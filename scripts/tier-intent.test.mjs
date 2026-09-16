// Regression test for CONVERSION_FIXES #6 — selected tier carried through
// sign-in, and platform-correct commitment wording.
//
// Before: both landing pricing buttons linked to /signin with no plan, the
// paywall always defaulted to Pro, and the billing disclosure said "Apple ID"
// on Android and web. Supabase strips query params from the auth redirect, so
// the tier is persisted same-browser (like affiliate ref) and read back.
//
// Runs the ACTUAL selectedPlan initializer from SubscribeNow.jsx in-memory,
// then source-guards every hop of the carry and the per-platform wording.
//
// Run: node scripts/tier-intent.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sub = read('../src/pages/SubscribeNow.jsx');
const pricing = read('../src/components/welcome-v2/PricingV2.jsx');
const signin = read('../src/pages/SignIn.jsx');
const gateway = read('../src/pages/Gateway.jsx');

function between(text, first, last) {
  const b = text.indexOf(first);
  const e = text.indexOf(last, b + first.length);
  assert(b >= 0 && e > b, `Source marker missing: ${first}`);
  return text.slice(b, e);
}

// --- Run the real selectedPlan initializer -------------------------------
const initBody = between(sub, 'useState(() => {', '\n  });').replace(/^useState\(/, '');
function resolvePlan({ search = '', stored = null, preview = false, storageThrows = false } = {}) {
  const ctx = vm.createContext({
    FREEMIUM_PREVIEW: preview,
    planIntentRef: { current: { explicit: false } }, // #8: initializer records explicitness
    URLSearchParams,
    window: { location: { search } },
    localStorage: { getItem() { if (storageThrows) throw new Error('blocked'); return stored; } },
  });
  return vm.runInContext(`(${initBody}\n})()`, ctx, { timeout: 1000 });
}
assert.equal(resolvePlan({ search: '?plan=basic', stored: 'pro' }), 'basic', 'URL ?plan wins over stored');
assert.equal(resolvePlan({ stored: 'basic' }), 'basic', 'stored tier used when URL has none');
assert.equal(resolvePlan({ search: '?plan=gold' }), 'pro', 'invalid ?plan falls back to pro');
assert.equal(resolvePlan({}), 'pro', 'no intent → pro default');
assert.equal(resolvePlan({ preview: true, search: '?plan=basic' }), 'pro_annual', 'freemium preview unaffected');
assert.equal(resolvePlan({ storageThrows: true, search: '?plan=basic' }), 'basic', 'storage throwing does not crash; URL still honored');
assert.equal(resolvePlan({ storageThrows: true }), 'pro', 'storage throwing → safe default');

// --- Every hop of the carry ----------------------------------------------
assert.ok(pricing.includes('/signin?plan='), 'PricingV2: landing buttons must carry the tier');
assert.ok(pricing.includes("p.best ? 'pro' : 'basic'"), 'PricingV2: Pro card → pro, other → basic');
for (const [name, src] of [['SignIn', signin], ['Gateway', gateway], ['SubscribeNow', sub]]) {
  assert.ok(src.includes('caddie_selected_plan'), `${name} must persist/read caddie_selected_plan`);
}
assert.ok(sub.includes("localStorage.getItem('caddie_selected_plan')"), 'SubscribeNow must read the persisted tier');

// --- Per-platform commitment wording -------------------------------------
const disclosure = sub.match(/function billingDisclosure[\s\S]*?\n\}/);
assert(disclosure, 'billingDisclosure missing');
assert.ok(disclosure[0].includes("platform === 'ios'"), 'iOS branch present');
assert.ok(disclosure[0].includes("platform === 'android'"), 'Android branch present');
const nonIos = disclosure[0].slice(disclosure[0].indexOf("if (platform === 'android')"));
assert.ok(!nonIos.includes('Apple ID'), 'Android/web disclosure must NOT say "Apple ID"');
assert.ok(nonIos.includes('Google Play'), 'Android disclosure names Google Play');
// #5 superseded the fixed CTA string: the label now derives from the selected
// plan's REAL offer — trial wording only when the store honors one, a plain
// "Subscribe" otherwise. Guard the derivation, not a literal.
assert.ok(sub.includes('const ctaLabel = checkoutLoading'), 'paywall CTA is derived from the resolved offer, not hardcoded');
assert.ok(sub.includes("? `Start ${selectedTrial.label} — ${planName} →`"), 'CTA promises a trial only from selectedTrial');
assert.ok(!sub.includes('Start 7-Day Free Trial —'), 'no hardcoded unconditional trial CTA remains');

console.log('PASS: tier resolution order (7 cases) + carry through SignIn/Gateway/paywall + platform-correct disclosure + consistent CTA.');
