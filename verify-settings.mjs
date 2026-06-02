// Verify TESTING.md §8 (Account / Settings pages).
//  A. /settings renders + has nav buttons.
//  B. /account renders. (Destructive: skip Delete Account.)
//  C. /notifications — toggle a switch, verify user_profile.notification_preferences.
//  D. /referral — verify referral_code populated, referral_page_visited true.
//  E. /send-feedback — submit form, verify new feedback row.
//  F. /club-distances — change driver_distance, save, verify user_profile.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());

const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

console.log('[db] state BEFORE:');
const before = await db(`user_profile?user_email=eq.${EMAIL}&select=referral_code,referral_page_visited,notification_preferences,driver_distance`);
console.log('   profile:', JSON.stringify(before));
console.log('   feedback rows:', (await db(`feedback?user_email=eq.${EMAIL}&select=id`)).length);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1600, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

// ── A. /settings ────────────────────────────────────────────────
console.log('[A] /settings…');
await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
await sleep(2000);
await page.screenshot({ path: '/tmp/set-1-settings.png', fullPage: true });
console.log('   on:', page.url());

// ── B. /account ─────────────────────────────────────────────────
console.log('[B] /account…');
await page.goto(`${APP_URL}/account`, { waitUntil: 'networkidle2' });
await sleep(2000);
await page.screenshot({ path: '/tmp/set-2-account.png', fullPage: true });

// ── C. /notifications — toggle weekly_insights ───────────────────
console.log('[C] /notifications — toggling weekly_insights…');
await page.goto(`${APP_URL}/notifications`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.screenshot({ path: '/tmp/set-3-notif-before.png', fullPage: true });

// Each ToggleRow renders a button. Find the row with "Weekly Insights" label.
const toggleBefore = before[0]?.notification_preferences?.weekly_insights;
console.log('   weekly_insights BEFORE:', toggleBefore);
const toggled = await page.evaluate(() => {
  // Find the button inside a ToggleRow next to the "Weekly Insights" label
  const labels = Array.from(document.querySelectorAll('*')).filter((el) => /Weekly Insights/i.test(el.textContent || '') && el.children.length === 0);
  for (const lbl of labels) {
    // Walk up to find the ToggleRow container, then look for a button (the switch)
    let row = lbl.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      const btn = row.querySelector('button');
      if (btn) { btn.click(); return true; }
      row = row.parentElement;
    }
  }
  return false;
});
console.log('   weekly_insights toggle clicked:', toggled);
await sleep(2500);
const profAfterToggle = await db(`user_profile?user_email=eq.${EMAIL}&select=notification_preferences`);
console.log('   notification_preferences AFTER:', JSON.stringify(profAfterToggle[0]?.notification_preferences));
await page.screenshot({ path: '/tmp/set-3-notif-after.png', fullPage: true });

// ── D. /referral ────────────────────────────────────────────────
console.log('[D] /referral…');
await page.goto(`${APP_URL}/referral`, { waitUntil: 'networkidle2' });
await sleep(3500);  // page mount may generate referral_code + mark visited
await page.screenshot({ path: '/tmp/set-4-referral.png', fullPage: true });
const profAfterRef = await db(`user_profile?user_email=eq.${EMAIL}&select=referral_code,referral_page_visited`);
console.log('   profile after /referral:', JSON.stringify(profAfterRef));

// ── E. /send-feedback — submit form ──────────────────────────────
console.log('[E] /send-feedback — submitting form…');
await page.goto(`${APP_URL}/send-feedback`, { waitUntil: 'networkidle2' });
await sleep(2500);
// Click feedback type "Bug Report"
const feedbackTypeClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Bug Report/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   Bug Report selected:', feedbackTypeClicked);
await sleep(500);
// Fill subject + description by finding the first text input + textarea
const filled = await page.evaluate(() => {
  const input = document.querySelector('input[type=text], input:not([type])');
  const ta = document.querySelector('textarea');
  if (!input || !ta) return false;
  const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const taSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  inputSetter.call(input, 'Verify §8 test subject');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  taSetter.call(ta, 'Automated puppeteer test — this should land as a feedback row.');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
});
console.log('   subject+description filled:', filled);
await sleep(500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Submit|Send Feedback/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await sleep(5000);
await page.screenshot({ path: '/tmp/set-5-feedback-after.png', fullPage: true });
const newFeedback = await db(`feedback?user_email=eq.${EMAIL}&select=feedback_type,subject,description,submitted_at,status&order=submitted_at.desc&limit=3`);
console.log('   feedback rows AFTER (latest 3):', JSON.stringify(newFeedback));

// ── F. /club-distances — change driver, save ─────────────────────
console.log('[F] /club-distances — bumping driver_distance by 5…');
await page.goto(`${APP_URL}/club-distances`, { waitUntil: 'networkidle2' });
await sleep(3000);
const driverBefore = before[0]?.driver_distance;
console.log('   driver_distance BEFORE:', driverBefore);
const targetDriver = (driverBefore || 240) + 5;
// Driver is the first club input by JSX order. Find inputs and target index 0.
await page.evaluate((v) => {
  const inputs = Array.from(document.querySelectorAll('input[type=number]'));
  if (!inputs.length) throw new Error('no number inputs found on /club-distances');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], String(v));
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
}, targetDriver);
await sleep(500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\s*(Save|Save Changes|Save Distances)\s*$/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await sleep(2500);
await page.screenshot({ path: '/tmp/set-6-clubs.png', fullPage: true });
const profAfterClubs = await db(`user_profile?user_email=eq.${EMAIL}&select=driver_distance`);
console.log('   driver_distance AFTER:', profAfterClubs[0]?.driver_distance, '(expected:', targetDriver, ')');

console.log('[done]');
await browser.close();
