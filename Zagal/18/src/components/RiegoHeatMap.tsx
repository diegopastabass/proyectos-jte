import React, { useMemo, useState, useEffect, useCallback } from "react";
import styles from "./styles/HeatMap.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import InfoModal from "./InfoModal";

interface RawHeatmapData {
  mt_name: string;
  date: string;
  value: number;
  totalizador: number;
  caudal: number;
}

interface ProcessedDay {
  date: Date;
  value: number | null;
  totalizador: number | null;
  caudal: number | null;
}

interface HeatMapProps {
  sector: string;
  month: number;
  year: number;
}

const parcelaMap: Record<string, string> = {
  "PARC_18_ZAGAL--slave.sector1": "SECTOR 1",
  "PARC_18_ZAGAL--slave.sector2": "SECTOR 2",
  "PARC_18_ZAGAL--slave.sector3": "SECTOR 3",
  "PARC_18_ZAGAL--slave.sector4": "SECTOR 4",
  "PARC_18_ZAGAL--slave.sector5": "SECTOR 5",
};

const getColor = (value: number | null): string => {
  if (value === null || value < 10) return styles.color0;
  if (value < 600) return styles.color1;
  if (value < 3600) return styles.color2;
  if (value < 14400) return styles.color3;
  return styles.color4;
};

