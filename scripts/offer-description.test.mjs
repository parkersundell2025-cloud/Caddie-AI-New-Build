// Regression test for CONVERSION_FIXES #5 — the paywall must describe what the
// store can ACTUALLY sell: real localized price/period, a trial only when the
// store offers one (and, on iOS, this user is eligible), and a discriminated
// reason when no offering is purchasable (instead of one collapsed null).
//
// Runs the ACTUAL pure helpers from src/lib/revenuecat.js in-memory with a
// mocked SDK. No native plugin, network, or purchases.
//
// Run: node scripts/offer-description.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const rc = readFileSync(new URL('../src/lib/revenuecat.js', import.meta.url), 'utf8');
function grab(re, name) {
  const m = rc.match(re);
  assert(m, `Could not locate ${name} in src/lib/revenuecat.js`);
  return m[0].replace(/^export /, '');
}
const code = [
  grab(/export const INTRO_ELIGIBILITY = \{[\s\S]*?\n\};/, 'INTRO_ELIGIBILITY'),
  grab(/export async function loadOfferings[\s\S]*?\n\}/, 'loadOfferings'),
  grab(/export async function getIntroEligibility[\s\S]*?\n\}/, 'getIntroEligibility'),
  grab(/export function periodLabelFromIso[\s\S]*?\n\}/, 'periodLabelFromIso'),
  grab(/function trialLabel[\s\S]*?\n\}/, 'trialLabel'),
  grab(/export function describeOffer[\s\S]*?\n\}/, 'describeOffer'),
].join('\n');

function makeApi({ native = true, platform = 'ios', configured = true, purchases = {} } = {}) {
  const ctx = vm.createContext({
    isNative: () => native,
    getPlatform: () => platform,
    configureRevenueCat: async () => configured,
    Purchases: purchases,
    console: { warn() {}, error() {}, log() {} },
  });
  const api = vm.runInContext(
    `${code}\n({ INTRO_ELIGIBILITY, loadOfferings, getIntroEligibility, periodLabelFromIso, describeOffer })`,
    ctx, { timeout: 2000 },
  );
  // Objects built inside the vm carry that realm's Object.prototype, which
  // strict deepEqual rejects even when the shape is identical. Normalize.
  const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    INTRO_ELIGIBILITY: plain(api.INTRO_ELIGIBILITY),
    periodLabelFromIso: api.periodLabelFromIso,
    describeOffer: (...a) => plain(api.describeOffer(...a)),
    loadOfferings: async (...a) => plain(await api.loadOfferings(...a)),
    getIntroEligibility: async (...a) => plain(await api.getIntroEligibility(...a)),
  };
}
const { INTRO_ELIGIBILITY: E, periodLabelFromIso, describeOffer } = makeApi();

// --- periodLabelFromIso ----------------------------------------------------
assert.equal(periodLabelFromIso('P1M'), '/mo');
assert.equal(periodLabelFromIso('P1Y'), '/yr');
assert.equal(periodLabelFromIso('P1W'), '/wk');
assert.equal(periodLabelFromIso('P3M'), '/3 mo');
assert.equal(periodLabelFromIso('junk'), '');
assert.equal(periodLabelFromIso(null), '');

// --- describeOffer: iOS (introPrice + eligibility) ---------------------------
const iosPkg = (introPrice) => ({ product: {
  identifier: 'com.caddieaiapp.pro.monthly', priceString: '$14.99', pricePerMonthString: '$14.99',
  subscriptionPeriod: 'P1M', introPrice,
} });
const freeIntro = { price: 0, priceString: '$0.00', cycles: 1, period: 'P1W', periodUnit: 'DAY', periodNumberOfUnits: 7 };

let d = describeOffer(iosPkg(freeIntro), E.ELIGIBLE, 'ios');
assert.equal(d.priceString, '$14.99', 'real localized price passes through');
assert.equal(d.periodLabel, '/mo', 'period derives from ISO subscriptionPeriod');
assert.deepEqual(d.trial, { label: '7-day free trial', certain: true }, 'iOS free intro + ELIGIBLE → certain trial');
assert.equal(describeOffer(iosPkg(freeIntro), E.UNKNOWN, 'ios').trial, null, 'UNKNOWN eligibility → NO trial promise (SDK guidance)');
assert.equal(describeOffer(iosPkg(freeIntro), E.INELIGIBLE, 'ios').trial, null, 'INELIGIBLE → no trial');
assert.equal(describeOffer(iosPkg(freeIntro), E.NO_INTRO_OFFER_EXISTS, 'ios').trial, null, 'no intro offer → no trial');
assert.equal(describeOffer(iosPkg({ ...freeIntro, price: 0.99 }), E.ELIGIBLE, 'ios').trial, null, 'paid intro price is not a FREE trial');
assert.equal(describeOffer(iosPkg(null), E.ELIGIBLE, 'ios').trial, null, 'no introPrice → no trial');

