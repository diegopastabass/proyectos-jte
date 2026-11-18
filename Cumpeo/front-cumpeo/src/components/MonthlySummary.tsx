import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./MonthlySummary.css";

interface Metric {
  value: number;
  time: string;
}

interface MonthlySummaryProps {
  baseUrl: string;
}

/** Unidades crudas del totalizador: décimas de m³. */
const TOTALIZADOR_DIV = 10;
const REFRESH_MS = 5 * 60 * 1000;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS_LONG = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Lunes = 0 … Domingo = 6 */
const weekdayOf = (y: number, m: number, d: number) =>
  (new Date(y, m, d).getDay() + 6) % 7;

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const fmtMinutes = (total: number) => {
  const minutes = Math.max(0, Math.round(total));
  return `${fmt(Math.floor(minutes / 60))} h ${pad(minutes % 60)} m`;
};

/** Fecha de hoy en Chile, independiente de la zona horaria del navegador. */
function todayInSantiago() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

/* ---------- Carga de datos ---------- */

interface MonthData {
  /** m³ por día del mes (1..N) */
  m3: Map<number, number>;
  /** minutos de operación por día */
  h1: Map<number, number>;
  h2: Map<number, number>;
}

async function fetchMetrics(url: string): Promise<Metric[]> {
  let lastError: unknown;
  // El primer cálculo de un mes puede fallar de forma transitoria en la API.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      if (!Array.isArray(json)) throw new Error("Respuesta inválida");
      return json as Metric[];
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastError;
}

const toDayMap = (
  list: Metric[],
  ym: string,
  divisor = 1,
): Map<number, number> => {
  const map = new Map<number, number>();
  for (const item of list) {
    if (typeof item.time !== "string" || item.time.slice(0, 7) !== ym) continue;
    const value = Number(item.value);
    if (Number.isFinite(value)) map.set(Number(item.time.slice(8, 10)), value / divisor);
  }
  return map;
};

const completedMonths = new Map<string, MonthData>();

async function loadMonth(baseUrl: string, y: number, m: number): Promise<MonthData> {
  const ym = monthKey(y, m);
  const cached = completedMonths.get(ym);
  if (cached) return cached;

  const today = todayInSantiago();
  const isPast = y < today.year || (y === today.year && m < today.month);
  const lastDay = isPast ? daysIn(y, m) : today.day;
  const query = `?start=${ym}-01&end=${ym}-${pad(lastDay)}`;

  const [tot, h1, h2] = await Promise.all([
    fetchMetrics(`${baseUrl}/totalizador${query}`),
    fetchMetrics(`${baseUrl}/horometro${query}`).catch(() => []),
    fetchMetrics(`${baseUrl}/horometro-pozo2${query}`).catch(() => []),
  ]);

  const data: MonthData = {
    m3: toDayMap(tot, ym, TOTALIZADOR_DIV),
    h1: toDayMap(h1, ym),
    h2: toDayMap(h2, ym),
  };
  if (isPast) completedMonths.set(ym, data);
  return data;
}

/* ---------- Escala del heatmap (azul secuencial, 5 niveles) ---------- */

const LEVEL_THRESHOLDS = [0.2, 0.4, 0.6, 0.8, 1];

const levelOf = (value: number, max: number) => {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  const idx = LEVEL_THRESHOLDS.findIndex((t) => ratio <= t);
  return (idx === -1 ? LEVEL_THRESHOLDS.length : idx + 1);
};

/* ---------- Componente ---------- */

interface Loaded {
  ym: string;
  cur: MonthData | null;
  prev: MonthData | null;
  error: string | null;
}

type View = "calendar" | "table";

