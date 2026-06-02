// Verify the lowercase-RLS migration:
//   1. user-A (admin@silexdev.com, fully lowercase) can still read their profile (regression check)
//   2. A seeded MIXED-CASE user_email can now be read by its owner's lowercase auth.email()
//      (which was the impossible-recovery scenario before the migration)
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launchAndCheck = async (email, label) => {
  const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: `${APP_URL}/gateway` } }),
  }).then((r) => r.json()).then((j) => j.action_link);

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
    defaultViewport: { width: 420, height: 1200, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`     [pageerror]`, e.message.slice(0, 160)));

  await page.goto(link, { waitUntil: 'load' });
  for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
  await sleep(2000);
  const landed = page.url().replace(APP_URL, '');

  // Probe inside the page (RLS context) — try to SELECT my own profile
  const visible = await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js');
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.user?.email;
    const { data } = await supabase.from('user_profile').select('user_email, subscription_status, trial_end_date').eq('user_email', jwt);
    return { jwt, rows: data?.length ?? 0, stored_email: data?.[0]?.user_email };
  });
  console.log(`  ${label}`);
  console.log(`     landed at: ${landed}`);
  console.log(`     JWT email: ${visible.jwt}`);
  console.log(`     RLS-visible rows: ${visible.rows}`);
  console.log(`     stored user_email in row: ${visible.stored_email || '(none)'}`);

  await browser.close();
};

// --- Test 1: existing user-A (regression) ---
console.log('\n[1] regression: existing admin@silexdev.com should still see their profile…');
await launchAndCheck('admin@silexdev.com', 'admin@silexdev.com');

// --- Test 2: deliberately MIXED-CASE user_email ---
console.log('\n[2] new test: mixed-case user_email row should now be readable by lowercased JWT…');
const TEST_EMAIL = `MixedCase-${Date.now()}@silexdev.com`;
const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, email_confirm: true }),
}).then((r) => r.json());
const userId = userRes.id;

// Insert profile with the ORIGINAL mixed-case email (the bug scenario)
const today = new Date().toISOString().split('T')[0];
const trialEnd = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0];
const seed = await fetch(`${SUPABASE_URL}/rest/v1/user_profile`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    user_email: TEST_EMAIL,   // MIXED CASE on purpose
    first_name: 'MixedCase',
    subscription_status: 'trial',
    subscription_plan: 'pro',
    stripe_subscription_id: 'sub_mc',
    stripe_customer_id: 'cus_mc',
    onboarding_complete: true,
    trial_start_date: today,
    trial_end_date: trialEnd,
    current_handicap: 18,
    goal_handicap: 10,
  }),
});
console.log(`     seed HTTP ${seed.status}, payload user_email was: ${TEST_EMAIL}`);

await launchAndCheck(TEST_EMAIL, `${TEST_EMAIL} (mixed case)`);

// Cleanup
console.log('\n[cleanup]…');
await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_email=eq.${encodeURIComponent(TEST_EMAIL)}`, { method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
console.log('done.');
