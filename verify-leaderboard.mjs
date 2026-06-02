// Verify TESTING.md §9 (/leaderboard).
//  - 4 tabs: month, week, streaks, alltime — each fires getLeaderboard with different body.
//  - User's own leaderboard_entry exists (from §4/§6 side effects) but meets_age_criteria=false,
//    so it won't appear in the public list. myEntry may still render.
//  - /leaderboard-info loads.
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

// Capture all getLeaderboard requests/responses for evidence the edge fn was hit per tab
const lbCalls = [];
page.on('response', async (r) => {
  if (r.url().includes('/functions/v1/getLeaderboard')) {
    try {
      const body = JSON.parse(await r.text());
      lbCalls.push({ status: r.status(), entries: body.entries?.length ?? null, myEntry: !!body.myEntry, prevChampion: !!body.prevChampion, hof: body.hallOfFame?.length ?? null });
    } catch {}
  }
});

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[1] /leaderboard — initial (month tab)…');
await page.goto(`${APP_URL}/leaderboard`, { waitUntil: 'networkidle2' });
await sleep(3500);
await page.screenshot({ path: '/tmp/lb-1-month.png', fullPage: true });

console.log('[2] click each tab and screenshot…');
for (const label of ['This Week', 'Streaks', 'All Time']) {
  const clicked = await page.evaluate((lbl) => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === lbl);
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
  console.log(`   "${label}" clicked:`, clicked);
  await sleep(3000);
  await page.screenshot({ path: `/tmp/lb-2-${label.toLowerCase().replace(/\s+/g, '')}.png`, fullPage: true });
}

console.log('[3] /leaderboard-info…');
await page.goto(`${APP_URL}/leaderboard-info`, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.screenshot({ path: '/tmp/lb-3-info.png', fullPage: true });

console.log('\n[edge fn calls observed]');
lbCalls.forEach((c, i) => console.log(`   call ${i + 1}:`, JSON.stringify(c)));

await browser.close();
console.log('done.');
