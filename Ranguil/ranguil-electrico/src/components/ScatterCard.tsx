import { useMemo } from "react";
import { Scatter } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "../lib/chartSetup";
import Card from "./Card";
import type { Sample } from "../types";
import type { Baseline } from "../lib/electrical";
import { chartTheme, useDarkTheme } from "../lib/useDarkTheme";

interface ScatterCardProps {
  samples: Sample[];
  baseline: Baseline | null;
}

function ScatterCard({ samples, baseline }: ScatterCardProps) {
  const theme = chartTheme(useDarkTheme());

  const { history, recent } = useMemo(() => {
    const run = samples.filter((s) => s.running && s.q !== null && s.q > 0.1);
    const limit = (samples.at(-1)?.t ?? 0) - 24 * 3600 * 1000;
    return {
      history: run
        .filter((s) => s.t < limit)
        .map((s) => ({ x: s.q as number, y: s.iAvg })),
      recent: run
        .filter((s) => s.t >= limit)
        .map((s) => ({ x: s.q as number, y: s.iAvg })),
    };
  }, [samples]);

  const data = {
    datasets: [
      {
        label: "Histórico 15 d",
        data: history,
        backgroundColor: "rgba(13,110,253,0.22)",
        pointRadius: 3,
      },
      {
        label: "Últimas 24 h",
        data: recent,
        backgroundColor: "rgba(255,140,0,0.85)",
        pointRadius: 4,
      },
      ...(baseline && baseline.q
        ? [
            {
              label: "Referencia (mediana)",
              data: [{ x: baseline.q, y: baseline.iAvg }],
              backgroundColor: "rgba(25,135,84,1)",
              borderColor: "#fff",
              pointStyle: "star" as const,
              pointRadius: 11,
            },
          ]
        : []),
    ],
  };

  const options: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: theme.text } },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${ctx.parsed.x?.toFixed(2)} l/s · ${ctx.parsed.y?.toFixed(1)} A`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Caudal (l/s)", color: theme.text },
        ticks: { color: theme.text },
        grid: { color: theme.grid },
      },
      y: {
        title: { display: true, text: "Corriente promedio (A)", color: theme.text },
        ticks: { color: theme.text },
        grid: { color: theme.grid },
      },
    },
  };

  return (
    <Card className="panel">
      <div className="panel-title">
        <i className="bi bi-bullseye me-1"></i>Curva de operación: caudal vs corriente
      </div>
      <div style={{ height: 250 }}>
        <Scatter data={data} options={options} />
      </div>
      <div className="small text-body-secondary mt-1">
        Una nube desplazada de la estrella verde indica desgaste, obstrucción o cambios en el pozo.
      </div>
    </Card>
  );
}

export default ScatterCard;
