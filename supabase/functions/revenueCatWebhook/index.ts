// supabase/functions/revenueCatWebhook/index.ts
//
// Receives subscription lifecycle events from RevenueCat (Stripe Web Billing +
// Apple App Store) and updates user_profile accordingly. Ported from the
// Base44 implementation (commit b2cb0d6, "Bug fix") with the hard-won
// production fixes preserved verbatim:
//
//   * Strict explicit product→plan matching (no substring fallback for known
//     IDs) — prior version misclassified Stripe Basic ('prod_…' contains 'pro')
//     and the offering 'caddiePro' as Pro, charging Basic users for Pro.
//   * Profile-creation guard: only iOS INITIAL_PURCHASE / TRIAL_STARTED events
//     create profiles here. Stripe (web) creation is owned by the
//     createStripeCheckoutSession flow; creating here too would duplicate.
//   * Phantom EXPIRATION / BILLING_ISSUE rejection — RC fired spurious
//     expirations shortly after INITIAL_PURCHASE due to upstream misconfig,
//     locking out users mid-trial. Guard: only mark expired if BOTH the
//     event's own expiration_at_ms AND the profile's trial_end_date are in
//     the past.
//   * TRIAL detection on INITIAL_PURCHASE — Stripe-imported trial starts come
//     through as INITIAL_PURCHASE with period_type='TRIAL', not as a separate
//     TRIAL_STARTED event. Without this branch, trialing users get charged as
//     paid from day 1.
//   * CANCELLATION → subscription_status='cancelling' (NOT 'expired'). The
//     user keeps access until period end. Schema migration
//     20260530150000_user_profile_add_cancelling_status added the value.
//
// Auth: simple shared-secret in the Authorization header. RC sends literally
// what you configure in the webhook integration's headers; we compare against
// REVENUECAT_WEBHOOK_SECRET. No HMAC — this is what RC's webhook integration
// supports today.
//
// Deploy: `supabase functions deploy revenueCatWebhook --no-verify-jwt`
// (also declared in config.toml). Set the secret with:
//     supabase secrets set REVENUECAT_WEBHOOK_SECRET=<value>
// The secret must match what's configured in the RC dashboard webhook headers.

import { serviceClient } from '../_shared/supabase.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

// RevenueCat App identifiers (from `list-apps` on project projfe7054d8).
// Used to distinguish iOS App Store events from Stripe Web Billing events.
const IOS_APP_ID = 'app63f79b5121';        // Caddie AI : Golf Coach (App Store)
const STRIPE_APP_ID = 'app4182f2d023';     // Caddie AI : Golf Coach (Stripe) — referenced for clarity, not used in branching
void STRIPE_APP_ID;

// ── Plan derivation ─────────────────────────────────────────────────────────
// Strict explicit map first — DO NOT add substring fallbacks for known IDs.
// Add new products here as they get added in RC.
const PLAN_FROM_PRODUCT: Record<string, 'basic' | 'pro'> = {
  // App Store — current IDs (com.caddieaiapp.app, created 2026-06-07).
  // The original Base44-era IDs (month1_caddie / month1_caddiePro) were
  // claimed by a rejected app; Apple permanently reserves Product IDs
  // even after deletion, so we couldn't reuse them on the new bundle.
  'com.caddieaiapp.basic.monthly': 'basic',
  'com.caddieaiapp.pro.monthly':   'pro',
  // App Store — Base44-era IDs kept for back-compat with any in-flight
  // RC events from before the swap. Safe to keep — they will simply never
  // appear again once the old app's RC entry is gone.
  'month1_caddie':       'basic',
  'month1_caddiePro':    'pro',
  // Stripe (RC-imported product IDs)
  'prod_UNQmTxp5xw8N0C': 'basic',
  'prod_UNQnQZbZ4pOtHo': 'pro',
};

// Stripe Price IDs (fallback if RC ever sends a price instead of a product).
// Preserved from the Base44 version where this fallback caught at least one
// real incident.
const STRIPE_PRICE_BASIC = 'price_1TOfvE2ZJRGxxJxRqXKmOVuf';
const STRIPE_PRICE_PRO   = 'price_1TOfwL2ZJRGxxJxRc7SiSjSm';

