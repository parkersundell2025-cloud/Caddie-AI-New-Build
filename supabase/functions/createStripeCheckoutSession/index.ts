// supabase/functions/createStripeCheckoutSession/index.ts
//
// Creates a server-side Stripe Checkout Session for a Caddie AI subscription
// and returns its URL. Replaces the old buy.stripe.com payment-link approach
// (which couldn't attach user identity to the purchase). Ported semantically
// from Base44's `stripeCheckoutSession` function (commit 7f3af62) with the
// following migration changes:
//
//   * client_reference_id is now the Supabase auth user UUID (auth.user.id),
//     not the email. UUIDs are stable across email changes and are what RC's
//     Stripe integration uses to tie the resulting RC subscriber to a user.
//   * `metadata.rc_app_user_id` set explicitly so RC's Stripe integration
//     attributes the purchase to the right RC App User ID.
//   * Email comes from the authenticated Supabase session (lowercased, trimmed
//     — matches the user_profile email-normalization trigger).
//   * success_url / cancel_url take a `return_url_origin` from the client so
//     the redirect lands on the calling app's origin (not the Supabase
//     edge-function origin) without us having to hardcode an APP_URL secret.
//
// Auth: standard Supabase JWT (verify_jwt defaults to true). The caller must
// be a signed-in user.
//
// Secrets required:
//   STRIPE_SECRET_KEY        sk_test_* in test mode, sk_live_* in production
//   STRIPE_BASIC_PRICE_ID    price_* for the monthly Basic subscription
//   STRIPE_PRO_PRICE_ID      price_* for the monthly Pro subscription

import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const PRICE_BY_PLAN: Record<'basic' | 'pro', string | undefined> = {
  basic: Deno.env.get('STRIPE_BASIC_PRICE_ID'),
  pro: Deno.env.get('STRIPE_PRO_PRICE_ID'),
};

// Lazy SDK init so the function can return a meaningful error if the key is
// missing rather than crashing at module-load time.
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
    // Auth
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Parse + validate body
    const body = await req.json().catch(() => null);
    const plan = body?.plan as 'basic' | 'pro' | undefined;
    const returnUrlOrigin = body?.return_url_origin as string | undefined;
    const overrideSuccessUrl = body?.success_url as string | undefined;
    const overrideCancelUrl = body?.cancel_url as string | undefined;
    const withTrial = body?.trial !== false; // default to true (matches existing prod flow)

    if (!plan || !['basic', 'pro'].includes(plan)) {
      return json({ error: 'plan must be "basic" or "pro"' }, 400);
    }

    // Caller can either supply both success_url + cancel_url (preferred — used
    // by Capacitor iOS/Android to pass caddieai:// custom-scheme URLs) or fall
    // back to return_url_origin (web flow). One of the two paths must be
    // satisfied.
    let successUrl: string;
    let cancelUrl: string;
    if (overrideSuccessUrl && overrideCancelUrl) {
      // Allow-list: only https:// (web) and caddieai:// (the iOS scheme
      // registered in Info.plist) are permitted. Blocks open-redirect attacks
      // that would otherwise let a caller fish a Stripe-branded redirect to
      // an arbitrary destination.
      const allowed = (u: string) => u.startsWith('https://') || u.startsWith('caddieai://');
      if (!allowed(overrideSuccessUrl) || !allowed(overrideCancelUrl)) {
        return json({ error: 'success_url and cancel_url must use https:// or caddieai:// scheme' }, 400);
      }
      successUrl = overrideSuccessUrl;
      cancelUrl = overrideCancelUrl;
    } else {
      if (!returnUrlOrigin) {
        return json({ error: 'return_url_origin is required (or pass success_url + cancel_url explicitly)' }, 400);
      }
      try {
        new URL(returnUrlOrigin);
      } catch {
        return json({ error: 'return_url_origin must be a valid URL' }, 400);
      }
      successUrl = `${returnUrlOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${returnUrlOrigin}/subscribe-now`;
    }

    const priceId = PRICE_BY_PLAN[plan];
    if (!priceId) {
      return json({ error: `STRIPE_${plan.toUpperCase()}_PRICE_ID not configured` }, 500);
    }

    // Identity
    const email = (user.email || '').toLowerCase().trim();
    const userId = user.id;
    if (!email) return json({ error: 'Authenticated user has no email' }, 400);

    // Metadata replicated on BOTH the Session AND the resulting Subscription so
    // RC's Stripe integration can find it from either side. Base44 did the same.
    const metadata = {
      rc_app_user_id: userId,
      supabase_user_id: userId,
      user_email: email,
      plan,
    };

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(withTrial ? { trial_period_days: 7 } : {}),
        metadata,
      },
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      // Allow promotion codes / coupons through Stripe Checkout — matches the
      // referral credit flow Base44 used. Harmless even if no coupons exist.
      allow_promotion_codes: true,
    });

    return json({ session_url: session.url, session_id: session.id });
  } catch (e) {
    const err = e as Error;
    console.error('[createStripeCheckoutSession] error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
