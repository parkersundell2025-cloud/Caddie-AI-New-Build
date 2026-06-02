// Verify TESTING.md §4 (/plan). Mints magic-link, opens /plan, generates a
// plan (real LLM via invokeLLM proxy), opens Start Session → CoachBriefing →
// ActiveSessionMode. Screenshots each state.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';

if (!SRK) { console.error('SRK env var not set'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dbQuery(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  return r.json();
}

async function mintLink() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'magiclink',
      email: EMAIL,
      options: { redirect_to: `${APP_URL}/gateway` },
    }),
  });
  const j = await r.json();
  return j.action_link;
}

console.log('[db] practice_plan rows BEFORE:');
const before = await dbQuery(`practice_plan?user_email=eq.${EMAIL}&select=id,week_start_date,is_active,generated_at`);
console.log('   ', JSON.stringify(before));

console.log('[1] minting magic-link…');
const actionLink = await mintLink();

console.log('[2] launching Chrome…');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1200, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || t.includes('[Gateway]') || t.includes('Error') || t.includes('error')) {
    console.log('   [page]', m.type(), t.slice(0, 180));
  }
});

console.log('[3] authenticating via action_link…');
await page.goto(actionLink, { waitUntil: 'load', timeout: 30_000 });
// Wait for routing to settle
for (let i = 0; i < 60 && !page.url().includes('/home') && !page.url().includes('/onboarding') && !page.url().includes('/subscribe-now') && !page.url().includes('/signin'); i++) {
  await sleep(500);
}
await sleep(2000);
console.log('   landed on:', page.url());

console.log('[4] navigate to /plan…');
await page.goto(`${APP_URL}/plan`, { waitUntil: 'networkidle2', timeout: 20_000 });
await sleep(2000);
await page.screenshot({ path: '/tmp/plan-1-initial.png', fullPage: true });
console.log('   screenshot → /tmp/plan-1-initial.png');

const hasNoPlanCTA = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button,a')).some((el) => /Generate Plan|Generate your first practice plan/i.test(el.textContent || ''))
);
console.log('   "Generate Plan" CTA visible:', hasNoPlanCTA);

if (hasNoPlanCTA) {
  console.log('[5] clicking Generate Plan (real LLM call — may take 5-15s)…');
  // The button text in the no-plan card is "Generate Plan"; the header has "New Plan".
  // Click whichever is present.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button,a')).find((el) => /^\s*Generate Plan\s*→?\s*$/i.test(el.textContent || ''));
    if (btn) btn.click();
  });
  // Wait for sessions to appear (day cards render once plan_data.sessions exists)
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const ready = await page.evaluate(() => /TODAY/.test(document.body.innerText) || document.body.innerText.includes('Range Day') || document.body.innerText.includes('Putting'));
    if (ready) break;
    await sleep(1000);
  }
  await sleep(2500);
  await page.screenshot({ path: '/tmp/plan-2-generated.png', fullPage: true });
  console.log('   screenshot → /tmp/plan-2-generated.png  (after generation, took', Math.round((Date.now() - t0)/1000), 's)');
}

console.log('[db] practice_plan rows AFTER:');
const after = await dbQuery(`practice_plan?user_email=eq.${EMAIL}&select=id,week_start_date,is_active,generated_at`);
console.log('   ', JSON.stringify(after));

console.log('[6] looking for today\'s "Start Session →" button…');
const startBtnFound = await page.evaluate(() => {
  // Find a button with text "Start Session" — today's card shows this once expanded.
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Start Session/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  // If not found, try expanding today first.
  const todayBadge = Array.from(document.querySelectorAll('*')).find((el) => el.textContent && el.textContent.trim() === 'TODAY');
  if (todayBadge) {
    let p = todayBadge;
    while (p && p.tagName !== 'BUTTON') p = p.parentElement;
    if (p) { p.click(); return 'expanded'; }
  }
  return false;
});
console.log('   Start Session click result:', startBtnFound);

if (startBtnFound === 'expanded') {
  await sleep(1000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Start Session/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
}

console.log('[7] waiting for CoachBriefing modal (LLM briefing)…');
// CoachBriefing has "Coach's Briefing" text. Wait up to 12s for LLM (timed out → falls to defaults).
const t1 = Date.now();
while (Date.now() - t1 < 18_000) {
  const seen = await page.evaluate(() => /Coach's Briefing/i.test(document.body.innerText));
  if (seen) break;
  await sleep(500);
}
await sleep(3000); // give LLM briefing time to populate
await page.screenshot({ path: '/tmp/plan-3-briefing.png', fullPage: true });
console.log('   screenshot → /tmp/plan-3-briefing.png');

console.log('[8] clicking "Let\'s Go" → ActiveSessionMode…');
const wentToActive = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Let'?s Go/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   Let\'s Go clicked:', wentToActive);
await sleep(2500);
await page.screenshot({ path: '/tmp/plan-4-active.png', fullPage: true });
console.log('   screenshot → /tmp/plan-4-active.png');

console.log('[9] completing session — click each drill rating to advance…');
// Click "Clicked" (best rating) per drill. ActiveSessionMode shows "Drill N of M".
for (let i = 0; i < 6; i++) {  // max 6 attempts — guard against unexpected state
  await sleep(1500);
  const state = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/Drill (\d+) of (\d+)/);
    return { hasRating: /Clicked/.test(t) && /Struggled/.test(t), drill: m ? m[0] : null };
  });
  if (!state.hasRating) { console.log('   no more rating buttons at iteration', i, '— state:', state.drill); break; }
  console.log('   rating:', state.drill, '→ click Clicked');
  const clicked = await page.evaluate(() => {
    // textContent may include emoji prefix like "⚡Clicked"; match by includes
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim().endsWith('Clicked'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) console.log('   (Clicked button NOT FOUND)');
}

console.log('[10] waiting for SessionCelebration…');
const t2 = Date.now();
while (Date.now() - t2 < 15_000) {
  const seen = await page.evaluate(() => /Session Complete|Locked in|dialed in|Tough day|Back to Plan|Share Achievement/i.test(document.body.innerText));
  if (seen) break;
  await sleep(500);
}
await sleep(3500); // let LLM coach note render
await page.screenshot({ path: '/tmp/plan-5-celebration.png', fullPage: true });
console.log('   screenshot → /tmp/plan-5-celebration.png');

console.log('[db] verifying side effects…');
const logs = await dbQuery(`session_log?user_email=eq.${EMAIL}&select=id,session_date,session_type,completed&order=created_date.desc&limit=3`);
const ratings = await dbQuery(`drill_rating?user_email=eq.${EMAIL}&select=id,drill_name,rating&order=created_date.desc&limit=5`);
console.log('   session_log latest:', JSON.stringify(logs));
console.log('   drill_rating latest:', JSON.stringify(ratings));

console.log('[11] navigate back to /plan to confirm "Session Complete" badge…');
await page.goto(`${APP_URL}/plan`, { waitUntil: 'networkidle2', timeout: 15_000 });
await sleep(2500);
await page.screenshot({ path: '/tmp/plan-6-after.png', fullPage: true });
console.log('   screenshot → /tmp/plan-6-after.png');

console.log('[done]');
await browser.close();
