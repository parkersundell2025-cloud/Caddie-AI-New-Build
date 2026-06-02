// Verify TESTING.md §10 (Pro features) — all four components mount on /progress.
//  A. MonthlyGamePlanCard — initial render reads cache; "Regenerate" → force:true → new row.
//  B. WeeklyReports — "Generate" → generateWeeklyReport → fields render → second call cached.
//  C. CompetitorIntel — only 1 paid user in DB, expect "not enough data" branch.
//  D. PreRoundGamePlan — modal still renders 3-sentence plan (already exercised in §6;
//     re-confirm by clicking "Log Round" header button and waiting for the modal).
//  E. proWeeklyCoachMessage — out-of-band: invoke with the page's bearer token,
//     verify a new chat_message row prefixed "[Weekly check-in]".
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

console.log('[db] BEFORE:');
const mgpBefore = await db(`monthly_game_plan?user_email=eq.${EMAIL}&select=id,month_year,created_date&order=created_date.desc`);
const wkBefore = await db(`weekly_report?user_email=eq.${EMAIL}&select=id,week_of,generated_at&order=generated_at.desc`);
const chatBefore = await db(`chat_message?user_email=eq.${EMAIL}&role=eq.assistant&select=id,content,created_date&order=created_date.desc&limit=3`);
console.log(`   monthly_game_plan rows: ${mgpBefore.length} (latest month_year: ${mgpBefore[0]?.month_year})`);
console.log(`   weekly_report rows: ${wkBefore.length}`);
console.log(`   recent assistant chat_messages: ${chatBefore.length}`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 2400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

const calls = [];
page.on('response', async (r) => {
  const fn = r.url().match(/\/functions\/v1\/(\w+)/)?.[1];
  if (!fn) return;
  if (!['generateMonthlyGamePlan', 'generateWeeklyReport', 'getCompetitorIntel', 'generatePreRoundGamePlan', 'proWeeklyCoachMessage'].includes(fn)) return;
  try {
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch {}
    calls.push({ fn, status: r.status(), keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 8) : null });
  } catch {}
});

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

// Grab the bearer token for §E (proWeeklyCoachMessage curl).
const SB_REF = SUPABASE_URL.match(/https:\/\/(\w+)\.supabase\.co/)[1];
const authToken = await page.evaluate((ref) => {
  const raw = localStorage.getItem(`sb-${ref}-auth-token`);
  if (!raw) return null;
  try { return JSON.parse(raw).access_token; } catch { return null; }
}, SB_REF);
console.log(`   bearer token captured: ${!!authToken}`);

console.log('\n[1] /progress — let all 4 Pro components mount + load…');
await page.goto(`${APP_URL}/progress`, { waitUntil: 'networkidle2' });
await sleep(5000);  // gen edge fns can take a few seconds
await page.screenshot({ path: '/tmp/pro-1-progress.png', fullPage: true });

// ── A. MonthlyGamePlanCard — open modal, then click Regenerate ────
console.log('\n[A] MonthlyGamePlanCard — open modal…');
const monthlyOpened = await page.evaluate(() => {
  // The card has "Monthly Game Plan" label. Find a clickable container with that text.
  const el = Array.from(document.querySelectorAll('*')).find((n) =>
    /Monthly Game Plan/i.test(n.textContent || '') && n.tagName === 'BUTTON'
  );
  if (el) { el.click(); return true; }
  // Fallback: find any element with text "Monthly Game Plan" and click its closest button parent.
  const lbl = Array.from(document.querySelectorAll('*')).find((n) => /^\s*Monthly Game Plan\s*$/i.test(n.textContent || '') && n.children.length === 0);
  if (lbl) {
    let p = lbl.parentElement;
    for (let i = 0; i < 6 && p; i++) { if (p.tagName === 'BUTTON') { p.click(); return true; } p = p.parentElement; }
    // Or click the card itself
    let div = lbl.parentElement;
    for (let i = 0; i < 6 && div; i++) {
      if (div.onclick || div.getAttribute('role') === 'button') { div.click(); return true; }
      div = div.parentElement;
    }
  }
  return false;
});
console.log('   monthly card opened:', monthlyOpened);
await sleep(2000);
await page.screenshot({ path: '/tmp/pro-2-monthly-modal.png', fullPage: true });

