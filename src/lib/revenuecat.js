import { Purchases } from '@revenuecat/purchases-capacitor';
import { isNative, getPlatform } from '@/lib/platform';

// RevenueCat wrapper. Every export is safe to call on web (no-ops cleanly);
// only fires real SDK calls when running inside Capacitor.
//
// API key conventions (set in .env.local at the Vite build layer):
//   VITE_REVENUECAT_IOS_KEY      — Apple App Store key, starts with "appl_"
//   VITE_REVENUECAT_ANDROID_KEY  — Google Play key, starts with "goog_" (later)
//
// Source-of-truth model: RC is the authority for subscription state. Our
// Supabase user_profile row is a cache the RC webhook keeps in sync. UI gates
// (SubscriptionGate, RootRoute) read from user_profile — they don't need to
// query RC directly. This wrapper exists to drive purchases, restores, and
// identity sync from the iOS app.

const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY;
const ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY;

function platformApiKey() {
  return getPlatform() === 'android' ? ANDROID_API_KEY : IOS_API_KEY;
}

let configured = false;
let configurePromise = null;

// Idempotent. Safe to call from multiple call sites — concurrent calls await
// the same in-flight promise instead of double-configuring.
export async function configureRevenueCat() {
  if (!isNative()) return false;
  if (configured) return true;
  if (configurePromise) return configurePromise;
  const apiKey = platformApiKey();
  if (!apiKey) {
    console.warn(`[revenuecat] RC API key for ${getPlatform()} not set — IAP disabled.`);
    return false;
  }
  configurePromise = (async () => {
    try {
      await Purchases.configure({ apiKey });
      configured = true;
      return true;
    } catch (e) {
      console.warn('[revenuecat] configure failed:', e?.message);
      configurePromise = null; // allow retry
      return false;
    }
  })();
  return configurePromise;
}

// Tie the RC anonymous user to the Supabase auth UUID so the same identity
// follows the user across web (Stripe) and iOS (Apple IAP) flows.
export async function identifyRevenueCatUser(appUserID) {
  if (!isNative() || !appUserID) return null;
  const ok = await configureRevenueCat();
  if (!ok) return null;
  try {
    const result = await Purchases.logIn({ appUserID });
    return result; // { customerInfo, created }
  } catch (e) {
    console.warn('[revenuecat] logIn failed:', e?.message);
    return null;
  }
}

// Attach subscriber attributes to the current RC user. These show up on every
// RC webhook payload, which is how affiliate attribution travels from the
// device → RC → our webhook. iOS-only; on web Stripe checkout passes the same
// info via session metadata instead.
//
// Standard RC attributes (e.g. $email) are recognized as reserved keys; our
// affiliate keys are CUSTOM attributes (no $ prefix) and can be filtered on
// in the RC dashboard.
export async function setRevenueCatSubscriberAttributes(attrs) {
  if (!isNative() || !attrs) return false;
  const ok = await configureRevenueCat();
  if (!ok) return false;
  try {
    await Purchases.setAttributes({ attributes: attrs });
    return true;
  } catch (e) {
    console.warn('[revenuecat] setAttributes failed:', e?.message);
    return false;
  }
}

// #5: the paywall needs to know WHY there is no purchasable offering, not just
// that there isn't one. getOfferings() collapsed "not on native", "SDK key
// missing", "no current offering configured" and "fetch failed" into one null,
// so the UI showed the same "store is still setting up" message for all four
// and nothing could tell them apart. This returns a discriminated status.
//   status: 'web' | 'not_configured' | 'unavailable' | 'error' | 'ready'
export async function loadOfferings() {
  if (!isNative()) return { status: 'web', offering: null, error: null };
  const ok = await configureRevenueCat();
  if (!ok) return { status: 'not_configured', offering: null, error: null };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current ?? null;
    if (!current || !current.availablePackages?.length) {
      return { status: 'unavailable', offering: null, error: null };
    }
    return { status: 'ready', offering: current, error: null };
  } catch (e) {
    console.warn('[revenuecat] getOfferings failed:', e?.message);
    return { status: 'error', offering: null, error: e?.message || 'offerings fetch failed' };
  }
}

// Back-compat: the dashboard-configured "current" offering, or null on web /
// failure. Purchase-time callers still use this as a last-second re-check.
export async function getOfferings() {
  const { offering } = await loadOfferings();
  return offering;
}

// Mirrors the SDK's INTRO_ELIGIBILITY_STATUS enum (numeric). Kept local so the
// pure helpers below (and their tests) don't depend on the native plugin.
export const INTRO_ELIGIBILITY = {
  UNKNOWN: 0,
  INELIGIBLE: 1,
  ELIGIBLE: 2,
  NO_INTRO_OFFER_EXISTS: 3,
};

