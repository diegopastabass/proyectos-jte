import type {
  DailyRow,
  ElectricConfig,
  Finding,
  Metric,
  RawSeries,
  Sample,
  Severity,
} from "../types";
import { santiagoDay, santiagoHour, utcDay } from "./time";

// ---------- Constantes de ingeniería (referencias típicas, ajustar con el cliente)
export const RUN_THRESHOLD_A = 1; // corriente promedio sobre la cual la bomba "opera"
export const V_OK_PCT = 6; // ± % respecto a la tensión nominal
export const V_WARN_PCT = 10;
export const V_UNBALANCE_WARN = 2; // % (NEMA MG-1)
export const I_UNBALANCE_WARN = 10; // %
export const SAMPLE_MIN = 5; // minutos entre muestras
const BUCKET_MS = SAMPLE_MIN * 60 * 1000;
const MAX_GAP_MS = 2 * BUCKET_MS; // sobre esto se considera pérdida de datos

// Escalas del PLC (mismas que usa el dashboard original)
export const V_DIV = 10;
export const I_DIV = 100;
export const P_DIV = 10;

// ---------- Utilidades
export const clamp = (x: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, x));

export const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// Desbalance según NEMA: máxima desviación respecto al promedio / promedio
export const unbalancePct = (xs: number[]): number => {
  const avg = mean(xs);
  if (avg <= 0) return 0;
  return (Math.max(...xs.map((x) => Math.abs(x - avg))) / avg) * 100;
};

export const voltageDeviationPct = (v: number, nominal: number) =>
  ((v - nominal) / nominal) * 100;

export const voltageSeverity = (v: number, nominal: number): Severity => {
  const dev = Math.abs(voltageDeviationPct(v, nominal));
  if (dev <= V_OK_PCT) return "ok";
  if (dev <= V_WARN_PCT) return "warn";
  return "bad";
};

// ---------- Construcción de muestras alineadas
export const buildSamples = (raw: RawSeries): Sample[] => {
  type Partial = {
    v: (number | undefined)[];
    i: (number | undefined)[];
    q?: number;
    p?: number;
  };
  const buckets = new Map<number, Partial>();
  const get = (time: string) => {
    const key = Math.round(new Date(time).getTime() / BUCKET_MS);
    let b = buckets.get(key);
    if (!b) {
      b = { v: [], i: [] };
      buckets.set(key, b);
    }
    return b;
  };

  (["v1", "v2", "v3"] as const).forEach((k, idx) =>
    raw.voltaje[k].forEach((m: Metric) => {
      get(m.time).v[idx] = m.value / V_DIV;
    }),
  );
  (["i1", "i2", "i3"] as const).forEach((k, idx) =>
    raw.corriente[k].forEach((m: Metric) => {
      get(m.time).i[idx] = m.value / I_DIV;
    }),
  );
  raw.caudal.forEach((m) => (get(m.time).q = m.value));
  raw.presion.forEach((m) => (get(m.time).p = m.value / P_DIV));

  const samples: Sample[] = [];
  for (const [key, b] of buckets) {
    // Los arreglos pueden quedar con huecos: se valida cada fase por índice
    const phases = [0, 1, 2];
    if (phases.some((k) => b.v[k] === undefined || b.i[k] === undefined))
      continue;
    const v = phases.map((k) => b.v[k] as number) as [number, number, number];
    const i = phases.map((k) => b.i[k] as number) as [number, number, number];
    const t = key * BUCKET_MS;
    const iAvg = mean(i);
    samples.push({
      t,
      day: santiagoDay(t),
      dayUtc: utcDay(t),
      hour: santiagoHour(t),
      v,
      i,
      iAvg,
      kva: (v[0] * i[0] + v[1] * i[1] + v[2] * i[2]) / 1000,
      running: iAvg > RUN_THRESHOLD_A,
      q: b.q ?? null,
      p: b.p ?? null,
    });
  }
  return samples.sort((a, b) => a.t - b.t);
};

// ---------- Eventos
// Cuenta transiciones detenida → operando entre muestras consecutivas
export const countStarts = (samples: Sample[]): number => {
  let n = 0;
  for (let k = 1; k < samples.length; k++) {
    const prev = samples[k - 1];
    const cur = samples[k];
    if (cur.t - prev.t > MAX_GAP_MS) continue;
    if (!prev.running && cur.running) n++;
  }
  return n;
};

export interface VoltageEvents {
  count: number;
  minutes: number;
  worstPct: number;
}

// Excursiones continuas fuera de la banda verde de tensión
export const voltageEvents = (
  samples: Sample[],
  nominal: number,
): VoltageEvents => {
  let count = 0;
  let minutes = 0;
  let worst = 0;
  let inEvent = false;
  for (const s of samples) {
    const dev = Math.max(
      ...s.v.map((v) => Math.abs(voltageDeviationPct(v, nominal))),
    );
    const out = dev > V_OK_PCT;
    if (out) {
      minutes += SAMPLE_MIN;
      worst = Math.max(worst, dev);
      if (!inEvent) count++;
    }
    inEvent = out;
  }
  return { count, minutes, worstPct: worst };
};

