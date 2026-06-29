// supabase/functions/stripeWebhook/index.ts
//
// Direct Stripe → Supabase webhook. Listens for subscription lifecycle
// events that RC's Stripe Web Billing integration doesn't reliably emit —
// most importantly `customer.subscription.updated`, which fires when a user
// changes plans via the Stripe Customer Portal.
//
// Background: RC's Stripe Web Billing integration silently swallows portal-
// initiated plan changes. Subscriptions update in Stripe immediately, RC's
// internal customer state catches up, but no webhook event is emitted —
// leaving user_profile.subscription_plan stale until the next billing cycle.
// This webhook fills that gap; RC remains responsible for iOS App Store
// events (which RC handles correctly).
//
// Auth: Stripe webhook signature verification using STRIPE_WEBHOOK_SECRET.
// Stripe sends a `Stripe-Signature` header that contains a timestamp + HMAC.
// We use the SDK's constructEventAsync (Deno-compatible variant of
// constructEvent that uses Web Crypto for the HMAC) to verify and parse in
// one step. A bad signature → 400.
//
// Events handled:
//   * customer.subscription.updated   — plan change, status change
//   * customer.subscription.deleted   — final cancellation (sub fully ended)
//
// Idempotency: Stripe retries failed deliveries. event.id is stable across
// retries. We don't dedupe explicitly because the operations are themselves
// idempotent (UPDATE user_profile SET subscription_status = ...).
//
// Deploy:
//   npx supabase functions deploy stripeWebhook --no-verify-jwt --project-ref dbvsnzppevytanoxzgwj
//   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref dbvsnzppevytanoxzgwj
//
// Stripe Dashboard setup:
//   Developers → Webhooks → Add endpoint
//     URL: https://dbvsnzppevytanoxzgwj.supabase.co/functions/v1/stripeWebhook
//     Events: customer.subscription.updated, customer.subscription.deleted
//     Copy the Signing secret → set as STRIPE_WEBHOOK_SECRET above.

import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

const STRIPE_SECRET_KEY     = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Reuse the same product → plan map as revenueCatWebhook so any product
// added there gets picked up here too. Keeping them in sync is a manual
// step today; worth extracting to _shared if the divergence becomes
// load-bearing.
const PLAN_FROM_PRODUCT: Record<string, 'basic' | 'pro'> = {
  'prod_UNQmTxp5xw8N0C': 'basic',
  'prod_UNQnQZbZ4pOtHo': 'pro',
};
const PLAN_FROM_PRICE: Record<string, 'basic' | 'pro'> = {
  'price_1TOfvE2ZJRGxxJxRqXKmOVuf': 'basic',
  'price_1TOfwL2ZJRGxxJxRc7SiSjSm': 'pro',
};

function planFromSubscriptionItem(item: Stripe.SubscriptionItem): 'basic' | 'pro' | null {
  const priceId = item.price?.id;
  const productId = typeof item.price?.product === 'string' ? item.price.product : item.price?.product?.id;
  if (priceId && PLAN_FROM_PRICE[priceId]) return PLAN_FROM_PRICE[priceId];
  if (productId && PLAN_FROM_PRODUCT[productId]) return PLAN_FROM_PRODUCT[productId];
  return null;
}

