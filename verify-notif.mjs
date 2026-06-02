// Quick targeted re-verify: confirm NotificationPreferences toggle now
// persists to user_profile.notification_preferences after the new migration.
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

console.log('[db] BEFORE:');
const before = await db(`user_profile?user_email=eq.${EMAIL}&select=notification_preferences`);
console.log('   notification_preferences:', JSON.stringify(before));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1200, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] /notifications…');
await page.goto(`${APP_URL}/notifications`, { waitUntil: 'networkidle2' });
await sleep(2500);

console.log('[2] toggle Weekly Insights…');
const toggled = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('*')).filter((el) => /Weekly Insights/i.test(el.textContent || '') && el.children.length === 0);
  for (const lbl of labels) {
    let row = lbl.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      const btn = row.querySelector('button');
      if (btn) { btn.click(); return true; }
      row = row.parentElement;
    }
  }
  return false;
});
console.log('   toggle clicked:', toggled);
await sleep(2500);
await page.screenshot({ path: '/tmp/notif-after-fix.png', fullPage: true });

console.log('[db] AFTER:');
const after = await db(`user_profile?user_email=eq.${EMAIL}&select=notification_preferences`);
console.log('   notification_preferences:', JSON.stringify(after));

console.log('[3] toggle it back to test the other direction…');
await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('*')).filter((el) => /Weekly Insights/i.test(el.textContent || '') && el.children.length === 0);
  for (const lbl of labels) {
    let row = lbl.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      const btn = row.querySelector('button');
      if (btn) { btn.click(); return; }
      row = row.parentElement;
    }
  }
});
await sleep(2500);
const after2 = await db(`user_profile?user_email=eq.${EMAIL}&select=notification_preferences`);
console.log('   after second toggle:', JSON.stringify(after2));

await browser.close();
