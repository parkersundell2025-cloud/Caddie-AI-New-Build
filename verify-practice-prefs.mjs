// Verify the PracticePreferences save flow on /profile (the TESTING.md §7 item
// I skipped). Click the "4" in DAYS PER WEEK (currently 3), then "✓ Save &
// Regenerate Plan". Confirm: user_profile.days_per_week=4, a NEW practice_plan
// row exists (newer than any pre-existing), and the sonner toast appears.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = (path) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  }).then((r) => r.json());

const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

console.log('[db] BEFORE:');
const profBefore = await db(`user_profile?user_email=eq.${EMAIL}&select=days_per_week,session_distribution,intensity_preference`);
console.log('   profile:', JSON.stringify(profBefore));
const plansBefore = await db(`practice_plan?user_email=eq.${EMAIL}&select=id,is_active,generated_at&order=generated_at.desc&limit=5`);
console.log('   practice_plan rows:', plansBefore.length, '— newest generated_at:', plansBefore[0]?.generated_at);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 2000, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] navigate to /profile…');
await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle2', timeout: 15_000 });
await sleep(2500);

console.log('[2] scroll the PracticePreferences component into view…');
await page.evaluate(() => {
  const heading = Array.from(document.querySelectorAll('*')).find((el) => /SCHEDULE SETTINGS/i.test(el.textContent || '') && el.children.length === 0);
  if (heading) heading.scrollIntoView({ block: 'center' });
});
await sleep(800);

console.log('[3] click "4" in DAYS PER WEEK (was 3)…');
const clicked4 = await page.evaluate(() => {
  // Look for buttons that contain just the digit "4" near the "Days per week" label
  const buttons = Array.from(document.querySelectorAll('button'));
  // Find a 1..6 grid by checking siblings. Simplest: find the button with exact "4" in DaysPerWeek section.
  const target = buttons.find((b) => {
    const txt = (b.textContent || '').trim();
    if (txt !== '4') return false;
    // Check it's within the PracticePreferences "DAYS PER WEEK" area by walking up and looking for the label text
    let p = b.parentElement, depth = 0;
    while (p && depth < 5) {
      if (/Days per week/i.test(p.textContent || '')) return true;
      p = p.parentElement; depth++;
    }
    return false;
  });
  if (target) { target.click(); return true; }
  return false;
});
console.log('   clicked "4":', clicked4);
await sleep(800);

console.log('[4] click "✓ Save & Regenerate Plan"…');
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Save & Regenerate Plan/i.test(b.textContent || ''));
  if (btn) btn.click();
});
// Saving spinner should appear right away
await sleep(500);
const savingVisible = await page.evaluate(() => /Saving preferences/i.test(document.body.innerText));
console.log('   "Saving preferences..." visible:', savingVisible);
await page.screenshot({ path: '/tmp/prefs-1-saving.png', fullPage: false });

console.log('[5] waiting for LLM regen + KEEP polling for toast after the plan lands…');
const t0 = Date.now();
let toastSeen = false;
let planLandedAt = null;
// Keep polling until: toast appears, OR 10 seconds AFTER plan landed (toast.success
// fires right after the plan insert — sonner toasts default to 4s visible).
while (Date.now() - t0 < 50_000) {
  await sleep(700);
  const toast = await page.evaluate(() => {
    const t = document.querySelector('[data-sonner-toast], [data-sonner-toaster] li, [data-sonner-toaster] ol li, [role="status"]');
    if (t) return (t.textContent || '').trim().slice(0, 200);
    // Also check for ANY new sonner-related element
    const anyToaster = document.querySelector('[data-sonner-toaster]');
    return anyToaster ? `(toaster-mount exists, empty: ${(anyToaster.textContent||'').trim().slice(0,80)})` : null;
  });
  if (toast && !toast.startsWith('(toaster-mount')) {
    toastSeen = true;
    console.log('   TOAST visible:', toast);
    await page.screenshot({ path: '/tmp/prefs-3-toast.png', fullPage: false });
    break;
  }
  if (!planLandedAt) {
    const fresh = await db(`practice_plan?user_email=eq.${EMAIL}&select=generated_at&order=generated_at.desc&limit=1`);
    if (fresh[0]?.generated_at && (!plansBefore[0] || fresh[0].generated_at > plansBefore[0].generated_at)) {
      planLandedAt = Date.now();
      console.log('   ✓ new practice_plan landed at t+', Math.round((Date.now() - t0)/1000), 's — toaster status:', toast || '(no toaster-mount in DOM)');
    }
  } else if (Date.now() - planLandedAt > 10_000) {
    console.log('   ✗ 10s after plan landed and still no visible toast — toaster mount status:', toast || '(no toaster-mount in DOM)');
    break;
  }
}
await page.screenshot({ path: '/tmp/prefs-2-after.png', fullPage: false });
console.log('   toast seen:', toastSeen);

console.log('[db] AFTER:');
const profAfter = await db(`user_profile?user_email=eq.${EMAIL}&select=days_per_week,session_distribution,intensity_preference`);
console.log('   profile:', JSON.stringify(profAfter));
const plansAfter = await db(`practice_plan?user_email=eq.${EMAIL}&select=id,is_active,generated_at&order=generated_at.desc&limit=5`);
console.log('   practice_plan rows:', plansAfter.length, '— newest:', plansAfter[0]?.generated_at, 'is_active:', plansAfter[0]?.is_active);
console.log('   diff: days_per_week', profBefore[0]?.days_per_week, '→', profAfter[0]?.days_per_week);

console.log('[done]');
await browser.close();
