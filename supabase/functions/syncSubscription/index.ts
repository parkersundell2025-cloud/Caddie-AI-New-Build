import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';
import { getPlan } from '../_shared/planFromProduct.ts';

const RC_PROJECT_ID = 'projfe7054d8';

// Pull-based subscription provisioning: asks RevenueCat's v2 API what THIS
// authenticated user owns and writes user_profile from that authoritative
// answer. Exists because webhook-only provisioning fails whenever an event
// arrives under an unresolvable identity (anonymous receipts, mid-session
// account switches) — observed 2026-08-04: a paid user permanently stuck on
// the paywall. Called by /checkout/success as the primary activation path;
// the webhook remains the driver for ongoing lifecycle updates.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user?.email) return json({ error: 'Unauthorized' }, 401);
    const apiKey = Deno.env.get('REVENUECAT_API_V2_KEY');
    if (!apiKey) return json({ provisioned: false, reason: 'sync_not_configured' });

    const db = serviceClient();
    const email = user.email.toLowerCase().trim();

    const res = await fetch(
      `https://api.revenuecat.com/v2/projects/${RC_PROJECT_ID}/customers/${user.id}/subscriptions?limit=20`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 404) return json({ provisioned: false, reason: 'no_rc_customer' });
    if (!res.ok) return json({ error: 'RevenueCat lookup failed', status: res.status }, 502);
    const body = await res.json();
    const subs = (body.items || []) as Array<Record<string, unknown>>;

    // Prefer production subs over sandbox, then whichever runs longest.
    const giving = subs.filter((s) => s.gives_access === true);
    giving.sort((a, b) => {
      if (a.environment !== b.environment) return a.environment === 'production' ? -1 : 1;
      return String(b.current_period_ends_at || '').localeCompare(String(a.current_period_ends_at || ''));
    });
    const sub = giving[0];
    if (!sub) return json({ provisioned: false, reason: 'no_active_subscription' });

    const plan = getPlan(String(sub.product_id || ''));
    const source = sub.store === 'play_store' ? 'play_store'
      : sub.store === 'stripe' ? 'stripe'
      : 'app_store';
    const isTrial = sub.status === 'trialing';
    const patch: Record<string, unknown> = {
      subscription_status: isTrial ? 'trial' : plan,
      subscription_source: source,
      revenuecat_app_user_id: user.id,
    };
    if (isTrial && sub.current_period_ends_at) {
      patch.trial_end_date = String(sub.current_period_ends_at).slice(0, 10);
    }

    const { data: rows, error: selErr } = await db
      .from('user_profile').select('id').eq('user_email', email);
    if (selErr) return json({ error: 'Profile lookup failed', detail: selErr.message }, 500);

    if (rows && rows[0]) {
      const { error } = await db.from('user_profile').update(patch).eq('id', rows[0].id);
      if (error) return json({ error: 'Profile update failed', detail: error.message }, 500);
    } else {
      const { error } = await db.from('user_profile')
        .insert({ user_email: email, ...patch, onboarding_complete: false });
      if (error) return json({ error: 'Profile create failed', detail: error.message }, 500);
    }

    console.log(`[syncSubscription] ${email} → ${patch.subscription_status}/${source} (env=${sub.environment}, product=${sub.product_id})`);
    return json({ provisioned: true, status: patch.subscription_status, source });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
