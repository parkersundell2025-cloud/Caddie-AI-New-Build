// Dev shortcut: generate a Supabase magic-link URL via the admin API without
// triggering an SMTP send (so it doesn't count against the rate limit).
// Paste the resulting URL into Simulator Safari to follow the redirect into
// the Capacitor iOS app (caddieai://gateway) and complete the sign-in.
//
// Usage:
//   SRK="<service-role-key>" node gen-magic-link.mjs <email> [redirect]
//
// Examples:
//   SRK=... node gen-magic-link.mjs admin@silexdev.com
//   SRK=... node gen-magic-link.mjs admin@silexdev.com https://localhost:5173/gateway
//
// Get SRK from Supabase Dashboard → Project Settings → API → service_role.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;

if (!SRK) {
  console.error('Missing SRK env var. Set it to your service-role key:');
  console.error('  SRK="eyJ..." node gen-magic-link.mjs <email>');
  process.exit(1);
}

const email = process.argv[2];
const redirectTo = process.argv[3] || 'caddieai://gateway';

if (!email) {
  console.error('Missing email. Usage: SRK=... node gen-magic-link.mjs <email> [redirect]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SRK, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo },
});

if (error) {
  console.error('generateLink error:', error.message);
  process.exit(1);
}

const link = data?.properties?.action_link;
if (!link) {
  console.error('No action_link in response:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('');
console.log('Magic link generated for:', email);
console.log('Redirect target:        ', redirectTo);
console.log('');
console.log(link);
console.log('');
console.log('Next steps:');
console.log('  1. Copy the URL above');
console.log('  2. In iOS Simulator menu: Edit → Send Pasteboard (syncs Mac clipboard)');
console.log('  3. Open Safari on the simulator → paste in URL bar → go');
console.log('  4. Safari follows the redirect → iOS prompts "Open in Caddie AI?" → tap Open');
console.log('  5. DeepLinkRouter runs the code exchange, you land signed in.');
