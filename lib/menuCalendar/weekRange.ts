/**
 * Week boundaries and date strings used by /menu/calendar week view
 * (Monday–Sunday, local calendar math; ISO date via toISOString like the UI).
 */
export function getMenuCalendarWeekDates(anchorDate: Date): Date[] {
  const dates: Date[] = [];
  const startOfWeek = new Date(anchorDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function formatMenuCalendarDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
