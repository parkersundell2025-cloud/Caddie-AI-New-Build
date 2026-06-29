// supabase/functions/completeStripeCheckout/index.ts
//
// Called by the post-checkout success page to pull the canonical Stripe
// customer + subscription IDs off the Checkout Session and persist them onto
// the user_profile. The revenueCatWebhook handles subscription_status and
// trial_end_date (via RC's entitlement-normalized events), but RC doesn't
// reliably surface the underlying Stripe IDs to the webhook payload — and
// even when it does, the field is the Subscription Item ID (`si_*`), not
// the parent Subscription ID (`sub_*`). So we go to Stripe directly.
//
// This function is the source of truth for these three fields on user_profile
// for web/Stripe-sourced subscriptions:
//   * stripe_customer_id      cus_*  — needed for Stripe Customer Portal links
//   * stripe_subscription_id  sub_*  — needed for direct cancel/update API calls
//   * subscription_source     'stripe' — drives the Cancel UX surface (Apple 5.1.1)
//
// Auth: standard Supabase JWT (verify_jwt defaults to true). The caller is
// the post-checkout user; we trust their identity from the JWT and we look
// up the Stripe session ourselves (caller-supplied session_id is verified
// against the session's metadata.supabase_user_id before writing).
//
// Caller body shape:
//   { session_id: "cs_test_..."|"cs_live_..." }
//
// Idempotent — safe to call multiple times. Won't overwrite IDs with null
// if the session lookup returns partial data.
//
// Secrets required:
//   STRIPE_SECRET_KEY        sk_test_*/sk_live_*/rk_live_* (same key as
//                            createStripeCheckoutSession)

