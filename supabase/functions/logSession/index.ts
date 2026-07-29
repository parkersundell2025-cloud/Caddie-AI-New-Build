import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser, invokeFunction } from '../_shared/supabase.ts';
import { DRILL_MIN_MINUTES } from '../_shared/drillMinimums.ts';

// Phase 3 anti-cheat thresholds. Flags are SILENT: the submission always
// succeeds and the response is unchanged; suspicious sessions land in
// flagged_session for admin review (mirrors how flagged_round works).
const SESSION_FLOOR_MINUTES = 15; // SOW: under 15 min flags regardless
const FIVE_DRILL_MINUTES = 45; // SOW: 5+ drills should take 45+
const ANOMALY_MIN_HISTORY = 10; // ratings-anomaly: need this much history
const ANOMALY_STRUGGLED_SHARE = 0.6; // ...mostly "Struggled" historically
const ANOMALY_MIN_DRILLS = 3; // ...and an all-"Clicked" session this size

// Who gets buzzed when a session is flagged. Per-environment override via
// the FLAG_ALERT_EMAILS secret (comma-separated) — prod points at Parker,
// see CUTOVER.md. Inserting a notification row fires the existing
// trg_notification_push → APNs/FCM pipeline; no push code needed here.
const ALERT_EMAILS = (Deno.env.get('FLAG_ALERT_EMAILS') ?? 'admin@silexdev.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { sessionData, drillRatings } = await req.json();
    const todayStr = sessionData.session_date;

    // RULE 2: Rate limit sessions
    const { data: todaySessions } = await db.from('session_log')
      .select('*').eq('user_email', user.email).eq('session_date', todayStr);
    const sessions = todaySessions || [];
    const completedToday = sessions.filter((s) => s.completed);

    // Max 3 sessions per day
    if (completedToday.length >= 3) return json({ success: true, saved: false });
    // Max 1 session per session type per day
    if (completedToday.filter((s) => s.session_type === sessionData.session_type).length >= 1) {
      return json({ success: true, saved: false });
    }

    // Ratings-anomaly history must be read BEFORE today's ratings are inserted
    const ratings = (drillRatings || []) as Array<{ drill_name: string; rating: string; elapsed_seconds?: number }>;
    let priorRatings: Array<{ rating: string }> = [];
    if (ratings.length >= ANOMALY_MIN_DRILLS && ratings.every((r) => r.rating === 'Clicked')) {
      const { data } = await db.from('drill_rating')
        .select('rating').eq('user_email', user.email)
        .order('created_date', { ascending: false }).limit(60);
      priorRatings = data || [];
    }

    // Update an existing incomplete log for this day, or create a new one
    const existingForDay = sessions.find((s) => s.session_type === sessionData.session_type);
    let sessionLogId: string | null = null;
    let durationMinutes: number | null = null;
    if (existingForDay) {
      sessionLogId = existingForDay.id;
      const patch: Record<string, unknown> = { completed: true, notes: sessionData.notes };
      // started_at was stamped server-side by startSession; null on
      // pre-Phase-3 clients, in which case duration stays unmeasured
      if (existingForDay.started_at) {
        durationMinutes = Math.round(((Date.now() - new Date(existingForDay.started_at).getTime()) / 60000) * 10) / 10;
        patch.duration_minutes = durationMinutes;
      }
      await db.from('session_log').update(patch).eq('id', existingForDay.id);
    } else {
      const { data: inserted } = await db.from('session_log')
        .insert({ ...sessionData, completed: true }).select('id').single();
      sessionLogId = inserted?.id ?? null;
    }

    // Save drill ratings
    if (ratings.length > 0) {
      await db.from('drill_rating').insert(ratings);
    }

    // --- Anti-cheat checks (Phase 3) -------------------------------------
    const reasons: string[] = [];
    const expectedMinutes = ratings.reduce((sum, r) => sum + (DRILL_MIN_MINUTES[r.drill_name] || 0), 0);

    if (durationMinutes !== null) {
      if (durationMinutes < SESSION_FLOOR_MINUTES) {
        reasons.push(`session completed in ${durationMinutes} min (under ${SESSION_FLOOR_MINUTES}-minute floor)`);
      }
      if (ratings.length >= 5 && durationMinutes < FIVE_DRILL_MINUTES) {
        reasons.push(`${ratings.length}-drill session completed in ${durationMinutes} min (expected ${FIVE_DRILL_MINUTES}+)`);
      }
      if (expectedMinutes > 0 && durationMinutes < expectedMinutes) {
        reasons.push(`faster than physical minimum (${durationMinutes} min measured vs ${expectedMinutes} min of drills)`);
      }
    }

    // Per-drill timing — only present from the guided session mode
    const rushed = ratings.filter((r) => {
      const min = DRILL_MIN_MINUTES[r.drill_name];
      return typeof r.elapsed_seconds === 'number' && min && r.elapsed_seconds < min * 60;
    });
    if (rushed.length > 0) {
      reasons.push(`drills completed under physical minimum: ${rushed.map((r) => r.drill_name).join(', ')}`);
    }

    // Interim score-plausibility (ratings-based until Phase 1.1 adds scores)
    if (priorRatings.length >= ANOMALY_MIN_HISTORY) {
      const struggledShare = priorRatings.filter((r) => r.rating === 'Struggled').length / priorRatings.length;
      if (struggledShare >= ANOMALY_STRUGGLED_SHARE) {
        reasons.push(`rating anomaly: all-"Clicked" ${ratings.length}-drill session from a ${Math.round(struggledShare * 100)}%-"Struggled" history`);
      }
    }

    if (reasons.length > 0) {
      await db.from('flagged_session').insert({
        user_email: user.email,
        session_log_id: sessionLogId,
        session_date: todayStr,
        session_type: sessionData.session_type,
        drill_count: ratings.length,
        measured_minutes: durationMinutes,
        expected_minutes: expectedMinutes || null,
        reason: reasons.join('; '),
        created_by: 'logSession',
      });
      await db.from('notification').insert(ALERT_EMAILS.map((email) => ({
        user_email: email,
        type: 'flagged_session',
        message: `⚠️ Practice session flagged — ${user.email}: ${reasons.join('; ')}`,
        read: false,
      })));
    }
    // ----------------------------------------------------------------------

    // Trigger badge check and leaderboard update in the background.
    // (Base44 also invoked 'recalculateSkills' here, but no such function exists —
    // it was a dead, silently-failing reference, so it's dropped.)
    invokeFunction('checkBadges', req).catch(() => {});
    invokeFunction('updateLeaderboard', req).catch(() => {});

    return json({ success: true, saved: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
