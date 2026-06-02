// Re-verify §13 using the correct (post-migration) routes.
//   - /checkout (was /subscription-checkout)
//   - /checkout/success (was /trial-started)
//   - /manage-subscription, /cancel-subscription — unchanged, just confirming the Cancel
//     button click on /manage-subscription triggers cancelSubscription and the page
//     handles the failure gracefully.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mintLink = () => fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

const launch = async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
    defaultViewport: { width: 420, height: 2400, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
  const calls = [];
  page.on('response', async (r) => {
    const m = r.url().match(/\/functions\/v1\/(\w+)/);
    if (!m) return;
    let body = ''; try { body = (await r.text()).slice(0, 150); } catch {}
    calls.push({ fn: m[1], status: r.status(), body });
  });
  return { browser, page, calls };
};

// C-fixed: anon /checkout?email=…&plan=pro
console.log('━━━━━ C-FIXED: anon /checkout?email=test@x.com&plan=pro ━━━━━');
{
  const { browser, page } = await launch();
  await page.goto(`${APP_URL}/checkout?email=test@x.com&plan=pro`, { waitUntil: 'networkidle2', timeout: 30_000 });
  await sleep(4000);
  console.log(`   landed at: ${page.url()}`);
  await page.screenshot({ path: '/tmp/sub-Cfix-checkout.png', fullPage: false });
  const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 250).replace(/\n+/g, ' | '));
  console.log(`   page text: ${visibleText}`);
  await browser.close();
}

// G-fixed: anon /checkout/success
console.log('\n━━━━━ G-FIXED: anon /checkout/success ━━━━━');
{
  const { browser, page } = await launch();
  await page.goto(`${APP_URL}/checkout/success`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  console.log(`   landed at: ${page.url()}`);
  await page.screenshot({ path: '/tmp/sub-Gfix-success.png', fullPage: false });
  const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '));
  console.log(`   page text: ${visibleText}`);
  await browser.close();
}

// E-deep: auth /manage-subscription, click Cancel → confirm → expect cancelSubscription 404
console.log('\n━━━━━ E-DEEP: auth /manage-subscription, click Cancel + Confirm ━━━━━');
const { browser, page, calls } = await launch();
const link = await mintLink();
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);
await page.goto(`${APP_URL}/manage-subscription`, { waitUntil: 'networkidle2' });
await sleep(3000);

// Cancel button is at bottom (small text), scroll to it
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^Cancel Subscription$/i.test((b.textContent || '').trim()));
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
});
await sleep(2000);
await page.screenshot({ path: '/tmp/sub-Edeep-confirm.png', fullPage: false });

// Confirm modal should be open — click the "Cancel Subscription" inside the modal (red text)
const confirmedClicked = await page.evaluate(() => {
  // Find the modal first, then the destructive button inside it
  const modal = document.querySelector('div.fixed.inset-0');
  if (!modal) return 'no-modal';
  // Within modal, find the destructive button (red "Cancel Subscription" text, NOT "Keep Subscription")
  const btn = Array.from(modal.querySelectorAll('button')).find((b) => /Cancel Subscription|Cancelling/i.test(b.textContent || ''));
  if (btn) { btn.click(); return 'clicked'; }
  return 'no-btn';
});
console.log(`   confirm dialog result: ${confirmedClicked}`);
await sleep(5000);  // edge fn call
await page.screenshot({ path: '/tmp/sub-Edeep-after.png', fullPage: false });

const errorText = await page.evaluate(() => {
  const txt = document.body.innerText;
  return txt.match(/(Failed|Error|404|not found|cancellation|cancel)/gi)?.slice(0, 5);
});
console.log(`   error/status keywords: ${errorText}`);

console.log('\n[edge fn calls observed]');
calls.forEach((c, i) => console.log(`   ${i + 1}: ${c.fn} → ${c.status} — ${c.body}`));

await browser.close();
console.log('\ndone.');
