// Configurable base URL for referral links — update this when app moves to permanent domain
export const REFERRAL_BASE_URL = 'https://caddieaiapp.com';

export function getReferralLink(code) {
  return `${REFERRAL_BASE_URL}/subscribe-now?ref=${code}`;
}

export function generateReferralCode(name) {
  const clean = (name || 'USER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'USER';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${clean}-${suffix}`;
}