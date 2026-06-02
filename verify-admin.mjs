// Verify TESTING.md §11 (Admin pages, JWT app_metadata.role='admin' gated).
//
// Phases:
//   A. Non-admin: visit each of 4 admin pages. AdminFlagged + AdminFeedback render
//      "Access denied" inline; AdminWaitlistCredits redirects to /; AdminFixUser to
//      /settings.
//   B. Grant role via PUT /auth/v1/admin/users/{id}.
//   C. Mint a fresh magic link (new JWT carries the role).
//   D. Drive each admin page as admin and verify DB side effects.
//   E. Curl getUsageReport with admin user JWT.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(init || {}) }).then((r) => r.json());

const mintLink = () => fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
    defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
  return { browser, page };
};

const authAndLand = async (page) => {
  const link = await mintLink();
  await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
  for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin|settings|gateway)/.test(page.url()); i++) await sleep(500);
  await sleep(1500);
};

// ── PHASE A — non-admin ──────────────────────────────────────────
// First strip the admin role (some earlier call PUT it), then re-test the gate.
console.log('━━━━━ PHASE A — strip admin role, then visit admin pages ━━━━━');
const userListA = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${EMAIL}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());
const userIdA = userListA.users?.[0]?.id;
// Supabase admin PUT merges app_metadata — to remove a key, set it to null explicitly.
const stripRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userIdA}`, {
  method: 'PUT',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_metadata: { role: null, provider: 'email', providers: ['email'] } }),
}).then((r) => r.json());
console.log(`   strip result app_metadata: ${JSON.stringify(stripRes.app_metadata)}`);
await sleep(1500);  // small buffer before generate_link to avoid stale-JWT cache
console.log('   logging in fresh…');
{
  const { browser, page } = await launchBrowser();
  await authAndLand(page);
  // Confirm role is NOT admin yet
  const role = await page.evaluate(() => {
    const ref = 'dbvsnzppevytanoxzgwj';
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    try { return JSON.parse(raw).user?.app_metadata?.role || 'user'; } catch { return 'parse-err'; }
  });
  console.log(`   role on JWT: ${role}`);

  for (const route of ['/admin/flagged', '/admin/feedback', '/admin/waitlist-credits', '/admin/fix-user']) {
    await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle2' });
    await sleep(2500);
    const landedAt = page.url().replace(APP_URL, '');
    const accessDenied = await page.evaluate(() => /Access denied/i.test(document.body.innerText));
    console.log(`   ${route} → landed at: ${landedAt}, "Access denied" visible: ${accessDenied}`);
  }
  await browser.close();
}

// ── PHASE B — grant admin role ───────────────────────────────────
console.log('\n━━━━━ PHASE B — grant app_metadata.role=admin ━━━━━');
const userList = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${EMAIL}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());
const userId = userList.users?.[0]?.id;
console.log(`   user_id: ${userId}`);
const putRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
  method: 'PUT',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_metadata: { role: 'admin', provider: 'email', providers: ['email'] } }),
});
const putBody = await putRes.json();
console.log(`   PUT status: ${putRes.status}, role on user: ${putBody.app_metadata?.role}`);

// ── PHASE C — seed waitlist_credit for §D ────────────────────────
console.log('\n━━━━━ PHASE C — seed a waitlist_credit row ━━━━━');
// Actual CHECK constraint is status in ('Applied','Failed'). The UI only renders the
// "Apply Credit" button for status='Failed' rows (it has no Pending bucket). So seed
// with 'Failed' to drive the Apply path.
const seedRaw = await fetch(`${SUPABASE_URL}/rest/v1/waitlist_credit`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ user_email: `waitlist-test-${Date.now()}@example.com`, credit_amount: 5, waitlist_signup_date: '2026-04-01', status: 'Failed' }),
});
const seedText = await seedRaw.text();
console.log(`   seed status: ${seedRaw.status}, body: ${seedText.slice(0, 200)}`);
let seedRes; try { seedRes = JSON.parse(seedText); } catch { seedRes = []; }
const seededCreditId = Array.isArray(seedRes) ? seedRes[0]?.id : seedRes?.id;
console.log(`   seeded credit id: ${seededCreditId}`);

// Reset the previously-approved flagged_round back to 'pending' so D1 has a row to drive.
await fetch(`${SUPABASE_URL}/rest/v1/flagged_round?id=eq.34991230-e6d3-4d9f-8891-330ecc278239`, {
  method: 'PATCH',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'pending' }),
});
console.log('   reset flagged_round to pending for D1');

// ── PHASE D — admin pages, fresh JWT ─────────────────────────────
console.log('\n━━━━━ PHASE D — drive admin pages with admin JWT ━━━━━');
const { browser, page } = await launchBrowser();
await authAndLand(page);

const role2 = await page.evaluate(() => {
  const ref = 'dbvsnzppevytanoxzgwj';
  const raw = localStorage.getItem(`sb-${ref}-auth-token`);
  try { return JSON.parse(raw).user?.app_metadata?.role; } catch { return null; }
});
console.log(`   role on fresh JWT: ${role2}`);

// ── D1. /admin/flagged — approve the pending flagged_round ─────
console.log('\n[D1] /admin/flagged — approve pending flagged_round…');
const flaggedBefore = await db(`flagged_round?status=eq.pending&select=id,user_email,status&limit=1`);
console.log(`   pending flagged_round BEFORE: ${JSON.stringify(flaggedBefore)}`);
await page.goto(`${APP_URL}/admin/flagged`, { waitUntil: 'networkidle2' });
await sleep(3000);
await page.screenshot({ path: '/tmp/adm-1-flagged.png', fullPage: true });
const approveClicked = await page.evaluate(() => {
  // First card on "rounds" tab — first Approve button.
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\s*Approve\s*$/i.test((b.textContent || '').replace(/ /g, ' ')));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log(`   Approve clicked: ${approveClicked}`);
await sleep(2500);
const flaggedAfter = await db(`flagged_round?id=eq.${flaggedBefore[0]?.id}&select=id,status`);
console.log(`   flagged_round AFTER: ${JSON.stringify(flaggedAfter)} (expected status=approved)`);

// ── D2. /admin/feedback — change status to "in review" ──────────
console.log('\n[D2] /admin/feedback — change feedback row status…');
const fbBefore = await db(`feedback?user_email=eq.${EMAIL}&select=id,status&order=submitted_at.desc&limit=1`);
console.log(`   feedback BEFORE: ${JSON.stringify(fbBefore)}`);
try {
  await page.goto(`${APP_URL}/admin/feedback`, { waitUntil: 'networkidle2', timeout: 15_000 });
} catch (e) { console.log(`   [navigation note] ${e.message.slice(0, 80)}`); }
await sleep(3500);
// Feedback rows render collapsed. Click the chevron to expand, then status buttons appear.
const expandedClicked = await page.evaluate(() => {
  const chev = document.querySelector('svg.lucide-chevron-down');
  const btn = chev?.closest('button');
  if (btn) { btn.click(); return 'chevron'; }
  return null;
}).catch((e) => `err: ${e.message.slice(0, 60)}`);
console.log(`   expanded feedback row via: ${expandedClicked}`);
await sleep(2000);
await page.screenshot({ path: '/tmp/adm-2-feedback.png', fullPage: true });
const reviewClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\s*In review\s*$/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
}).catch((e) => `err: ${e.message.slice(0, 60)}`);
console.log(`   "In review" clicked: ${reviewClicked}`);
await sleep(2500);
const fbAfter = await db(`feedback?id=eq.${fbBefore[0]?.id}&select=id,status`);
console.log(`   feedback AFTER: ${JSON.stringify(fbAfter)} (expected status="in review")`);

// ── D3. /admin/waitlist-credits — apply the seeded credit ──────
console.log('\n[D3] /admin/waitlist-credits — apply credit…');
await page.goto(`${APP_URL}/admin/waitlist-credits`, { waitUntil: 'networkidle2' });
await sleep(3000);
await page.screenshot({ path: '/tmp/adm-3-credits.png', fullPage: true });
const applyClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Apply Credit/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log(`   Apply Credit clicked: ${applyClicked}`);
await sleep(5000);
const creditAfter = await db(`waitlist_credit?id=eq.${seededCreditId}&select=id,status,date_applied`);
console.log(`   waitlist_credit AFTER: ${JSON.stringify(creditAfter)} (expected status=Applied)`);

// ── D4. /admin/fix-user — create a new profile ─────────────────
console.log('\n[D4] /admin/fix-user — create profile for fixme@test.com…');
const fixTargetEmail = `fixme-${Date.now()}@test.com`;
await page.goto(`${APP_URL}/admin/fix-user`, { waitUntil: 'networkidle2' });
await sleep(3000);
await page.screenshot({ path: '/tmp/adm-4-fix-before.png', fullPage: true });
await page.evaluate((email) => {
  const inputs = Array.from(document.querySelectorAll('input'));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  // First input = email, second = subscriptionId
  setter.call(inputs[0], email);
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(inputs[1], 'sub_dev_test_999');
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  // Plan select — set to 'pro'
  const sel = document.querySelector('select');
  if (sel) {
    const selSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    selSetter.call(sel, 'pro');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, fixTargetEmail);
await sleep(500);
const submitClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Create.*Profile/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log(`   submit clicked: ${submitClicked}`);
await sleep(6000);  // edge fn createManualUserProfile
await page.screenshot({ path: '/tmp/adm-4-fix-after.png', fullPage: true });
// createManualUserProfile hardcodes subscription_status='trial' and stores plan in subscription_plan.
const fixUser = await db(`user_profile?user_email=eq.${fixTargetEmail}&select=user_email,stripe_subscription_id,subscription_status,subscription_plan,trial_end_date`);
console.log(`   profile after: ${JSON.stringify(fixUser)} (expected subscription_plan=pro, subscription_status=trial)`);

// ── PHASE E — getUsageReport curl ────────────────────────────────
console.log('\n━━━━━ PHASE E — getUsageReport with admin JWT ━━━━━');
const adminToken = await page.evaluate(() => {
  const ref = 'dbvsnzppevytanoxzgwj';
  const raw = localStorage.getItem(`sb-${ref}-auth-token`);
  try { return JSON.parse(raw).access_token; } catch { return null; }
});
const usage = await fetch(`${SUPABASE_URL}/functions/v1/getUsageReport`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${adminToken}`, apikey: SRK, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const usageBody = await usage.text();
console.log(`   status: ${usage.status} — body keys: ${(() => { try { return Object.keys(JSON.parse(usageBody)).join(','); } catch { return 'parse-err'; } })()} — first 200: ${usageBody.slice(0, 200)}`);

await browser.close();
console.log('\n[done]');
