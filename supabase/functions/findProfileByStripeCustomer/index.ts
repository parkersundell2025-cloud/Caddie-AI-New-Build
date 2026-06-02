// supabase/functions/findProfileByStripeCustomer/index.ts
//
// Gateway.jsx fallback when post-auth profile lookup by email fails. Use case:
// the user signs in with a Google/Apple OAuth email different from the email
// they used to purchase (e.g. signed in as foo@gmail.com but bought as
// foo@aol.com years ago). Without this fallback they'd bounce to /subscribe-now
// even though they have a paid sub.
//
// Lookups (tried in order):
//   1. Search Stripe for a customer with this email.
//   2. For each candidate customer, check our new metadata convention —
//      `metadata.rc_app_user_id` (set by createStripeCheckoutSession) — and
//      look up the user_profile whose `revenuecat_app_user_id` matches.
//   3. Legacy fallback: look up user_profile by `stripe_customer_id`. This
//      column was set by Base44's flow but is null for profiles created via
//      the new Supabase flow. Helps after migrating Base44 user data.
//
// Auth: verify_jwt = true (default). Uses the JWT's email — ignores any
// `email` field in the request body, so callers can't fish for other users'
// profiles.
//
// Secret required: STRIPE_SECRET_KEY (test mode for dev, live mode at cutover).

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
    if (!email) return json({ found: false, message: 'No email on authenticated user' });

    const db = serviceClient();
    const s = stripe();

    // 1. Find Stripe customers with this email (handles multiple — possible
    // when a user accidentally created more than one customer over time).
    const customers = await s.customers.search({
      query: `email:"${email}"`,
      limit: 10,
    });
    if (customers.data.length === 0) {
      return json({ found: false, message: 'No Stripe customer for this email' });
    }

    // 2. For each customer, check metadata.rc_app_user_id and try the
    // revenuecat_app_user_id linkage we maintain on user_profile.
    for (const customer of customers.data) {
      const rcAppUserId = customer.metadata?.rc_app_user_id;
      if (rcAppUserId) {
        const { data, error } = await db
          .from('user_profile')
          .select('*')
          .eq('revenuecat_app_user_id', rcAppUserId);
        if (error) {
          console.warn('[findProfileByStripeCustomer] revenuecat_app_user_id lookup failed:', error.message);
          continue;
        }
        if (data && data[0]) {
          return json({ found: true, profile: data[0], resolved_via: 'rc_app_user_id' });
        }
      }

      // 3. Legacy: lookup by stripe_customer_id. Only Base44-migrated profiles
      // have this column populated; new flow leaves it null.
      const { data, error } = await db
        .from('user_profile')
        .select('*')
        .eq('stripe_customer_id', customer.id);
      if (error) {
        console.warn('[findProfileByStripeCustomer] stripe_customer_id lookup failed:', error.message);
        continue;
      }
      if (data && data[0]) {
        return json({ found: true, profile: data[0], resolved_via: 'stripe_customer_id' });
      }
    }

    return json({ found: false, message: 'Stripe customer(s) found but no matching user_profile' });
  } catch (e) {
    const err = e as Error;
    console.error('[findProfileByStripeCustomer] error:', err?.message || err);
    return json({ found: false, error: err?.message || 'Internal error' });
  }
});
