// Re-verify ManageSubscription + CancelSubscription show graceful error after
// the bug-fix (was showing a JS NPE / silent false-success on 404).
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 2400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[A] /manage-subscription — click bottom "Cancel Subscription" + confirm…');
await page.goto(`${APP_URL}/manage-subscription`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^Cancel Subscription$/i.test((b.textContent || '').trim()));
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
});
await sleep(1500);
await page.evaluate(() => {
  const modal = document.querySelector('div.fixed.inset-0');
  const btn = Array.from((modal || document).querySelectorAll('button')).find((b) => /Cancel Subscription|Cancelling/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await sleep(6000);
await page.screenshot({ path: '/tmp/cancelfix-A-manage.png', fullPage: false });
const manageErr = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    nullNpe: /Cannot read properties of null/.test(txt),
    friendlyMsg: /support@caddieaiapp\.com|email support/i.test(txt),
    cancelSuccessShown: /(has been cancelled|Subscription Cancelled)/i.test(txt),
  };
});
console.log(`   ManageSubscription error state: ${JSON.stringify(manageErr)}`);

console.log('\n[B] /cancel-subscription — click "Cancel Subscription"…');
await page.goto(`${APP_URL}/cancel-subscription`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^Cancel Subscription$/i.test((b.textContent || '').trim()));
  if (btn) btn.click();
});
await sleep(6000);
await page.screenshot({ path: '/tmp/cancelfix-B-cancel.png', fullPage: false });
const cancelState = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    nullNpe: /Cannot read properties of null/.test(txt),
    friendlyMsg: /support@caddieaiapp\.com|email support/i.test(txt),
    falseSuccessShown: /Subscription Cancelled|You will retain access/i.test(txt) && !/Are you sure/i.test(txt),
  };
});
console.log(`   CancelSubscription state: ${JSON.stringify(cancelState)}`);

await browser.close();
console.log('done.');
