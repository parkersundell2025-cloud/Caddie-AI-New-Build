import { getTrialDaysRemaining as getTrial, isTrialExpired } from './trialUtils';
import { isNative } from './platform';

export const PLANS = {
  basic: { name: 'Caddie AI Basic', priceId: 'price_1TOfvE2ZJRGxxJxRqXKmOVuf' },
  pro: { name: 'Caddie AI Pro', priceId: 'price_1TOfwL2ZJRGxxJxRc7SiSjSm' }
};

export const getTrialDaysRemaining = getTrial;

// Trial users get full Pro access — the "try before you buy" pattern that
// matches the original Base44 implementation and the Apple-friendlier story
// at App Store review. SubscriptionGate (the upstream gate) already bounces
// users with truly expired trials to /subscribe-now, but we guard here too
// in case a stale profile object slips through during the brief window
// between trial_end_date passing and the RC webhook flipping status.
export function hasProAccess(profile) {
  if (!profile) return false;
  if (profile.subscription_status === 'pro') return true;
  if (profile.subscription_status === 'trial') return !isTrialExpired(profile);
  return false;
}

export function isTrialUser(profile) {
  return profile?.subscription_status === 'trial';
}

export function hasBasicOrBetter(profile) {
  return profile?.subscription_status === 'basic' || profile?.subscription_status === 'pro' || profile?.subscription_status === 'trial';
}

export function hasExpiredTrial(profile) {
  return profile?.subscription_status === 'expired';
}

// THE access decision — one definition shared by Gateway, RootRoute,
// SubscriptionGate, the paywall (SubscribeNow) and the activation screen
// (CheckoutSuccess). Each previously carried a slightly different copy:
// SubscribeNow demanded a Stripe subscription id, so a native Pro with only a
// RevenueCat id passed the gate yet stayed stuck on the paywall (#7).
// Rules: a payment linkage is required (Stripe customer OR RevenueCat app
// user); a trial is active only through trial_end_date; 'cancelling' keeps paid
// access through its end date; basic/pro are active. Never grants on uncertainty.
export function hasActiveAccess(profile) {
  if (!profile) return false;
  const hasPaymentLinkage = !!profile.stripe_customer_id || !!profile.revenuecat_app_user_id;
  if (!hasPaymentLinkage) return false;
  const today = new Date().toISOString().split('T')[0];
  if (profile.subscription_status === 'trial') {
    return !!profile.trial_end_date && profile.trial_end_date >= today;
  }
  if (profile.subscription_status === 'cancelling') {
    return !profile.trial_end_date || profile.trial_end_date >= today;
  }
  return ['basic', 'pro'].includes(profile.subscription_status);
}

// Where to send a user when they tap "Upgrade to Pro" / "Change Plan".
// Branches on subscription_source so the surface matches the store the sub
// came from. Store-billed users on NATIVE get the in-app plan picker — an
// upgrade purchase through the store's own sheet is fully 5.1.1-compliant
// (the guideline restricts external payment links, not IAP), and StoreKit /
// Play Billing handle the Basic→Pro crossgrade since both plans share one
// subscription group. The old external-Settings link stranded upgraders on
// a page with no upgrade path (found by Parker, 2026-08).
export function getUpgradeTarget(profile) {
  const src = profile?.subscription_source;
  if (src === 'app_store' || src === 'mac_app_store') {
    if (isNative()) return { type: 'internal', path: '/subscribe-now' };
    // Web can't run the IAP flow — Apple's account page is the best we have
    return { type: 'external', url: 'https://apps.apple.com/account/subscriptions' };
  }
  if (src === 'play_store') {
    if (isNative()) return { type: 'internal', path: '/subscribe-now' };
    return { type: 'external', url: 'https://play.google.com/store/account/subscriptions' };
  }
  // Stripe explicit OR migrated user with Stripe linkage (Base44 imports
  // never populated subscription_source). Customer portal handles plan
  // switching once it's enabled in Stripe Dashboard settings.
  if (src === 'stripe' || profile?.stripe_customer_id) {
    return { type: 'internal', path: '/customerportal' };
  }
  // No payment linkage — fresh user picking their first plan.
  return { type: 'internal', path: '/subscribe-now' };
}