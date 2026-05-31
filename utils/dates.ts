export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = day === 6 ? 0 : day + 1;
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function daysBetween(from: string, to = new Date()) {
  const diff = to.getTime() - new Date(from).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
