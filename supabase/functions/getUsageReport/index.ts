import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Admin-only usage report: subscription-state buckets + "leaky" users (active
// without a valid subscription). Admin = JWT app_metadata.role === 'admin'.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (user?.app_metadata?.role !== 'admin') {
      return json({ error: 'Forbidden: Admin access required' }, 403);
    }
    const db = serviceClient();

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: allProfilesData } = await db.from('user_profile').select('*');
    const allProfiles = allProfilesData || [];

    const buckets = {
      total: allProfiles.length,
      neverPaid: 0,
      trialActive: 0,
      trialExpiredStillTrial: 0,
      expired: 0,
      cancelling: 0,
      basic: 0,
      pro: 0,
    };
    // deno-lint-ignore no-explicit-any
    const leakyUsers: any[] = [];

    for (const p of allProfiles) {
      const hasPayment = !!p.stripe_customer_id || !!p.revenuecat_app_user_id;
      const usedRecently = p.last_session_date && p.last_session_date >= sevenDaysAgo;
      const trialExpired = p.subscription_status === 'trial' && p.trial_end_date && p.trial_end_date < today;

      if (!hasPayment) buckets.neverPaid++;
      else if (p.subscription_status === 'trial') {
        if (trialExpired) buckets.trialExpiredStillTrial++;
        else buckets.trialActive++;
      } else if (p.subscription_status === 'expired') buckets.expired++;
      else if (p.subscription_status === 'cancelling') buckets.cancelling++;
      else if (p.subscription_status === 'basic') buckets.basic++;
      else if (p.subscription_status === 'pro') buckets.pro++;

      if (usedRecently && (!hasPayment || trialExpired || p.subscription_status === 'expired')) {
        leakyUsers.push({
          email: p.user_email,
          last_session_date: p.last_session_date,
          subscription_status: p.subscription_status,
          trial_end_date: p.trial_end_date,
          stripe_customer_id: p.stripe_customer_id || null,
          revenuecat_app_user_id: p.revenuecat_app_user_id || null,
          reason: !hasPayment ? 'no_payment_linkage' : trialExpired ? 'trial_expired_status_unchanged' : 'expired',
        });
      }
    }

    return json({ generated_at: new Date().toISOString(), buckets, leakyUserCount: leakyUsers.length, leakyUsers });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
