// Smoke test for createStripeCheckoutSession.
// Signs in as admin@silexdev.com via magic link, grabs the access_token,
// calls the function for both plans, prints the Session URLs.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const FN_URL = `${SUPABASE_URL}/functions/v1/createStripeCheckoutSession`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
}).then((r) => r.json()).then((j) => j.action_link);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 800, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(link, { waitUntil: 'load' });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

const accessToken = await page.evaluate(() => {
  const raw = localStorage.getItem('sb-dbvsnzppevytanoxzgwj-auth-token');
  try { return JSON.parse(raw).access_token; } catch { return null; }
});
console.log('admin user access_token grabbed:', !!accessToken);

await browser.close();

for (const plan of ['basic', 'pro']) {
  console.log(`\n── plan=${plan} ──`);
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, return_url_origin: APP_URL }),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  console.log(`session_id: ${body.session_id}`);
  console.log(`session_url: ${body.session_url?.slice(0, 100)}...`);
  console.log(`error: ${body.error || '(none)'}`);
}
