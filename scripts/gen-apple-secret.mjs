// Mint the Apple Sign In client_secret JWT for Supabase Auth.
//
// Background: Apple's "client_secret" for Sign in with Apple isn't a static
// secret — it's a short-lived JWT (ES256) signed with the .p8 key from
// developer.apple.com → Keys. Supabase Dashboard → Auth → Providers → Apple
// → "Secret Key (for OAuth)" wants this signed JWT pasted, NOT the raw .p8.
//
// Apple caps the JWT lifetime at 180 days. After expiry, Apple sign-in
// breaks until we regenerate this JWT and re-paste it into Supabase.
// Set a calendar reminder ~150 days from issuance to rotate ahead of time.
//
// Usage:
//   node scripts/gen-apple-secret.mjs
//
// Edit the constants below if any change. Keep the .p8 OUT of git — store
// it locally (default path: ~/Downloads/CaddieAI/AuthKey_<KEY_ID>.p8).

import { createSign, createPrivateKey } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const TEAM_ID     = 'AHYLLM9RY8';
const KEY_ID      = '3G526MFG5A';
const SERVICES_ID = 'com.caddieaiapp.app.signin';
const P8_PATH     = join(homedir(), 'Downloads/CaddieAI', `AuthKey_${KEY_ID}.p8`);

const EXP_SECONDS = 180 * 24 * 60 * 60; // Apple's hard ceiling

const now = Math.floor(Date.now() / 1000);

const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + EXP_SECONDS,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signingInput = `${b64url(header)}.${b64url(payload)}`;

const privateKey = createPrivateKey(readFileSync(P8_PATH));
const signer = createSign('SHA256');
signer.update(signingInput);
// ieee-p1363 is the JOSE/JWT-compatible flat r||s signature format; the
// default DER ASN.1 encoding is what crypto.sign() uses but it's not valid
// in a JWS signature segment.
const derSig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
const signature = derSig
  .toString('base64')
  .replace(/=+$/, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const jwt = `${signingInput}.${signature}`;

console.log(jwt);
console.log();
console.log('---');
console.log(`Expires: ${new Date((now + EXP_SECONDS) * 1000).toISOString()}`);
console.log(`(${Math.floor(EXP_SECONDS / 86400)} days from now)`);
