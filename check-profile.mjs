// Quick service-role read of a user_profile row. Reads SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY from .env.local; first arg is the email to check.
//
// Usage:
//   node check-profile.mjs admin@silexdev.com

import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SRK) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node check-profile.mjs <email>');
  process.exit(1);
}

const url = `${SUPABASE_URL}/rest/v1/user_profile?user_email=eq.${encodeURIComponent(email)}&select=user_email,subscription_status,trial_start_date,trial_end_date,stripe_customer_id,revenuecat_app_user_id,onboarding_complete`;

const res = await fetch(url, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});

if (!res.ok) {
  console.error('Error:', res.status, await res.text());
  process.exit(1);
}

const rows = await res.json();
if (rows.length === 0) {
  console.log(`No profile found for ${email}`);
  process.exit(0);
}

const today = new Date().toISOString().split('T')[0];
console.log(`Today (UTC): ${today}`);
console.log('');
for (const r of rows) {
  console.log(JSON.stringify(r, null, 2));
}
