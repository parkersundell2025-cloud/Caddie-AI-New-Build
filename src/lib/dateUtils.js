// Date utilities for trial and subscription logic

export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export function getDatePlusDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getDaysDifference(date1, date2) {
  // date1 and date2 should be strings in YYYY-MM-DD format
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function isDateBefore(date1, date2) {
  return new Date(date1) < new Date(date2);
}

export function isDateAfter(date1, date2) {
  return new Date(date1) > new Date(date2);
}

export function isDateEqual(date1, date2) {
  return date1 === date2;
}