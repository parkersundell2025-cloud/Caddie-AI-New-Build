#!/usr/bin/env node
//
// Base44 → Supabase data migration.
//
// Reads CSV exports from Base44's admin Data area and inserts into the
// Supabase target schema. Designed to run idempotently: re-running against
// the same CSVs and a partially-migrated target is safe; rows already
// present (matched on `id`) are skipped.
//
// Usage:
//   node scripts/migrate-from-base44.mjs --csv-dir /Users/tonyt/Projects/caddie-ai-base44/exports
//   node scripts/migrate-from-base44.mjs --csv-dir <dir> --dry-run
//   node scripts/migrate-from-base44.mjs --csv-dir <dir> --wipe-first
//
// Steps:
//   1. (optional) Wipe every Base44-sourced table + auth.users for a clean
//      start. Affiliate tables (which have NO Base44 source) are also wiped
//      because their FK chain is internal — wiping user_profile while
//      leaving affiliate_attribution behind would orphan rows.
//   2. Parse each entity CSV.
//   3. Create auth.users rows for every unique email in UserProfile.csv
//      (no password — magic-link / OAuth only after cutover).
//   4. Insert user_profile rows FIRST so anything downstream that gates on
//      profile existence (Stripe webhook, RC webhook, etc.) has the row.
//   5. Insert dependent tables in any order.
//
// Email lowercasing: applied to user_email / referrer_email / referred_email
// per the [[email-case-rls-trap]] memory note. Supabase auth lowercases
// auth.email; mixed-case user_email rows orphan users from their own data.
//
// JSON / jsonb fields: CSV stores them as quoted strings. We detect leading
// `{` / `[` and try to JSON.parse — if it works, the value goes in as the
// parsed object; if not, it stays as a string.

import { createClient } from '@supabase/supabase-js';
import { readFile, readFileSync as _rfs } from 'node:fs';
import { readFile as readFileAsync, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';

// ── args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    'csv-dir':     { type: 'string' },
    'dry-run':     { type: 'boolean', default: false },
    'wipe-first':  { type: 'boolean', default: false },
    'project-ref': { type: 'string',  default: 'dbvsnzppevytanoxzgwj' },
  },
  strict: true,
});

const CSV_DIR     = values['csv-dir'];
const DRY_RUN     = values['dry-run'];
const WIPE_FIRST  = values['wipe-first'];
const PROJECT_REF = values['project-ref'];

if (!CSV_DIR) {
  console.error('Usage: --csv-dir <path> [--dry-run] [--wipe-first]');
  process.exit(1);
}

// ── env ──────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('./.env.local', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SB_URL = env.VITE_SUPABASE_URL;
const SVC    = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SVC) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SB_URL, SVC, { auth: { persistSession: false } });
console.log(`→ Target: ${SB_URL} (project ${PROJECT_REF})`);
console.log(`→ Mode:   ${DRY_RUN ? 'DRY RUN' : 'LIVE'} ${WIPE_FIRST ? '+ WIPE FIRST' : ''}`);

// ── Entity → table mapping ───────────────────────────────────────────────
// Order matters for inserts: user_profile FIRST, then dependents.
// Wipe order is the reverse (computed below).
const ENTITIES = [
  ['UserProfile',      'user_profile'],
  ['Badge',            'badge'],
  ['ChatMessage',      'chat_message'],
  ['DrillRating',      'drill_rating'],
  ['Feedback',         'feedback'],
  ['FlaggedAccount',   'flagged_account'],
  ['FlaggedRound',     'flagged_round'],
  ['HallOfFame',       'hall_of_fame'],
  ['HandicapEntry',    'handicap_entry'],
  ['LeaderboardEntry', 'leaderboard_entry'],
  ['MonthlyGamePlan',  'monthly_game_plan'],
  ['Notification',     'notification'],
  ['PendingUser',      'pending_user'],
  ['PracticePlan',     'practice_plan'],
  ['Referral',         'referral'],
  ['Round',            'round'],
  ['SessionLog',       'session_log'],
  ['WaitlistCredit',   'waitlist_credit'],
  ['WaitlistEmail',    'waitlist_email'],
  ['WeeklyInsight',    'weekly_insight'],
  ['WeeklyReport',     'weekly_report'],
];

// ── CSV parser (RFC4180-ish, no external dep) ────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cell += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(cell); cell = ''; continue; }
      if (c === '\r') continue;
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
    .map(r => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        const v = i < r.length ? r[i] : '';
        obj[headers[i]] = v === '' ? null : v;
      }
      return obj;
    });
}

// Base44 attaches these implicit columns to every entity export but our
// Supabase schema doesn't carry them. Strip on import.
//   is_sample      — Base44 demo-data marker
//   created_by_id  — Base44's pointer to its own users table (no equivalent
//                    on our side; created_by stays as the email text instead)
const BASE44_ONLY_COLUMNS = new Set(['is_sample', 'created_by_id']);

// ── Per-row coercion ─────────────────────────────────────────────────────
function coerceRow(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    if (BASE44_ONLY_COLUMNS.has(k)) continue;
    out[k] = row[k];
  }
  // Lowercase any email field — see [[email-case-rls-trap]]
  for (const k of ['user_email', 'referrer_email', 'referred_email', 'email', 'created_by']) {
    if (out[k] && typeof out[k] === 'string' && out[k].includes('@')) {
      out[k] = out[k].toLowerCase().trim();
    }
  }
  // Best-effort JSON parse for jsonb-ish strings
  for (const k of Object.keys(out)) {
    if (out[k] == null) continue;
    if (typeof out[k] !== 'string') continue;
    const t = out[k].trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { out[k] = JSON.parse(t); } catch { /* keep as string */ }
    }
  }
  return out;
}

