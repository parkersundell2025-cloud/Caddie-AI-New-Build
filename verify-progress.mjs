// Verify TESTING.md §6 (/progress).
//  A. Empty state → log round today → DB + UI confirms.
//  B. Log round yesterday + 2-days-ago → 3 rounds total → updateHandicap fires
//     → HandicapHero shows calculated value.
//  C. Log a suspicious round today (score way below expected) → flagged_round.
//  D. Attempt 3rd round today → silent no-op (rate limit).
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = (path) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  }).then((r) => r.json());

const ymd = (d) => d.toISOString().split('T')[0];
const today = new Date();
const yesterday = new Date(Date.now() - 86400e3);
const twoDaysAgo = new Date(Date.now() - 2 * 86400e3);

async function mintLink() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
  });
  return (await r.json()).action_link;
}

async function logRoundViaUI(page, { course, date, score, fwHit, fwAvail, gir, putts }) {
  // Pro path: header "Log Round" → PreRoundGamePlan modal → inner "Log Round →"
  // → LogRoundModal (the form). Both onDismiss/onProceed on PreRoundGamePlan
  // close it and open the form.
  // Step 1: header "Log Round" → PreRoundGamePlan (JS click is enough; we
  // already proved it fires React's handleLogRoundClick).
  const clicked1 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim().endsWith('Log Round'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked1) throw new Error('header Log Round button not found');
  // Wait for PreRoundGamePlan's "Log Round →" button (which has the arrow) to appear inside the modal
  let advanced = false;
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const clicked2 = await page.evaluate(() => {
      // PreRoundGamePlan sits inside a fixed inset-0 overlay. Find the inner
      // "Log Round →" — there may also be one on the empty-state Recent Rounds
      // section, so pick the last (modal renders last in DOM).
      const matches = Array.from(document.querySelectorAll('button')).filter((b) => /Log Round →/.test(b.textContent || ''));
      // Prefer one within a .fixed parent (the modal overlay)
      const modal = matches.find((b) => {
        let p = b.parentElement;
        while (p) { if (p.className && /\bfixed\b/.test(p.className)) return true; p = p.parentElement; }
        return false;
      });
      const target = modal || matches[matches.length - 1];
      if (target) { target.click(); return true; }
      return false;
    });
    if (clicked2) { advanced = true; break; }
  }
  if (!advanced) throw new Error('"Log Round →" inside PreRoundGamePlan never appeared');
  // wait for LogRoundModal form (date input)
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => !!document.querySelector('input[type=date]'))) break;
    await sleep(150);
  }
  const modalReady = await page.evaluate(() => !!document.querySelector('input[type=date]'));
  if (!modalReady) throw new Error('LogRoundModal form did not open');

  // Exact placeholder match — `.includes()` was matching 'e.g. 84' for 'e.g. 8',
  // causing fairways_hit to overwrite total_score.
  const fill = async (placeholder, value) => {
    await page.evaluate((p, v) => {
      const el = Array.from(document.querySelectorAll('input,textarea')).find((i) => i.placeholder === p);
      if (!el) throw new Error('input not found by exact placeholder: ' + p);
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, placeholder, String(value));
  };
  // Date field is type=date, no placeholder
  await page.evaluate((v) => {
    const el = document.querySelector('input[type=date]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, date);
  await fill('Augusta National...', course);
  await fill('e.g. 84', score);
  await fill('e.g. 8', fwHit);
  await fill('14', fwAvail);
  await fill('e.g. 6 (out of 18)', gir);
  await fill('e.g. 32', putts);

  // Save
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Save Round/.test(b.textContent || ''));
    if (btn) btn.click();
  });
}

console.log('[db] state BEFORE:');
console.log('   rounds:', (await db(`round?user_email=eq.${EMAIL}&select=round_date,total_score`)).length);
console.log('   profile:', JSON.stringify(await db(`user_profile?user_email=eq.${EMAIL}&select=current_handicap,handicap_last_updated`)));
console.log('   flagged_round:', (await db(`flagged_round?user_email=eq.${EMAIL}&select=*`)).length);

console.log('[1] auth + /progress…');
const link = await mintLink();
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);
await page.goto(`${APP_URL}/progress`, { waitUntil: 'networkidle2', timeout: 20_000 });
await sleep(2500);
await page.screenshot({ path: '/tmp/progress-1-empty.png', fullPage: true });
console.log('   screenshot → /tmp/progress-1-empty.png');

console.log('[A] log round 1 — today, score 85…');
await logRoundViaUI(page, { course: 'Augusta National', date: ymd(today), score: 85, fwHit: 8, fwAvail: 14, gir: 8, putts: 32 });
await sleep(4500);
console.log('   rounds in DB:', (await db(`round?user_email=eq.${EMAIL}&select=round_date,total_score&order=round_date.desc`)).length);

console.log('[B1] log round 2 — yesterday, score 90…');
await logRoundViaUI(page, { course: 'Pebble Beach', date: ymd(yesterday), score: 90, fwHit: 7, fwAvail: 14, gir: 5, putts: 34 });
await sleep(4500);

console.log('[B2] log round 3 — 2 days ago, score 88…');
await logRoundViaUI(page, { course: 'St Andrews', date: ymd(twoDaysAgo), score: 88, fwHit: 9, fwAvail: 14, gir: 6, putts: 33 });
await sleep(6000);  // give updateHandicap longer (it itself invokes calculateHandicap)
const after3 = await db(`round?user_email=eq.${EMAIL}&select=round_date,total_score&order=round_date.desc`);
const profileAfter3 = await db(`user_profile?user_email=eq.${EMAIL}&select=current_handicap,handicap_last_updated`);
console.log('   rounds in DB:', after3.length, JSON.stringify(after3));
console.log('   profile after updateHandicap:', JSON.stringify(profileAfter3));

await page.reload({ waitUntil: 'networkidle2' });
await sleep(3500);
await page.screenshot({ path: '/tmp/progress-2-three-rounds.png', fullPage: true });
console.log('   screenshot → /tmp/progress-2-three-rounds.png');

console.log('[C] log suspicious round — today round 2, score 60 (should flag)…');
await logRoundViaUI(page, { course: 'Test Flag Course', date: ymd(today), score: 60, fwHit: 14, fwAvail: 14, gir: 18, putts: 22 });
await sleep(5000);
const flaggedAfter = await db(`flagged_round?user_email=eq.${EMAIL}&select=user_email,round_id,logged_score,expected_score,status&order=created_date.desc`);
console.log('   flagged_round rows:', flaggedAfter.length, JSON.stringify(flaggedAfter));
const after4 = await db(`round?user_email=eq.${EMAIL}&select=round_date,total_score&order=round_date.desc`);
console.log('   total rounds now:', after4.length);

console.log('[D] rate-limit — try to log 3rd round today (score 100), should silent no-op…');
await logRoundViaUI(page, { course: 'Rate Limit Test', date: ymd(today), score: 100, fwHit: 4, fwAvail: 14, gir: 2, putts: 38 });
await sleep(4500);
const after5 = await db(`round?user_email=eq.${EMAIL}&select=round_date,total_score&order=round_date.desc`);
console.log('   rounds after 3rd today attempt:', after5.length, '(should still be 4 — no-op silent)');

await page.reload({ waitUntil: 'networkidle2' });
await sleep(4000);
await page.screenshot({ path: '/tmp/progress-3-final.png', fullPage: true });
console.log('   screenshot → /tmp/progress-3-final.png');

console.log('[done]');
await browser.close();
