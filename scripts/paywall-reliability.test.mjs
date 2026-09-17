// Behavioral test for CONVERSION_FIXES #2 (paywall load recovery) and #3
// (strict identity before native purchase). Extracts the ACTUAL handlers from
// source and runs them in-memory with injected failures — no network, SDK,
// or DB. Asserts the FIXED behavior (contrast the investigation scripts, which
// asserted the defective behavior).
//
// Run: node scripts/paywall-reliability.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sub = readFileSync(new URL('../src/pages/SubscribeNow.jsx', import.meta.url), 'utf8');
const rc = readFileSync(new URL('../src/lib/revenuecat.js', import.meta.url), 'utf8');
// #7 moved the access decision into a shared predicate that init now calls;
// extract the real one so the harness runs the same code the page does.
const lib = readFileSync(new URL('../src/lib/subscription.js', import.meta.url), 'utf8');
const accessMatch = lib.match(/export function hasActiveAccess[\s\S]*?\n\}/);
assert(accessMatch, 'Could not locate hasActiveAccess in src/lib/subscription.js');
const hasActiveAccess = eval('(' + accessMatch[0].replace('export ', '') + ')');

function between(text, first, last) {
  const b = text.indexOf(first);
  const e = text.indexOf(last, b + first.length);
  assert(b >= 0 && e > b, `Source marker missing: ${first}`);
  return text.slice(b, e);
}

const initSource = between(sub, '    const withTimeout = (promise, ms) =>', '\n    init();');
const nativeSource = between(sub, '  const handleIOSPurchase = async (plan) => {', '\n  const handleIOSRestore');
const identitySource = between(rc, 'export async function identifyRevenueCatUser', '\n// Attach subscriber attributes').replace('export ', '');

// ---- #2 init harness ------------------------------------------------------
function initCtx(options = {}) {
  const result = { loading: true, loadError: null, navigations: [], events: [] };
  const profile = options.profile ?? { onboarding_complete: true, subscription_status: null };
  const query = {
    select() { return query; }, eq() { return query; },
    then(resolve, reject) {
      const err = options.profileError ? new Error(options.profileErrorMsg || 'Injected profile read failure') : null;
      return Promise.resolve({ data: [profile], error: err }).then(resolve, reject);
    },
  };
  const values = {
    cancelled: false,
    initRunRef: { current: 0 },
    hasActiveAccess,
    // #8 funnel instrumentation referenced by init; inert stubs here.
    // `shown` = the paywall has already been presented once (view id set).
    paywallViewIdRef: { current: options.shown ? 'view-0' : null },
    planIntentRef: { current: { explicit: false } },
    selectedPlan: 'pro',
    newViewId: () => 'view-1',
    track: () => {},
    URLSearchParams,
    setTimeout: () => 0, // no-op: exercise the resolve/reject path, not the 12s timer
    Promise,
    console: { warn() {}, error() {}, log() {} },
    window: { location: { search: '' }, fbq: (...a) => result.events.push(a) },
    getCurrentUser: async () => (options.noUser ? null : { id: 'u1', email: 'd@example.invalid' }),
    setUser() {},
    setLoading: (v) => { result.loading = v; },
    setLoadError: (v) => { result.loadError = v; },
    navigate: (r) => result.navigations.push(r),
    unwrap: async (p) => { const r = await p; if (r.error) throw r.error; return r.data; },
    // getUser() is a network call; getSession() is local. The offline case is
    // "getUser fails but a session is still stored" (or navigator says offline).
    supabase: {
      from: () => query,
      auth: { getSession: async () => ({ data: { session: options.localSession ? { user: { id: 'u1' } } : null } }) },
    },
    navigator: { onLine: !options.offline },
  };
  return { result, ctx: vm.createContext(values) };
}
async function runInit(options, code = 'init();') {
  const { result, ctx } = initCtx(options);
  await vm.runInContext(`${initSource}\n${code}`, ctx, { timeout: 2000 });
  return result;
}

const normal = await runInit({});
assert.equal(normal.loading, false, 'normal: spinner clears');
assert.equal(normal.loadError, null, 'normal: no error');
assert.deepEqual(normal.events, [['track', 'InitiateCheckout']], 'normal: InitiateCheckout fires');

