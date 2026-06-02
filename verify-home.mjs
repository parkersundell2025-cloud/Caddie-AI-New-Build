// One-shot script: mint magic-link, drive headless Chrome to /home, screenshot.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const SHOT = '/tmp/home.png';

if (!SRK) { console.error('SRK env var not set'); process.exit(2); }

console.log('[1/4] minting magic link…');
const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'magiclink',
    email: EMAIL,
    options: { redirect_to: `${APP_URL}/gateway` },
  }),
});
const linkJson = await linkRes.json();
if (!linkJson.action_link) { console.error('no action_link:', linkJson); process.exit(2); }
console.log('    action_link minted (len=', linkJson.action_link.length, ')');

console.log('[2/4] launching Chrome…');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
});
const page = await browser.newPage();

// Useful: pipe console + page errors
page.on('console', msg => {
  const t = msg.text();
  if (t.startsWith('[RootRoute]') || t.startsWith('[Gateway]') || msg.type() === 'error') {
    console.log('    [page]', msg.type(), t.slice(0, 160));
  }
});
page.on('pageerror', err => console.log('    [pageerror]', err.message.slice(0, 200)));

console.log('[3/4] following action_link → expecting /home after auth + routing…');
await page.goto(linkJson.action_link, { waitUntil: 'load', timeout: 30_000 });
// Let Supabase exchange the token + AuthContext load + Gateway/RootRoute route us through.
// Wait up to 30s for /home (or any post-routing destination).
const start = Date.now();
let final = null;
while (Date.now() - start < 30_000) {
  await new Promise(r => setTimeout(r, 500));
  const url = page.url();
  if (url.includes('/home') || url.includes('/onboarding') || url.includes('/subscribe-now') || url.includes('/signin')) {
    // give the page a moment for data fetches
    await new Promise(r => setTimeout(r, 3000));
    final = url;
    break;
  }
}
console.log('    landed on:', final || page.url());

console.log('[4/4] screenshot →', SHOT);
await page.screenshot({ path: SHOT, fullPage: true });

// Inventory: dump the visible text of key sections for verification
const html = await page.content();
const snippet = await page.evaluate(() => document.body.innerText.slice(0, 4000));
console.log('---visible text snippet (first 4000 chars)---');
console.log(snippet);
console.log('---end snippet---');

await browser.close();
console.log('done.');
