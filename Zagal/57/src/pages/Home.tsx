import { useCallback, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import StatTile, { Delta } from "../components/StatTile";
import SectorTable from "../components/SectorTable";
import ParcelaMapa from "../components/ParcelaMapa";
import DailyChart, { type DailyMetric } from "../components/DailyChart";
import HeatMap from "../components/RiegoHeatMap";
import SectorSummaryTable, { CAUDAL_ALERT } from "../components/SectorSummaryTable";
import ExportHistorial from "../components/ExportHistorial";
import Loading from "./Loading";
import lgJte from "../assets/logoJte.png";
import { MIN_MONTH, SECTOR_IDS } from "../config";
import { useLiveData } from "../hooks/useLiveData";
import { useSummaryMonths } from "../hooks/useSummaryMonths";
import {
  addMonths,
  daysInMonth,
  monthEnd,
  monthLabel,
  monthOf,
  monthStart,
  MONTH_NAMES,
  todayChile,
} from "../lib/dates";
import { formatDelta, formatDuration, formatHours, formatNumber } from "../lib/format";
import {
  ALL_SECTORS,
  comparisonRange,
  dailySeries,
  filterRows,
  lastIrrigationBySector,
  ratioDelta,
  sectorSummaries,
  staleSectors,
  totals,
} from "../lib/metrics";
import { SECTORS, sectorLabel } from "../lib/sectors";

function Spinner() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5 text-muted">
      <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando…
    </div>
  );
}

