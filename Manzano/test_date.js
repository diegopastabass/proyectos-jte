const dto = { start: "2026-09-06", end: "2026-09-06" };
const startDate = new Date(`${dto.start}T00:00:00Z`);
const nextDay = new Date(dto.end);
nextDay.setDate(nextDay.getDate() + 1);
const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);

console.log("startDate:", startDate);
console.log("nextDay:", nextDay);
console.log("endDate:", endDate);
