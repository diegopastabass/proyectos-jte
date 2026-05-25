import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Metric {
  value: number;
  time: string;
}

interface VpdChartProps {
  /** Serie de temperatura de la zona (°C) */
  tempData: Metric[];
  /** Serie de humedad relativa de la zona (%) */
  humData: Metric[];
  /** Etiqueta de la zona, ej. "Calor", "Frío", "Ambiente" */
  zoneName: string;
  /** Color principal de la línea (CSS color string) */
  color?: string;
}

/**
 * Calcula el VPD (kPa) a partir de temperatura (°C) y humedad relativa (%).
 * Fórmula: SVP = 0.6108 * e^(17.27*T / (T+237.3)); VPD = SVP * (1 - HR/100)
 */
function calculateVPD(tempC: number, humidity: number): number {
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpd = svp * (1 - humidity / 100);
  return Math.round(vpd * 100) / 100;
}

export default function VpdChart({
  tempData,
  humData,
  zoneName,
  color = "rgba(46,125,50,1)",
}: VpdChartProps) {
  const { labels, vpdValues } = useMemo(() => {
    const len = Math.min(tempData.length, humData.length);
    const vpdValues: number[] = [];
    const labels: string[] = [];

    for (let i = 0; i < len; i++) {
      const vpd = calculateVPD(
        parseFloat(tempData[i].value as unknown as string),
        parseFloat(humData[i].value as unknown as string),
      );
      vpdValues.push(vpd);
      labels.push(
        new Date(tempData[i].time).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }

    return { labels, vpdValues };
  }, [tempData, humData]);

  const colorArea = color.replace("1)", "0.12)");

  const chartData = {
    labels,
    datasets: [
      {
        label: `VPD ${zoneName} (kPa)`,
        data: vpdValues,
        borderColor: color,
        backgroundColor: colorArea,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        fill: true,
      },
      // Banda óptima referencia: 0.8 – 1.2 kPa
      {
        label: "Límite superior (1.2 kPa)",
        data: Array(labels.length).fill(1.2),
        borderColor: "rgba(220,53,69,0.6)",
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      {
        label: "Límite inferior (0.8 kPa)",
        data: Array(labels.length).fill(0.8),
        borderColor: "rgba(13,110,253,0.6)",
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: { boxWidth: 12, font: { size: 10 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y} kPa`,
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: "VPD (kPa)", font: { size: 11 } },
        suggestedMin: 0,
        suggestedMax: 2,
      },
      x: {
        ticks: { maxTicksLimit: 10, font: { size: 10 } },
      },
    },
  };

  if (vpdValues.length === 0) {
    return (
      <p className="text-center text-secondary small mt-2">
        Sin datos suficientes para calcular VPD.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: 200 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
