// Verify the AdminWaitlistCredits NULL-status fix:
//   - seed one credit with status=null (Pending) and one with status='Failed'
//   - load /admin/waitlist-credits as admin
//   - both render in distinct buckets, screenshot confirms
//   - click Apply Credit on the Pending one → DB shows status='Applied'
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seed = async (status) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist_credit`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ user_email: `wlfix-${status ?? 'null'}-${Date.now()}@test.com`, credit_amount: 7, waitlist_signup_date: '2026-04-01', ...(status ? { status } : {}) }),
  });
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
};

const pending = await seed(null);
const failed = await seed('Failed');
console.log('seeded pending id:', pending?.id?.slice(0, 8), 'status:', pending?.status);
console.log('seeded failed  id:', failed?.id?.slice(0, 8), 'status:', failed?.status);

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
await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/home/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] /admin/waitlist-credits — render both buckets…');
await page.goto(`${APP_URL}/admin/waitlist-credits`, { waitUntil: 'networkidle2' });
await sleep(3000);
await page.screenshot({ path: '/tmp/wlfix-1-before.png', fullPage: true });

const sectionTexts = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    hasPendingHeader: /Pending Credits/i.test(txt),
    hasFailedHeader: /Failed Credits/i.test(txt),
    hasOpenStat: /\bOpen\b/.test(txt),
    pendingBadgeCount: (txt.match(/^\s*Pending\s*$/gm) || []).length,
    failedBadgeCount: (txt.match(/^\s*Failed\s*$/gm) || []).length,
  };
});
console.log('   section presence:', JSON.stringify(sectionTexts));

console.log('[2] click Apply Credit on the FIRST card (Pending bucket renders first)…');
const beforeApply = await fetch(`${SUPABASE_URL}/rest/v1/waitlist_credit?id=eq.${pending.id}&select=status`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());
console.log('   pending row status BEFORE click:', beforeApply[0]?.status);
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button')).filter((b) => /Apply Credit/i.test(b.textContent || ''));
  if (btns.length) { btns[0].click(); return btns.length; }
  return 0;
});
console.log('   Apply Credit button count + first clicked:', clicked);
await sleep(5000);
await page.screenshot({ path: '/tmp/wlfix-2-after.png', fullPage: true });
const afterApply = await fetch(`${SUPABASE_URL}/rest/v1/waitlist_credit?id=eq.${pending.id}&select=status,date_applied`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }).then((r) => r.json());
console.log('   pending row AFTER click:', JSON.stringify(afterApply));

await browser.close();
console.log('done.');
