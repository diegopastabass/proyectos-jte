const start = "2026-09-05";
const end = "2026-09-08";
let currentDate = new Date(`${start}T00:00:00Z`);
const endDate = new Date(`${end}T00:00:00Z`);

let iterations = 0;
while (currentDate <= endDate && iterations < 10) {
  console.log("currentDate UTC:", currentDate.toISOString(), "Local:", currentDate.toString());
  currentDate.setDate(currentDate.getDate() + 1);
  iterations++;
}