const failed = await runInit({ profileError: true });
assert.equal(failed.loading, false, 'FIX #2: failed read is NOT a stuck spinner');
assert.ok(failed.loadError, 'FIX #2: failed read surfaces an actionable loadError');
assert.deepEqual(failed.navigations, [], 'FIX #2: failure never grants access / routes forward');

const authErr = await runInit({ profileError: true, profileErrorMsg: 'JWT expired' });
assert.ok(authErr.navigations.includes('/signin'), 'FIX #2: expired auth → /signin, not retry');
assert.equal(authErr.loadError, null, 'FIX #2: auth error routes rather than showing retry');

const noUser = await runInit({ noUser: true });
assert.ok(noUser.navigations.some((n) => n.startsWith('/signin')), 'no user → /signin');

// Walkthrough finding 2026-09-16: offline + reload sent a signed-in user to the
// login screen, because getUser() (network) returned nothing. A stored session
// or an offline browser must be treated as transient → retry, never sign-out.
const offlineWithSession = await runInit({ noUser: true, localSession: true });
assert.deepEqual(offlineWithSession.navigations, [], 'FIX #2: auth unreachable + stored session → no /signin bounce');
assert.ok(offlineWithSession.loadError, 'FIX #2: auth unreachable + stored session → retry screen');
assert.equal(offlineWithSession.loading, false, 'FIX #2: auth unreachable → not stuck');

const offlineBrowser = await runInit({ noUser: true, offline: true });
assert.deepEqual(offlineBrowser.navigations, [], 'FIX #2: navigator.onLine=false → no /signin bounce');
assert.ok(offlineBrowser.loadError, 'FIX #2: navigator.onLine=false → retry screen');

// A focus/visibility recheck that fails while the paywall is ALREADY on screen
// keeps the paywall (what's shown is still valid); it never swaps in the error
// screen. Only the initial load / explicit retry surfaces "Try again".
const bgFail = await runInit({ profileError: true, shown: true }, 'init({ background: true });');
assert.equal(bgFail.loadError, null, 'FIX #2: background recheck failure keeps the paywall');
assert.deepEqual(bgFail.navigations, [], 'FIX #2: background recheck failure never routes');
const bgOfflineFail = await runInit({ noUser: true, offline: true, shown: true }, 'init({ background: true });');
assert.equal(bgOfflineFail.loadError, null, 'FIX #2: going offline on the paywall keeps the paywall');
const fgFail = await runInit({ profileError: true, shown: true });
assert.ok(fgFail.loadError, 'FIX #2: an explicit (non-background) rerun still shows Try again');
const bgAuthFail = await runInit({ profileError: true, profileErrorMsg: 'JWT expired', shown: true }, 'init({ background: true });');
assert.ok(bgAuthFail.navigations.includes('/signin'), 'FIX #2: a real auth expiry on recheck still routes to /signin');