// --- describeOffer: Android (defaultOption.freePhase; eligibility always UNKNOWN) --
const andPkg = (freePhase) => ({ product: {
  identifier: 'caddie_pro:monthly', priceString: '$14.99', subscriptionPeriod: 'P1M', introPrice: null,
  defaultOption: freePhase ? { freePhase } : null,
} });
const freePhase = {
  price: { amountMicros: 0, formatted: '$0.00', currencyCode: 'USD' },
  billingPeriod: { value: 7, unit: 'DAY', iso8601: 'P1W' }, offerPaymentMode: 'FREE_TRIAL',
};
d = describeOffer(andPkg(freePhase), E.UNKNOWN, 'android');
assert.deepEqual(d.trial, { label: '7-day free trial', certain: false }, 'Android free phase → trial, marked not-certain (Play decides at purchase)');
assert.equal(describeOffer(andPkg({ ...freePhase, price: { ...freePhase.price, amountMicros: 990000 } }), E.UNKNOWN, 'android').trial, null,
  'Android paid intro phase is not a free trial');
assert.equal(describeOffer(andPkg(null), E.UNKNOWN, 'android').trial, null, 'Android without a free phase → no trial');
assert.equal(describeOffer(null, E.ELIGIBLE, 'ios'), null, 'no package → null');
assert.equal(describeOffer({ product: null }, E.ELIGIBLE, 'ios'), null, 'no product → null');

// --- loadOfferings: distinct reasons instead of one null -------------------
const off = (current) => ({ getOfferings: async () => ({ current }) });
assert.equal((await makeApi({ native: false }).loadOfferings()).status, 'web');
assert.equal((await makeApi({ configured: false }).loadOfferings()).status, 'not_configured');
assert.equal((await makeApi({ purchases: off(null) }).loadOfferings()).status, 'unavailable', 'no current offering');
assert.equal((await makeApi({ purchases: off({ availablePackages: [] }) }).loadOfferings()).status, 'unavailable', 'empty packages');
const er = await makeApi({ purchases: { getOfferings: async () => { throw new Error('boom'); } } }).loadOfferings();
assert.equal(er.status, 'error'); assert.equal(er.error, 'boom', 'fetch failure carries its message');
const ready = await makeApi({ purchases: off({ availablePackages: [iosPkg(freeIntro)] }) }).loadOfferings();
assert.equal(ready.status, 'ready'); assert.equal(ready.offering.availablePackages.length, 1);

// --- getIntroEligibility: never throws; UNKNOWN whenever it can't tell ------
let calls = 0;
const elig = (map) => ({ checkTrialOrIntroductoryPriceEligibility: async () => { calls++; return map; } });
assert.deepEqual(await makeApi({ native: false }).getIntroEligibility(['a']), { a: E.UNKNOWN }, 'web → UNKNOWN');
calls = 0;
assert.deepEqual(await makeApi({ platform: 'android', purchases: elig({ a: { status: 2 } }) }).getIntroEligibility(['a']), { a: E.UNKNOWN }, 'android → UNKNOWN');
assert.equal(calls, 0, 'android never calls the iOS-only API');
assert.deepEqual(await makeApi({ purchases: { checkTrialOrIntroductoryPriceEligibility: async () => { throw new Error('nope'); } } }).getIntroEligibility(['a']),
  { a: E.UNKNOWN }, 'rejected call → UNKNOWN, not a throw');
assert.deepEqual(await makeApi({ purchases: elig({ a: { status: 2 } }) }).getIntroEligibility(['a', 'b']), { a: E.ELIGIBLE, b: E.UNKNOWN }, 'mapped; missing id → UNKNOWN');
assert.deepEqual(await makeApi().getIntroEligibility([]), {}, 'empty ids → empty map');

console.log('PASS: #5 helpers — period labels, iOS/Android trial gating, offering status reasons, eligibility contract.');
