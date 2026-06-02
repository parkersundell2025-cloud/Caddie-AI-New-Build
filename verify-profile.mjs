// Verify TESTING.md §7 (Profile + EditProfile).
//  A. /profile renders user card + handicap + skill ratings + preferences.
//  B. Edit button → /edit-profile pre-filled from profile.
//  C. Photo upload → Supabase Storage 'profile-photos' bucket + profile_picture updated.
//  D. Change handicap → Save Changes → user_profile.update + handicap_entry insert.
//  E. Log Out → /signin.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const EMAIL = 'admin@silexdev.com';
const APP_URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = (path) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  }).then((r) => r.json());

async function mintLink() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL, options: { redirect_to: `${APP_URL}/gateway` } }),
  });
  return (await r.json()).action_link;
}

// 1x1 transparent PNG for the photo upload
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync('/tmp/test-avatar.png', onePixelPng);

console.log('[db] state BEFORE:');
console.log('   profile:', JSON.stringify(await db(`user_profile?user_email=eq.${EMAIL}&select=first_name,current_handicap,goal_handicap,profile_picture,handicap_last_updated`)));
console.log('   handicap_entry count:', (await db(`handicap_entry?user_email=eq.${EMAIL}&select=id`)).length);

console.log('[1] auth + open browser…');
const link = await mintLink();
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 420, height: 1600, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)));

await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
for (let i = 0; i < 30 && !/\/(home|onboarding|subscribe-now|signin)/.test(page.url()); i++) await sleep(500);
await sleep(1500);

console.log('[A] navigate to /profile…');
await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle2', timeout: 15_000 });
await sleep(2500);
await page.screenshot({ path: '/tmp/profile-1.png', fullPage: true });
console.log('   screenshot → /tmp/profile-1.png');
const profileText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('   visible text (first 500):', profileText.slice(0, 500));

console.log('[B] click Edit → /edit-profile…');
const editClicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('a,button')).find((b) => /Edit/i.test(b.textContent || '') && (b.textContent || '').length < 25);
  if (btn) { btn.click(); return true; }
  return false;
});
if (!editClicked) {
  await page.goto(`${APP_URL}/edit-profile`, { waitUntil: 'networkidle2' });
}
await sleep(2500);
await page.screenshot({ path: '/tmp/profile-2-edit.png', fullPage: true });
console.log('   on:', page.url());

// Verify the form pre-filled
const formState = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input,textarea'));
  return inputs.map((i) => ({
    type: i.type, value: i.value, placeholder: i.placeholder?.slice(0, 30),
  })).filter((i) => i.value);
});
console.log('   pre-filled inputs:', JSON.stringify(formState));

console.log('[C] photo upload (Supabase Storage) — set hidden input[type=file]…');
const fileInput = await page.$('input[type=file]');
if (!fileInput) throw new Error('file input not found');
await fileInput.uploadFile('/tmp/test-avatar.png');
console.log('   uploaded /tmp/test-avatar.png');
await sleep(6000); // give Supabase Storage upload + profile update time
await page.screenshot({ path: '/tmp/profile-3-photo.png', fullPage: true });
const profileAfterPhoto = await db(`user_profile?user_email=eq.${EMAIL}&select=profile_picture`);
console.log('   profile.profile_picture:', profileAfterPhoto[0]?.profile_picture);

// List bucket via service-role: HEAD on the object via storage REST API
console.log('   list profile-photos bucket:');
const bucketListRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/profile-photos`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '', limit: 5, offset: 0, sortBy: { column: 'name', order: 'desc' } }),
});
const bucketList = await bucketListRes.json();
console.log('   top-level entries:', JSON.stringify(bucketList?.slice?.(0, 5) || bucketList));

console.log('[D] change handicap (12 → 14) and Save Changes…');
// Find the current-handicap input. Format: 2 inputs in the handicap row; first is Current HCP.
await page.evaluate(() => {
  // Find inputs of type=number; first one is Current HCP per the JSX
  const inputs = Array.from(document.querySelectorAll('input[type=number]'));
  if (!inputs.length) throw new Error('no number inputs found');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], '14');
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(500);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Save Changes/i.test(b.textContent || ''));
  if (btn) btn.click();
});
// Wait for navigation back to /profile (handleSave navigates after save)
for (let i = 0; i < 30 && !page.url().endsWith('/profile'); i++) await sleep(500);
await sleep(2500);
console.log('   on:', page.url());
const afterSave = await db(`user_profile?user_email=eq.${EMAIL}&select=first_name,current_handicap,goal_handicap,profile_picture`);
console.log('   profile after Save:', JSON.stringify(afterSave));
const hcpEntries = await db(`handicap_entry?user_email=eq.${EMAIL}&select=handicap,entry_date,note&order=entry_date.desc&limit=3`);
console.log('   handicap_entry latest:', JSON.stringify(hcpEntries));

console.log('[E] Log Out…');
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Log Out/i.test(b.textContent || ''));
  if (btn) btn.click();
});
for (let i = 0; i < 30 && !/\/signin/.test(page.url()); i++) await sleep(500);
await sleep(1500);
console.log('   on:', page.url());
await page.screenshot({ path: '/tmp/profile-4-loggedout.png', fullPage: true });

console.log('[done]');
await browser.close();