// Row-level filter for tables keyed by email. Skips orphan rows where the
// user_email field is a UUID placeholder (Base44 generates these when a
// Stripe trial starts before the user completes signup — they have no
// usable identity and would collide with auth.users which requires an
// email). Returns true to keep the row.
function isUsableRow(row, table) {
  // Tables that legitimately have no user_email column — keep everything
  if (!('user_email' in row)) return true;
  // Empty user_email — keep (some tables allow nulls)
  if (!row.user_email) return true;
  // Reject if the supposed email doesn't contain @
  return String(row.user_email).includes('@');
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  // 1. WIPE
  if (WIPE_FIRST && !DRY_RUN) {
    console.log('\n[wipe] Truncating tables (FK-safe order)…');
    const wipeOrder = [
      // Affiliate program — internal FKs only, but wipe first so user_profile
      // can be safely cleared even if anyone got attributed during testing
      'affiliate_commission', 'affiliate_payout', 'affiliate_attribution', 'affiliate',
      // Push notification token cache (no Base44 source)
      'device_token',
      // Base44-sourced tables — no cross-FKs at the SQL level (Base44 never
      // enforced referential integrity), so order among these doesn't matter
      'badge', 'chat_message', 'drill_rating', 'feedback',
      'flagged_account', 'flagged_round', 'hall_of_fame', 'handicap_entry',
      'leaderboard_entry', 'monthly_game_plan', 'notification', 'pending_user',
      'practice_plan', 'referral', 'round', 'session_log',
      'waitlist_credit', 'waitlist_email', 'weekly_insight', 'weekly_report',
      'user_profile',
    ];
    for (const t of wipeOrder) {
      // `.neq('id', '__never__')` is the canonical Supabase "delete all rows"
      // trick — supabase-js refuses unconditional deletes by design.
      const { error } = await supabase.from(t).delete().neq('id', '__never__');
      console.log(`  ${t.padEnd(28)} ${error ? '⚠️  ' + error.message : 'cleared'}`);
    }

    // auth.users — delete in batches via the admin API
    console.log('\n[wipe] Clearing auth.users…');
    let removed = 0;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (error) { console.warn('  listUsers failed:', error.message); break; }
      if (!data.users.length) break;
      for (const u of data.users) {
        const r = await supabase.auth.admin.deleteUser(u.id);
        if (!r.error) removed++;
      }
      if (data.users.length < 100) break;
    }
    console.log(`  auth.users: removed ${removed}`);
  }

  // 2. Read CSVs
  console.log('\n[read] Parsing CSVs…');
  const csvs = {};
  for (const [base, table] of ENTITIES) {
    // Base44 exports as either `${base}.csv` or `${base}_export.csv`
    // depending on whether the admin uses the per-entity Download or the
    // bulk export. Try both.
    const candidates = [
      path.join(CSV_DIR, `${base}.csv`),
      path.join(CSV_DIR, `${base}_export.csv`),
    ];
    let loaded = false;
    for (const file of candidates) {
      try {
        const text = await readFileAsync(file, 'utf8');
        const raw = csvToObjects(text);
        const coerced = raw.map(coerceRow);
        const kept = coerced.filter(r => isUsableRow(r, table));
        const dropped = coerced.length - kept.length;
        csvs[table] = kept;
        const dropNote = dropped > 0 ? `  (dropped ${dropped} orphan${dropped === 1 ? '' : 's'})` : '';
        console.log(`  ${base.padEnd(20)} → ${table.padEnd(20)} ${String(kept.length).padStart(5)} rows${dropNote}  (${path.basename(file)})`);
        loaded = true;
        break;
      } catch (e) {
        // try next candidate
      }
    }
    if (!loaded) {
      console.warn(`  ${base.padEnd(20)} → ${table.padEnd(20)} not found in ${CSV_DIR}`);
      csvs[table] = [];
    }
  }

  // 3. Create auth.users for unique emails in user_profile
  const emails = new Set();
  for (const r of csvs.user_profile || []) {
    if (r.user_email) emails.add(r.user_email);
  }
  console.log(`\n[auth] Need ${emails.size} auth.users rows`);

  let created = 0, existing = 0, failedAuth = 0;
  if (!DRY_RUN) {
    for (const email of emails) {
      const { error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (!error) created++;
      else if (/already/i.test(error.message || '')) existing++;
      else { failedAuth++; console.warn(`  ${email}: ${error.message}`); }
    }
    console.log(`  created=${created} already-existed=${existing} failed=${failedAuth}`);
  } else {
    console.log('  [dry-run] skipping auth creation');
  }

  // 4. Insert tables — user_profile first, then the rest in declared order
  console.log('\n[insert] Upserting rows…');
  for (const [base, table] of ENTITIES) {
    const rows = csvs[table] || [];
    if (rows.length === 0) { console.log(`  ${table.padEnd(28)} (empty)`); continue; }
    if (DRY_RUN) {
      console.log(`  ${table.padEnd(28)} would upsert ${rows.length}`);
      continue;
    }
    let inserted = 0, failed = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        failed += chunk.length;
        console.warn(`    chunk ${i}-${i + chunk.length}: ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`  ${table.padEnd(28)} inserted=${inserted} failed=${failed}`);
  }

  console.log('\n✅ Done.');
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
