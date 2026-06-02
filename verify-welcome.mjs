// Verify TESTING.md §12 (Pre-auth Welcome flow at /welcome).
//   1. Hero + sections render.
//   2. EmailCapture submit → waitlist_email INSERT succeeds (public RLS).
//   3. WaitlistCounter renders count via getWaitlistCount edge fn; refresh updates.
//
// Runs without authentication — the browser is fresh, no magic link minted.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());
const dbCount = async (table) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '*/0';
  return Number(cr.split('/')[1]);
};

console.log('[db] BEFORE:');
const countBefore = await dbCount('waitlist_email');
console.log(`   waitlist_email count: ${countBefore}`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 2400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

const calls = [];
page.on('response', async (r) => {
  if (r.url().includes('/functions/v1/getWaitlistCount')) {
    try { const b = JSON.parse(await r.text()); calls.push({ status: r.status(), count: b.count }); } catch {}
  }
});

console.log('\n[1] /welcome (no auth) — render hero + sections…');
await page.goto(`${APP_URL}/welcome`, { waitUntil: 'networkidle2', timeout: 30_000 });
await sleep(3500);
await page.screenshot({ path: '/tmp/welc-1-hero.png', fullPage: false });

const sections = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    h1Count: document.querySelectorAll('h1').length,
    emailInputs: document.querySelectorAll('input[type=email]').length,
    submitButtons: Array.from(document.querySelectorAll('button')).filter((b) => /Try for Free/i.test(b.textContent || '')).length,
    hasHowItWorks: /How it Works|How It Works/i.test(txt),
    hasTestimonials: /Testimonials|What.{0,3}re saying|Real golfers/i.test(txt),
    hasFooter: /Privacy|Terms|©/i.test(txt),
    waitlistCounterText: (() => {
      const m = txt.match(/(\d[\d,]*)\s*(golfers|on the waitlist|joined|signed up)/i);
      return m ? m[0] : null;
    })(),
  };
});
console.log('   sections:', JSON.stringify(sections));

console.log('\n[2] submit EmailCapture form — focus + type + click Submit button…');
const testEmail = `verify-welcome-${Date.now()}@test.com`;
// Use native keyboard events so React picks up state changes synchronously.
await page.focus('input[type=email]');
await page.type('input[type=email]', testEmail, { delay: 5 });
await sleep(300);
// Click the Submit button (first "Try for Free →" — there are two EmailCapture instances).
const submitted = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Try for Free/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log(`   filled+submitted ${testEmail}: ${submitted}`);
await sleep(4000);  // network + InstallModal animation
await page.screenshot({ path: '/tmp/welc-2-after-submit.png', fullPage: false });

const rowsAfter = await db(`waitlist_email?email=eq.${testEmail}&select=email,submitted_at`);
console.log(`   DB row inserted: ${JSON.stringify(rowsAfter)}`);

const countAfter = await dbCount('waitlist_email');
console.log(`   waitlist_email count AFTER: ${countAfter} (was ${countBefore})`);

// Modal might have opened — close it before refresh test
await page.evaluate(() => {
  const close = Array.from(document.querySelectorAll('button')).find((b) => /Close|×|Not now/i.test(b.textContent || ''));
  if (close) close.click();
});
await sleep(500);

console.log('\n[3] reload /welcome — counter should reflect new count…');
await page.goto(`${APP_URL}/welcome`, { waitUntil: 'networkidle2', timeout: 30_000 });
await sleep(4000);
await page.screenshot({ path: '/tmp/welc-3-reload.png', fullPage: false });
const counterAfter = await page.evaluate(() => {
  const txt = document.body.innerText;
  const m = txt.match(/(\d[\d,]*)\s*(golfers|on the waitlist|joined|signed up)/i);
  return m ? m[0] : null;
});
console.log(`   counter text after reload: ${counterAfter}`);

console.log('\n[edge fn calls observed]');
calls.forEach((c, i) => console.log(`   ${i + 1}: getWaitlistCount → ${c.status}, count=${c.count}`));

await browser.close();
console.log('\ndone.');
