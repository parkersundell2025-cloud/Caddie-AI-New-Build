// Debug: seed user-B, log in, then dump exactly what Gateway sees.
//   - what profile.* values are visible from user-B's RLS context?
//   - what does the JWT email claim look like vs. user_profile.user_email?
//   - what does the hasAccess predicate evaluate to inline?
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_B = `dbg-${Date.now()}@silexdev.com`;

// 1) create auth user
const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: USER_B, email_confirm: true }),
}).then((r) => r.json());
const userBId = createRes.id;
console.log(`[1] created auth user — id=${userBId}, email=${createRes.email}`);

// 2) seed trial profile with both stripe linkages + future trial_end
const today = new Date().toISOString().split('T')[0];
const trialEnd = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0];
const seedProfile = {
  user_email: USER_B,
  first_name: 'Debug',
  subscription_status: 'trial',
  subscription_plan: 'pro',
  stripe_subscription_id: 'sub_dbg',
  stripe_customer_id: 'cus_dbg',
  onboarding_complete: true,
  trial_start_date: today,
  trial_end_date: trialEnd,
  current_handicap: 18,
  goal_handicap: 10,
};
console.log(`[2] seeding profile with today=${today}, trial_end_date=${trialEnd}`);
const seedRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profile`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify(seedProfile),
}).then((r) => r.json());
console.log(`   seeded: ${JSON.stringify(seedRes[0] || seedRes)?.slice(0, 200)}`);

// 3) mint magic link
const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: USER_B, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

// 4) open browser, capture Gateway's console.log output, capture final URL
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1600, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('console', (msg) => {
  const text = msg.text();
  if (/RootRoute|Gateway|profile|subscription/i.test(text)) {
    console.log(`   [browser]`, text.slice(0, 200));
  }
});
page.on('pageerror', (e) => console.log(`   [pageerror]`, e.message.slice(0, 160)));

console.log('[3] navigating via magic link…');
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && /\/gateway/.test(page.url()); i++) await sleep(500);
await sleep(2500);
console.log(`[4] landed at: ${page.url()}`);

// 5) Inside the page (user-B's auth context), query the profile and evaluate hasAccess.
const probe = await page.evaluate(async () => {
  const { supabase } = await import('/src/lib/supabase.js');
  // Get user-B's JWT claims
  const { data: { session } } = await supabase.auth.getSession();
  const jwtEmail = session?.user?.email;
  // Query the profile (RLS applies)
  const { data, error } = await supabase.from('user_profile').select('*').eq('user_email', jwtEmail);
  const profile = data?.[0];
  // Replicate hasAccess inline
  const today = new Date().toISOString().split('T')[0];
  let hasAccess = false;
  let reason = '';
  if (!profile) { reason = 'NO PROFILE'; }
  else if (!profile.stripe_customer_id && !profile.revenuecat_app_user_id) { reason = 'NO PAYMENT LINKAGE'; }
  else if (profile.subscription_status === 'trial') {
    if (!profile.trial_end_date) { reason = 'trial but no trial_end_date'; }
    else if (profile.trial_end_date < today) { reason = `trial expired: end=${profile.trial_end_date} < today=${today}`; }
    else { hasAccess = true; reason = 'trial OK'; }
  } else if (['basic', 'pro'].includes(profile.subscription_status)) {
    hasAccess = true;
    reason = `paid: ${profile.subscription_status}`;
  } else {
    reason = `unhandled status: ${profile.subscription_status}`;
  }
  return {
    jwtEmail,
    profile_visible: !!profile,
    profile_email: profile?.user_email,
    profile_status: profile?.subscription_status,
    profile_stripe_customer_id: profile?.stripe_customer_id,
    profile_stripe_subscription_id: profile?.stripe_subscription_id,
    profile_trial_end_date: profile?.trial_end_date,
    profile_onboarding_complete: profile?.onboarding_complete,
    today,
    hasAccess,
    reason,
    rlsError: error?.message,
  };
});
console.log(`[5] probe inside user-B's auth context:`);
console.log(JSON.stringify(probe, null, 2));

await browser.close();

// 6) cleanup
console.log('[6] cleanup…');
await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userBId}`, { method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_email=eq.${USER_B}`, { method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
console.log('done.');