// iOS-only per the SDK: whether THIS user can still take the intro/trial offer.
// Returns a map productId → status. Never throws; anything we can't determine
// (web, Android, unconfigured, rejected) is UNKNOWN — and per the SDK's own
// guidance, UNKNOWN must be rendered as the non-intro price, not as a trial.
export async function getIntroEligibility(productIdentifiers) {
  const unknownAll = Object.fromEntries((productIdentifiers || []).map((id) => [id, INTRO_ELIGIBILITY.UNKNOWN]));
  if (!isNative() || getPlatform() === 'android' || !productIdentifiers?.length) return unknownAll;
  const ok = await configureRevenueCat();
  if (!ok) return unknownAll;
  try {
    const map = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers });
    const out = { ...unknownAll };
    for (const id of productIdentifiers) {
      const status = map?.[id]?.status;
      out[id] = typeof status === 'number' ? status : INTRO_ELIGIBILITY.UNKNOWN;
    }
    return out;
  } catch (e) {
    console.warn('[revenuecat] eligibility check failed:', e?.message);
    return unknownAll;
  }
}

// ISO-8601 subscription period (P1W / P1M / P3M / P1Y) → short suffix.
export function periodLabelFromIso(iso) {
  const m = /^P(\d+)([DWMY])$/.exec(iso || '');
  if (!m) return '';
  const n = Number(m[1]);
  const unit = { D: 'day', W: 'wk', M: 'mo', Y: 'yr' }[m[2]];
  return n === 1 ? `/${unit}` : `/${n} ${unit}`;
}

function trialLabel(value, unit) {
  const u = String(unit || '').toUpperCase();
  const word = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }[u];
  if (!word || !value) return null;
  return `${value}-${word} free trial`;
}

// Pure. Describes what the store can ACTUALLY sell for a package, so the paywall
// renders the real localized price/period and only promises a trial when one
// genuinely exists for this user. Returns:
//   { priceString, pricePerMonthString, periodLabel, trial: { label, certain } | null }
// iOS: a free trial is introPrice with price 0 — shown only when eligibility is
//      ELIGIBLE (certain). UNKNOWN / INELIGIBLE / NO_INTRO → no trial wording.
// Android: eligibility is always UNKNOWN, so the honest signal is the base
//      plan's freePhase (amountMicros 0). Play still decides at purchase time,
//      so it's marked certain:false and the store sheet remains authoritative.
export function describeOffer(pkg, eligibilityStatus, platform = getPlatform()) {
  const product = pkg?.product;
  if (!product) return null;
  const priceString = product.priceString || '';
  const pricePerMonthString = product.pricePerMonthString || null;
  const periodLabel = periodLabelFromIso(product.subscriptionPeriod);

  let trial = null;
  if (platform === 'android') {
    const free = product.defaultOption?.freePhase;
    if (free && free.price?.amountMicros === 0) {
      const label = trialLabel(free.billingPeriod?.value, free.billingPeriod?.unit);
      if (label) trial = { label, certain: false };
    }
  } else {
    const intro = product.introPrice;
    if (intro && intro.price === 0 && eligibilityStatus === INTRO_ELIGIBILITY.ELIGIBLE) {
      const label = trialLabel(intro.periodNumberOfUnits, intro.periodUnit);
      if (label) trial = { label, certain: true };
    }
  }
  return { priceString, pricePerMonthString, periodLabel, trial };
}

// Opens Apple's IAP sheet for the given package. Throws on cancel / billing
// error — callers should catch and inspect e.userCancelled / e.code.
export async function purchasePackage(aPackage) {
  if (!isNative()) throw new Error('purchasePackage is native-only');
  const ok = await configureRevenueCat();
  if (!ok) throw new Error('RevenueCat is not configured');
  return Purchases.purchasePackage({ aPackage });
  // → { customerInfo, transaction }
}

// Apple App Store requires a visible Restore Purchases control. Returns the
// refreshed customerInfo so the caller can react to newly-active entitlements.
export async function restorePurchases() {
  if (!isNative()) return null;
  const ok = await configureRevenueCat();
  if (!ok) return null;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  } catch (e) {
    console.warn('[revenuecat] restorePurchases failed:', e?.message);
    throw e;
  }
}

// Read entitlement state without triggering UI. Useful for one-shot checks.
export async function getCustomerInfo() {
  if (!isNative()) return null;
  const ok = await configureRevenueCat();
  if (!ok) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (e) {
    console.warn('[revenuecat] getCustomerInfo failed:', e?.message);
    return null;
  }
}

// Convenience: customerInfo → boolean (any active entitlement?)
export function hasAnyActiveEntitlement(customerInfo) {
  return !!customerInfo && Object.keys(customerInfo.entitlements?.active ?? {}).length > 0;
}

// Map a Package to a 'basic' | 'pro' plan label. Convention matches the legacy
// Base44 bridge: product identifier contains "basic" or "pro". The actual
// product IDs (com.caddieaiapp.app.basic.monthly, com.caddieaiapp.app.pro.monthly,
// or whatever the client configures in App Store Connect) get mapped here.
export function planForPackage(pkg) {
  const productId = pkg?.product?.identifier || pkg?.identifier || '';
  if (productId.toLowerCase().includes('basic')) return 'basic';
  if (productId.toLowerCase().includes('pro')) return 'pro';
  return null;
}
