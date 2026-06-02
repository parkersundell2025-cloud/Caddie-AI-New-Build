// Verify TESTING.md §13 (Subscribe/Checkout pages, limited — Stripe not fully wired).
//
// Phases:
//   A. Anon /subscribe-now (no email param) → redirect to /signin.
//   B. Anon /subscribe-now?email=… → render plan picker (Basic/Pro with buy.stripe URLs).
//   C. Anon /subscription-checkout → ProtectedRoute (unauthenticated fallback).
//   D. Auth (admin@silexdev.com w/ active sub) /subscribe-now → redirect to /home.
//   E. Auth /manage-subscription → renders. Cancel click → cancelSubscription invoke
//      (expected 404 / not deployed). Page should handle gracefully.
//   F. Auth /cancel-subscription → renders. Same expected behavior.
//   G. /trial-started?session_id=fake_abc → getStripeSessionDetails fails (expected),
//      page should handle gracefully.
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
    defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
  const calls = [];
  page.on('response', async (r) => {
    const m = r.url().match(/\/functions\/v1\/(\w+)/);
    if (!m) return;
    if (!['cancelSubscription', 'getStripeSessionDetails', 'signInAfterCheckout'].includes(m[1])) return;
    let body = ''; try { body = (await r.text()).slice(0, 150); } catch {}
    calls.push({ fn: m[1], status: r.status(), body });
  });
  return { browser, page, calls };
};

// ── Phase A: anon /subscribe-now (no email) → /signin ───────────
console.log('━━━━━ A: anon /subscribe-now (no email param) ━━━━━');
{
  const { browser, page } = await launch();
  await page.goto(`${APP_URL}/subscribe-now`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  console.log(`   landed at: ${page.url()}`);
  await page.screenshot({ path: '/tmp/sub-A-anon-noemail.png', fullPage: false });
  await browser.close();
}

// ── Phase B: anon /subscribe-now?email=… → render picker ────────
console.log('\n━━━━━ B: anon /subscribe-now?email=test@x.com ━━━━━');
{
  const { browser, page } = await launch();
  await page.goto(`${APP_URL}/subscribe-now?email=test@x.com`, { waitUntil: 'networkidle2' });
  await sleep(3500);
  console.log(`   landed at: ${page.url()}`);
  await page.screenshot({ path: '/tmp/sub-B-anon-email.png', fullPage: false });
  const planButtons = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    return links
      .filter((l) => /buy\.stripe\.com/i.test(l.href || '') || /Choose|Get Basic|Get Pro|Start/i.test(l.textContent || ''))
      .map((l) => ({ text: (l.textContent || '').trim().slice(0, 30), href: l.href || null }))
      .slice(0, 6);
  });
  console.log(`   plan picker buttons/links: ${JSON.stringify(planButtons)}`);
  await browser.close();
}

// ── Phase C: anon /subscription-checkout ────────────────────────
console.log('\n━━━━━ C: anon /subscription-checkout ━━━━━');
{
  const { browser, page } = await launch();
  await page.goto(`${APP_URL}/subscription-checkout?email=test@x.com&plan=pro`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  console.log(`   landed at: ${page.url()}`);
  await page.screenshot({ path: '/tmp/sub-C-checkout-anon.png', fullPage: false });
  await browser.close();
}

// ── Phase D: auth /subscribe-now (has active sub) → /home ──────
console.log('\n━━━━━ D: auth (admin@silexdev w/ active sub) /subscribe-now ━━━━━');
{
  const { browser, page } = await launch();
  const link = await mintLink();
  await page.goto(link, { waitUntil: 'load' });
  for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
  await sleep(1500);
  await page.goto(`${APP_URL}/subscribe-now`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  console.log(`   landed at: ${page.url()}`);
  await browser.close();
}

// ── Phases E + F + G: auth pages with edge fn failures ─────────
console.log('\n━━━━━ E+F+G: auth /manage-subscription, /cancel-subscription, /trial-started ━━━━━');
const { browser, page, calls } = await launch();
const link = await mintLink();
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('\n[E] /manage-subscription…');
await page.goto(`${APP_URL}/manage-subscription`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.screenshot({ path: '/tmp/sub-E-manage.png', fullPage: false });
console.log(`   landed at: ${page.url()}`);
// Look for a Cancel button — but careful not to actually trigger it on the first run unless needed
const manageCancelBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Cancel Subscription|Cancel sub/i.test(b.textContent || ''));
  return btn ? btn.textContent.trim() : null;
});
console.log(`   Cancel button text: ${manageCancelBtn}`);
// Click it to trigger cancelSubscription edge fn
if (manageCancelBtn) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Cancel Subscription|Cancel sub/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  await sleep(3000);
  // A confirmation modal may appear — confirm it
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Confirm|Yes|Cancel anyway|I'm sure/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  await sleep(3000);
  await page.screenshot({ path: '/tmp/sub-E-manage-after-cancel.png', fullPage: false });
}

console.log('\n[F] /cancel-subscription…');
await page.goto(`${APP_URL}/cancel-subscription`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.screenshot({ path: '/tmp/sub-F-cancel.png', fullPage: false });
console.log(`   landed at: ${page.url()}`);

console.log('\n[G] /trial-started?session_id=fake_abc…');
await page.goto(`${APP_URL}/trial-started?session_id=fake_abc`, { waitUntil: 'networkidle2' });
await sleep(5000);  // edge fn 404 takes a moment to fail
await page.screenshot({ path: '/tmp/sub-G-trial.png', fullPage: false });
console.log(`   landed at: ${page.url()}`);
const trialText = await page.evaluate(() => document.body.innerText.slice(0, 300));
console.log(`   trial-started visible text: ${trialText.replace(/\n+/g, ' | ').slice(0, 250)}`);

console.log('\n[edge fn calls observed]');
calls.forEach((c, i) => console.log(`   ${i + 1}: ${c.fn} → ${c.status} — ${c.body}`));

await browser.close();
console.log('\ndone.');
