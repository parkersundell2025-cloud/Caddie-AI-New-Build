#!/usr/bin/env node
//
// Manually fire the scheduled-notification job (SOW 3f) that pg_cron runs
// daily. Uses the service-role key, same as the cron caller.
//
// Usage:
//   node scripts/run-scheduled-notifications.mjs                 # real run, all users
//   node scripts/run-scheduled-notifications.mjs --dry           # who WOULD be nudged, no send
//   node scripts/run-scheduled-notifications.mjs --only a@b.com   # limit to one user
//   node scripts/run-scheduled-notifications.mjs --only a@b.com --force  # ignore the cooldown cap
//
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const body = {
  dryRun: args.includes('--dry'),
  ignoreCooldown: args.includes('--force'),
  ...(only ? { onlyEmail: only } : {}),
};

const env = Object.fromEntries(
  readFileSync('./.env.local', 'utf8').split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/runScheduledNotifications`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
