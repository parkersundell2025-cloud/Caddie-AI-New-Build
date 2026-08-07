import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Referral v1 (SOW 3b): record a user-to-user referral at signup. The caller
// is the NEW user; their user_profile.referred_by_code (set during onboarding)
// names the code they signed up under. We resolve that code to the referrer,
// apply the fraud guards, and write one pending referral row.
//
// Fraud policy (per quote): no self-referral. Reward itself is only "earned"
// on the referred user's first paid PRO purchase — that flip happens in
// revenueCatWebhook, not here. Fulfillment stays manual.
//
// Idempotent: unique(lower(referred_email)) means a re-call is a no-op.
// Codes that don't resolve to a user profile are ignored here (they may be
// influencer AFFILIATE codes, handled by the separate affiliate system).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user?.email) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();
    const email = user.email.toLowerCase().trim();

    const { data: profiles } = await db.from('user_profile')
      .select('referred_by_code, referral_code').eq('user_email', email);
    const profile = profiles?.[0];
    const code = (profile?.referred_by_code || '').trim();
    if (!code) return json({ recorded: false, reason: 'no_code' });

    // Self-referral guard: the code can't be the user's own.
    if (profile?.referral_code && code.toUpperCase() === profile.referral_code.toUpperCase()) {
      return json({ recorded: false, reason: 'self_referral' });
    }

    // Resolve the code to a referrer. Case-insensitive; must be a real user's
    // referral_code (not an affiliate code).
    const { data: refUsers } = await db.from('user_profile')
      .select('user_email').ilike('referral_code', code);
    const referrer = refUsers?.[0];
    if (!referrer?.user_email) return json({ recorded: false, reason: 'code_not_a_user' });
    if (referrer.user_email.toLowerCase() === email) {
      return json({ recorded: false, reason: 'self_referral' });
    }

    const { error } = await db.from('referral').insert({
      referrer_email: referrer.user_email.toLowerCase(),
      referred_email: email,
      referral_code: code,
      status: 'pending',
      created_by: 'recordReferral',
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return json({ recorded: false, reason: 'already_recorded' });
      }
      return json({ error: 'insert_failed', detail: error.message }, 500);
    }
    return json({ recorded: true, referrer: referrer.user_email });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
