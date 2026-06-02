// supabase/functions/cancelSubscription/index.ts
//
// Cancels the authenticated user's active Stripe subscription at the end of
// the current billing period. The user retains access until period_end.
// Required by Apple Guideline 5.1.1 (in-app cancel must work for iOS users).
//
// Flow:
//   1. Authenticate the Supabase JWT (verify_jwt = true).
//   2. Find the user's Stripe customer(s) by email.
//   3. For each, find an active or trialing subscription.
//   4. Update with `cancel_at_period_end: true`.
//   5. Synchronously update user_profile.subscription_status='cancelling' for
//      immediate UX feedback. The eventual RC CANCELLATION webhook will
//      confirm + update further (this matches Gateway/SubscribeNow's
//      'cancelling' state which still grants access until trial_end_date).
//
// What this DOESN'T do:
//   - Cancel iOS App Store subscriptions. iOS users must cancel through iOS
//     Settings (Apple's rule); ManageSubscription.jsx already deeplinks to
//     `itms-apps://apps.apple.com/account/subscriptions` for them.
//   - Process the refund logic. RC's CANCELLATION webhook fires once Stripe
//     processes our cancel_at_period_end update.
//
// Secrets required: STRIPE_SECRET_KEY (same secret used by
// createStripeCheckoutSession — test mode key in dev, live mode at cutover).

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

    const email = (user.email || '').toLowerCase().trim();
    if (!email) return json({ error: 'No email on authenticated user' }, 400);

    const s = stripe();

    // Find Stripe customer(s) for this email. Most users have exactly one,
    // but Stripe doesn't prevent multiple customers per email — handle both.
    const customers = await s.customers.search({
      query: `email:"${email}"`,
      limit: 10,
    });

    if (customers.data.length === 0) {
      return json({
        error: 'No active subscription found',
        message: 'It looks like you don\'t have an active subscription on file. If you think this is wrong, please email support@caddieaiapp.com.',
      }, 404);
    }

    // Find an active or trialing subscription across all matching customers.
    // Stripe's list-subscriptions `status` param accepts a single value; passing
    // 'all' returns every status, so we filter client-side for safety.
    let activeSub: Stripe.Subscription | null = null;
    let matchedCustomerId: string | null = null;
    for (const customer of customers.data) {
      const subs = await s.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 20,
      });
      const found = subs.data.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing',
      );
      if (found) {
        activeSub = found;
        matchedCustomerId = customer.id;
        break;
      }
    }

    if (!activeSub) {
      return json({
        error: 'No active subscription found',
        message: 'It looks like you don\'t have an active subscription. If you recently cancelled, you may still have access until your billing period ends.',
      }, 404);
    }

    // Already scheduled to cancel? Idempotent — return the existing state.
    if (activeSub.cancel_at_period_end) {
      return json({
        success: true,
        message: 'Your subscription is already scheduled to cancel at the end of the current billing period.',
        already_cancelling: true,
        subscription_id: activeSub.id,
        current_period_end: activeSub.current_period_end,
      });
    }

    // Cancel at period end — user keeps paid access until current_period_end.
    const updated = await s.subscriptions.update(activeSub.id, {
      cancel_at_period_end: true,
    });

    // Synchronously update the profile for immediate UX feedback. The eventual
    // RC CANCELLATION webhook will confirm + may set additional fields. RLS
    // requires service-role here because we're cross-checking by user_email
    // (which the JWT can match on its own, but service-role is simpler).
    try {
      const db = serviceClient();
      const { error: updErr } = await db
        .from('user_profile')
        .update({ subscription_status: 'cancelling' })
        .eq('user_email', email);
      if (updErr) {
        console.warn('[cancelSubscription] profile update failed (non-fatal):', updErr.message);
      }
    } catch (dbErr) {
      console.warn('[cancelSubscription] profile update exception (non-fatal):', (dbErr as Error)?.message);
    }

    return json({
      success: true,
      message: 'Your subscription will be cancelled at the end of the current billing period. You\'ll keep full access until then.',
      subscription_id: updated.id,
      stripe_customer_id: matchedCustomerId,
      current_period_end: updated.current_period_end,
    });
  } catch (e) {
    const err = e as Error;
    console.error('[cancelSubscription] error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
