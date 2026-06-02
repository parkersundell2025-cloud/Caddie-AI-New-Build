import { getTrialDaysRemaining as getTrial, isTrialExpired } from './trialUtils';

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