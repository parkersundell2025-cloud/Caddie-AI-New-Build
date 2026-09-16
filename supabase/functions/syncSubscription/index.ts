import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';
import { getPlan } from '../_shared/planFromProduct.ts';

const RC_PROJECT_ID = 'projfe7054d8';

// RC v2 timestamps (current_period_ends_at / current_period_starts_at) are
// epoch MILLISECONDS. The prior code did String(value).slice(0, 10), writing
// the first ten digits of the ms value into a `date` column — SQLSTATE 22008,
// a 500 for every trial (4 customers, Sept 13-14). Convert to a real UTC
// calendar date; return null for anything that is not a finite ms-epoch
// integer in a sane range (null / seconds / strings / NaN / out of range), so
// we never write a partial or invented trial state.
function msToUtcDate(v: unknown): string | null {
  const ms = typeof v === 'number'
    ? v
    : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);
  if (!Number.isFinite(ms) || !Number.isInteger(ms) || ms < 1e11 || ms > 8.64e15) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

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
    const db = serviceClient();
    const email = user.email.toLowerCase().trim();

    // #8: activation_sync_result — one server-authoritative record per sync
    // attempt with its outcome and (when known) the store environment, tied to
    // the edge request id so a failed activation is traceable from the funnel
    // back to the logs. Emitting never throws and never blocks provisioning.
    const requestId = req.headers.get('x-request-id') ?? req.headers.get('sb-request-id') ?? null;
    const emit = async (outcome: string, extra: Record<string, unknown> = {}, environment: string | null = null) => {
      try {
        const { error } = await db.rpc('track_funnel_event', {
          p_event_id: crypto.randomUUID(),
          p_event_name: 'activation_sync_result',
          p_occurred_at: new Date().toISOString(),
          p_producer: 'server',
          p_user_id: user.id,
          p_environment: environment,
          p_request_id: requestId,
          p_properties: { outcome, ...extra },
        });
        if (error) console.warn('[syncSubscription] funnel emit failed:', error.message);
      } catch (e) {
        console.warn('[syncSubscription] funnel emit threw:', (e as Error)?.message);
      }
    };

    const apiKey = Deno.env.get('REVENUECAT_API_V2_KEY');
    if (!apiKey) {
      await emit('sync_not_configured');
      return json({ provisioned: false, reason: 'sync_not_configured' });
    }

    const res = await fetch(
      `https://api.revenuecat.com/v2/projects/${RC_PROJECT_ID}/customers/${user.id}/subscriptions?limit=20`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 404) {
      await emit('no_rc_customer');
      return json({ provisioned: false, reason: 'no_rc_customer' });
    }
    if (!res.ok) {
      await emit('rc_lookup_failed', { status: res.status });
      return json({ error: 'RevenueCat lookup failed', status: res.status }, 502);
    }
    const body = await res.json();
    const subs = (body.items || []) as Array<Record<string, unknown>>;

    // Prefer production subs over sandbox, then whichever runs longest.
    const giving = subs.filter((s) => s.gives_access === true);
    giving.sort((a, b) => {
      if (a.environment !== b.environment) return a.environment === 'production' ? -1 : 1;
      return String(b.current_period_ends_at || '').localeCompare(String(a.current_period_ends_at || ''));
    });
    const sub = giving[0];
    if (!sub) {
      await emit('no_active_subscription');
      return json({ provisioned: false, reason: 'no_active_subscription' });
    }
    const env = sub.environment === 'production' || sub.environment === 'sandbox' ? (sub.environment as string) : null;

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
    if (isTrial) {
      const endDate = msToUtcDate(sub.current_period_ends_at);
      if (!endDate) {
        // No usable expiry: refuse to write a partial trial (it would corrupt
        // the access checks). Leave any existing webhook-provided state intact.
        console.warn(
          `[syncSubscription] ${email} trialing but current_period_ends_at unusable ` +
            `(${JSON.stringify(sub.current_period_ends_at)}); leaving existing state`,
        );
        await emit('invalid_trial_expiry', { source }, env);
        return json({ provisioned: false, reason: 'invalid_trial_expiry' });
      }
      // RootRoute requires BOTH trial_start_date and trial_end_date for a valid
      // trial. Prefer RC's period start; fall back to today (the trial is being
      // activated now) so a fresh trial is never rejected for a missing start.
      patch.trial_start_date = msToUtcDate(sub.current_period_starts_at)
        ?? msToUtcDate(sub.starts_at)
        ?? new Date().toISOString().slice(0, 10);
      patch.trial_end_date = endDate;
    }

    const { data: rows, error: selErr } = await db
      .from('user_profile').select('id').eq('user_email', email);
    if (selErr) {
      await emit('profile_lookup_failed', { source }, env);
      return json({ error: 'Profile lookup failed', detail: selErr.message }, 500);
    }

    if (rows && rows[0]) {
      const { error } = await db.from('user_profile').update(patch).eq('id', rows[0].id);
      if (error) {
        await emit('profile_write_failed', { source, op: 'update' }, env);
        return json({ error: 'Profile update failed', detail: error.message }, 500);
      }
    } else {
      const { error } = await db.from('user_profile')
        .insert({ user_email: email, ...patch, onboarding_complete: false });
      if (error) {
        await emit('profile_write_failed', { source, op: 'create' }, env);
        return json({ error: 'Profile create failed', detail: error.message }, 500);
      }
    }

    console.log(`[syncSubscription] ${email} → ${patch.subscription_status}/${source} (env=${sub.environment}, product=${sub.product_id})`);
    await emit('provisioned', { source, status: patch.subscription_status, trial: isTrial }, env);
    return json({ provisioned: true, status: patch.subscription_status, source });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