function getPlan(pid: string): 'basic' | 'pro' {
  if (!pid) return 'basic';
  if (PLAN_FROM_PRODUCT[pid]) return PLAN_FROM_PRODUCT[pid];
  if (pid.includes(STRIPE_PRICE_PRO)) return 'pro';
  if (pid.includes(STRIPE_PRICE_BASIC)) return 'basic';
  // Word-boundary fallback for unknown future RC IDs. Strips 'prod_' prefix
  // and any 'caddiepro' substring to avoid the false positives that
  // previously misclassified Stripe Basic and the offering name as Pro.
  const lower = pid.toLowerCase().replace(/^prod_/, '').replace(/caddiepro/g, '');
  if (/(^|[_\s-])pro($|[_\s-])/.test(lower)) return 'pro';
  return 'basic';
}

// ── Identity resolution ─────────────────────────────────────────────────────
// Existing iOS subscribers (and the current Base44 setup) use app_user_id=email.
// New Supabase users (after the cutover) will use app_user_id=UUID. The
// resolver handles both: check app_user_id and aliases for an email; if
// nothing matches, also try app_user_id as a literal revenuecat_app_user_id
// lookup (covers the UUID case once we wire up identify() on sign-in).
function extractEmail(appUserId: string, aliases: string[]): string | null {
  if (appUserId && appUserId.includes('@')) {
    return appUserId.toLowerCase().trim();
  }
  const aliasEmail = (aliases || []).find((a) => typeof a === 'string' && a.includes('@'));
  return aliasEmail ? aliasEmail.toLowerCase().trim() : null;
}

// ── Date helpers ────────────────────────────────────────────────────────────
function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}
function msToISODate(ms: number | string | null | undefined): string | null {
  if (ms === null || ms === undefined || ms === '') return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString().split('T')[0];
}

