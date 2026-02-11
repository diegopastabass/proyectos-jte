import type { Metric } from "../components/types";

export const fillMissingDates = (data: Metric[], daysBack: number): Metric[] => {
  const filledData: Metric[] = [];
  const dataMap = new Map(data.map((m) => [m.time.split("T")[0], m]));

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];

    if (dataMap.has(dateKey)) {
      filledData.push(dataMap.get(dateKey)!);
    } else {
      filledData.push({ time: `${dateKey}T00:00:00`, value: 0 });
    }
  }
  return filledData;
};