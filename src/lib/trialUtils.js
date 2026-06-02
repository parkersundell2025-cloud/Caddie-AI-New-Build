export function getTrialDaysRemaining(profile) {
  if (!profile?.trial_end_date) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trialEnd = new Date(profile.trial_end_date);
  trialEnd.setHours(0, 0, 0, 0);
  
  const diff = trialEnd.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  return Math.max(0, daysRemaining);
}

export function isTrialExpired(profile) {
  const daysRemaining = getTrialDaysRemaining(profile);
  return daysRemaining <= 0 && profile?.subscription_status === 'trial';
}