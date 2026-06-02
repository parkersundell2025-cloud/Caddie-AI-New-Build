// Verify TESTING.md §5 (/coach). Auth, open /coach, wait for opening LLM msg,
// send a user message, wait for reply, navigate Home → Coach to confirm
// within-session history persistence.
import puppeteer from 'puppeteer-core';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dbQuery = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
}).then((r) => r.json());

const mintLink = async () => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
  });
  return (await r.json()).action_link;
};

console.log('[db] chat_message BEFORE:');
const before = await dbQuery(`chat_message?user_email=eq.${EMAIL}&select=role,content,timestamp&order=timestamp.asc`);
console.log('   rows:', before.length);
before.forEach((m) => console.log(`   - ${m.role}: ${m.content.slice(0, 80)}…`));

console.log('[1] auth + /coach…');
const action = await mintLink();
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('   [page error]', m.text().slice(0, 180));
});

await page.goto(action, { waitUntil: 'load', timeout: 30_000 });
// Wait for auth + initial routing
for (let i = 0; i < 30 && !page.url().includes('/home') && !page.url().includes('/onboarding') && !page.url().includes('/subscribe-now') && !page.url().includes('/signin'); i++) {
  await sleep(500);
}
await sleep(1500);
console.log('   landed first on:', page.url());

console.log('[2] navigate to /coach, wait for opening LLM message…');
await page.goto(`${APP_URL}/coach`, { waitUntil: 'networkidle2', timeout: 20_000 });

// Wait for the assistant opening message to appear (Coach.jsx: generatingOpening
// shows loader → message bubble appears). LLM may take 3-15s.
const t0 = Date.now();
while (Date.now() - t0 < 25_000) {
  const visible = await page.evaluate(() => {
    // Find the first non-empty assistant message bubble (rounded-bl-sm class is the assistant style)
    const bubbles = Array.from(document.querySelectorAll('div'));
    const opener = bubbles.find((b) => b.className && /rounded-bl-sm/.test(b.className) && (b.innerText || '').trim().length > 30);
    return opener ? opener.innerText.slice(0, 200) : null;
  });
  if (visible) {
    console.log('   opening message:', visible.slice(0, 160));
    break;
  }
  await sleep(800);
}
await sleep(1500);
await page.screenshot({ path: '/tmp/coach-1-opening.png', fullPage: true });
console.log('   screenshot → /tmp/coach-1-opening.png');

console.log('[3] verify chat_message row created (role=assistant)…');
const afterOpen = await dbQuery(`chat_message?user_email=eq.${EMAIL}&select=role,content,timestamp&order=timestamp.asc`);
console.log('   total rows:', afterOpen.length, '(was', before.length, ')');
const newest = afterOpen[afterOpen.length - 1];
console.log('   newest:', newest?.role, '—', newest?.content?.slice(0, 120), '…');

console.log('[4] send a user message…');
const USER_MSG = 'Whats one drill i can do tonight to fix my chipping?';
// Find input by placeholder
await page.evaluate((msg) => {
  const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder?.includes('Talk to your coach'));
  if (!input) throw new Error('input not found');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, msg);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, USER_MSG);
await sleep(300);
// Click the send button (it's the round button next to the input). Send icon = lucide Send svg.
await page.evaluate(() => {
  // The send button is the second button in the input row. Find the input, then its sibling button.
  const input = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder?.includes('Talk to your coach'));
  if (!input) return;
  const row = input.closest('.flex') || input.parentElement;
  const btn = row?.querySelector('button');
  if (btn) btn.click();
});

console.log('[5] waiting for assistant reply (LLM)…');
const t1 = Date.now();
let replyText = null;
while (Date.now() - t1 < 30_000) {
  await sleep(800);
  const stats = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('div')).filter((d) => d.className && /rounded-(br-sm|bl-sm)/.test(d.className));
    const user = bubbles.filter((b) => /rounded-br-sm/.test(b.className)).map((b) => b.innerText.trim()).filter(Boolean);
    const assistant = bubbles.filter((b) => /rounded-bl-sm/.test(b.className)).map((b) => b.innerText.trim()).filter(Boolean);
    return { userN: user.length, assistantN: assistant.length, lastAssistant: assistant[assistant.length - 1]?.slice(0, 200) };
  });
  if (stats.userN >= 1 && stats.assistantN >= 2) {
    replyText = stats.lastAssistant;
    console.log('   reply:', replyText.slice(0, 160));
    break;
  }
}
await sleep(1500);
await page.screenshot({ path: '/tmp/coach-2-exchange.png', fullPage: true });
console.log('   screenshot → /tmp/coach-2-exchange.png');

console.log('[6] verify 2 new chat_message rows (user + assistant)…');
const afterExchange = await dbQuery(`chat_message?user_email=eq.${EMAIL}&select=role,content,timestamp&order=timestamp.asc`);
console.log('   total rows now:', afterExchange.length, '(was', afterOpen.length, ')');
afterExchange.slice(-3).forEach((m) => console.log(`   - ${m.role}: ${m.content.slice(0, 100)}…`));

console.log('[7] within-session navigation: /home → /coach. Should NOT generate a new opening; should show all bubbles…');
await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle2', timeout: 15_000 });
await sleep(2000);
await page.goto(`${APP_URL}/coach`, { waitUntil: 'networkidle2', timeout: 15_000 });
await sleep(3000);
const persisted = await page.evaluate(() => {
  const bubbles = Array.from(document.querySelectorAll('div')).filter((d) => d.className && /rounded-(br-sm|bl-sm)/.test(d.className));
  return { userN: bubbles.filter((b) => /rounded-br-sm/.test(b.className)).length, assistantN: bubbles.filter((b) => /rounded-bl-sm/.test(b.className)).length };
});
console.log('   on re-entry — user bubbles:', persisted.userN, ' assistant bubbles:', persisted.assistantN);
await page.screenshot({ path: '/tmp/coach-3-revisit.png', fullPage: true });
console.log('   screenshot → /tmp/coach-3-revisit.png');

console.log('[8] db should have same row count (no new opening generated):');
const finalRows = await dbQuery(`chat_message?user_email=eq.${EMAIL}&select=role&order=timestamp.asc`);
console.log('   rows:', finalRows.length, '— delta from prev step:', finalRows.length - afterExchange.length);

console.log('[done]');
await browser.close();
