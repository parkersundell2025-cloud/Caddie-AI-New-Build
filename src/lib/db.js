import { supabase } from '@/lib/supabase';

/**
 * Unwrap a supabase-js query result, throwing on error so call sites can use
 * plain `await unwrap(...)` and get the data directly (mirrors how the old
 * Base44 SDK returned data without an { data, error } envelope).
 *
 *   const profiles = await unwrap(
 *     supabase.from('user_profile').select('*').eq('user_email', email)
 *   );
 */
export async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * The current authenticated user, shaped like the old `base44.auth.me()`:
 * an object with at least `id`, `email`, and `role`. Returns null when there
 * is no active session. `role` comes from the JWT app_metadata (set via the
 * Supabase admin API) and defaults to 'user'.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { ...user, role: user.app_metadata?.role ?? 'user' };
}

/** True when there is an active Supabase session. */
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Drop-in replacement for the old `base44.integrations.Core.InvokeLLM(args)`.
 * Proxies to the server-side `invokeLLM` edge function (keeps the Anthropic key
 * off the client) and returns the result value directly — an object when
 * `response_json_schema` is given, a string otherwise.
 */
export async function invokeLLM(args) {
  const { data, error } = await supabase.functions.invoke('invokeLLM', { body: args });
  if (error) throw error;
  return data;
}

// Per-browser-session cache of users we've already aligned with RevenueCat.
// Prevents the redundant query/UPDATE that would otherwise happen on every
// onAuthStateChange tick (token refresh, tab focus, etc.).
const rcIdentifiedUserIds = new Set();

/**
 * Idempotently align RevenueCat's view of "App User ID" with this user's
 * Supabase auth UUID by caching it on `user_profile.revenuecat_app_user_id`.
 *
 * Why this matters:
 *   - createStripeCheckoutSession sets `client_reference_id` + Stripe metadata
 *     to the Supabase UUID, so RC creates subscribers with that UUID as the
 *     App User ID.
 *   - Future RC webhook events (renewal, cancellation, expiration, transfer)
 *     arrive with `event.app_user_id = <Supabase UUID>` and (often) no email.
 *     The webhook resolves them by `eq('revenuecat_app_user_id', appUserId)`.
 *   - Without this helper, the webhook falls back to an auth.admin.getUserById
 *     hop on every event. With it, the fast path matches directly.
 *
 * Also primes the iOS path: when the Capacitor app ships, the iOS SDK call
 * `Purchases.logIn(supabaseUuid)` will produce events with the same UUID,
 * which will already match the cached value.
 *
 * Silent on errors so it never blocks sign-in.
 */
export async function alignRevenueCatAppUserId(user) {
  if (!user?.id || !user?.email) return;
  if (rcIdentifiedUserIds.has(user.id)) return;

  const email = user.email.toLowerCase().trim();
  const uuid = user.id;

  try {
    // Unconditional UPDATE keyed on user_email. We previously tried to filter
    // with `.neq('revenuecat_app_user_id', uuid)` to skip the write when the
    // value was already correct — but Postgres `NULL != 'uuid'` evaluates to
    // NULL (not TRUE), so the filter silently excluded rows where the column
    // was null, which is exactly the case we most need to fix. The
    // module-scope `rcIdentifiedUserIds` cache already prevents this UPDATE
    // from firing twice for the same user in the same browser session, so
    // the unconditional write is harmless.
    //
    // RLS on user_profile is `lower(user_email) = auth.email()` and accepts
    // the user's own JWT — no service-role needed.
    const { data, error } = await supabase
      .from('user_profile')
      .update({ revenuecat_app_user_id: uuid })
      .eq('user_email', email)
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('[alignRevenueCatAppUserId] update failed (non-fatal):', error.message);
      return;
    }

    if (data) {
      console.log('[alignRevenueCatAppUserId] cached revenuecat_app_user_id for', email);
    } else {
      // No row matched. Either the user_profile doesn't exist yet (new user,
      // no purchase yet — fine; first INITIAL_PURCHASE will create it via
      // the webhook's iOS path or the Stripe-flow profile-creation that lives
      // outside this function) or RLS blocked the read-back of `.select('id')`.
      console.log('[alignRevenueCatAppUserId] no profile to align for', email, '(will be set on first purchase)');
    }

    rcIdentifiedUserIds.add(uuid);
  } catch (err) {
    console.warn('[alignRevenueCatAppUserId] exception (non-fatal):', err?.message || err);
  }
}
