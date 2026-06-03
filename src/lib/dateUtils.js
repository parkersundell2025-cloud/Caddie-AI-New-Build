// Date utilities for working with Postgres DATE columns.
//
// The footgun: Postgres returns DATE columns as plain 'YYYY-MM-DD' strings.
// `new Date('YYYY-MM-DD')` parses those as UTC midnight, which for any user
// west of UTC (i.e., every North/South American customer) ends up
// representing the *previous* calendar day in local time. Trials appear to
// expire a day early, sessions shift dates, weekly strips render wrong,
// etc. Discovered when admin's Day-6 trial banner test rendered as Day-7.
//
// parseDateLocal constructs the Date with the date parts directly via the
// year/month/day constructor, anchoring at the user's local midnight on
// the correct day.

/**
 * Parse a 'YYYY-MM-DD' string as a local-time Date at midnight on that day.
 * Returns null for null/undefined/empty input so callers don't have to
 * guard against `new Date(undefined)` becoming an Invalid Date.
 *
 * Only use for date-only columns (Postgres `date` type). For
 * `timestamptz` columns, `new Date(value)` is correct — the ISO string
 * includes timezone information and parses unambiguously.
 */
export function parseDateLocal(dateStr) {
  if (!dateStr) return null;
  // Allow 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss…' (just use the date part).
  const [datePart] = String(dateStr).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Today's date at local midnight. Convenience anchor for diffing against
 * parseDateLocal results.
 */
export function todayLocal() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