console.log('   click Regenerate button…');
const regenClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Regenerate/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   Regenerate clicked:', regenClicked);
await sleep(15000);  // LLM generation
await page.screenshot({ path: '/tmp/pro-3-monthly-regen.png', fullPage: true });
const mgpAfter = await db(`monthly_game_plan?user_email=eq.${EMAIL}&select=id,month_year,created_date&order=created_date.desc`);
console.log(`   monthly_game_plan rows AFTER: ${mgpAfter.length} (latest id: ${mgpAfter[0]?.id?.slice(0, 8)}…, was: ${mgpBefore[0]?.id?.slice(0, 8)}…)`);
console.log(`   new row? ${mgpAfter[0]?.id !== mgpBefore[0]?.id}`);

// Close modal (Esc or click X)
await page.keyboard.press('Escape');
await sleep(500);

// ── B. WeeklyReports — open accordion + click Generate ────────────
console.log('\n[B] WeeklyReports — open + Generate…');
// Scroll to it
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find((n) => /Week of/i.test(n.textContent || '') && n.children.length === 0);
  if (el) el.scrollIntoView({ block: 'center' });
});
await sleep(500);
// Click the "Week of" header to open the accordion
const wkOpened = await page.evaluate(() => {
  // The button has "Week of" text. Find it.
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Week of/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   WeeklyReports accordion opened:', wkOpened);
await sleep(1500);
const genClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\s*Generate\s*$/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   "Generate" clicked:', genClicked);
await sleep(20000);  // LLM
await page.screenshot({ path: '/tmp/pro-4-weekly.png', fullPage: true });
const wkAfter = await db(`weekly_report?user_email=eq.${EMAIL}&select=id,week_of,generated_at,this_week_numbers,drill_of_the_week,coachs_take&order=generated_at.desc`);
console.log(`   weekly_report rows AFTER: ${wkAfter.length} (latest: week_of=${wkAfter[0]?.week_of}, has drill=${!!wkAfter[0]?.drill_of_the_week}, has coachs_take=${!!wkAfter[0]?.coachs_take})`);

// ── C. CompetitorIntel — already auto-loaded on mount; just snapshot ──
console.log('\n[C] CompetitorIntel — snapshot (already mounted)…');
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find((n) => /Competitor Intel/i.test(n.textContent || '') && n.children.length === 0);
  if (el) el.scrollIntoView({ block: 'center' });
});
await sleep(500);
await page.screenshot({ path: '/tmp/pro-5-competitor.png', fullPage: true });
const ciText = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find((n) => /Competitor Intel/i.test(n.textContent || '') && n.children.length < 3);
  // Walk up to the card
  let p = el?.parentElement;
  for (let i = 0; i < 5 && p; i++) { if ((p.textContent || '').length > 80) return (p.textContent || '').slice(0, 500); p = p.parentElement; }
  return null;
});
console.log('   Competitor Intel text:', ciText);

// ── D. PreRoundGamePlan — click "Log Round" header button ─────────
console.log('\n[D] PreRoundGamePlan — click header Log Round button → wait for plan modal…');
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(500);
const logBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Log Round/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('   Log Round clicked:', logBtn);
await sleep(20000);  // LLM
await page.screenshot({ path: '/tmp/pro-6-preround.png', fullPage: true });
// Look for the 3-sentence plan in the modal
const preroundText = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find((n) => /Game plan|pre-round|first tee/i.test(n.textContent || '') && (n.textContent || '').length < 1500 && (n.textContent || '').length > 80);
  return el ? (el.textContent || '').slice(0, 500) : null;
});
console.log('   Pre-Round Game Plan text snippet:', preroundText?.slice(0, 200));

// ── E. proWeeklyCoachMessage — curl with bearer ─────────────────
console.log('\n[E] proWeeklyCoachMessage — invoke with bearer token…');
if (authToken) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/proWeeklyCoachMessage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, apikey: SRK, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  console.log(`   status: ${res.status} — body: ${body.slice(0, 300)}`);
  await sleep(2000);
  const chatAfter = await db(`chat_message?user_email=eq.${EMAIL}&role=eq.assistant&select=id,content,created_date&order=created_date.desc&limit=3`);
  console.log(`   recent assistant chat_messages AFTER: ${chatAfter.length} (newest content start: ${chatAfter[0]?.content?.slice(0, 80)})`);
  const newOnes = chatAfter.filter((c) => !chatBefore.find((b) => b.id === c.id));
  console.log(`   NEW assistant messages since: ${newOnes.length}, prefixed [Weekly check-in]? ${newOnes.some((m) => /\[Weekly check-in\]/.test(m.content || ''))}`);
}

console.log('\n[edge fn calls observed]');
calls.forEach((c, i) => console.log(`   ${i + 1}: ${c.fn} → ${c.status} — keys: ${c.keys?.join(',')}`));

await browser.close();
console.log('\ndone.');
