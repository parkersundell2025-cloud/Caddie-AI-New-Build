// Source-guard test for CONVERSION_FIXES #5 — the paywall wiring.
//
// Before: the paywall showed hardcoded $15/$29 and promised a 7-day trial
// unconditionally; getOfferings() ran only AFTER the Subscribe tap; and every
// failure collapsed into one "store is still setting up" message.
//
// Guards that SubscribeNow.jsx now: loads the offering up front, renders the
// real offer through PlanRow/Hero/Disclosure, keeps trial wording behind the
// resolved offer, exposes distinct load states with a manual retry that only
// re-fetches (never re-purchases, never switches billing route), and disables
// the CTA on native until the offering is ready.
//
// Run: node scripts/paywall-offers.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sub = readFileSync(new URL('../src/pages/SubscribeNow.jsx', import.meta.url), 'utf8');
const has = (s, msg) => assert.ok(sub.includes(s), msg);
const lacks = (s, msg) => assert.ok(!sub.includes(s), msg);

// Up-front load, keyed on the paywall actually being shown; manual retry only.
has("import {\n  getOfferings,\n  loadOfferings,\n  getIntroEligibility,\n  describeOffer,", 'imports the #5 helpers');
has('const res = await loadOfferings();', 'offering is loaded up front (not only after the tap)');
has('}, [loading, offerNonce]);', 'offer effect runs once the paywall is shown and on retry');
has('const eligibility = await getIntroEligibility(ids);', 'eligibility is checked for the loaded products');
has('byPlan[plan] = describeOffer(pkg, eligibility[pkg.product.identifier]);', 'each plan is described from the real package');
has('const retryOffers = () => setOfferNonce((n) => n + 1);', 'retry only re-fetches the offering');
has('offerState.offering ?? await getOfferings()', 'purchase tap reuses the loaded offering, falls back to a single fetch');
has('No silent Stripe web fallback', 'native path still never falls back to Stripe');

// Distinct, truthful load states.
for (const key of ['loading:', 'not_configured:', 'unavailable:', 'error:']) {
  has(key, `offerNotice has a distinct ${key.replace(':', '')} state`);
}
has("offerState.status === 'unavailable' || offerState.status === 'error'", 'retry offered only for retryable states');

// Real offer rendered; trial wording gated on the resolved offer.
has('<Hero trial={selectedTrial} />', 'Hero receives the resolved trial');
has('offer={native ? offerState.byPlan[p.id] : undefined}', 'PlanRow receives the real offer on native');
has('<Disclosure byPlan={native ? offerState.byPlan : undefined} />', 'price disclosure uses real prices on native');
has('const price = offer?.priceString || plan.price;', 'PlanRow prefers the store price');
lacks('Start your 7-day free trial. Cancel anytime. No commitment.', 'no unconditional Hero trial promise remains');
has("? `Start your ${trial.label}${trial.certain ? '' : ' (if eligible)'}. Cancel anytime.`", 'Hero trial line comes from the offer');
has('disabled={checkoutLoading !== null || !offersReady}', 'CTA disabled on native until the offering is ready');
has("? `Start ${selectedTrial.label} — ${planName} →`", 'CTA promises a trial only from selectedTrial');
has("`Subscribe — ${planName} →`", 'CTA falls back to a plain Subscribe when no trial is offered');
lacks('Start 7-Day Free Trial —', 'no hardcoded unconditional trial CTA remains');

console.log('PASS: #5 paywall wiring — up-front offering load, real prices, gated trial wording, distinct states, manual retry, gated CTA.');
