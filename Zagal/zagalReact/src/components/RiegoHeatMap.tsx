import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";

interface HeatmapData {
  mt_name: string;
  date: string;
  value: number;
}

interface HeatMapProps {
  data: HeatmapData[];
  sector: string;
  month: number;
  year: number;
}

interface Days {
  date: string;
  value: number;
}

const getColor = (value: number | null): string => {
  if (value === null || value < 10) return "#eeeeee";
  if (value < 600) return "#c6e48b";
  if (value < 3600) return "#7bc96f";
  if (value < 14400) return "#239a3b";
  return "#196127";
};

const formatSecondsToHHMM = (seconds: number | null): string => {
  if (seconds === null) return "N/A";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const generateMonthDays = (year: number, month: number) => {
  const date = new Date(year, month - 1, 1);
  const days: Days[] = [];

  while (date.getMonth() === month - 1) {
    days.push({
      date: new Date(date).toISOString(),
      value: 0,
    });
    date.setDate(date.getDate() + 1);
  }

  return days;
};

const HeatMap: React.FC<HeatMapProps> = ({ data, sector, month, year }) => {
  const sectorData = data
    .filter((d) => d.mt_name === sector)
    .reduce<Record<string, number>>((acc, curr) => {
      const day = new Date(curr.date).getDate();
      acc[day] = curr.value;
      return acc;
    }, {});

  const monthDays = generateMonthDays(year, month).map((d) => {
    const dayNum = new Date(d.date).getDate();
    return {
      ...d,
      value: sectorData[dayNum] ?? null,
    };
  });

  // Semana de los días
  const weekDays = ["Lun", "Mar", "Miér", "Jue", "Vie", "Sáb", "Dom"];

  // Calcula offset del primer día para alinear semanas
  const firstDay = new Date(year, month - 1, 1).getDay();
  // Ajusta para que Lunes sea 0 y Domingo sea 6
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const emptyCells = Array(offset).fill(null);

  const calendarDays = [...emptyCells, ...monthDays];

  const weeks: (typeof calendarDays)[][] = [];
  let currentWeek: (typeof calendarDays)[0][] = [];

  calendarDays.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between fw-bold mb-1">
        {weekDays.map((d) => (
          <div key={d} style={{ width: "40px", textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="d-flex mb-1">
          {week.map((day, j) =>
            day ? (
              <div
                key={j}
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: getColor(day.value),
                  margin: "1px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
                title={`${new Date(day.date).toLocaleDateString("es-CL", {
                  timeZone: "UTC",
                })} - ${formatSecondsToHHMM(day.value)} horas`}
              >
                {new Date(day.date).getDate()}
              </div>
            ) : (
              <div
                key={j}
                style={{ width: "40px", height: "40px", margin: "1px" }}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
};

export default HeatMap;
