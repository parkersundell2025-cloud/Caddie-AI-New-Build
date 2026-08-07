import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

// Scheduled-notification trigger layer (SOW item 3f). The DELIVERY pipeline
// (notification insert → trg_notification_push → APNs/FCM) already exists;
// this is the missing PROACTIVE half: a job that decides who to nudge and
// when, with frequency capping so nobody gets buzzed repeatedly.
//
// Invoked daily by pg_cron (see migration) with the service-role key, or
// manually via scripts/run-scheduled-notifications.mjs. Service-role gated.
//
// v1 nudge: re-engagement. An established user (has practiced before) who
// opted into push and has gone quiet for a few days gets one reminder that
// their plan is waiting — capped so we never nag.

const INACTIVE_MIN_DAYS = 3;   // quiet at least this long
const INACTIVE_MAX_DAYS = 21;  // ...but not so long they've churned (don't nag)
const NUDGE_COOLDOWN_DAYS = 5; // never send another scheduled nudge within this

const DAY_MS = 86400000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Service-role gate via the JWT role claim (same approach as
    // sendPushNotification — the gateway already verified the signature; a
    // string-compare against the injected env key can drift across platform
    // versions). Only cron / admin tooling may run this.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let role: string | undefined;
    try {
      const parts = bearer.split('.');
      if (parts.length === 3) {
        let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (p.length % 4) p += '=';
        role = JSON.parse(atob(p))?.role;
      }
    } catch (_) { role = undefined; }
    if (role !== 'service_role') return json({ error: 'Unauthorized' }, 401);

    // Optional test controls (only reachable with the service-role key above)
    const body = await req.json().catch(() => ({}));
    const onlyEmail: string | null = body?.onlyEmail?.toLowerCase?.() ?? null;
    const ignoreCooldown: boolean = body?.ignoreCooldown === true;
    const dryRun: boolean = body?.dryRun === true;

    const db = serviceClient();
    const now = Date.now();

    // 1. Push-opted-in active subscribers.
    let profQ = db.from('user_profile')
      .select('user_email, subscription_status, notification_preferences, last_session_date, first_name');
    if (onlyEmail) profQ = profQ.eq('user_email', onlyEmail);
    const { data: profiles } = await profQ;
    const optedIn = (profiles || []).filter((p) =>
      ['basic', 'pro', 'trial'].includes(p.subscription_status) &&
      p.notification_preferences?.push_enabled === true);

    if (optedIn.length === 0) return json({ scanned: 0, nudged: 0, sent: [] });

    // 2. Last activity = latest of last_session_date and most recent round.
    const emails = optedIn.map((p) => p.user_email);
    const { data: rounds } = await db.from('round')
      .select('user_email, round_date').in('user_email', emails);
    const lastRound: Record<string, string> = {};
    for (const r of rounds || []) {
      if (!lastRound[r.user_email] || r.round_date > lastRound[r.user_email]) {
        lastRound[r.user_email] = r.round_date;
      }
    }

    // 3. Recent nudges (frequency cap) — anyone nudged within cooldown is out.
    const cutoffIso = new Date(now - NUDGE_COOLDOWN_DAYS * DAY_MS).toISOString();
    const { data: recentNudges } = await db.from('notification')
      .select('user_email').eq('type', 'nudge').gte('created_date', cutoffIso);
    const recentlyNudged = new Set((recentNudges || []).map((n) => n.user_email));

    // 4. Eligibility: established (has any prior activity), quiet 3–21 days,
    //    not nudged within cooldown.
    const toNudge = optedIn.filter((p) => {
      const dates = [p.last_session_date, lastRound[p.user_email]].filter(Boolean) as string[];
      if (dates.length === 0) return false; // brand new — not a re-engagement case
      const last = dates.sort().at(-1)!;
      const daysQuiet = (now - new Date(last).getTime()) / DAY_MS;
      if (daysQuiet < INACTIVE_MIN_DAYS || daysQuiet > INACTIVE_MAX_DAYS) return false;
      if (!ignoreCooldown && recentlyNudged.has(p.user_email)) return false;
      return true;
    });

    if (dryRun) {
      return json({ scanned: optedIn.length, nudged: toNudge.length, dryRun: true,
        sent: toNudge.map((p) => p.user_email) });
    }

    if (toNudge.length > 0) {
      const rows = toNudge.map((p) => ({
        user_email: p.user_email,
        type: 'nudge',
        message: `Your practice plan is ready and waiting${p.first_name ? `, ${p.first_name}` : ''}. Jump back in and keep the momentum going.`,
        read: false,
        created_by: 'runScheduledNotifications',
      }));
      // Insert fires trg_notification_push per row → delivery to devices.
      await db.from('notification').insert(rows);
    }

    return json({ scanned: optedIn.length, nudged: toNudge.length,
      sent: toNudge.map((p) => p.user_email) });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
