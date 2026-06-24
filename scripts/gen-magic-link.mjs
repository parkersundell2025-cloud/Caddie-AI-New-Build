#!/usr/bin/env node
//
// Mint a magic link for any user without spamming their inbox.
// Uses service role; prints a single-use URL that signs you in as that user.
//
// Usage: node scripts/gen-magic-link.mjs <email> [redirect_url]
//
// Defaults redirect to https://caddieaiapp.com/gateway.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const email    = process.argv[2];
const redirect = process.argv[3] || 'https://caddieaiapp.com/gateway';

if (!email) {
  console.error('Usage: node scripts/gen-magic-link.mjs <email> [redirect_url]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('./.env.local', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: email.toLowerCase().trim(),
  options: { redirectTo: redirect },
});

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('\nSign-in URL (single-use, expires in 1 hour):\n');
console.log(data.properties.action_link);
console.log('');
