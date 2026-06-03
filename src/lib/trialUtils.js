import { parseDateLocal, todayLocal } from './dateUtils';

export function getTrialDaysRemaining(profile) {
  if (!profile?.trial_end_date) return 0;

  const trialEnd = parseDateLocal(profile.trial_end_date);
  if (!trialEnd) return 0;

  const diff = trialEnd.getTime() - todayLocal().getTime();
  const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return Math.max(0, daysRemaining);
}

export function isTrialExpired(profile) {
  const daysRemaining = getTrialDaysRemaining(profile);
  return daysRemaining <= 0 && profile?.subscription_status === 'trial';
}