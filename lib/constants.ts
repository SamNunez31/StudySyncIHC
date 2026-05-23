export const days = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miercoles", short: "Mie" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sabado", short: "Sab" }
];

export const timeSlots = [
  ["07:00", "08:00"],
  ["08:00", "09:00"],
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["12:00", "13:00"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
  ["16:00", "17:00"],
  ["17:00", "18:00"],
  ["18:00", "19:00"],
  ["19:00", "20:00"]
].map(([start, end]) => ({ start, end, label: `${start} - ${end}` }));

export function normalizeTime(value: string) {
  return value.slice(0, 5);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getNextDateForDay(day: number, time: string) {
  const now = new Date();
  const date = new Date(now);
  const current = date.getDay() === 0 ? 7 : date.getDay();
  let delta = day - current;
  if (delta < 0) delta += 7;
  date.setDate(date.getDate() + delta);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 7);
  return date;
}
