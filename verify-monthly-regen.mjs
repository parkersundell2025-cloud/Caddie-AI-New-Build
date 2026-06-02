// Focused retry: open MonthlyGamePlanCard modal and force a regen.
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

const before = await db(`monthly_game_plan?user_email=eq.${EMAIL}&select=id,monthly_focus,created_date&order=created_date.desc&limit=1`);
console.log('BEFORE: id=', before[0]?.id?.slice(0, 8), ' focus(20)=', before[0]?.monthly_focus?.slice(0, 60));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 2400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));
const calls = [];
page.on('response', async (r) => {
  if (r.url().includes('/functions/v1/generateMonthlyGamePlan')) {
    try { const b = JSON.parse(await r.text()); calls.push({ status: r.status(), cached: b.cached, planId: b.plan?.id?.slice(0, 8) }); } catch {}
  }
});
await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] /progress, scroll to "This Month\'s Game Plan", click it…');
await page.goto(`${APP_URL}/progress`, { waitUntil: 'networkidle2' });
await sleep(5000);
const opened = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /This Month's Game Plan/i.test(b.textContent || ''));
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
  return false;
});
console.log('   card clicked:', opened);
await sleep(2000);
await page.screenshot({ path: '/tmp/mgp-modal.png', fullPage: false });

console.log('[2] click Regenerate inside modal…');
const regen = await page.evaluate(() => {
  // Regen is an icon-only button (RefreshCw SVG, no text). Find it by the SVG class.
  const svg = document.querySelector('svg.lucide-refresh-cw');
  const btn = svg?.closest('button');
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   Regenerate clicked:', regen);
await sleep(25_000);  // LLM
await page.screenshot({ path: '/tmp/mgp-after-regen.png', fullPage: false });

const after = await db(`monthly_game_plan?user_email=eq.${EMAIL}&select=id,monthly_focus,created_date&order=created_date.desc&limit=2`);
console.log('AFTER: rows=', after.length);
after.forEach((r, i) => console.log(`   ${i}: id=${r.id?.slice(0,8)}, created=${r.created_date}, focus(60)=${r.monthly_focus?.slice(0,60)}`));
console.log('NEW row inserted?', after[0]?.id !== before[0]?.id);
console.log('edge fn calls:', JSON.stringify(calls));

await browser.close();
