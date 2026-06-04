// Diagnostic for the APNs smoke test. Reads via service-role.
// Confirms each precondition the trigger needs:
//   1. user_profile.notification_preferences.push_enabled === true
//   2. device_token row exists with an iOS token
//   3. notification row was actually inserted

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

const email = 'admin@silexdev.com';
const headers = { apikey: SRK, Authorization: `Bearer ${SRK}` };

async function q(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  return { status: r.status, body: await r.json().catch(() => null) };
}

console.log(`Checking smoke test state for ${email}\n`);

// 1. profile + push_enabled
const profile = await q(`user_profile?user_email=eq.${encodeURIComponent(email)}&select=user_email,notification_preferences,subscription_status`);
console.log('--- user_profile ---');
console.log(JSON.stringify(profile.body?.[0] ?? '(no row)', null, 2));
const pushEnabled = profile.body?.[0]?.notification_preferences?.push_enabled;
console.log(`\npush_enabled: ${pushEnabled === true ? '✅ true' : `❌ ${pushEnabled}`}`);

// 2. device_token rows
const tokens = await q(`device_token?user_email=eq.${encodeURIComponent(email)}&select=id,platform,token,created_at`);
console.log('\n--- device_token rows ---');
console.log(`count: ${tokens.body?.length ?? 0}`);
for (const t of tokens.body || []) {
  console.log(`  ${t.platform} ${t.token.slice(0, 12)}... (created ${t.created_at})`);
}

// 3. recent notification rows
const notifs = await q(`notification?user_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=5&select=id,type,message,created_at`);
console.log('\n--- last 5 notifications for user ---');
console.log(`count: ${notifs.body?.length ?? 0}`);
for (const n of notifs.body || []) {
  console.log(`  [${n.type}] ${n.message?.slice(0, 60) ?? ''} (${n.created_at})`);
}
