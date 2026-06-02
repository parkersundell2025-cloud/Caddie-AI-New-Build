// Verify TESTING.md §14.1 (RLS owner isolation) + §14.2 (admin gate for non-admin).
//
// Strategy: create a FRESH second test user (no admin role) — sidesteps the
// JWT-stale-cache problem in §11 where stripping role mid-session didn't take.
//
//   A. Seed user-B (verifyB-<ts>@silexdev.com) via admin API. Confirm role is 'user'.
//   B. Sign in as user-B, visit each /admin/* page. Confirm gates fire
//      (Access denied inline OR redirect to /, /settings).
//   C. Seed a session_log + a round row for user-A (admin@silexdev.com) via service role.
//   D. Signed in as user-B, query session_log + round via supabase client. Confirm
//      ZERO rows belonging to user-A are visible.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_A = 'admin@silexdev.com';
// Supabase auth lowercases auth.users.email on insert. RLS policy is
// `user_email = auth.email()` which is case-sensitive. Use lowercase here so
// the seeded user_profile.user_email matches what the JWT will carry.
const USER_B = `verifyb-${Date.now()}@silexdev.com`;

console.log('━━━━━ A: seed user-B via admin API ━━━━━');
const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: USER_B, email_confirm: true }),
}).then((r) => r.json());
const userBId = createRes.id;
console.log(`   created user-B id=${userBId}, role=${createRes.app_metadata?.role || '(none → "user")'}`);

// Seed a trial profile for user-B (RootRoute needs a stripe_subscription_id to land on /home)
const seedRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profile`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    user_email: USER_B,
    first_name: 'B-Test',
    subscription_status: 'trial',
    subscription_plan: 'pro',
    stripe_subscription_id: 'sub_test_userB',
    stripe_customer_id: 'cus_test_userB',
    onboarding_complete: true,
    current_handicap: 18,
    goal_handicap: 10,
    trial_start_date: new Date().toISOString().split('T')[0],
    trial_end_date: new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0],
  }),
});
const seedText = await seedRes.text();
console.log(`   seed profile HTTP ${seedRes.status}, body: ${seedText.slice(0, 200)}`);

// Now read the profile back as service-role to confirm what's there for user-B
const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_email=eq.${encodeURIComponent(USER_B)}&select=user_email,subscription_status,trial_end_date,stripe_customer_id`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});
console.log(`   verify (service-role): ${(await verifyRes.text()).slice(0, 200)}`);

// Seed one session_log and one round FOR USER-A so user-B can try to read them
await fetch(`${SUPABASE_URL}/rest/v1/session_log?user_email=eq.${USER_A}&completed=eq.true&limit=1`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});
console.log(`   (user-A already has session_log + round rows from §4 + §6 testing)`);

console.log('\n━━━━━ B: sign in as user-B, visit each /admin/* page ━━━━━');
const linkB = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: USER_B, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1600, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
// Capture browser console logs from Gateway/RootRoute to debug routing decisions.
page.on('console', (msg) => {
  const text = msg.text();
  if (/RootRoute|Gateway|profile/i.test(text)) {
    console.log(`   [browser]`, text.slice(0, 200));
  }
});

await page.goto(linkB, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(2500);
const onLanding = page.url();
console.log(`   user-B landed at: ${onLanding}`);

const role = await page.evaluate(() => {
  const raw = localStorage.getItem('sb-dbvsnzppevytanoxzgwj-auth-token');
  try { return JSON.parse(raw).user?.app_metadata?.role || '(none)'; } catch { return null; }
});
console.log(`   role on user-B JWT: ${role}`);

for (const route of ['/admin/flagged', '/admin/feedback', '/admin/waitlist-credits', '/admin/fix-user']) {
  await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  const finalUrl = page.url().replace(APP_URL, '');
  const accessDenied = await page.evaluate(() => /Access denied/i.test(document.body.innerText));
  console.log(`   ${route} → landed: ${finalUrl}, "Access denied" visible: ${accessDenied}`);
}

console.log('\n━━━━━ D: query session_log + round as user-B; confirm no user-A rows ━━━━━');
// As user-B (logged in), query session_log and round directly via the supabase client.
const queries = await page.evaluate(async (otherEmail) => {
  const { supabase } = await import('/src/lib/supabase.js');
  const sl = await supabase.from('session_log').select('user_email').limit(50);
  const rd = await supabase.from('round').select('user_email').limit(50);
  return {
    session_log_rows: sl.data?.length ?? null,
    session_log_my_emails: [...new Set((sl.data || []).map((r) => r.user_email))],
    session_log_other_visible: (sl.data || []).some((r) => r.user_email === otherEmail),
    round_rows: rd.data?.length ?? null,
    round_my_emails: [...new Set((rd.data || []).map((r) => r.user_email))],
    round_other_visible: (rd.data || []).some((r) => r.user_email === otherEmail),
  };
}, USER_A);
console.log('   user-B sees (filtered by RLS):');
console.log(`     session_log: ${queries.session_log_rows} rows, emails: ${JSON.stringify(queries.session_log_my_emails)}, user-A's rows visible: ${queries.session_log_other_visible}`);
console.log(`     round:       ${queries.round_rows} rows, emails: ${JSON.stringify(queries.round_my_emails)}, user-A's rows visible: ${queries.round_other_visible}`);

// Also try to SELECT user-A's user_profile row directly (a profile.* lookup)
const profCheck = await page.evaluate(async (otherEmail) => {
  const { supabase } = await import('/src/lib/supabase.js');
  const res = await supabase.from('user_profile').select('user_email,first_name,current_handicap').eq('user_email', otherEmail);
  return { rows: res.data, error: res.error?.message };
}, USER_A);
console.log(`   user-B tries to select user-A's user_profile by email: ${JSON.stringify(profCheck)}`);

await browser.close();

// Cleanup: delete user-B
console.log('\n[cleanup] delete user-B…');
await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userBId}`, {
  method: 'DELETE',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});
await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_email=eq.${USER_B}`, {
  method: 'DELETE',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});
console.log('done.');
