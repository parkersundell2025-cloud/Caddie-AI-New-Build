import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (user?.app_metadata?.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, 403);
    const db = serviceClient();

    let { email, stripeSubscriptionId, stripeCustomerId } = await req.json();
    if (!email) return json({ error: 'Email is required' }, 400);
    // Supabase auth lowercases email on user creation, and RLS on user_profile
    // is `user_email = auth.email()` (case-sensitive). Normalize so the row we
    // insert here is readable by the eventual signed-in user.
    email = email.toLowerCase().trim();

    const today = new Date().toISOString().split('T')[0];
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: existing } = await db.from('user_profile').select('id').eq('user_email', email);
    if ((existing?.length ?? 0) > 0) {
      await db.from('user_profile').update({
        subscription_status: 'trial',
        subscription_plan: 'pro',
        stripe_subscription_id: stripeSubscriptionId || 'sub_provisional_pro',
        stripe_customer_id: stripeCustomerId || 'cus_provisional',
        trial_start_date: today,
        trial_end_date: trialEnd,
      }).eq('id', existing![0].id);
      return json({ success: true, message: 'Profile updated', action: 'updated' });
    }

    await db.from('user_profile').insert({
      user_email: email,
      first_name: email.split('@')[0],
      subscription_status: 'trial',
      subscription_plan: 'pro',
      stripe_subscription_id: stripeSubscriptionId || 'sub_provisional_pro',
      stripe_customer_id: stripeCustomerId || 'cus_provisional',
      trial_start_date: today,
      trial_end_date: trialEnd,
      onboarding_complete: false,
      current_handicap: 18,
      goal_handicap: 10,
      target_timeline: '6 months',
      days_per_week: 3,
      preferred_days: ['Saturday', 'Sunday', 'Wednesday'],
      skill_driving: 3,
      skill_iron_play: 3,
      skill_short_game: 3,
      skill_putting: 3,
      skill_course_management: 3,
    });
    return json({ success: true, message: 'Profile created', action: 'created' });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
