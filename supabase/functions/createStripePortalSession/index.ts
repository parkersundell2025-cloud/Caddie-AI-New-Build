// supabase/functions/createStripePortalSession/index.ts
//
// Creates a Stripe Billing Portal Session for the authenticated user and
// returns its URL. The portal lets the user manage their subscription —
// switch plans (if enabled in Stripe Dashboard → Customer Portal), update
// payment method, view invoices, cancel.
//
// Why this exists instead of just linking to the public Stripe login URL:
// the public login URL bounces users through email magic-link verification,
// and any cached session cookie causes Stripe to auto-redirect to the
// configured return URL — manifesting as "click Upgrade, end up at /home"
// when the user already had a portal session open. A portal Session URL is
// pre-authenticated for a specific customer and lands directly on the
// management view.
//
// Auth: standard Supabase JWT. Caller must be a signed-in user with a
// stripe_customer_id on their user_profile row.
//
// Secrets required:
//   STRIPE_SECRET_KEY  sk_test_* or sk_live_*

import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
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
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const db = serviceClient();
    const { data: profiles, error: profileErr } = await db
      .from('user_profile')
      .select('stripe_customer_id')
      .eq('user_email', user.email);
    if (profileErr) return json({ error: 'Profile lookup failed', detail: profileErr.message }, 500);

    const customerId = profiles?.[0]?.stripe_customer_id;
    if (!customerId) {
      return json({ error: 'No Stripe customer on file. Subscribe first.' }, 404);
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.return_url || 'https://caddieaiapp.com/manage-subscription';

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
