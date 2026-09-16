// Regression test for CONVERSION_FIXES #7 — one shared access predicate.
//
// Before: Gateway, SubscriptionGate, RootRoute, the paywall (SubscribeNow) and
// the activation screen (CheckoutSuccess) each carried a slightly different
// "does this user have access" check. SubscribeNow demanded a
// stripe_subscription_id for basic/pro, so a native Pro (RevenueCat id only)
// passed the gate yet was never redirected off the paywall.
//
// Extracts and runs the ACTUAL hasActiveAccess from src/lib/subscription.js,
// asserts the decision matrix, and source-guards that every consumer delegates
// to it and the divergent copies are gone.
//
// Run: node scripts/access-predicate.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const lib = read('../src/lib/subscription.js');

const match = lib.match(/export function hasActiveAccess[\s\S]*?\n\}/);
assert(match, 'Could not locate hasActiveAccess in src/lib/subscription.js');
// eval of first-party repo source we just extracted — not external input.
const hasActiveAccess = eval('(' + match[0].replace('export ', '') + ')');

const FUTURE = '2099-12-31';
const PAST = '2000-01-01';
const cases = [
  // [description, profile, expected]
  ['null profile', null, false],
  ['native Pro: RC id only, NO stripe sub id (the #7 bug)', { subscription_status: 'pro', revenuecat_app_user_id: 'u' }, true],
  ['web Pro: stripe customer', { subscription_status: 'pro', stripe_customer_id: 'c' }, true],
  ['basic + linkage', { subscription_status: 'basic', revenuecat_app_user_id: 'u' }, true],
  ['pro with NO payment linkage → never grant on uncertainty', { subscription_status: 'pro' }, false],
  ['onboarded-but-unpaid (status null)', { subscription_status: null, onboarding_complete: true }, false],
  ['valid trial', { subscription_status: 'trial', revenuecat_app_user_id: 'u', trial_end_date: FUTURE }, true],
  ['valid trial WITHOUT trial_start_date (unified: start not required)', { subscription_status: 'trial', revenuecat_app_user_id: 'u', trial_end_date: FUTURE }, true],
  ['expired trial', { subscription_status: 'trial', revenuecat_app_user_id: 'u', trial_end_date: PAST }, false],
  ['trial with linkage but NO end date', { subscription_status: 'trial', revenuecat_app_user_id: 'u' }, false],
  ['trial with no linkage', { subscription_status: 'trial', trial_end_date: FUTURE }, false],
  ['cancelling, future end', { subscription_status: 'cancelling', stripe_customer_id: 'c', trial_end_date: FUTURE }, true],
  ['cancelling, past end', { subscription_status: 'cancelling', stripe_customer_id: 'c', trial_end_date: PAST }, false],
  ['cancelling, no end date (assume active)', { subscription_status: 'cancelling', stripe_customer_id: 'c' }, true],
  ['expired status + linkage', { subscription_status: 'expired', stripe_customer_id: 'c' }, false],
];
for (const [name, profile, expected] of cases) {
  assert.equal(hasActiveAccess(profile), expected, `hasActiveAccess: ${name}`);
}

// --- Source guards: every consumer delegates; divergent copies are gone -----
const consumers = {
  'src/pages/Gateway.jsx': read('../src/pages/Gateway.jsx'),
  'src/components/SubscriptionGate.jsx': read('../src/components/SubscriptionGate.jsx'),
  'src/App.jsx': read('../src/App.jsx'),
  'src/pages/SubscribeNow.jsx': read('../src/pages/SubscribeNow.jsx'),
  'src/pages/CheckoutSuccess.jsx': read('../src/pages/CheckoutSuccess.jsx'),
};
for (const [file, src] of Object.entries(consumers)) {
  assert.ok(src.includes('hasActiveAccess'), `${file} must use the shared hasActiveAccess`);
  assert.ok(src.includes("from '@/lib/subscription'"), `${file} must import from @/lib/subscription`);
}
const sub = consumers['src/pages/SubscribeNow.jsx'];
assert.ok(!sub.includes('activeStatuses'), 'SubscribeNow: old Restore-Access Stripe-id check must be gone');
assert.ok(!sub.includes("includes(profile.subscription_status) && profile.stripe_subscription_id"),
  'SubscribeNow: old isPaidSub Stripe-id requirement must be gone');
assert.ok(!consumers['src/App.jsx'].includes('isGracePeriod'), 'RootRoute: divergent inline predicate must be gone');
assert.ok(consumers['src/pages/CheckoutSuccess.jsx'].includes('trial_end_date'),
  'CheckoutSuccess: must select trial_end_date so the predicate can evaluate trials');

console.log(`PASS: ${cases.length} access cases + ${Object.keys(consumers).length} consumers delegate to one predicate; divergent copies removed.`);
