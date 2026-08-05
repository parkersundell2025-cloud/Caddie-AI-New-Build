// Product → plan mapping shared by revenueCatWebhook (event-driven) and
// syncSubscription (pull-based provisioning). Single source of truth — add
// new products HERE as they get added in RC.
//
// Strict explicit map first — DO NOT add substring fallbacks for known IDs.
export const PLAN_FROM_PRODUCT: Record<string, 'basic' | 'pro'> = {
  // App Store — current IDs (com.caddieaiapp.app, created 2026-06-07).
  // The original Base44-era IDs (month1_caddie / month1_caddiePro) were
  // claimed by a rejected app; Apple permanently reserves Product IDs
  // even after deletion, so we couldn't reuse them on the new bundle.
  'com.caddieaiapp.basic.monthly': 'basic',
  'com.caddieaiapp.pro.monthly':   'pro',
  // Play Store — RC addresses Google products as subscriptionId:basePlanId;
  // bare subscription IDs included in case an event omits the base plan.
  'caddie_basic:monthly': 'basic',
  'caddie_pro:monthly':   'pro',
  'caddie_basic':         'basic',
  'caddie_pro':           'pro',
  // App Store — Base44-era IDs kept for back-compat with any in-flight
  // RC events from before the swap. Safe to keep — they will simply never
  // appear again once the old app's RC entry is gone.
  'month1_caddie':       'basic',
  'month1_caddiePro':    'pro',
  // Stripe (RC-imported product IDs)
  'prod_UNQmTxp5xw8N0C': 'basic',
  'prod_UNQnQZbZ4pOtHo': 'pro',
  // RC's *internal* product object IDs. Some RC webhook event types include
  // these instead of the store_identifier — particularly PRODUCT_CHANGE on
  // Stripe-origin subs. Without these, the upgrade silently overwrites the
  // user back to 'basic' via the default fallback in getPlan().
  // (Listed via mcp__revenuecat__list-products on project projfe7054d8.)
  'prod0aaf40d266':      'basic',  // iOS com.caddieaiapp.basic.monthly
  'prodadf207ab77':      'pro',    // iOS com.caddieaiapp.pro.monthly
  'prod15571b3733':      'basic',  // Stripe prod_UNQmTxp5xw8N0C
  'prod59d78fbb87':      'pro',    // Stripe prod_UNQnQZbZ4pOtHo
  'prodcff849834f':      'basic',  // iOS legacy month1_caddie
  'prodb8a8b72ce9':      'pro',    // iOS legacy month1_caddiePro
  'prod520db6f5d8':      'basic',  // Play caddie_basic:monthly
  'prode521f73efb':      'pro',    // Play caddie_pro:monthly
};

// Stripe Price IDs (fallback if RC ever sends a price instead of a product).
// Preserved from the Base44 version where this fallback caught at least one
// real incident.
export const STRIPE_PRICE_BASIC = 'price_1TOfvE2ZJRGxxJxRqXKmOVuf';
export const STRIPE_PRICE_PRO   = 'price_1TOfwL2ZJRGxxJxRc7SiSjSm';

export function getPlan(pid: string): 'basic' | 'pro' {
  if (!pid) return 'basic';
  if (PLAN_FROM_PRODUCT[pid]) return PLAN_FROM_PRODUCT[pid];
  if (pid.includes(STRIPE_PRICE_PRO)) return 'pro';
  if (pid.includes(STRIPE_PRICE_BASIC)) return 'basic';
  // Word-boundary fallback for unknown future RC IDs. Strips 'prod_' prefix
  // and any 'caddiepro' substring to avoid the false positives that
  // previously misclassified Stripe Basic and the offering name as Pro.
  const lower = pid.toLowerCase().replace(/^prod_/, '').replace(/caddiepro/g, '');
  if (/(^|[_\s-])pro($|[_\s-])/.test(lower)) return 'pro';
  return 'basic';
}
