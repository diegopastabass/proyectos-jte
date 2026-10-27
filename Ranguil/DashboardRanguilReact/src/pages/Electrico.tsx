import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Loading from "./Loading";
import Error from "./Error";
import ExportModal from "../components/ExportModal";
import SettingsModal from "../electrico/components/SettingsModal";
import KpiCard from "../electrico/components/KpiCard";
import SingleLine from "../electrico/components/SingleLine";
import HealthScore from "../electrico/components/HealthScore";
import DiagnosticsCard from "../electrico/components/DiagnosticsCard";
import VoltageGauges from "../electrico/components/VoltageGauges";
import CurrentBalance from "../electrico/components/CurrentBalance";
import ScatterCard from "../electrico/components/ScatterCard";
import TrendChart from "../electrico/components/TrendChart";
import EfficiencyChart from "../electrico/components/EfficiencyChart";
import HeatmapCard from "../electrico/components/HeatmapCard";
import DailySummaryTable from "../electrico/components/DailySummaryTable";
import { fetchWithCache } from "../components/fetchWithcache";
import logoJte from "../assets/logoJte.png";
import { DIVISOR_NIVEL_NUEVO, NIVEL_MAX_M } from "../config/estanques";
import { fetchRawSeries } from "../electrico/lib/api";
import {
  I_DIV,
  RUN_THRESHOLD_A,
  V_DIV,
  buildDailyRows,
  buildSamples,
  computeBaseline,
  computeFindings,
  computeHealth,
  mean,
  median,
} from "../electrico/lib/electrical";
import { loadConfig, saveConfig } from "../electrico/lib/config";
import type {
  ElectricConfig,
  Metric,
  RawSeries,
  Snapshot,
} from "../electrico/types";
import "../electrico/electrico.css";

const money = (x: number) => `$${Math.round(x).toLocaleString("es-CL")}`;

// Variación % del último valor contra el promedio de los anteriores
const trendVsAverage = (xs: number[]): number | null => {
  if (xs.length < 3) return null;
  const prev = xs.slice(0, -1);
  const avg = mean(prev);
  return avg > 0 ? (xs[xs.length - 1] / avg - 1) * 100 : null;
};