// ---------- Referencia de operación normal
export interface Baseline {
  iAvg: number;
  q: number | null;
  p: number | null;
  kva: number;
}

export const computeBaseline = (samples: Sample[]): Baseline | null => {
  const run = samples.filter((s) => s.running);
  if (run.length < 12) return null;
  const qs = run.filter((s) => s.q !== null && s.q > 0.1).map((s) => s.q!);
  const ps = run.filter((s) => s.p !== null).map((s) => s.p!);
  return {
    iAvg: median(run.map((s) => s.iAvg)),
    q: qs.length ? median(qs) : null,
    p: ps.length ? median(ps) : null,
    kva: median(run.map((s) => s.kva)),
  };
};

// ---------- Resumen diario (une series crudas con los diarios del API)
const byDate = (xs: Metric[]) =>
  new Map(xs.map((m) => [m.time.split("T")[0], m.value]));

export const buildDailyRows = (
  samples: Sample[],
  kwh: Metric[],
  horometro: Metric[],
  totalizador: Metric[],
  cfg: ElectricConfig,
): DailyRow[] => {
  const kwhMap = byDate(kwh);
  const horoMap = byDate(horometro);
  const m3Map = byDate(totalizador);

  // Los diarios del API se agrupan por día UTC → se usa la misma agrupación
  const samplesByDay = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = samplesByDay.get(s.dayUtc) ?? [];
    arr.push(s);
    samplesByDay.set(s.dayUtc, arr);
  }

  const dates = [...new Set([...kwhMap.keys(), ...horoMap.keys()])].sort();
  return dates.map((date) => {
    const horas = (horoMap.get(date) ?? 0) / 60;
    const m3 = m3Map.get(date) ?? 0;
    const energy = (kwhMap.get(date) ?? 0) * cfg.kwhFactor;
    const day = samplesByDay.get(date) ?? [];
    const run = day.filter((s) => s.running);
    // kVAh con datos completos del día; si faltan muestras no se infiere FP
    const complete = day.length >= 0.9 * ((24 * 60) / SAMPLE_MIN);
    const kvah = day.reduce((a, s) => a + (s.kva * SAMPLE_MIN) / 60, 0);
    return {
      date,
      horas,
      m3,
      kwh: energy,
      kwhPorM3: m3 > 0 ? energy / m3 : null,
      costo: energy * cfg.tarifaClpKwh,
      arranques: countStarts(day),
      // Percentil 95: una lectura aislada con una fase en 0 no debe definir el día
      desbalanceI: run.length ? percentile(run.map((s) => unbalancePct(s.i)), 95) : null,
      desbalanceV: day.length ? percentile(day.map((s) => unbalancePct(s.v)), 95) : null,
      fpImplicito: complete && kvah > 0 ? energy / kvah : null,
    };
  });
};

// ---------- Salud del equipo
export interface HealthItem {
  key: string;
  label: string;
  score: number;
  detail: string;
}

export interface Health {
  total: number;
  severity: Severity;
  label: string;
  items: HealthItem[];
}

export const computeHealth = (
  last24h: Sample[],
  rows: DailyRow[],
  cfg: ElectricConfig,
): Health => {
  const run = last24h.filter((s) => s.running);

  // Tensión: % del tiempo dentro de la banda verde
  const vOk = last24h.length
    ? (last24h.filter((s) =>
        s.v.every((v) => voltageSeverity(v, cfg.vNominal) === "ok"),
      ).length /
        last24h.length) *
      100
    : 100;

  // Balance de corriente: 1 % → 100 pts; ≥10 % → 0 pts
  const uI = run.length ? mean(run.map((s) => unbalancePct(s.i))) : 0;
  const balance = clamp(100 - ((uI - 1) / 9) * 100);

  // Arranques: ≤6/día → 100 pts; ≥20/día → 0 pts
  const starts = countStarts(last24h);
  const startScore = clamp(100 - ((starts - 6) / 14) * 100);

  // Eficiencia: kWh/m³ del último día cerrado vs mediana de la ventana
  const eff = rows.filter((r) => r.kwhPorM3 !== null && r.m3 > 20);
  const lastEff = eff.length > 1 ? eff[eff.length - 2] : undefined;
  const refEff = median(eff.map((r) => r.kwhPorM3!));
  const effDelta =
    lastEff && refEff > 0 ? (lastEff.kwhPorM3! / refEff - 1) * 100 : 0;
  const effScore = clamp(100 - (Math.max(0, effDelta) / 20) * 100);

  // Carga: corriente de operación vs corriente de placa
  const iRun = run.length ? mean(run.map((s) => s.iAvg)) : 0;
  const loadPct = (iRun / cfg.iNominal) * 100;
  const loadScore = clamp(100 - ((Math.max(0, loadPct) - 100) / 25) * 100);

  const items: HealthItem[] = [
    {
      key: "v",
      label: "Tensión",
      score: vOk,
      detail: `${vOk.toFixed(0)} % del tiempo en banda`,
    },
    {
      key: "bal",
      label: "Balance de fases",
      score: balance,
      detail: `Desbalance medio ${uI.toFixed(1)} %`,
    },
    {
      key: "st",
      label: "Arranques",
      score: startScore,
      detail: `${starts} en 24 h`,
    },
    {
      key: "ef",
      label: "Eficiencia",
      score: effScore,
      detail: `${effDelta >= 0 ? "+" : ""}${effDelta.toFixed(1)} % vs mediana`,
    },
    {
      key: "ld",
      label: "Carga del motor",
      score: loadScore,
      detail: iRun ? `${loadPct.toFixed(0)} % de la corriente de placa` : "Sin operación",
    },
  ];
  const weights = [0.25, 0.25, 0.15, 0.2, 0.15];
  const total = items.reduce((a, it, k) => a + it.score * weights[k], 0);
  const severity: Severity = total >= 85 ? "ok" : total >= 65 ? "warn" : "bad";
  return {
    total,
    severity,
    label: severity === "ok" ? "Óptimo" : severity === "warn" ? "Atención" : "Crítico",
    items,
  };
};