import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser, serviceClient } from '../_shared/supabase.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const sessionId = body?.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== 'string') {
      return json({ error: 'session_id required' }, 400);
    }
    if (!sessionId.startsWith('cs_')) {
      return json({ error: 'session_id must start with cs_' }, 400);
    }

    // Pull the session with the subscription (+ its line items) + customer
    // relations expanded in one round-trip. Without the expand, we'd only
    // get IDs and have to hop again to resolve them. We also need the line
    // item price to derive basic vs. pro for the profile-create path below.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe().checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'subscription.items.data.price', 'customer'],
      });
    } catch (e) {
      const msg = (e as Error)?.message || 'Stripe lookup failed';
      console.warn(`[completeStripeCheckout] sessions.retrieve(${sessionId}) failed:`, msg);
      return json({ error: 'Session not found', detail: msg }, 404);
    }

    // Verify the session belongs to the caller. metadata.supabase_user_id was
    // set when createStripeCheckoutSession created the session; if it
    // doesn't match the authenticated user, someone is trying to claim
    // another user's checkout (a real attack vector — checkout session IDs
    // travel in the URL).
    const sessionUserId = session.metadata?.supabase_user_id;
    if (sessionUserId && sessionUserId !== user.id) {
      console.warn(
        `[completeStripeCheckout] session ${sessionId} metadata.supabase_user_id=${sessionUserId} ` +
          `does not match authenticated user ${user.id}; refusing`,
      );
      return json({ error: 'Session does not belong to caller' }, 403);
    }

    // Customer/subscription may be the bare ID string (no expand) or the
    // expanded object. Normalize both shapes.
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id ?? null;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

    if (!customerId) {
      // Genuinely possible for one-time payment sessions, but we only create
      // subscription-mode sessions, so this would mean Stripe returned a
      // shape we didn't expect. Log + 200 so the frontend doesn't error;
      // the RC webhook still handles subscription_status independently.
      console.warn(`[completeStripeCheckout] session ${sessionId} has no customer; skipping`);
      return json({ success: true, updated: {}, message: 'No customer on session' });
    }

    // Derive plan + trial state from the expanded subscription. Used for
    // both create and update paths so the user lands in the right state
    // without depending on the RC webhook (which is unreliable for
    // Stripe-origin INITIAL_PURCHASE events). Mirrors the
    // revenueCatWebhook INITIAL_PURCHASE handler so both code paths
    // converge on identical writes.
    const STRIPE_PRICE_BASIC = 'price_1TOfvE2ZJRGxxJxRqXKmOVuf';
    const STRIPE_PRICE_PRO   = 'price_1TOfwL2ZJRGxxJxRc7SiSjSm';
    const subObj = typeof session.subscription === 'object' ? session.subscription : null;
    const lineItemPriceId =
      subObj?.items?.data?.[0]?.price?.id ?? (session.metadata?.plan === 'pro' ? STRIPE_PRICE_PRO : STRIPE_PRICE_BASIC);
    const plan: 'basic' | 'pro' = lineItemPriceId === STRIPE_PRICE_PRO ? 'pro' : 'basic';
    const nowMs = Date.now();
    const trialEndMs = subObj?.trial_end ? subObj.trial_end * 1000 : null;
    const isInTrial = trialEndMs !== null && trialEndMs > nowMs;
    const trialEndISO = trialEndMs ? new Date(trialEndMs).toISOString().split('T')[0] : null;
    const todayISO = new Date().toISOString().split('T')[0];

    // Build the patch. Always set subscription_source='stripe' since the
    // mere fact that we got here through a Stripe Checkout Session is
    // proof enough — we don't need to trust RC's event.store for this.
    // Only set the subscription_id if we actually have one (sub_*) — a
    // null write would clobber a prior value.
    const updates: Record<string, unknown> = {
      stripe_customer_id: customerId,
      subscription_source: 'stripe',
      // Flip subscription_status + plan directly. Previously this was left
      // to revenueCatWebhook, but RC's Stripe Web Billing integration drops
      // events for portal-initiated changes AND for INITIAL_PURCHASE on
      // existing customers, trapping the user on /subscribe-now → /checkout/
      // success → /subscribe-now. Writing it here makes the post-payment
      // unlock deterministic regardless of RC's behavior. If RC also writes
      // (later), it lands on the same value so no conflict.
      subscription_status: isInTrial ? 'trial' : plan,
      subscription_plan: plan,
    };
    if (subscriptionId) updates.stripe_subscription_id = subscriptionId;
    if (isInTrial && trialEndISO) {
      updates.trial_start_date = todayISO;
      updates.trial_end_date = trialEndISO;
    }

    // Match by user_email. user_profile.id is a random text UUID assigned by
    // the table default — it is NOT the same as auth.users.id. The
    // normalize_user_email_trigger lowercases user_email on write, so we
    // lowercase here too to match.
    const userEmail = (user.email || '').toLowerCase().trim();
    if (!userEmail) return json({ error: 'Authenticated user has no email' }, 400);

    const db = serviceClient();

    // Does a profile already exist? Web sign-ups via OAuth (Apple/Google) ->
    // Stripe checkout hit this function with NO existing profile, because
    // revenueCatWebhook only creates profiles for iOS-app events and there
    // is no other automatic profile-creation path on web. Without an upsert
    // here, the silent no-op UPDATE leaves the user trapped on
    // /subscribe-now forever (Gateway sees no profile -> /subscribe-now;
    // CheckoutSuccess polls and times out).
    const { data: existing, error: lookupErr } = await db
      .from('user_profile')
      .select('id')
      .eq('user_email', userEmail);
    if (lookupErr) {
      console.error('[completeStripeCheckout] profile lookup failed:', lookupErr.message);
      return json({ error: 'Profile lookup failed', detail: lookupErr.message }, 500);
    }

    if (existing && existing.length > 0) {
      // Existing profile path — patch Stripe identity AND subscription state
      // so the post-payment access flip is deterministic.
      const { error: updErr } = await db
        .from('user_profile')
        .update(updates)
        .eq('user_email', userEmail);
      if (updErr) {
        console.error('[completeStripeCheckout] update failed:', updErr.message);
        return json({ error: 'Profile update failed', detail: updErr.message }, 500);
      }
      console.log(`[completeStripeCheckout] Updated user_profile for ${userEmail} with ${JSON.stringify(updates)}`);
      return json({ success: true, created: false, updated: updates });
    }

    // No profile — create one with everything we know from Stripe.
    // plan / trial fields already derived above for the existing-profile
    // path; reused here verbatim.
    //
    // first_name: prefer the auth user_metadata.name if present (Google +
    // Apple-with-name share this), then session.customer_details.name,
    // then the local part of the email as a last-resort.
    const authName =
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined);
    const customerDetailsName = session.customer_details?.name;
    const fallbackName = userEmail.split('@')[0];
    const rawName = authName || customerDetailsName || fallbackName;
    const firstName = rawName.split(' ')[0];

    const insertPayload = {
      user_email: userEmail,
      first_name: firstName,
      subscription_status: isInTrial ? 'trial' : plan,
      subscription_plan: plan,
      trial_start_date: todayISO,
      trial_end_date: trialEndISO,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_source: 'stripe',
      onboarding_complete: false,
      tour_completed: false,
    };
    const { error: insErr } = await db.from('user_profile').insert(insertPayload);
    if (insErr) {
      console.error('[completeStripeCheckout] profile create failed:', insErr.message);
      return json({ error: 'Profile create failed', detail: insErr.message }, 500);
    }
    console.log(`[completeStripeCheckout] Created user_profile for ${userEmail} with ${JSON.stringify(insertPayload)}`);
    return json({ success: true, created: true, profile: insertPayload });
  } catch (e) {
    const err = e as Error;
    console.error('[completeStripeCheckout] error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