function Electrico() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);
  const [raw, setRaw] = useState<RawSeries | null>(null);
  const [kwh, setKwh] = useState<Metric[]>([]);
  const [horometro, setHorometro] = useState<Metric[]>([]);
  const [totalizador, setTotalizador] = useState<Metric[]>([]);

  const [config, setConfig] = useState<ElectricConfig>(loadConfig);
  const [isOpenExport, setIsOpenExport] = useState(false);
  const [isOpenSettings, setIsOpenSettings] = useState(false);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const fetchData = async () => {
      // Se recalcula en cada ciclo para que la ventana de 15 días avance
      const end = formatter.format(new Date());
      try {
        const [snapshotRes, rawSeries, kwhData, horometroData, totalizadorData] =
          await Promise.all([
            fetch("https://app.jteanalytics.cl/ranguil/snapshot"),
            fetchRawSeries(),
            fetchWithCache("kwh", end),
            fetchWithCache("horometro", end),
            fetchWithCache("totalizador", end),
          ]);

        setData(await snapshotRes.json());
        setRaw(rawSeries);
        setKwh(kwhData);
        setHorometro(horometroData);
        setTotalizador(totalizadorData);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, []);

  const samples = useMemo(() => (raw ? buildSamples(raw) : []), [raw]);

  const analysis = useMemo(() => {
    const lastT = samples.at(-1)?.t ?? 0;
    const last24h = samples.filter((s) => s.t >= lastT - 24 * 3600 * 1000);
    const rows = buildDailyRows(samples, kwh, horometro, totalizador, config);
    const baseline = computeBaseline(samples);
    return {
      rows,
      baseline,
      health: computeHealth(last24h, rows, config),
      findings: computeFindings(samples, baseline, rows, config),
      lastRun: [...samples].reverse().find((s) => s.running) ?? null,
    };
  }, [samples, kwh, horometro, totalizador, config]);

  const handleSaveConfig = (next: ElectricConfig) => {
    saveConfig(next);
    setConfig(next);
    setIsOpenSettings(false);
  };

  if (loading) return <Loading />;
  if (!data) return <Error />;

  const { rows, baseline, health, findings, lastRun } = analysis;
  const snap = data.snapshot;

  // ----- Estado en vivo desde el snapshot
  const vLive = [snap.v1.value, snap.v2.value, snap.v3.value].map(
    (x) => x / V_DIV,
  ) as [number, number, number];
  const iLive = [snap.i1.value, snap.i2.value, snap.i3.value].map(
    (x) => x / I_DIV,
  ) as [number, number, number];
  const iLiveAvg = mean(iLive);
  const running = iLiveAvg > RUN_THRESHOLD_A;
  const kvaLive =
    (vLive[0] * iLive[0] + vLive[1] * iLive[1] + vLive[2] * iLive[2]) / 1000;

  // ----- KPIs. Los acumulados diarios se comparan sobre el último día cerrado,
  // porque el día en curso está incompleto y distorsiona la tendencia.
  const today = rows.at(-1);
  const closed = rows.slice(0, -1);
  const yday = closed.at(-1);
  const kwhM3Series = rows.filter((r) => r.kwhPorM3 !== null && r.m3 > 5);
  const kwhM3Today = kwhM3Series.at(-1)?.kwhPorM3 ?? null;
  const costClosedAvg = closed.length ? mean(closed.map((r) => r.costo)) : 0;
  const m3PerHour = rows.map((r) => (r.horas > 0.1 ? r.m3 / r.horas : 0));

  const trendUtil = trendVsAverage(closed.map((r) => r.horas));
  const trendCost = trendVsAverage(closed.map((r) => r.costo));
  const trendKwhM3 = trendVsAverage(kwhM3Series.map((r) => r.kwhPorM3 as number));
  const trendM3h = trendVsAverage(m3PerHour);
  const trendStarts = trendVsAverage(closed.map((r) => r.arranques));

  // En operación se muestran las corrientes en vivo; detenida, la última jornada con carga
  const balanceBase = lastRun ?? samples.at(-1) ?? null;
  const balanceSample =
    running && balanceBase ? { ...balanceBase, i: iLive } : lastRun;

  return (
    <div className="electrico">
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar
            text={snap.caudal.time}
            actions={[
              {
                key: "agua",
                label: "Diagrama de agua",
                icon: "bi-droplet",
                to: "/ranguil/",
              },
              {
                key: "parametros",
                label: "Parámetros del análisis",
                icon: "bi-gear",
                onClick: () => setIsOpenSettings(true),
              },
              {
                key: "exportar",
                label: "Exportar a Excel",
                icon: "bi-save",
                onClick: () => setIsOpenExport(true),
              },
            ]}
          />
        </div>

        <div
          className="flex-grow-1 w-100 px-3"
          style={{ maxWidth: "2400px" }}
        >
          {/* Encabezado */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h4 className="mb-0">Monitoreo Eléctrico</h4>
              <span className="text-body-secondary small">
                Análisis de variables eléctricas y eficiencia de la impulsión
              </span>
            </div>
          </div>

          {/* KPIs */}
          <div className="row g-3 row-cols-2 row-cols-md-3 row-cols-xl-6 mb-3">
            <div className="col">
              <KpiCard
                icon="bi-droplet-half"
                title="Consumo específico"
                value={kwhM3Today === null ? "—" : kwhM3Today.toFixed(3)}
                unit="kWh/m³"
                sub="Día en curso vs. prom."
                trendPct={trendKwhM3}
                goodWhen="down"
                spark={kwhM3Series.map((r) => r.kwhPorM3 as number)}
              />
            </div>
            <div className="col">
              <KpiCard
                icon="bi-cash-coin"
                title="Costo energético ayer"
                value={money(yday?.costo ?? 0)}
                sub={`Hoy ${money(today?.costo ?? 0)} · mes ~${money(costClosedAvg * 30)}`}
                trendPct={trendCost}
                goodWhen="down"
                spark={closed.map((r) => r.costo)}
              />
            </div>
            <div className="col">
              <KpiCard
                icon="bi-clock-history"
                title="Utilización ayer"
                value={(yday?.horas ?? 0).toFixed(1)}
                unit="h"
                sub={`${(((yday?.horas ?? 0) / 24) * 100).toFixed(0)} % del día · hoy ${(today?.horas ?? 0).toFixed(1)} h`}
                trendPct={trendUtil}
                spark={closed.map((r) => r.horas)}
              />
            </div>
            <div className="col">
              <KpiCard
                icon="bi-speedometer2"
                title="Productividad"
                value={(m3PerHour.at(-1) ?? 0).toFixed(1)}
                unit="m³/h"
                sub={`Mediana ${median(m3PerHour.filter((x) => x > 0)).toFixed(1)} m³/h`}
                trendPct={trendM3h}
                goodWhen="up"
                spark={m3PerHour}
              />
            </div>
            <div className="col">
              <KpiCard
                icon="bi-power"
                title="Arranques ayer"
                value={String(yday?.arranques ?? 0)}
                sub={`Hoy ${today?.arranques ?? 0} · resolución 5 min`}
                trendPct={trendStarts}
                goodWhen="down"
                spark={closed.map((r) => r.arranques)}
              />
            </div>
            <div className="col">
              <KpiCard
                icon="bi-lightning-charge"
                title="Potencia aparente"
                value={running ? kvaLive.toFixed(1) : "0.0"}
                unit="kVA"
                sub={running ? `${iLiveAvg.toFixed(1)} A promedio` : "Bomba detenida"}
              />
            </div>
          </div>

          {/* Unifilar + salud + diagnóstico */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-xl-6">
              <SingleLine
                running={running}
                falla={snap.falla.value === 1}
                vAvg={mean(vLive)}
                iAvg={iLiveAvg}
                kva={kvaLive}
                caudal={snap.caudal.value}
                presion={snap.presion.value / 10}
                nivel={snap.estanque.value / DIVISOR_NIVEL_NUEVO}
                nivelMax={NIVEL_MAX_M}
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <HealthScore health={health} />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <DiagnosticsCard findings={findings} />
            </div>
          </div>

          {/* Tensión / corriente / curva de operación */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-6 col-xl-4">
              <VoltageGauges v={vLive} nominal={config.vNominal} />
            </div>
            <div className="col-12 col-lg-6 col-xl-4">
              <CurrentBalance
                sample={balanceSample}
                live={running}
                iNominal={config.iNominal}
              />
            </div>
            <div className="col-12 col-xl-4">
              <ScatterCard samples={samples} baseline={baseline} />
            </div>
          </div>

          {/* Tendencias */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-xl-7">
              <TrendChart samples={samples} vNominal={config.vNominal} />
            </div>
            <div className="col-12 col-xl-5">
              <EfficiencyChart rows={rows} />
            </div>
          </div>

          {/* Mapa de calor */}
          <div className="mb-3">
            <HeatmapCard samples={samples} />
          </div>

          {/* Resumen diario */}
          <div className="mb-3">
            <DailySummaryTable rows={rows} />
          </div>
        </div>

        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img src={logoJte} alt="logo" width={40} height={24} />
        </footer>
      </div>

      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
      {isOpenSettings && (
        <SettingsModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setIsOpenSettings(false)}
        />
      )}
    </div>
  );
}

export default Electrico;
