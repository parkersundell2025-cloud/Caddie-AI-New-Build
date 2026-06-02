import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

const USER_TABLES = [
  'chat_message', 'drill_rating', 'session_log', 'round', 'handicap_entry',
  'practice_plan', 'weekly_insight', 'badge', 'leaderboard_entry', 'weekly_report',
  'monthly_game_plan', 'notification', 'flagged_round', 'flagged_account',
  'hall_of_fame', 'feedback', 'waitlist_credit',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();
    const email = user.email!;

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', email);
    const profile = profiles?.[0] || null;

    // Cancel Stripe subscription if configured (non-blocking)
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey && profile?.stripe_subscription_id) {
      try {
        const Stripe = (await import('npm:stripe@14.21.0')).default;
        const stripe = new Stripe(stripeKey);
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (e) {
        console.error(`Stripe cancellation failed for ${email}:`, (e as Error).message);
      }
    }

    // Delete all user-owned data
    await Promise.all(USER_TABLES.map((t) =>
      db.from(t).delete().eq('user_email', email).then(({ error }) => {
        if (error) console.error(`Failed to delete ${t} for ${email}:`, error.message);
      })
    ));

    // Referrals (user as referrer or referred)
    await Promise.all([
      db.from('referral').delete().eq('referrer_email', email),
      db.from('referral').delete().eq('referred_email', email),
    ]);

    // Profile last
    if (profile) await db.from('user_profile').delete().eq('id', profile.id);

    // Delete the auth user — frees the email to register again
    await db.auth.admin.deleteUser(user.id);

    return json({ success: true });
  } catch (error) {
    console.error('deleteAccount error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