// Map Stripe sub status → our subscription_status column.
function mapStatus(stripeStatus: Stripe.Subscription.Status, plan: 'basic' | 'pro'):
  | 'trial' | 'basic' | 'pro' | 'cancelling' | 'expired' {
  switch (stripeStatus) {
    case 'trialing':            return 'trial';
    case 'active':              return plan;
    case 'past_due':            return plan;        // give a grace window; will retry
    case 'unpaid':              return 'expired';
    case 'canceled':            return 'expired';
    case 'incomplete':          return 'expired';
    case 'incomplete_expired':  return 'expired';
    case 'paused':              return plan;        // we don't have a 'paused' state
    default:                    return 'expired';
  }
}

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    stripeClient = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  }
  return stripeClient;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }

    const signature = req.headers.get('Stripe-Signature');
    if (!signature) {
      console.error('[stripeWebhook] missing Stripe-Signature header');
      return json({ error: 'Missing signature' }, 400);
    }

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe().webhooks.constructEventAsync(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch (err) {
      console.error('[stripeWebhook] signature verification failed:', (err as Error).message);
      return json({ error: 'Invalid signature' }, 400);
    }

    console.log(`[stripeWebhook] received ${event.type} id=${event.id}`);

    const HANDLED_EVENTS = new Set([
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);
    if (!HANDLED_EVENTS.has(event.type)) {
      // Other event types ack but no-op. Stripe won't retry on 2xx.
      return json({ success: true, message: `Event ${event.type} acknowledged (no-op)` });
    }

    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) {
      console.error('[stripeWebhook] subscription has no customer id');
      return json({ error: 'Missing customer id' }, 400);
    }

    // Find the user_profile row by stripe_customer_id. For brand-new
    // subscriptions (customer.subscription.created), the profile may not
    // have stripe_customer_id yet because completeStripeCheckout writes
    // that asynchronously from the success page — and webhooks frequently
    // beat the success page to the DB. Fall back to looking up by Stripe
    // customer email so we can still claim and update the right profile.
    const db = serviceClient();
    let profiles: { id: string; user_email: string; subscription_status: string; subscription_plan: string }[] | null = null;
    {
      const { data, error: lookupErr } = await db
        .from('user_profile')
        .select('id, user_email, subscription_status, subscription_plan')
        .eq('stripe_customer_id', customerId);
      if (lookupErr) {
        console.error('[stripeWebhook] profile lookup failed:', lookupErr.message);
        return json({ error: 'Profile lookup failed', detail: lookupErr.message }, 500);
      }
      profiles = data;
    }
    if (!profiles || profiles.length === 0) {
      // Fallback for created events: resolve the customer's email from
      // Stripe, then match user_profile by that email. Lowercased to match
      // the normalize_user_email_trigger.
      try {
        const customer = await stripe().customers.retrieve(customerId);
        const customerEmail =
          typeof customer === 'object' && !('deleted' in customer) && customer.email
            ? customer.email.toLowerCase().trim()
            : null;
        if (customerEmail) {
          const { data: byEmail, error: emailLookupErr } = await db
            .from('user_profile')
            .select('id, user_email, subscription_status, subscription_plan')
            .eq('user_email', customerEmail);
          if (emailLookupErr) {
            console.error('[stripeWebhook] email fallback lookup failed:', emailLookupErr.message);
          } else if (byEmail && byEmail.length > 0) {
            profiles = byEmail;
            console.log(`[stripeWebhook] resolved customer=${customerId} to user_email=${customerEmail} via fallback`);
          }
        }
      } catch (e) {
        console.warn(`[stripeWebhook] customers.retrieve(${customerId}) failed for email fallback:`, (e as Error).message);
      }
    }
    if (!profiles || profiles.length === 0) {
      console.warn(`[stripeWebhook] no user_profile for stripe_customer_id=${customerId} (and no email match) — event ${event.type} dropped`);
      // Ack so Stripe doesn't retry forever for an orphan customer.
      return json({ success: true, message: 'No profile for customer; skipped' });
    }
    if (profiles.length > 1) {
      console.warn(`[stripeWebhook] multiple user_profile rows (${profiles.length}) for stripe_customer_id=${customerId}; updating all`);
    }

    // Derive plan from the (first) subscription item's price/product.
    const item = sub.items?.data?.[0];
    const plan = item ? planFromSubscriptionItem(item) : null;
    if (!plan) {
      console.warn(`[stripeWebhook] could not derive plan from sub ${sub.id} — item.price=${item?.price?.id} item.product=${typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id}`);
      return json({ success: true, message: 'Plan not derivable; skipped' });
    }

    let updates: Record<string, unknown>;
    if (event.type === 'customer.subscription.deleted') {
      // Final cancellation — sub fully ended.
      updates = { subscription_status: 'expired' };
    } else {
      // customer.subscription.created / .updated — new sub, plan change,
      // status change. cancel_at_period_end == true means user requested
      // cancellation but is still in their paid period; map to 'cancelling'
      // to match the existing revenueCatWebhook behavior. For .created we
      // also stamp stripe_customer_id since the profile may not have it yet
      // (completeStripeCheckout races us).
      if (sub.cancel_at_period_end) {
        updates = { subscription_status: 'cancelling', subscription_plan: plan, stripe_subscription_id: sub.id };
      } else {
        updates = {
          subscription_status: mapStatus(sub.status, plan),
          subscription_plan: plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          subscription_source: 'stripe',
        };
      }
    }

    for (const profile of profiles) {
      const { error: updErr } = await db
        .from('user_profile')
        .update(updates)
        .eq('id', profile.id);
      if (updErr) {
        console.error(`[stripeWebhook] update failed for profile ${profile.id}:`, updErr.message);
        // Keep going; one failure shouldn't block the others.
      } else {
        console.log(`[stripeWebhook] updated ${profile.user_email}:`, JSON.stringify(updates));
      }
    }

    return json({ success: true, event: event.type, customer: customerId, updated: updates });
  } catch (e) {
    const err = e as Error;
    console.error('[stripeWebhook] unhandled error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
