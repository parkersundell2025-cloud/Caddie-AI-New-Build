import { supabase } from '@/lib/supabase';
import { getPlatform } from '@/lib/platform';

// Affiliate attribution capture + bind.
//
// Flow:
//   1. Visitor clicks `https://caddieaiapp.com/?ref=SARAH` (web) or
//      `caddieai://?ref=SARAH` (deep-link from native).
//   2. captureRefFromUrl() reads ?ref=CODE from a URL, validates it against
//      the affiliate edge fn, and stashes it in localStorage with a 30-day TTL.
//   3. On signup, AuthContext calls bindAttributionPostSignup() which reads
//      the stash, calls bindAffiliateAttribution, then clears the stash.
//
// localStorage on Capacitor WebView is persistent (survives app restarts), so
// the same code path covers web + iOS without a separate Preferences plugin.

const STORAGE_KEY = 'caddie:aff_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readStash() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.code !== 'string') return null;
    if (typeof parsed.first_seen_at !== 'number') return null;
    // TTL gate — silently expire stale stashes.
    if (Date.now() - parsed.first_seen_at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStash(code) {
  try {
    const existing = readStash();
    // Last-touch attribution: a fresh ref overwrites the prior stash.
    // first_seen_at is reset because the TTL is measured from the LATEST click.
    const payload = { code, first_seen_at: Date.now() };
    if (existing && existing.code === code) {
      // Same code re-clicked — keep original first_seen_at so we don't
      // perpetually renew the TTL while the user wavers.
      payload.first_seen_at = existing.first_seen_at;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage disabled / quota exceeded — non-fatal; we just won't attribute.
  }
}

function clearStash() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read the current stash for inspection. Useful for debug + tests.
 * @returns {{code: string, first_seen_at: number} | null}
 */
export function getStashedRef() {
  return readStash();
}

/**
 * Extract ?ref=CODE from a URL-like input, validate it server-side, and
 * stash it. Called from:
 *   - boot (window.location.search)
 *   - Capacitor App.addListener('appUrlOpen', ...) for deep-link clicks
 *
 * Returns the validated affiliate when stashed, or null when the URL had no
 * ref or the code was rejected.
 */
export async function captureRefFromUrl(urlOrSearch) {
  let code = null;
  try {
    if (!urlOrSearch) return null;
    // Accept a full URL, a path+query string, or a bare search string.
    let search;
    if (urlOrSearch.startsWith('http')) {
      search = new URL(urlOrSearch).searchParams;
    } else if (urlOrSearch.includes('?')) {
      search = new URLSearchParams(urlOrSearch.split('?')[1].split('#')[0]);
    } else if (urlOrSearch.startsWith('?')) {
      search = new URLSearchParams(urlOrSearch);
    } else {
      // Try to parse as a query string sans leading '?'
      search = new URLSearchParams(urlOrSearch);
    }
    const raw = search.get('ref');
    if (!raw) return null;
    code = raw.trim();
    if (!code) return null;
  } catch {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('validateAffiliateCode', {
    body: { code },
  });
  // Per supabase-invoke-error-footgun: invoke() does NOT throw on non-2xx —
  // we MUST check `error` before reading `data`.
  if (error) {
    console.warn('[affiliate] validate fn errored:', error.message || error);
    return null;
  }
  if (!data?.valid) {
    console.log('[affiliate] code rejected:', code, data?.reason);
    return null;
  }
  writeStash(data.affiliate.code);
  return data.affiliate; // { id, code, display_name }
}

/**
 * After the user is authenticated, send the stashed ref to the bind edge fn.
 * Idempotent server-side (UNIQUE on user_email). Always clears the stash
 * after attempt — a single try is enough; if it failed (network blip), the
 * commission step won't fire but the user state is still consistent.
 *
 * Returns { bound, affiliate_id, code } or null if nothing to bind.
 */
export async function bindAttributionPostSignup() {
  const stash = readStash();
  if (!stash) return null;

  const platform = getPlatform(); // 'ios' | 'android' | 'web'
  const source = platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'web';

  const { data, error } = await supabase.functions.invoke('bindAffiliateAttribution', {
    body: {
      code: stash.code,
      source,
      first_seen_at: new Date(stash.first_seen_at).toISOString(),
    },
  });
  // Always clear stash after attempt — don't infinitely re-bind on every
  // sign-in. If the network errored, the user remains unattributed; that's
  // acceptable v1 behavior.
  clearStash();

  if (error) {
    console.warn('[affiliate] bind fn errored:', error.message || error);
    return null;
  }
  if (!data?.bound) {
    console.log('[affiliate] bind rejected:', data?.reason);
    return null;
  }
  return {
    bound: true,
    already_bound: !!data.already_bound,
    affiliate_id: data.affiliate_id,
    code: data.code,
  };
}

/**
 * Test-only: programmatic stash setter. Lets us drop a known code into
 * storage from the dev console before exercising the bind flow.
 */
export function _setStashForTest(code) {
  writeStash(code);
}

export function _clearStashForTest() {
  clearStash();
}