// ── Main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[revenueCatWebhook] REVENUECAT_WEBHOOK_SECRET not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    if (authHeader !== webhookSecret) {
      console.error('[revenueCatWebhook] Unauthorized');
      return json({ error: 'Unauthorized' }, 401);
    }

    // Parse
    const payload = await req.json().catch(() => null);
    const event = payload?.event;
    if (!event) return json({ error: 'Missing event' }, 400);

    const eventType: string = event.type;
    const productId: string = event.product_id || '';
    const appUserId: string = event.app_user_id || '';
    const aliases: string[] = Array.isArray(event.aliases) ? event.aliases : [];

    // TEST event from RC dashboard "Send test event" — ack and exit.
    if (eventType === 'TEST') {
      console.log('[revenueCatWebhook] TEST event acknowledged');
      return json({ success: true, message: 'TEST acknowledged' });
    }

    // Informational events we explicitly acknowledge without doing anything.
    // RC retries on non-2xx, so returning 200 here prevents retries.
    if (
      eventType === 'INVOICE_ISSUANCE' ||
      eventType === 'VIRTUAL_CURRENCY_TRANSACTION' ||
      eventType === 'EXPERIMENT_ENROLLMENT' ||
      eventType === 'PURCHASE_REDEEMED'
    ) {
      console.log(`[revenueCatWebhook] ${eventType} acknowledged (no-op)`);
      return json({ success: true, message: `${eventType} acknowledged` });
    }

    // Resolve email (mutable: the auth-UUID fallback below may set it)
    let userEmail = extractEmail(appUserId, aliases);

    console.log(
      `[revenueCatWebhook] ${eventType} app_user_id=${appUserId} email=${userEmail} product=${productId} app=${event.app_id}`,
    );

    const db = serviceClient();

    // Look up the profile by email (canonical) or revenuecat_app_user_id
    // (for the future UUID-identified flow).
    let profile: Record<string, unknown> | null = null;
    if (userEmail) {
      const { data, error } = await db
        .from('user_profile')
        .select('*')
        .eq('user_email', userEmail);
      if (error) {
        console.error('[revenueCatWebhook] profile lookup by email failed:', error.message);
        return json({ error: 'Profile lookup failed', detail: error.message }, 500);
      }
      profile = (data && data[0]) || null;
    }
    if (!profile && appUserId) {
      const { data, error } = await db
        .from('user_profile')
        .select('*')
        .eq('revenuecat_app_user_id', appUserId);
      if (error) {
        console.error('[revenueCatWebhook] profile lookup by app_user_id failed:', error.message);
        return json({ error: 'Profile lookup failed', detail: error.message }, 500);
      }
      profile = (data && data[0]) || null;
    }

    // Third fallback: when the Stripe Checkout flow set client_reference_id =
    // Supabase auth UUID, RC's INITIAL_PURCHASE event arrives with that UUID
    // as `app_user_id` and (importantly) no email anywhere on the payload.
    // Neither lookup above will match unless we've previously cached the UUID
    // on the profile (task #7 will do that at sign-in). Until then, resolve
    // by asking the Supabase auth admin API for the user's email, then look
    // up the profile by that email.
    if (!profile && !userEmail && appUserId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
      if (isUuid) {
        const { data: authData, error: authErr } = await db.auth.admin.getUserById(appUserId);
        if (authErr) {
          console.warn(`[revenueCatWebhook] auth.admin.getUserById(${appUserId}) failed: ${authErr.message}`);
        } else if (authData?.user?.email) {
          userEmail = authData.user.email.toLowerCase().trim();
          const { data, error } = await db
            .from('user_profile')
            .select('*')
            .eq('user_email', userEmail);
          if (error) {
            console.error('[revenueCatWebhook] profile lookup by email-from-auth failed:', error.message);
            return json({ error: 'Profile lookup failed', detail: error.message }, 500);
          }
          profile = (data && data[0]) || null;
          if (profile) {
            console.log(`[revenueCatWebhook] resolved UUID ${appUserId} to email ${userEmail} via auth.admin`);
          }
        } else {
          console.warn(`[revenueCatWebhook] auth.admin.getUserById(${appUserId}) returned no user`);
        }
      }
    }

    // No profile path — create only for iOS INITIAL_PURCHASE / TRIAL_STARTED.
    // For Stripe (web) events, profile creation is owned by the Stripe
    // checkout flow (createStripeCheckoutSession + a Supabase auth session).
    // Creating here would race with that flow and produce duplicate profiles.
    if (!profile) {
      const isCreationEvent =
        eventType === 'INITIAL_PURCHASE' || eventType === 'TRIAL_STARTED';
      if (!isCreationEvent) {
        console.warn(`[revenueCatWebhook] No profile for ${userEmail}, ${eventType} skipped`);
        return json({ success: true, message: 'No profile found, skipped' });
      }
      if (event.app_id !== IOS_APP_ID) {
        console.warn(
          `[revenueCatWebhook] No profile for ${userEmail}, app=${event.app_id} (not iOS) — skipped to avoid duplicating Stripe-side creation`,
        );
        return json({ success: true, message: 'Non-iOS creation event skipped' });
      }
      if (!userEmail) {
        console.error(`[revenueCatWebhook] iOS creation event with no resolvable email`);
        return json({ error: 'Missing email for iOS creation' }, 400);
      }

      const plan = getPlan(productId);
      const today = todayISODate();
      const trialEnd = msToISODate(event.expiration_at_ms) || today;
      const isInTrial =
        eventType === 'TRIAL_STARTED' ||
        String(event.period_type || '').toUpperCase() === 'TRIAL';

      // Same store normalization as the update path below — used so iOS
      // first-purchase profiles get their subscription_source set on day one
      // and the Cancel UI immediately routes to iOS Settings (Apple 5.1.1).
      const iosRawStore = String(event.store || '').toLowerCase();
      const IOS_ALLOWED_STORES = new Set([
        'app_store', 'play_store', 'mac_app_store', 'stripe', 'promotional', 'amazon',
      ]);
      const iosSubscriptionSource = IOS_ALLOWED_STORES.has(iosRawStore) ? iosRawStore : null;

      const { data: created, error: insErr } = await db
        .from('user_profile')
        .insert({
          // user_email gets lowercased by the normalize_user_email_trigger.
          user_email: userEmail,
          first_name: userEmail.split('@')[0],
          subscription_status: isInTrial ? 'trial' : plan,
          subscription_plan: plan,
          trial_start_date: today,
          trial_end_date: trialEnd,
          revenuecat_app_user_id: appUserId,
          subscription_source: iosSubscriptionSource,
          onboarding_complete: false,
          tour_completed: false,
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('[revenueCatWebhook] profile create failed:', insErr.message);
        return json({ error: 'Profile create failed', detail: insErr.message }, 500);
      }
      console.log(`[revenueCatWebhook] Created profile ${created.id} for iOS subscriber ${userEmail}`);
      return json({ success: true, created: true, email: userEmail });
    }

    // ── Event handling for existing profiles ──
    let updates: Record<string, unknown> = {};

    switch (eventType) {
      case 'INITIAL_PURCHASE': {
        const plan = getPlan(productId);
        const isInTrial = String(event.period_type || '').toUpperCase() === 'TRIAL';
        if (isInTrial) {
          const today = todayISODate();
          const trialEnd = msToISODate(event.expiration_at_ms) || today;
          updates = {
            subscription_status: 'trial',
            subscription_plan: plan,
            trial_start_date: today,
            trial_end_date: trialEnd,
          };
        } else {
          updates = {
            subscription_status: plan,
            subscription_plan: plan,
          };
        }
        break;
      }

      case 'RENEWAL':
      case 'UNCANCELLATION': {
        const plan = getPlan(productId);
        updates = {
          subscription_status: plan,
          subscription_plan: plan,
        };
        break;
      }

      case 'TRIAL_STARTED': {
        const plan = getPlan(productId);
        const today = todayISODate();
        const trialEnd = msToISODate(event.expiration_at_ms) || today;
        updates = {
          subscription_status: 'trial',
          subscription_plan: plan,
          trial_start_date: today,
          trial_end_date: trialEnd,
        };
        break;
      }

      case 'TRIAL_CONVERTED': {
        const plan = getPlan(productId);
        updates = {
          subscription_status: plan,
          subscription_plan: plan,
        };
        break;
      }

      case 'CANCELLATION': {
        // User opted to cancel at period end. They retain access until
        // trial_end_date / current_period_end. Gateway.hasAccess and
        // RootRoute.isCancellingButActive both honor this state.
        updates = { subscription_status: 'cancelling' };
        break;
      }

      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        // Phantom-event guard. RC has repeatedly fired spurious EXPIRATION /
        // BILLING_ISSUE events shortly after INITIAL_PURCHASE due to upstream
        // offering/product-mapping misconfiguration — locking out users whose
        // trial is still active for days.
        //
        // Rule: only mark expired if BOTH the event's expiration_at_ms AND
        // the profile's trial_end_date are in the past. If either source
        // says "this sub should still be active", reject the event. A real
        // expiration suppressed here will retry on the next billing cycle or
        // fire EXPIRATION again at the actual trial_end_date.
        const nowMs = Date.now();
        const FUTURE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour grace for clock skew
        const eventExpMs = event.expiration_at_ms ? Number(event.expiration_at_ms) : null;
        const eventClaimsFutureExpiry =
          eventExpMs !== null && eventExpMs > nowMs + FUTURE_THRESHOLD_MS;

        const profileEndDate = (profile as any).trial_end_date as string | null | undefined;
        let profileTrialStillValid = false;
        if (profileEndDate) {
          // trial_end_date is YYYY-MM-DD; end-of-day UTC for a safe comparison.
          const endOfDayMs = new Date(profileEndDate + 'T23:59:59Z').getTime();
          profileTrialStillValid = endOfDayMs > nowMs;
        }

        if (eventClaimsFutureExpiry || profileTrialStillValid) {
          console.warn(
            `[revenueCatWebhook] Suspicious ${eventType} for ${userEmail} — ignored. ` +
              `event.expiration_at_ms=${eventExpMs} (${eventExpMs ? new Date(eventExpMs).toISOString() : 'null'}), ` +
              `profile.trial_end_date=${profileEndDate}, ` +
              `now=${new Date(nowMs).toISOString()}. ` +
              `Subscription appears still active — likely a phantom event from RC upstream misconfiguration.`,
          );
          return json({
            success: true,
            message: `Ignored suspicious ${eventType}`,
            email: userEmail,
            event_expiration_at_ms: eventExpMs,
            profile_trial_end_date: profileEndDate,
          });
        }

        updates = { subscription_status: 'expired' };
        break;
      }

      case 'PRODUCT_CHANGE': {
        // User upgraded basic → pro (or downgraded) mid-cycle.
        const newProductId = event.new_product_id || productId;
        const plan = getPlan(newProductId);
        updates = { subscription_status: plan, subscription_plan: plan };
        break;
      }

      case 'REFUND': {
        // Entitlement revoked. RC typically also fires EXPIRATION, but be
        // explicit so we don't depend on event ordering.
        updates = { subscription_status: 'expired' };
        break;
      }

      case 'REFUND_REVERSED': {
        // Refund was reversed (App Store only). Restore access by re-deriving
        // plan from the product. expiration_at_ms is informational here; the
        // next RENEWAL will refresh trial_end_date.
        const plan = getPlan(productId);
        updates = { subscription_status: plan, subscription_plan: plan };
        break;
      }

      case 'SUBSCRIPTION_EXTENDED': {
        // RC bumped the expiration. Update trial_end_date if the event carries
        // a new expiration_at_ms; otherwise log and move on.
        const newEnd = msToISODate(event.expiration_at_ms);
        if (newEnd) updates = { trial_end_date: newEnd };
        else {
          console.log(`[revenueCatWebhook] SUBSCRIPTION_EXTENDED with no expiration_at_ms; no-op`);
          return json({ success: true, message: 'SUBSCRIPTION_EXTENDED no-op' });
        }
        break;
      }

      case 'TEMPORARY_ENTITLEMENT_GRANT': {
        // Store had a validation issue; RC granted temporary access. Treat as
        // a renewal — the next RENEWAL or EXPIRATION will reconcile.
        const plan = getPlan(productId);
        updates = { subscription_status: plan, subscription_plan: plan };
        break;
      }

      case 'SUBSCRIPTION_PAUSED': {
        // We don't have a 'paused' state in the schema. Leave subscription_status
        // alone (the user can still use the app until expiration_at_ms passes)
        // and just cache the RC app_user_id below.
        console.log(`[revenueCatWebhook] SUBSCRIPTION_PAUSED for ${userEmail} — leaving subscription_status unchanged`);
        break;
      }

      case 'TRANSFER': {
        // A subscription was transferred between RC App User IDs. Handling
        // this correctly requires updating two users (revoke from old, grant
        // to new). For now: log + 200 so RC doesn't retry, and document.
        // We'll wire proper transfer handling once we see one in real traffic.
        console.warn(`[revenueCatWebhook] TRANSFER received — not yet handled. event=${JSON.stringify(event)}`);
        return json({ success: true, message: 'TRANSFER logged, no profile update' });
      }

      case 'NON_RENEWING_PURCHASE': {
        // Not relevant for auto-renewing subs.
        console.log(`[revenueCatWebhook] NON_RENEWING_PURCHASE ignored for ${userEmail}`);
        return json({ success: true, message: 'Non-renewing purchase ignored' });
      }

      default:
        console.log(`[revenueCatWebhook] Unhandled event type: ${eventType}`);
        return json({ success: true, message: `Event ${eventType} acknowledged (unhandled)` });
    }

    // Always cache the RC app_user_id so downstream code can look up RC state.
    updates.revenuecat_app_user_id = appUserId;

    // Also persist the store this subscription came from. Apple Guideline
    // 5.1.1 requires Cancel UI for Apple IAP subscriptions to link to iOS
    // Settings instead of an in-app cancel button — the frontend branches
    // on subscription_source to pick the right Cancel surface.
    const rawStore = String(event.store || '').toLowerCase();
    const ALLOWED_STORES = new Set([
      'app_store', 'play_store', 'mac_app_store', 'stripe', 'promotional', 'amazon',
    ]);
    if (ALLOWED_STORES.has(rawStore)) {
      updates.subscription_source = rawStore;
    }

    const { error: updErr } = await db
      .from('user_profile')
      .update(updates)
      .eq('id', (profile as any).id);
    if (updErr) {
      console.error('[revenueCatWebhook] profile update failed:', updErr.message);
      return json({ error: 'Profile update failed', detail: updErr.message }, 500);
    }

    console.log(`[revenueCatWebhook] Updated ${userEmail}:`, JSON.stringify(updates));
    return json({ success: true, email: userEmail, event: eventType, updated: updates });
  } catch (e) {
    const err = e as Error;
    console.error('[revenueCatWebhook] Unhandled error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
