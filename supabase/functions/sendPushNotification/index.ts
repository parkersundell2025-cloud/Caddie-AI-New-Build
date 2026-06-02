// supabase/functions/sendPushNotification/index.ts
//
// Sends an Apple Push Notification to every iOS device_token row registered
// for the given user. Service-role-gated — only callable from other edge
// functions, Postgres triggers (via pg_net), or admin tooling carrying the
// SUPABASE_SERVICE_ROLE_KEY in the Authorization header.
//
// Flow:
//   1. Verify Authorization matches the service-role key (string compare).
//   2. Look up active device_token rows for the target user (iOS-only for now;
//      Android via FCM will share the same table once we wire it).
//   3. Build an APNs JWT (ES256 over the .p8 PKCS#8 key). Cached up to ~50min
//      across invocations within the same worker, then re-signed.
//   4. POST to https://api.push.apple.com/3/device/{token} (sandbox in dev).
//   5. On 410 Gone, delete the token row — Apple's signal that the install
//      is gone and that token will never deliver again.
//
// Secrets required (set with `supabase secrets set ...`):
//   APNS_AUTH_KEY     — contents of the .p8 file, including BEGIN/END markers.
//   APNS_KEY_ID       — 10-char key id from Apple Developer → Keys.
//   APNS_TEAM_ID      — 10-char team id from membership details.
//   APNS_BUNDLE_ID    — com.caddieaiapp.app (matches Info.plist).
//   APNS_USE_SANDBOX  — "true" while running TestFlight/dev builds; "false"
//                       for the App Store production build. The same .p8 key
//                       works for both endpoints; the topic + endpoint differ.
//
// Caller body shape:
//   {
//     user_email: string,         // joined to device_token.user_email (lower-cased)
//     title: string,
//     body: string,
//     data?: Record<string, unknown>, // merged into the APNs payload at top
//                                     // level so iOS pushNotificationActionPerformed
//                                     // can read it (e.g. { url: "caddieai://plan" })
//     badge?: number,             // app icon badge count
//     sound?: string              // override default "default" sound
//   }

import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

const APNS_AUTH_KEY = Deno.env.get('APNS_AUTH_KEY') ?? '';
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? '';
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? '';
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') ?? '';
const APNS_USE_SANDBOX = Deno.env.get('APNS_USE_SANDBOX') === 'true';
const APNS_HOST = APNS_USE_SANDBOX ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ─── JWT caching ─────────────────────────────────────────────────────────────
// APNs JWTs are valid for up to 1 hour. Re-using one across multiple sends
// within the same worker avoids re-signing on every notification. Apple
// actually requires re-use here — sending too many distinct JWTs per token
// is treated as suspicious and can trigger throttling.
let cachedJWT: string | null = null;
let cachedJWTAt = 0;

// Apple-compatible base64url (no padding, +/- swapped for -/_).
function base64UrlEncode(input: string | Uint8Array): string {
  let raw: string;
  if (typeof input === 'string') {
    raw = btoa(input);
  } else {
    // chunked to avoid String.fromCharCode arg-count limits on large inputs
    let s = '';
    for (let i = 0; i < input.length; i += 0x8000) {
      s += String.fromCharCode(...input.subarray(i, i + 0x8000));
    }
    raw = btoa(s);
  }
  return raw.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function pemToCryptoKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

async function buildAPNsJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Refresh ~10min before Apple's 1-hour ceiling so we don't race with the
  // server clock or with workers that hold onto an old token slightly too long.
  if (cachedJWT && now - cachedJWTAt < 50 * 60) return cachedJWT;
  if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
    throw new Error('APNs secrets not configured (APNS_AUTH_KEY / APNS_KEY_ID / APNS_TEAM_ID)');
  }

  const header = { alg: 'ES256', kid: APNS_KEY_ID, typ: 'JWT' };
  const payload = { iss: APNS_TEAM_ID, iat: now };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

  const key = await pemToCryptoKey(APNS_AUTH_KEY);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );

  const jwt = `${signingInput}.${base64UrlEncode(sig)}`;
  cachedJWT = jwt;
  cachedJWTAt = now;
  return jwt;
}

// ─── Send a single notification ──────────────────────────────────────────────
async function sendToToken(
  token: string,
  apnsPayload: unknown,
  jwt: string,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`https://${APNS_HOST}/3/device/${token}`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    },
    body: JSON.stringify(apnsPayload),
  });
  // APNs returns empty body on success; reason JSON on error.
  const text = await res.text().catch(() => '');
  return { status: res.status, text };
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Service-role auth — string compare the Authorization header. We don't
    // accept arbitrary signed JWTs from the anon key here; this function
    // can fan out across users and must not be reachable from frontend code.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!SERVICE_ROLE_KEY || authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => null);
    const userEmailRaw = body?.user_email as string | undefined;
    const title = body?.title as string | undefined;
    const bodyText = body?.body as string | undefined;
    const customData = (body?.data as Record<string, unknown> | undefined) ?? {};
    const badge = body?.badge as number | undefined;
    const sound = (body?.sound as string | undefined) ?? 'default';

    if (!userEmailRaw || !title || !bodyText) {
      return json({ error: 'user_email, title, body required' }, 400);
    }
    const userEmail = userEmailRaw.toLowerCase().trim();

    const db = serviceClient();
    const { data: tokens, error } = await db
      .from('device_token')
      .select('id, token, platform')
      .eq('user_email', userEmail)
      .eq('platform', 'ios');
    if (error) {
      console.error('[sendPushNotification] device_token lookup failed:', error.message);
      return json({ error: 'Failed to look up device tokens' }, 500);
    }
    if (!tokens || tokens.length === 0) {
      return json({ sent: 0, failed: 0, deleted: 0, message: 'No iOS tokens for user' });
    }

    let jwt: string;
    try {
      jwt = await buildAPNsJWT();
    } catch (e) {
      console.error('[sendPushNotification] JWT build failed:', (e as Error).message);
      return json({ error: 'APNs not configured' }, 500);
    }

    // APNs payload — aps block is reserved; custom data sits at the top level
    // so iOS hands it back to JS through pushNotificationActionPerformed.
    const apnsPayload: Record<string, unknown> = {
      aps: {
        alert: { title, body: bodyText },
        sound,
        ...(badge !== undefined ? { badge } : {}),
      },
      ...customData,
    };

    let sent = 0;
    let failed = 0;
    let deleted = 0;

    // Send to all tokens in parallel. Each device is independent — one bad
    // token shouldn't block the rest.
    await Promise.all(
      tokens.map(async (row) => {
        try {
          const { status, text } = await sendToToken(row.token, apnsPayload, jwt);
          if (status === 200) {
            sent += 1;
            return;
          }
          if (status === 410) {
            // Token is dead per Apple — uninstall, OS reset, etc. Drop it so
            // we stop spending APNs quota and DB rows on it.
            const { error: delErr } = await db.from('device_token').delete().eq('id', row.id);
            if (delErr) {
              console.warn('[sendPushNotification] failed to delete stale token:', delErr.message);
            }
            deleted += 1;
            return;
          }
          console.warn(
            `[sendPushNotification] APNs ${status} for token ${row.token.slice(0, 12)}...: ${text}`,
          );
          failed += 1;
        } catch (e) {
          console.warn('[sendPushNotification] send threw:', (e as Error).message);
          failed += 1;
        }
      }),
    );

    return json({ sent, failed, deleted });
  } catch (e) {
    console.error('[sendPushNotification] error:', (e as Error)?.message || e);
    return json({ error: (e as Error)?.message || 'Internal error' }, 500);
  }
});
