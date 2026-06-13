import { Purchases } from '@revenuecat/purchases-capacitor';
import { isNative } from '@/lib/platform';

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

let configured = false;
let configurePromise = null;

// Idempotent. Safe to call from multiple call sites — concurrent calls await
// the same in-flight promise instead of double-configuring.
export async function configureRevenueCat() {
  if (!isNative()) return false;
  if (configured) return true;
  if (configurePromise) return configurePromise;
  if (!IOS_API_KEY) {
    console.warn('[revenuecat] VITE_REVENUECAT_IOS_KEY not set — IAP disabled.');
    return false;
  }
  configurePromise = (async () => {
    try {
      await Purchases.configure({ apiKey: IOS_API_KEY });
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

// Returns the dashboard-configured "current" offering's available packages,
// or null on web / failure. UI uses this to render plan buttons.
export async function getOfferings() {
  if (!isNative()) return null;
  const ok = await configureRevenueCat();
  if (!ok) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch (e) {
    console.warn('[revenuecat] getOfferings failed:', e?.message);
    return null;
  }
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