export default function MonthlySummary({ baseUrl }: MonthlySummaryProps) {
  const today = todayInSantiago();
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [reloadTick, setReloadTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [view, setView] = useState<View>("calendar");
  const [picked, setPicked] = useState<number | null>(null);

  const { year, month } = cursor;
  const ym = monthKey(year, month);
  const isCurrent = year === today.year && month === today.month;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  useEffect(() => {
    let cancelled = false;
    loadMonth(baseUrl, year, month)
      .then(async (cur) => {
        const prev = await loadMonth(baseUrl, prevYear, prevMonth).catch(() => null);
        if (!cancelled) setLoaded({ ym, cur, prev, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Error desconocido";
        // En un refresco silencioso se conservan los datos ya mostrados.
        setLoaded((old) =>
          old && old.ym === ym ? old : { ym, cur: null, prev: null, error: message },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, year, month, prevYear, prevMonth, ym, reloadTick]);

  // Refresco automático sólo mientras se mira el mes en curso
  useEffect(() => {
    if (!isCurrent) return;
    const id = setInterval(() => setReloadTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, [isCurrent]);

  const loading = !loaded || loaded.ym !== ym;
  const data = loaded && loaded.ym === ym ? loaded : null;

  const stats = useMemo(() => {
    if (!data?.cur) return null;
    const { cur, prev } = data;
    const total = daysIn(year, month);
    const elapsed = isCurrent ? today.day : total;

    const days = Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      const future = day > elapsed;
      const value = future ? null : (cur.m3.get(day) ?? null);
      return {
        day,
        weekday: weekdayOf(year, month, day),
        future,
        value,
        minutes1: cur.h1.get(day) ?? 0,
        minutes2: cur.h2.get(day) ?? 0,
      };
    });

    const withData = days.filter((d) => d.value !== null);
    const sum = withData.reduce((acc, d) => acc + (d.value ?? 0), 0);
    const avg = withData.length > 0 ? sum / withData.length : 0;
    const active = withData.filter((d) => (d.value ?? 0) > 0);
    const max = active.reduce<(typeof days)[number] | null>(
      (best, d) => (best === null || (d.value ?? 0) > (best.value ?? 0) ? d : best),
      null,
    );
    const min = active.reduce<(typeof days)[number] | null>(
      (best, d) => (best === null || (d.value ?? 0) < (best.value ?? 0) ? d : best),
      null,
    );
    const idleDays = withData.length - active.length;

    const minutes1 = days.reduce((acc, d) => acc + d.minutes1, 0);
    const minutes2 = days.reduce((acc, d) => acc + d.minutes2, 0);
    // m³ / (minutos × 60 s) × 1000 l
    const avgFlow = minutes1 > 0 ? (sum * 1000) / (minutes1 * 60) : null;

    const projection = isCurrent && elapsed < total && withData.length > 0 ? avg * total : null;

    // Comparación justa: mismos días transcurridos del mes anterior
    let prevSame: number | null = null;
    if (prev && prev.m3.size > 0) {
      const limit = Math.min(elapsed, daysIn(prevYear, prevMonth));
      let sumPrev = 0;
      let activeDays = 0;
      for (let d = 1; d <= limit; d++) {
        const v = prev.m3.get(d) ?? 0;
        sumPrev += v;
        if (v > 0) activeDays++;
      }
      // Si el mes anterior casi no tuvo operación (corte de datos, puesta en marcha)
      // la comparación sería engañosa: no se muestra.
      if (activeDays >= limit * 0.6) prevSame = sumPrev;
    }
    const delta = prevSame && prevSame > 0 ? ((sum - prevSame) / prevSame) * 100 : null;

    const weekdayAvg = WEEKDAYS.map((_, wd) => {
      const list = withData.filter((d) => d.weekday === wd);
      return list.length > 0 ? list.reduce((a, d) => a + (d.value ?? 0), 0) / list.length : 0;
    });

    return {
      days,
      sum,
      avg,
      max,
      min,
      idleDays,
      minutes1,
      minutes2,
      avgFlow,
      projection,
      delta,
      weekdayAvg,
      dataDays: withData.length,
      peak: max?.value ?? 0,
    };
    // today.day sólo cambia con el mes en curso, que ya depende de reloadTick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, year, month, isCurrent, prevYear, prevMonth]);

  const goTo = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setPicked(null);
  };

  const exportExcel = () => {
    if (!stats) return;
    const rows = stats.days
      .filter((d) => d.value !== null)
      .map((d) => ({
        Fecha: `${ym}-${pad(d.day)}`,
        "Totalizador San Enrique 3 (m³)": Number((d.value ?? 0).toFixed(1)),
        "Horómetro San Enrique 3 (min)": d.minutes1,
        "Horómetro San Enrique 1 (min)": d.minutes2,
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen mensual");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), `Resumen_${ym}.xlsx`);
  };

  const selectedDay = stats
    ? (stats.days.find((d) => d.day === picked) ?? stats.max)
    : null;

  const title = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;
  const firstOffset = weekdayOf(year, month, 1);

  return (
    <section className="card msum" aria-label="Resumen mensual del totalizador">
      <div className="msum__head">
        <div>
          <h6 className="msum__title">Resumen mensual · Totalizador San Enrique 3</h6>
          <div className="msum__sub">Consumo diario de agua impulsada (m³)</div>
        </div>
        <div className="msum__nav">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => goTo(-1)}
            aria-label="Mes anterior"
          >
            <i className="bi bi-chevron-left" />
          </button>
          <span className="msum__month" aria-live="polite">
            {title}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => goTo(1)}
            disabled={isCurrent}
            aria-label="Mes siguiente"
          >
            <i className="bi bi-chevron-right" />
          </button>
          {!isCurrent && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                setCursor({ year: today.year, month: today.month });
                setPicked(null);
              }}
            >
              Mes actual
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="msum__state" role="status">
          <div className="spinner-border spinner-border-sm text-primary" />
          <span>Cargando {title}…</span>
        </div>
      )}

      {!loading && data?.error && (
        <div className="msum__state msum__state--error" role="alert">
          <span>No se pudo cargar el resumen ({data.error}).</span>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              setLoaded(null);
              setReloadTick((t) => t + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && stats && stats.dataDays === 0 && (
        <div className="msum__state">Sin registros del totalizador en {title}.</div>
      )}

      {!loading && stats && stats.dataDays > 0 && (
        <>
          <div className="msum__kpis">
            <Kpi
              label="Consumo del mes"
              value={fmt(stats.sum)}
              unit="m³"
              note={`${stats.dataDays} ${stats.dataDays === 1 ? "día" : "días"} con registro`}
              primary
            />
            <Kpi label="Promedio diario" value={fmt(stats.avg)} unit="m³/día" />
            {stats.max && (
              <Kpi
                label="Día de mayor consumo"
                value={fmt(stats.max.value ?? 0)}
                unit="m³"
                note={`${WEEKDAYS_LONG[stats.max.weekday]} ${stats.max.day}`}
              />
            )}
            {stats.min && stats.dataDays > 1 && (
              <Kpi
                label="Día de menor consumo"
                value={fmt(stats.min.value ?? 0)}
                unit="m³"
                note={`${WEEKDAYS_LONG[stats.min.weekday]} ${stats.min.day}`}
              />
            )}
            {stats.projection !== null && (
              <Kpi
                label="Proyección fin de mes"
                value={fmt(stats.projection)}
                unit="m³"
                note="según el promedio diario"
              />
            )}
            {stats.delta !== null && (
              <Kpi
                label="Vs. mes anterior"
                value={`${stats.delta >= 0 ? "▲" : "▼"} ${fmt(Math.abs(stats.delta), 1)}`}
                unit="%"
                note={
                  isCurrent
                    ? `mismos ${today.day} días de ${MONTHS[prevMonth]}`
                    : `total de ${MONTHS[prevMonth]}`
                }
              />
            )}
            <Kpi
              label="Horas de bombeo"
              value={fmtMinutes(stats.minutes1)}
              note={`San Enrique 1: ${fmtMinutes(stats.minutes2)}`}
            />
            {stats.avgFlow !== null && (
              <Kpi
                label="Caudal medio operando"
                value={fmt(stats.avgFlow, 1)}
                unit="l/s"
                note="San Enrique 3"
              />
            )}
          </div>

          <div className="msum__tools">
            <div className="btn-group btn-group-sm" role="group" aria-label="Vista">
              <button
                type="button"
                className={`btn ${view === "calendar" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setView("calendar")}
              >
                <i className="bi bi-calendar3" /> Calendario
              </button>
              <button
                type="button"
                className={`btn ${view === "table" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setView("table")}
              >
                <i className="bi bi-table" /> Tabla
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={exportExcel}
            >
              <i className="bi bi-file-earmark-excel" /> Exportar mes
            </button>
          </div>

          {view === "calendar" ? (
            <div className="msum__body">
              <div className="msum__calendar">
                <div className="msum__grid msum__grid--head" aria-hidden="true">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="msum__grid" role="grid" aria-label={`Calendario de ${title}`}>
                  {Array.from({ length: firstOffset }, (_, i) => (
                    <span key={`blank-${i}`} className="msum__cell msum__cell--blank" />
                  ))}
                  {stats.days.map((d) => {
                    const level = d.value === null ? -1 : levelOf(d.value, stats.peak);
                    const isMax = stats.max?.day === d.day;
                    const label =
                      d.value === null
                        ? d.future
                          ? "sin datos aún"
                          : "sin registro"
                        : `${fmt(d.value)} m³`;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        disabled={d.value === null}
                        className={`msum__cell msum__cell--l${level < 0 ? "x" : level}${
                          isMax ? " is-max" : ""
                        }${selectedDay?.day === d.day ? " is-picked" : ""}${
                          isCurrent && d.day === today.day ? " is-today" : ""
                        }`}
                        aria-label={`${WEEKDAYS_LONG[d.weekday]} ${d.day} de ${MONTHS[month]}: ${label}`}
                        onMouseEnter={() => d.value !== null && setPicked(d.day)}
                        onFocus={() => d.value !== null && setPicked(d.day)}
                        onClick={() => d.value !== null && setPicked(d.day)}
                      >
                        <span className="msum__day">{d.day}</span>
                        {d.value !== null && (
                          <span className="msum__val">
                            {isMax && <i className="bi bi-caret-up-fill" aria-hidden="true" />}
                            {fmt(d.value)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="msum__legend" aria-label="Leyenda de intensidad">
                  <span>Menos</span>
                  <span className="msum__swatch msum__cell--l0" title="Sin consumo" />
                  {LEVEL_THRESHOLDS.map((t, i) => (
                    <span
                      key={t}
                      className={`msum__swatch msum__cell--l${i + 1}`}
                      title={`hasta ${fmt(stats.peak * t)} m³`}
                    />
                  ))}
                  <span>Más</span>
                  <span className="msum__legend-scale">
                    0 – {fmt(stats.peak)} m³ · <i className="bi bi-caret-up-fill" /> máximo del mes
                  </span>
                </div>

                {selectedDay && selectedDay.value !== null && (
                  <div className="msum__detail" aria-live="polite">
                    <strong>
                      {WEEKDAYS_LONG[selectedDay.weekday]} {selectedDay.day} de {MONTHS[month]}
                    </strong>
                    <span>{fmt(selectedDay.value, 1)} m³</span>
                    <span>
                      {stats.peak > 0 ? fmt((selectedDay.value / stats.peak) * 100) : 0}% del máximo
                    </span>
                    <span>SE3 {fmtMinutes(selectedDay.minutes1)}</span>
                    <span>SE1 {fmtMinutes(selectedDay.minutes2)}</span>
                  </div>
                )}
              </div>

              <aside className="msum__side">
                <h6 className="msum__side-title">Promedio por día de la semana</h6>
                {(() => {
                  const top = Math.max(...stats.weekdayAvg, 1);
                  return (
                    <ul className="msum__bars">
                      {stats.weekdayAvg.map((v, i) => (
                        <li key={WEEKDAYS[i]}>
                          <span className="msum__bar-label">{WEEKDAYS[i]}</span>
                          <span className="msum__bar-track">
                            <span
                              className="msum__bar-fill"
                              style={{ width: `${(v / top) * 100}%` }}
                            />
                          </span>
                          <span className="msum__bar-value">{fmt(v)} m³</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                {stats.idleDays > 0 && (
                  <p className="msum__note">
                    {stats.idleDays} {stats.idleDays === 1 ? "día" : "días"} sin consumo registrado.
                  </p>
                )}
              </aside>
            </div>
          ) : (
            <div className="table-responsive msum__table">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th className="text-end">Totalizador (m³)</th>
                    <th className="text-end">Bombeo SE3</th>
                    <th className="text-end">Bombeo SE1</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.days
                    .filter((d) => !d.future)
                    .map((d) => (
                      <tr key={d.day}>
                        <td>
                          {WEEKDAYS[d.weekday]} {d.day}
                        </td>
                        <td className="text-end">{d.value === null ? "—" : fmt(d.value, 1)}</td>
                        <td className="text-end">{fmtMinutes(d.minutes1)}</td>
                        <td className="text-end">{fmtMinutes(d.minutes2)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th className="text-end">{fmt(stats.sum, 1)}</th>
                    <th className="text-end">{fmtMinutes(stats.minutes1)}</th>
                    <th className="text-end">{fmtMinutes(stats.minutes2)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  primary?: boolean;
}

function Kpi({ label, value, unit, note, primary }: KpiProps) {
  return (
    <div className={`msum__kpi${primary ? " msum__kpi--primary" : ""}`}>
      <span className="msum__kpi-label">{label}</span>
      <span className="msum__kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {note && <span className="msum__kpi-note">{note}</span>}
    </div>
  );
}
