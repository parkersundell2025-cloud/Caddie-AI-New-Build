// Quick existence check for the tables we care about via PostgREST. Uses
// the anon key — so this only tells us whether the tables are reachable,
// not whether triggers, functions, or vault secrets are set up. Run the
// audit SQL block in the dashboard for those.
//
// Usage:
//   node audit-supabase.mjs

import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=').reduce((acc, _, i, arr) => (i === 0 ? [arr[0], arr.slice(1).join('=')] : acc), null))
    .filter(Boolean),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;

const checkTable = async (name) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=*&limit=0`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (r.status === 200) return { table: name, exists: true };
  const body = await r.text().catch(() => '');
  // 404 from postgrest = relation does not exist.
  if (r.status === 404 || /relation .* does not exist/i.test(body)) {
    return { table: name, exists: false };
  }
  // RLS-blocked 401/403 means the row reads are gated but the table is real.
  if (r.status === 401 || r.status === 403) return { table: name, exists: true, rlsBlocked: true };
  return { table: name, exists: 'unknown', status: r.status, body: body.slice(0, 120) };
};

const TABLES = ['user_profile', 'notification', 'device_token', 'practice_plan', 'badge'];
const results = await Promise.all(TABLES.map(checkTable));

console.log('Table existence (via anon REST API):');
for (const r of results) {
  const mark = r.exists === true ? '✅' : r.exists === false ? '❌' : '⚠️';
  const rls = r.rlsBlocked ? ' (RLS blocks reads — expected)' : '';
  console.log(`  ${mark} ${r.table}${rls}`);
}
console.log('');
console.log('What this DOES verify:');
console.log('  • The table is in the public schema and reachable by PostgREST');
console.log('');
console.log('What this does NOT verify (you still need the dashboard audit query):');
console.log('  • pg_net extension installed');
console.log('  • notify_user_push_on_notification_insert function exists');
console.log('  • trg_notification_push trigger exists on public.notification');
console.log('  • vault secrets supabase_url + service_role_key are seeded');
console.log('  • Migration history table reflects the new migrations');