// ---- #3 native purchase harness -------------------------------------------
function purchaseCtx(options = {}) {
  const result = { checkoutLoading: null, checkoutError: '', navigations: [], purchases: 0, events: [] };
  const values = {
    URLSearchParams,
    console: { warn() {}, error() {}, log() {} },
    window: { location: { search: '' }, fbq: () => {} },
    isNative: () => true,
    // #5: the tap reads the paywall's pre-loaded offering first; null falls
    // through to the mocked getOfferings below.
    offerState: { offering: null, byPlan: {} },
    // #8 funnel instrumentation: record name + the discriminating property so
    // the attempt lifecycle (tapped → preflight/sdk → result) is asserted.
    track: (name, opts) => result.events.push([name, opts?.properties?.outcome ?? opts?.properties?.reason ?? null]),
    newAttemptId: () => 'attempt-1',
    getCurrentUser: async () => (options.noUser ? null : { id: 'u1', email: 'd@example.invalid' }),
    // Device finding 2026-09-16: getUser() (network) can transiently return
    // null for a signed-in user; the locally stored session is the fallback.
    supabase: { auth: { getSession: async () => ({ data: { session: options.localSession ? { user: { id: 'u1' } } : null } }) } },
    setCheckoutLoading: (v) => { result.checkoutLoading = v; },
    setCheckoutError: (v) => { result.checkoutError = v; },
    navigate: (r) => result.navigations.push(r),
    getOfferings: async () => ({ availablePackages: options.noPackage ? [] : [{ product: { identifier: 'pro' } }] }),
    planForPackage: () => 'pro',
    configureRevenueCat: async () => true,
    Purchases: { logIn: async () => { if (options.identityFails) throw new Error('Injected identity failure'); return { customerInfo: {}, created: false }; } },
    purchasePackage: async () => {
      if (options.purchaseCancels) throw Object.assign(new Error('Purchase was cancelled.'), { userCancelled: true });
      if (options.purchaseThrows) throw Object.assign(new Error('Injected store failure'), { code: 'STORE_PROBLEM' });
      result.purchases++; return { customerInfo: {} };
    },
    startCheckout: async () => { result.navigations.push('startCheckout'); },
  };
  return { result, ctx: vm.createContext(values) };
}
async function runPurchase(options) {
  const { result, ctx } = purchaseCtx(options);
  await vm.runInContext(`${identitySource}\n${nativeSource}\nhandleIOSPurchase('pro');`, ctx, { timeout: 2000 });
  return result;
}

const ok = await runPurchase({});
assert.equal(ok.purchases, 1, 'success: purchase proceeds');
assert.deepEqual(ok.navigations, ['/checkout/success'], 'success: routes to checkout success');
assert.deepEqual(ok.events, [['purchase_tapped', null], ['purchase_sdk_invoked', null], ['purchase_result', 'success']],
  'FIX #8: native success emits tapped → sdk_invoked → result:success');

const idFail = await runPurchase({ identityFails: true });
assert.equal(idFail.purchases, 0, 'FIX #3: identity failure BLOCKS the purchase call');
assert.ok(!idFail.navigations.includes('/checkout/success'), 'FIX #3: no navigation to success on identity failure');
assert.ok(idFail.checkoutError, 'FIX #3: identity failure shows a retryable error');
assert.equal(idFail.checkoutLoading, null, 'FIX #3: button is reset for retry');
assert.deepEqual(idFail.events, [['purchase_tapped', null], ['purchase_preflight_failed', 'identity']],
  'FIX #8: identity block is a preflight failure, never an sdk_invoked');

const noUserBuy = await runPurchase({ noUser: true });
assert.equal(noUserBuy.purchases, 0, 'FIX #3: no authenticated user → no purchase');
assert.ok(noUserBuy.checkoutError, 'FIX #3: unauthenticated shows an error');
assert.deepEqual(noUserBuy.events.at(-1), ['purchase_preflight_failed', 'no_user'], 'FIX #8: no_user preflight reason');

// Transient getUser() failure with a stored session must NOT block a
// signed-in user (and must still run the identity alignment for that uuid).
const blipBuy = await runPurchase({ noUser: true, localSession: true });
assert.equal(blipBuy.purchases, 1, 'device fix: stored session stands in for a transient getUser() null');
assert.deepEqual(blipBuy.navigations, ['/checkout/success'], 'device fix: purchase completes normally');
assert.ok(!blipBuy.events.some((e) => e[0] === 'purchase_preflight_failed'), 'device fix: not recorded as a preflight failure');

const noPkg = await runPurchase({ noPackage: true });
assert.equal(noPkg.purchases, 0, 'no package → no purchase');
assert.deepEqual(noPkg.events.at(-1), ['purchase_preflight_failed', 'no_package'], 'FIX #8: no_package preflight reason');

const cancelled = await runPurchase({ purchaseCancels: true });
assert.equal(cancelled.checkoutError, '', 'user cancel stays silent in the UI');
assert.deepEqual(cancelled.events.at(-1), ['purchase_result', 'cancel'], 'FIX #8: cancel recorded as its own outcome');

const storeErr = await runPurchase({ purchaseThrows: true });
assert.ok(storeErr.checkoutError, 'store error surfaces to the UI');
assert.deepEqual(storeErr.events.at(-1), ['purchase_result', 'error'], 'FIX #8: store error recorded as result:error');

