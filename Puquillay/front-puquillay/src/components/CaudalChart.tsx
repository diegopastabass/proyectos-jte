import React, { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartOptions } from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DataPoint {
  time: string | number | Date;
  value: number;
}

interface CaudalChartProps {
  data: DataPoint[];
}

const CaudalChart: React.FC<CaudalChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const labels = data.map((item) => new Date(item.time));
    const values = data.map((item) => item.value);

    const config: ChartOptions<"line"> = {
      responsive: true,
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "HH:mm",
            unit: "minute",
            displayFormats: {
              minute: "HH:mm",
            },
          },
          title: {
            display: true,
            text: "Hora",
          },
        },
        y: {
          title: {
            display: true,
            text: "l/s",
          },
        },
      },
    };

    if (chartInstance.current) {
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets[0].data = values;
      chartInstance.current.update();
    } else {
      chartInstance.current = new Chart(chartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Caudal",
              data: values,
              borderColor: "rgba(157, 0, 6, 1)",
              backgroundColor: "rgba(157, 0, 6, 0.2)",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: config,
      });
    }

    return () => {
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [data]);

  return <canvas ref={chartRef} />;
};

export default CaudalChart;
