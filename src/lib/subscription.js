import { getTrialDaysRemaining as getTrial } from './trialUtils';

export const PLANS = {
  basic: { name: 'Caddie AI Basic', priceId: 'price_1TOfvE2ZJRGxxJxRqXKmOVuf' },
  pro: { name: 'Caddie AI Pro', priceId: 'price_1TOfwL2ZJRGxxJxRc7SiSjSm' }
};

export const getTrialDaysRemaining = getTrial;

export function hasProAccess(profile) {
  return profile?.subscription_status === 'pro';
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