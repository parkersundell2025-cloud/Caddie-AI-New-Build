// Regression test for the syncSubscription trial-expiry defect (CONVERSION_FIXES #1).
//
// Guards the production bug where RC v2 `current_period_ends_at` (epoch ms) was
// sliced to its first 10 digits and written to a `date` column, causing
// SQLSTATE 22008 / HTTP 500 for every trial (4 customers, Sept 13-14).
//
// Extracts and runs the ACTUAL msToUtcDate helper from the deployed source
// (strips its two TS type annotations), then asserts the four evidence values,
// invalid inputs, UTC boundaries, and that the buggy pattern is gone.
//
// Run: node scripts/syncSubscription-trial-expiry.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../supabase/functions/syncSubscription/index.ts', import.meta.url),
  'utf8',
);

// --- Extract the real helper and evaluate it as plain JS -------------------
const match = src.match(/function msToUtcDate[\s\S]*?\n\}/);
assert(match, 'Could not locate msToUtcDate in syncSubscription/index.ts');
const stripped = match[0]
  .replace('(v: unknown)', '(v)')
  .replace('): string | null {', ') {');
// eval of first-party repo source we just extracted — not external input.
const msToUtcDate = eval('(' + stripped + ')');

// --- Evidence-backed cases (epoch ms → expected UTC date) ------------------
// The four real trial expiries recovered from RevenueCat INITIAL_PURCHASE
// events; each reproduces the recorded bad 10-digit date string.
const cases = [
  { ms: 1789946413000, date: '2026-09-20', bad: '1789946413' },
  { ms: 1790005076000, date: '2026-09-21', bad: '1790005076' },
  { ms: 1790008540000, date: '2026-09-21', bad: '1790008540' },
  { ms: 1790017543000, date: '2026-09-21', bad: '1790017543' },
];
for (const c of cases) {
  assert.equal(msToUtcDate(c.ms), c.date, `ms ${c.ms} should convert to ${c.date}`);
  // The old code produced this bad string; the fix must NOT.
  assert.notEqual(msToUtcDate(c.ms), c.bad);
  assert.equal(String(c.ms).slice(0, 10), c.bad, 'sanity: bad string is the old output');
}

// --- Numeric strings are accepted (JSON may deliver either representation) --
assert.equal(msToUtcDate('1790017543000'), '2026-09-21');

// --- Invalid inputs must return null (never a partial/garbage write) -------
for (const bad of [
  null, undefined, '', 'abc', '2026-09-21', NaN, Infinity, -1,
  1790017543,        // seconds, not ms
  '1790017543',      // seconds as string
  1.5,               // non-integer
  1789946413000.5,   // non-integer
  9e18,              // out of range
]) {
  assert.equal(msToUtcDate(bad), null, `input ${String(bad)} should be rejected`);
}

// --- UTC day boundaries ----------------------------------------------------
assert.equal(msToUtcDate(Date.parse('2026-09-21T00:00:00.000Z')), '2026-09-21');
assert.equal(msToUtcDate(Date.parse('2026-09-20T23:59:59.999Z')), '2026-09-20');

// --- Source guards: the exact defect cannot silently return ----------------
assert.ok(
  !src.includes('String(sub.current_period_ends_at).slice'),
  'The buggy String(...).slice(0,10) on current_period_ends_at is still present',
);
assert.ok(src.includes('new Date(ms).toISOString()'), 'Correct ms→date conversion missing');
assert.ok(src.includes('trial_start_date'), 'trial_start_date is not written (RootRoute needs it)');
assert.ok(src.includes('trial_end_date'), 'trial_end_date is not written');

console.log(`PASS: ${cases.length} evidence cases + numeric strings + invalid inputs + UTC boundaries + source guards.`);