// ---- #4 web checkout harness ----------------------------------------------
const checkoutSource = between(sub, '  const startCheckout = async (plan) => {', '\n  const handleRestoreAccess');
function checkoutCtx(options = {}) {
  const result = { checkoutLoading: null, checkoutError: '', opened: [], invokes: 0, events: [] };
  const inFlight = { current: false };
  const values = {
    URLSearchParams,
    console: { warn() {}, error() {}, log() {} },
    window: { location: { origin: 'https://x.invalid' } },
    isNative: () => !!options.native,
    NATIVE_URL_SCHEME: 'caddieai',
    checkoutInFlightRef: inFlight,
    track: (name, opts) => result.events.push([name, opts?.properties?.outcome ?? opts?.properties?.reason ?? null]),
    newAttemptId: () => 'attempt-1',
    setCheckoutLoading: (v) => { result.checkoutLoading = v; },
    setCheckoutError: (v) => { result.checkoutError = v; },
    supabase: { functions: { invoke: async () => {
      result.invokes++;
      if (options.invokeThrows) throw new Error('Injected invocation rejection');
      if (options.invokeReturnsError) return { data: null, error: new Error('Injected function error') };
      return { data: { session_url: 'https://checkout.example.invalid' }, error: null };
    } } },
    openExternal: async (url) => { if (options.openThrows) throw new Error('Injected navigation failure'); result.opened.push(url); },
  };
  return { result, inFlight, ctx: vm.createContext(values) };
}
async function runCheckout(options, code = `startCheckout('pro');`) {
  const { result, inFlight, ctx } = checkoutCtx(options);
  await vm.runInContext(`${checkoutSource}\n${code}`, ctx, { timeout: 2000 });
  return { ...result, inFlight: inFlight.current };
}

const returned = await runCheckout({ invokeReturnsError: true });
assert.ok(returned.checkoutError, 'returned error: message shown');
assert.equal(returned.checkoutLoading, null, 'returned error: button reset');

assert.deepEqual(returned.events, [['purchase_tapped', null], ['purchase_sdk_invoked', null], ['purchase_result', 'error']],
  'FIX #8: web session error emits result:error');

const thrown = await runCheckout({ invokeThrows: true });
assert.ok(thrown.checkoutError, 'FIX #4: THROWN invoke shows an error (was silent)');
assert.equal(thrown.checkoutLoading, null, 'FIX #4: THROWN invoke resets the button (was stuck)');
assert.equal(thrown.inFlight, false, 'FIX #4: in-flight guard released after throw');
assert.deepEqual(thrown.events.at(-1), ['purchase_result', 'error'], 'FIX #8: thrown invoke still records result:error');

const navFail = await runCheckout({ openThrows: true });
assert.ok(navFail.checkoutError, 'FIX #4: failed openExternal shows an error (was silent)');
assert.equal(navFail.checkoutLoading, null, 'FIX #4: failed openExternal resets the button (was stuck)');

const nativeOk = await runCheckout({ native: true });
assert.deepEqual(nativeOk.opened, ['https://checkout.example.invalid'], 'native success: browser opened');
assert.equal(nativeOk.checkoutLoading, null, 'native success: button re-enabled for the return trip');
assert.equal(nativeOk.inFlight, false, 'native success: guard released');

const webOk = await runCheckout({});
assert.deepEqual(webOk.opened, ['https://checkout.example.invalid'], 'web success: redirected');
assert.equal(webOk.checkoutLoading, 'pro', 'web success: stays disabled during handoff (one session per attempt)');
assert.deepEqual(webOk.events, [['purchase_tapped', null], ['purchase_sdk_invoked', null], ['purchase_result', 'redirected']],
  'FIX #8: web handoff emits tapped → sdk_invoked → result:redirected');

const dup = await runCheckout({}, `(async () => { const a = startCheckout('pro'); const b = startCheckout('pro'); await Promise.all([a, b]); })();`);
assert.equal(dup.invokes, 1, 'FIX #4: duplicate submission guarded — one Checkout Session, not two');

console.log('PASS: #2 load recovery, #3 strict purchase identity, #4 checkout exception handling + duplicate guard.');