function Home() {
  const today = todayChile();
  const currentMonth = monthOf(today);

  const { data: live, error: liveError, refreshing } = useLiveData();

  const [month, setMonth] = useState(currentMonth);
  const [sector, setSector] = useState(ALL_SECTORS);
  const [chartMetric, setChartMetric] = useState<DailyMetric>("hours");

  const prevMonth = addMonths(month, -1);
  // Mes elegido + su anterior (comparación) + los 3 últimos meses (último riego por sector)
  const months = [month, prevMonth, currentMonth, addMonths(currentMonth, -1), addMonths(currentMonth, -2)].filter(
    (m) => m >= MIN_MONTH,
  );
  const { data: summary, error: summaryError } = useSummaryMonths(months);

  const toggleSector = useCallback(
    (id: string) => setSector((s) => (s === id ? ALL_SECTORS : id)),
    [],
  );

  // ---------------- En vivo ----------------
  const intervals = useMemo(() => live?.intervals ?? [], [live]);
  const activeSectors = intervals.filter((i) => i.is_active === 1);
  const todayTotals = totals(filterRows(summary[currentMonth] ?? [], ALL_SECTORS, today, today));
  const sectorsToday = new Set(
    filterRows(summary[currentMonth] ?? [], ALL_SECTORS, today, today)
      .filter((r) => r.value >= 60)
      .map((r) => r.mt_name),
  ).size;

  const recentRows = [0, -1, -2].flatMap((d) => summary[addMonths(currentMonth, d)] ?? []);
  const lastIrrigation = lastIrrigationBySector(recentRows);
  activeSectors.forEach((i) => (lastIrrigation[i.mt_name] = today));
  const stale = staleSectors(SECTOR_IDS, lastIrrigation, today);

  // ---------------- Historial ----------------
  const isCurrent = month === currentMonth;
  const lastDay = isCurrent ? today : monthEnd(month);
  const monthLoaded = month in summary;
  const allMonthRows = filterRows(summary[month] ?? [], ALL_SECTORS, monthStart(month), lastDay);
  const monthRows = sector === ALL_SECTORS ? allMonthRows : allMonthRows.filter((r) => r.mt_name === sector);

  const cmp = comparisonRange(month, prevMonth, lastDay);
  const hasPrev = prevMonth >= MIN_MONTH;
  const allPrevRows = filterRows(summary[prevMonth] ?? [], ALL_SECTORS, cmp.from, cmp.to);
  const prevRows = sector === ALL_SECTORS ? allPrevRows : allPrevRows.filter((r) => r.mt_name === sector);

  const cur = totals(monthRows);
  const prev = totals(prevRows);
  const comparisonLabel = !hasPrev
    ? "del mes anterior"
    : isCurrent
      ? `vs. 1–${Number(cmp.to.slice(8, 10))} de ${MONTH_NAMES[Number(prevMonth.slice(5, 7)) - 1].toLowerCase()}`
      : `vs. ${monthLabel(prevMonth).toLowerCase()}`;
  const delta = (a: number, b: number) => (hasPrev && prevMonth in summary ? ratioDelta(a, b) : null);

  const points = dailySeries(monthRows, month, lastDay);
  const bySector = sectorSummaries(SECTOR_IDS, allMonthRows, allPrevRows);
  const caudalAlerts = bySector.filter((r) => r.caudalDelta !== null && Math.abs(r.caudalDelta) >= CAUDAL_ALERT);
  const scopeLabel = sector === ALL_SECTORS ? "Toda la parcela" : sectorLabel(sector);
  const elapsedDays = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month);

  const monthOptions: string[] = [];
  for (let m = currentMonth; m >= MIN_MONTH; m = addMonths(m, -1)) monthOptions.push(m);

  if (!live && !liveError) return <Loading />;

  return (
    <div className="dash">
      <Navbar lastUpdate={live?.lastUpdate} refreshing={refreshing} />

      {liveError && (
        <div className="alert alert-warning mt-3 mb-0 py-2 small" role="status">
          <i className="bi bi-wifi-off me-2" aria-hidden="true" />
          {liveError}.{" "}
          {live
            ? `Se muestran los últimos datos guardados (${new Date(live.fetchedAt).toLocaleTimeString("es-CL", { timeStyle: "short" })}).`
            : "Se reintentará automáticamente."}
        </div>
      )}

      {/* ======================= EN VIVO ======================= */}
      <div className="dash-section-title">
        <h2>En vivo</h2>
        <small>Se actualiza cada 2 minutos</small>
      </div>

      <div className="kpi-row kpi-row--5">
        <StatTile
          label="Caudal actual"
          icon="bi-droplet-half"
          value={live?.metric ? formatNumber(live.metric.caudal, 1) : "—"}
          unit="l/s"
          sub={(live?.metric?.caudal ?? 0) > 0 ? "Con flujo" : "Sin flujo"}
        />
        <StatTile
          label="Sectores regando"
          icon="bi-water"
          value={`${activeSectors.length} / ${SECTORS.length}`}
          sub={
            activeSectors.length
              ? activeSectors.map((i) => sectorLabel(i.mt_name)).join(", ")
              : "Ningún sector activo"
          }
        />
        <StatTile
          label="Riego de hoy"
          icon="bi-clock-history"
          value={formatDuration(todayTotals.seconds)}
          sub={sectorsToday ? `Suma de ${sectorsToday} ${sectorsToday === 1 ? "sector" : "sectores"}` : "Sin riego registrado hoy"}
        />
        <StatTile
          label="Volumen de hoy"
          icon="bi-moisture"
          value={todayTotals.volumeMissing ? "—" : formatNumber(todayTotals.volume, 1)}
          unit="m³"
          sub={todayTotals.volumeMissing ? "Sin datos del totalizador" : "Suma de todos los sectores"}
        />
        <StatTile
          label="Totalizador"
          icon="bi-speedometer2"
          value={live?.metric ? formatNumber(live.metric.totalizador, 1) : "—"}
          unit="m³"
          sub="Lectura acumulada del medidor"
          className="d-none d-md-block"
        />
      </div>

      <div className="dash-grid dash-grid--live mt-3">
        <Card title="Mapa de sectores" subtitle="Haz clic en un sector para ver su historial">
          <ParcelaMapa intervals={intervals} selected={sector} onSelect={toggleSector} />
        </Card>
        <Card title="Estado de sectores" subtitle="Riego en curso y último riego registrado">
          <SectorTable
            sectors={SECTORS}
            intervals={intervals}
            lastIrrigation={lastIrrigation}
            stale={stale}
            today={today}
            selected={sector}
            onSelect={toggleSector}
          />
          {stale.size > 0 && (
            <div className="insight" role="note">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
              <span>
                {[...stale].map(sectorLabel).join(", ")} {stale.size === 1 ? "lleva" : "llevan"} 7 días o más sin
                riego, mientras otros sectores sí han regado.
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* ======================= HISTORIAL ======================= */}
      <div className="dash-section-title">
        <h2>Historial de riego</h2>
        <small>
          {monthLabel(month)} · {scopeLabel}
        </small>
      </div>

      <div className="filter-bar" role="group" aria-label="Filtros del historial">
        <div>
          <label htmlFor="month-select">Mes</label>
          <div className="input-group input-group-sm">
            <button
              className="btn btn-outline-secondary"
              aria-label="Mes anterior"
              disabled={prevMonth < MIN_MONTH}
              onClick={() => setMonth(prevMonth)}
            >
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <select
              id="month-select"
              className="form-select form-select-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              className="btn btn-outline-secondary"
              aria-label="Mes siguiente"
              disabled={isCurrent}
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="sector-select">Sector</label>
          <select
            id="sector-select"
            className="form-select form-select-sm"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value={ALL_SECTORS}>Toda la parcela</option>
            {SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {summaryError && (
          <small className="text-danger align-self-center">
            <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
            {summaryError}
          </small>
        )}
      </div>

      <div className="kpi-row kpi-row--4">
        <StatTile
          label={isCurrent ? "Horas de riego (mes a la fecha)" : "Horas de riego"}
          hint={sector === ALL_SECTORS ? "Suma de las horas de todos los sectores: puede superar 24 h por día" : undefined}
          icon="bi-clock"
          value={monthLoaded ? formatHours(cur.seconds) : "…"}
          unit="h"
          sub={monthLoaded && <Delta ratio={delta(cur.seconds, prev.seconds)} label={comparisonLabel} />}
        />
        <StatTile
          label="Volumen aplicado"
          icon="bi-moisture"
          value={monthLoaded ? (cur.volumeMissing ? "—" : formatNumber(cur.volume, 0)) : "…"}
          unit="m³"
          sub={
            monthLoaded &&
            (cur.volumeMissing ? (
              "Sin datos del totalizador"
            ) : (
              <Delta ratio={delta(cur.volume, prev.volume)} label={comparisonLabel} />
            ))
          }
        />
        <StatTile
          label="Días con riego"
          icon="bi-calendar-check"
          value={monthLoaded ? cur.irrigationDays : "…"}
          unit={`de ${elapsedDays}`}
          sub={
            monthLoaded &&
            (cur.irrigationDays > 0
              ? `Promedio ${formatDuration(cur.seconds / cur.irrigationDays)} por día regado`
              : "Sin riego en el periodo")
          }
        />
        <StatTile
          label="Caudal promedio en riego"
          icon="bi-droplet"
          value={monthLoaded && cur.avgCaudal !== null ? formatNumber(cur.avgCaudal, 1) : monthLoaded ? "—" : "…"}
          unit="l/s"
          sub={
            monthLoaded &&
            cur.avgCaudal !== null && (
              <Delta
                ratio={prev.avgCaudal ? ratioDelta(cur.avgCaudal, prev.avgCaudal) : null}
                label={comparisonLabel}
              />
            )
          }
        />
      </div>

      <div className="dash-grid dash-grid--history mt-3">
        <Card
          title="Riego diario"
          subtitle={`${scopeLabel} · ${chartMetric === "hours" ? "horas" : "m³"} por día`}
          actions={
            <div className="segmented" role="group" aria-label="Unidad del gráfico">
              <button aria-pressed={chartMetric === "hours"} onClick={() => setChartMetric("hours")}>
                Horas
              </button>
              <button aria-pressed={chartMetric === "volume"} onClick={() => setChartMetric("volume")}>
                m³
              </button>
            </div>
          }
        >
          {monthLoaded ? (
            <DailyChart points={points} metric={chartMetric} totalDays={daysInMonth(month)} />
          ) : (
            <Spinner />
          )}
        </Card>

        <Card title="Calendario de riego" subtitle={`${scopeLabel} · tiempo diario`}>
          {monthLoaded ? <HeatMap points={points} month={month} scopeLabel={scopeLabel} /> : <Spinner />}
        </Card>

        <Card title="Resumen por sector" subtitle={`${monthLabel(month)} · haz clic en una fila para filtrar`}>
          {monthLoaded ? (
            <>
              <SectorSummaryTable
                rows={bySector}
                total={totals(allMonthRows)}
                selected={sector}
                onSelect={toggleSector}
                comparisonLabel={comparisonLabel}
              />
              {caudalAlerts.length > 0 && (
                <div className="insight" role="note">
                  <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                  <span>
                    El caudal promedio de {caudalAlerts.map((r) => `${sectorLabel(r.id)} (${formatDelta(r.caudalDelta!)})`).join(", ")}{" "}
                    cambió {Math.round(CAUDAL_ALERT * 100)}% o más {comparisonLabel}. Puede indicar filtros sucios,
                    emisores obstruidos o fugas.
                  </span>
                </div>
              )}
            </>
          ) : (
            <Spinner />
          )}
        </Card>

        <Card title="Exportar historial" subtitle="Descarga en Excel por rango de meses">
          <ExportHistorial />
        </Card>
      </div>

      <footer className="d-flex flex-wrap justify-content-between align-items-center pt-3 mt-4 border-top">
        <p className="mb-0 text-body-secondary small">&copy; {today.slice(0, 4)} JTE Analytics.</p>
        <img src={lgJte} alt="JTE Analytics" width={40} height={24} />
      </footer>
    </div>
  );
}

export default Home;
