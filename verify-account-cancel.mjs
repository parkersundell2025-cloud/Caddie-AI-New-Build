// Verify AccountScreen Cancel path shows graceful error (was NPE before fix).
// Note: SKIP Delete Account button per TESTING.md §8 (destructive).
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
  defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] /account — find Cancel Subscription button…');
await page.goto(`${APP_URL}/account`, { waitUntil: 'networkidle2' });
await sleep(3000);
await page.screenshot({ path: '/tmp/acct-cancel-1.png', fullPage: true });

const cancelClickInfo = await page.evaluate(() => {
  // Look for a button or link containing "Cancel Subscription"
  const els = Array.from(document.querySelectorAll('button, a'));
  const btn = els.find((b) => /Cancel Subscription/i.test(b.textContent || ''));
  if (!btn) return { found: false, count: els.length };
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  return { found: true, text: (btn.textContent || '').trim().slice(0, 40) };
});
console.log(`   first Cancel-button click: ${JSON.stringify(cancelClickInfo)}`);
await sleep(1500);

// A confirm modal might open. Click the destructive Cancel inside it.
const confirmInfo = await page.evaluate(() => {
  // Look for any modal-like fixed inset element
  const modal = document.querySelector('div.fixed.inset-0');
  if (!modal) return 'no-modal';
  const els = Array.from(modal.querySelectorAll('button, a'));
  // Find the destructive Cancel button (NOT "Keep Subscription")
  const btn = els.find((b) => /Cancel Subscription|Cancelling/i.test(b.textContent || '') && !/Keep/i.test(b.textContent || ''));
  if (btn) { btn.click(); return 'clicked'; }
  return 'no-btn-in-modal';
});
console.log(`   confirm dialog: ${confirmInfo}`);
await sleep(6000);
await page.screenshot({ path: '/tmp/acct-cancel-2.png', fullPage: true });

const errState = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    nullNpe: /Cannot read properties of null/.test(txt),
    friendlyMsg: /support@caddieaiapp\.com/i.test(txt),
    falseSuccessShown: /Subscription Cancelled|has been cancelled/i.test(txt),
  };
});
console.log(`   AccountScreen error state: ${JSON.stringify(errState)}`);

await browser.close();
console.log('done.');