const formatIrrigationTime = (seconds: number | null): string => {
  if (seconds === 0 || seconds === null) return "No hubo riego";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h.toString().padStart(2, "0")} h`);
  if (m > 0 || h > 0) parts.push(`${m.toString().padStart(2, "0")} m`);
  if (s > 0 && h === 0 && m === 0)
    parts.push(`${s.toString().padStart(2, "0")} s`);
  return parts.join(" ");
};

const formatSecondsToText = (seconds: number | null): string => {
  if (seconds === null || seconds === 0) return "No hubo riego";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  let result = "";
  if (h > 0) result += `${h} hora${h > 1 ? "s" : ""}`;
  if (m > 0)
    result += `${result.length > 0 ? " " : ""}${m} minuto${m > 1 ? "s" : ""}`;
  if (s > 0 && h === 0 && m === 0)
    result += `${result.length > 0 ? " " : ""}${s} segundo${s > 1 ? "s" : ""}`;

  return result.trim();
};

const generateMonthDays = (year: number, month: number): ProcessedDay[] => {
  const days: ProcessedDay[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (date.getUTCMonth() === month - 1) {
    days.push({
      date: new Date(date),
      value: null,
      totalizador: null,
      caudal: null,
    });
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
};

const HeatMap: React.FC<HeatMapProps> = ({ sector, month, year }) => {
  const [data, setData] = useState<RawHeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState({
    show: false,
    title: "",
    text1: "",
    text2: "",
    text3: "",
    text4: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const daysInMonth = new Date(year, month, 0).getDate();

        const isCurrentMonth =
          year === today.getFullYear() && month === today.getMonth() + 1;
        const endDay = isCurrentMonth ? today.getDate() : daysInMonth;

        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
          endDay
        ).padStart(2, "0")}`;

        const res = await fetch(
          `https://app.jteanalytics.cl/zagal/18/summary?startDate=${startDate}&endDate=${endDate}`
        );

        if (!res.ok) {
          throw new Error(
            `Error ${res.status}: Falló la carga de datos del resumen.`
          );
        }

        const json: RawHeatmapData[] = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error al cargar datos en Heatmap:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, [month, year]);

  const calendarData = useMemo(() => {
    const sectorData = data
      .filter((d) => d.mt_name === sector)
      .reduce<
        Record<number, { value: number; totalizador: number; caudal: number }>
      >((acc, curr) => {
        const dayNum = new Date(curr.date).getUTCDate();

        if (!acc[dayNum]) {
          acc[dayNum] = { value: 0, totalizador: 0, caudal: 0 };
        }

        acc[dayNum].value += curr.value;
        acc[dayNum].totalizador += curr.totalizador;
        acc[dayNum].caudal += curr.caudal;

        return acc;
      }, {});

    const days = generateMonthDays(year, month).map((d) => {
      const dayNum = d.date.getUTCDate();
      const dailyData = sectorData[dayNum];

      return {
        ...d,
        value: dailyData ? dailyData.value : null,
        totalizador: dailyData ? dailyData.totalizador : null,
        caudal: dailyData ? dailyData.caudal : null,
      };
    });

    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const emptyCells = Array.from({ length: offset }, (): null => null);

    return [...emptyCells, ...days];
  }, [data, sector, month, year]);

  const weekDays = ["L", "M", "Mi", "J", "V", "S", "D"];

  const handleDayClick = useCallback(
    (day: ProcessedDay) => {
      const parcelaName = parcelaMap[sector] ?? sector;

      const formattedDate = day.date.toLocaleDateString("es-CL", {
        timeZone: "UTC",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });

      const totalizadorText =
        day.totalizador !== null
          ? `${(day.totalizador / 10).toFixed(1)} m³`
          : "N/A";

      const caudalText =
        day.caudal !== null ? `${day.caudal.toFixed(1)} l/s` : "N/A";

      setModalData({
        show: true,
        title: `Riego del ${formattedDate}`,
        text1: `Parcela: ${parcelaName}`,
        text2: `Tiempo total de riego: ${formatSecondsToText(day.value)}`,
        text3: `Totalizador: ${totalizadorText}`,
        text4: `Caudal Promedio: ${caudalText}`,
      });
    },
    [sector]
  );

  if (loading)
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ height: "10vh" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="text-muted mt-2">Cargando...</p>
      </div>
    );

  if (data.length === 0 && !loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "10vh" }}
      >
        <p className="text-center text-success m-0 p-4 border border-success rounded">
          No se encontraron datos de riego para el mes seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cardContainer}>
      <div className={styles.container}>
        {/* Encabezado con días de la semana + columna Σ */}
        <div className={styles.weekDaysContainer}>
          {weekDays.map((d) => (
            <div key={d} className={styles.weekDayLabel}>
              {d}
            </div>
          ))}
          <div className={styles.weekTotalLabel}>Σ</div>
        </div>

        {/* Celdas de días + resumen semanal */}
        <div className={styles.grid}>
          {(() => {
            const weeks: (ProcessedDay | null)[][] = [];
            for (let i = 0; i < calendarData.length; i += 7) {
              weeks.push(calendarData.slice(i, i + 7));
            }

            return weeks.map((week, wIndex) => {
              // Asegurar 7 días por semana rellenando con null
              const paddedWeek = [...week];
              while (paddedWeek.length < 7) paddedWeek.push(null);

              const totalWeekSeconds = paddedWeek.reduce((sum, day) => {
                if (day && day.value) return sum + day.value;
                return sum;
              }, 0);

              const totalText = (() => {
                if (!totalWeekSeconds) return "0 m";
                const h = Math.floor(totalWeekSeconds / 3600);
                const m = Math.floor((totalWeekSeconds % 3600) / 60);
                return `${h > 0 ? `${h} h ` : ""}${m} m`;
              })();

              return (
                <div key={wIndex} className={styles.weekRow}>
                  {paddedWeek.map((day, index) => {
                    const dayDate = day?.date;
                    const isSelectable = day && day.value !== null;
                    return (
                      <div
                        key={index}
                        className={`${styles.dayCell} ${
                          day ? getColor(day.value) : styles.emptyCell
                        }`}
                        title={
                          dayDate
                            ? `${dayDate.toLocaleDateString("es-CL", {
                                timeZone: "UTC",
                              })} - ${formatIrrigationTime(day.value)}`
                            : ""
                        }
                        onClick={() =>
                          isSelectable && handleDayClick(day as ProcessedDay)
                        }
                        style={{
                          cursor: isSelectable ? "pointer" : "default",
                        }}
                      >
                        {dayDate && (
                          <>
                            <div>{dayDate.getUTCDate()}</div>
                            {day?.value !== null && (
                              <div className={styles.irrigationTime}>
                                {formatIrrigationTime(day.value)
                                  .replace(/\s?\d{2}\s?s/, "")
                                  .trim()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {/* Resumen semanal */}
                  <div className={styles.weekSummary}>{totalText}</div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <InfoModal
        show={modalData.show}
        onClose={() => setModalData({ ...modalData, show: false })}
        title={modalData.title}
        text1={modalData.text1}
        text2={modalData.text2}
        text3={modalData.text3}
        text4={modalData.text4}
      />
    </div>
  );
};

export default HeatMap;