// ---------- Diagnóstico por cruce de variables
export const computeFindings = (
  samples: Sample[],
  baseline: Baseline | null,
  rows: DailyRow[],
  cfg: ElectricConfig,
): Finding[] => {
  const findings: Finding[] = [];
  const lastRun = [...samples].reverse().find((s) => s.running);
  const recent = samples.filter((s) => s.t >= (samples.at(-1)?.t ?? 0) - 24 * 3600 * 1000);

  if (lastRun) {
    const loadPct = (lastRun.iAvg / cfg.iNominal) * 100;
    if (loadPct > 110) {
      findings.push({
        severity: loadPct > 125 ? "bad" : "warn",
        title: "Sobrecarga del motor",
        detail: `Corriente de operación al ${loadPct.toFixed(0)} % de la corriente de placa.`,
      });
    }

    if (baseline) {
      const q = lastRun.q;
      if (q !== null && baseline.q && q < baseline.q * 0.85 && lastRun.iAvg >= baseline.iAvg * 0.95) {
        findings.push({
          severity: "warn",
          title: "Posible obstrucción o desgaste",
          detail: `Corriente normal (${lastRun.iAvg.toFixed(1)} A) con caudal bajo (${q.toFixed(2)} l/s vs ${baseline.q.toFixed(2)} l/s habitual).`,
        });
      }
      if (lastRun.iAvg < baseline.iAvg * 0.6) {
        findings.push({
          severity: "bad",
          title: "Baja carga / posible marcha en seco",
          detail: `Corriente ${lastRun.iAvg.toFixed(1)} A, muy bajo la referencia de ${baseline.iAvg.toFixed(1)} A.`,
        });
      }
      if (lastRun.p !== null && baseline.p && lastRun.p < baseline.p * 0.8) {
        findings.push({
          severity: "warn",
          title: "Presión de impulsión baja",
          detail: `${lastRun.p.toFixed(1)} bar vs ${baseline.p.toFixed(1)} bar habitual.`,
        });
      }
    }

    const uI = unbalancePct(lastRun.i);
    if (uI > I_UNBALANCE_WARN) {
      findings.push({
        severity: uI > 15 ? "bad" : "warn",
        title: "Desbalance de corriente",
        detail: `${uI.toFixed(1)} % entre fases (límite recomendado ${I_UNBALANCE_WARN} %).`,
      });
    }
  }

  const lastSample = samples.at(-1);
  if (lastSample) {
    const uV = unbalancePct(lastSample.v);
    if (uV > V_UNBALANCE_WARN) {
      findings.push({
        severity: uV > 3.5 ? "bad" : "warn",
        title: "Desbalance de tensión",
        detail: `${uV.toFixed(1)} % entre fases (límite recomendado ${V_UNBALANCE_WARN} %).`,
      });
    }
  }

  const ev = voltageEvents(recent, cfg.vNominal);
  if (ev.count > 0) {
    findings.push({
      severity: ev.worstPct > V_WARN_PCT ? "bad" : "warn",
      title: "Tensión fuera de banda",
      detail: `${ev.count} evento(s) en 24 h, ${ev.minutes} min acumulados (máx. ${ev.worstPct.toFixed(1)} % de desvío).`,
    });
  }

  const startsToday = rows.at(-1)?.arranques ?? 0;
  if (startsToday > 12) {
    findings.push({
      severity: startsToday > 20 ? "bad" : "warn",
      title: "Exceso de arranques",
      detail: `${startsToday} arranques hoy (resolución de 5 min). Cada partida somete al motor a corrientes de arranque.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "ok",
      title: "Sin hallazgos",
      detail: "Las variables eléctricas están dentro de los rangos esperados.",
    });
  }
  return findings;
};

// ---------- Reducción de puntos para gráficos de ventanas largas
export const downsample = <T extends { t: number }>(
  xs: T[],
  maxPoints: number,
  reduce: (bucket: T[]) => T,
): T[] => {
  if (xs.length <= maxPoints) return xs;
  const size = Math.ceil(xs.length / maxPoints);
  const out: T[] = [];
  for (let k = 0; k < xs.length; k += size) {
    out.push(reduce(xs.slice(k, k + size)));
  }
  return out;
};
