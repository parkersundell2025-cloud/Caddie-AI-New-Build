import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];

    const { data: referralsData } = await db.from('referral').select('*').eq('referrer_email', user.email);
    const referrals = referralsData || [];
    const totalSignups = referrals.length;
    const rewarded = referrals.filter((r) => r.status === 'rewarded').length;

    // Credit balance lives in Stripe. Only query it when the secret is configured.
    let creditsRemaining = 0;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey && profile?.stripe_customer_id) {
      try {
        const Stripe = (await import('npm:stripe@14.21.0')).default;
        const stripe = new Stripe(stripeKey);
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        // balance is negative when credits exist (Stripe convention)
        creditsRemaining = (customer as { balance: number }).balance < 0
          ? Math.abs((customer as { balance: number }).balance) / 100 : 0;
      } catch (_e) { /* Stripe not reachable — leave credits at 0 */ }
    }

    return json({
      referralCode: profile?.referral_code || '',
      totalSignups,
      freeMonthsEarned: rewarded,
      freeMonthsRemaining: Math.floor(creditsRemaining / 15),
      creditsRemaining,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
