import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Called after any round or session is logged to update the user's leaderboard entry.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    if (!profile) return json({ error: 'No profile' }, 404);

    const isPaid = profile.subscription_status === 'basic' || profile.subscription_status === 'pro';
    if (!isPaid) return json({ skipped: true });

    // RULE 5: Account age (14 days from first subscription date)
    const subscriptionDate = profile.trial_start_date ? new Date(profile.trial_start_date) : new Date();
    const daysSinceSubscription = Math.floor((Date.now() - subscriptionDate.getTime()) / (1000 * 60 * 60 * 24));
    const meetsAgeCriteria = daysSinceSubscription >= 14;

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthYear}-01`;

    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - daysToMonday);
    const weekStart = weekStartDate.toISOString().split('T')[0];

    // Set month baseline handicap if not set yet
    if (!profile.leaderboard_month_start || profile.leaderboard_month_start !== monthYear) {
      await db.from('user_profile').update({
        leaderboard_month_start: monthYear,
        leaderboard_month_handicap_start: profile.current_handicap,
      }).eq('id', profile.id);
      profile.leaderboard_month_handicap_start = profile.current_handicap;
      profile.leaderboard_month_start = monthYear;
    }

    // Count activity — exclude flagged rounds from scoring
    const [roundsRes, sessionsRes, flaggedRoundsRes] = await Promise.all([
      db.from('round').select('*').eq('user_email', user.email),
      db.from('session_log').select('*').eq('user_email', user.email),
      db.from('flagged_round').select('*').eq('user_email', user.email),
    ]);
    const rounds = roundsRes.data || [];
    const sessions = sessionsRes.data || [];
    const flaggedRounds = flaggedRoundsRes.data || [];

    const excludedRoundIds = new Set(
      flaggedRounds.filter((f) => f.status !== 'approved').map((f) => f.round_id),
    );

    const { data: flaggedAccounts } = await db.from('flagged_account').select('*').eq('user_email', user.email);
    const isAccountFlagged = (flaggedAccounts || []).some((f) => f.status === 'pending');

    const monthRounds = rounds.filter((r) => r.round_date >= monthStart && !excludedRoundIds.has(r.id));
    const monthSessions = sessions.filter((s) => s.session_date >= monthStart && s.completed);
    const weekRounds = rounds.filter((r) => r.round_date >= weekStart && !excludedRoundIds.has(r.id));
    const weekSessions = sessions.filter((s) => s.session_date >= weekStart && s.completed);
    const weekActivityScore = (weekRounds.length * 3) + (weekSessions.length * 1);
    const activityScore = (monthRounds.length * 3) + (monthSessions.length * 1);

    // Calculate handicap from actual logged rounds — never trust profile.current_handicap for scoring
    function calculateHandicapFromRounds(roundList: Array<{ total_score: number }>) {
      if (roundList.length < 3) return null;
      const diffs = roundList.map((r) => ((r.total_score - 72) * 113) / 113);
      diffs.sort((a, b) => a - b);
      const count = diffs.length;
      let useCount;
      if (count <= 4) useCount = 1;
      else if (count <= 6) useCount = 2;
      else if (count <= 8) useCount = 3;
      else if (count <= 11) useCount = 4;
      else if (count <= 14) useCount = 5;
      else if (count <= 16) useCount = 6;
      else if (count <= 18) useCount = 7;
      else if (count <= 19) useCount = 8;
      else useCount = 10;
      const selected = diffs.slice(0, useCount);
      const avg = selected.reduce((a, b) => a + b, 0) / selected.length;
      return Math.round(avg * 0.96 * 10) / 10;
    }

    const roundDerivedHandicap = monthRounds.length >= 3 ? calculateHandicapFromRounds(monthRounds) : null;

    // RULE 4: Cap handicap improvement at 3 strokes per month for scoring
    const baseline = profile.leaderboard_month_handicap_start ?? profile.current_handicap;
    let rawDrop = roundDerivedHandicap !== null ? baseline - roundDerivedHandicap : 0;
    if (rawDrop < 0) rawDrop = 0;
    const cappedDrop = Math.min(rawDrop, 3);

    let improvementPct = 0;
    if (baseline > 0 && cappedDrop > 0) improvementPct = (cappedDrop / baseline) * 100;

    const totalScore = (activityScore * 0.4) + (improvementPct * 0.6);

    // Device fingerprinting — detect duplicate accounts
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const fingerprint = btoa(`${ip}:${userAgent}`).substring(0, 32);

    if (!isAccountFlagged) {
      const { data: allFlaggedAccounts } = await db.from('flagged_account').select('*');
      const all = allFlaggedAccounts || [];
      const matchingFingerprint = all.find((f) => f.fingerprint_hash === fingerprint && f.user_email !== user.email);
      const existingFingerprintRecord = all.find((f) => f.user_email === user.email && f.fingerprint_hash === fingerprint);

      if (!existingFingerprintRecord) {
        if (matchingFingerprint) {
          await db.from('flagged_account').insert({
            user_email: user.email,
            fingerprint_hash: fingerprint,
            matched_email: matchingFingerprint.user_email,
            reason: 'Duplicate device fingerprint detected',
            status: 'pending',
            flagged_at: new Date().toISOString(),
          });
          const matchedAlreadyFlagged = all.find((f) => f.user_email === matchingFingerprint.user_email && f.status === 'pending');
          if (!matchedAlreadyFlagged) {
            await db.from('flagged_account').insert({
              user_email: matchingFingerprint.user_email,
              fingerprint_hash: fingerprint,
              matched_email: user.email,
              reason: 'Duplicate device fingerprint detected',
              status: 'pending',
              flagged_at: new Date().toISOString(),
            });
          }
        } else {
          await db.from('flagged_account').insert({
            user_email: user.email,
            fingerprint_hash: fingerprint,
            status: 'approved',
            flagged_at: new Date().toISOString(),
          });
        }
      }
    }

    // Upsert leaderboard entry
    const { data: existingRows } = await db.from('leaderboard_entry')
      .select('*').eq('user_email', user.email).eq('month_year', monthYear);
    const existing = existingRows || [];

    const previousRank = existing.length > 0 ? existing[0].rank : null;
    const previousLowestRank = existing.length > 0 ? (existing[0].lowest_rank_this_month || existing[0].rank || null) : null;

    const entryData = {
      user_email: user.email,
      display_name: profile.first_name || user.user_metadata?.full_name || 'Golfer',
      month_year: monthYear,
      activity_score: activityScore,
      improvement_score: improvementPct,
      total_score: Math.round(totalScore * 100) / 100,
      rounds_logged: monthRounds.length,
      sessions_logged: monthSessions.length,
      handicap_start: baseline,
      handicap_current: profile.current_handicap,
      improvement_pct: Math.round(improvementPct * 100) / 100,
      streak_days: profile.streak_days || 0,
      meets_age_criteria: meetsAgeCriteria,
      is_account_flagged: isAccountFlagged,
      days_until_eligible: meetsAgeCriteria ? 0 : Math.max(0, 14 - daysSinceSubscription),
      week_activity_score: weekActivityScore,
      week_start: weekStart,
    };

    let entryId;
    if (existing.length > 0) {
      await db.from('leaderboard_entry').update(entryData).eq('id', existing[0].id);
      entryId = existing[0].id;
    } else {
      const { data: created } = await db.from('leaderboard_entry').insert(entryData).select('id').single();
      entryId = created?.id;
    }

    // Recalculate ranks for all eligible entries this month + fire rank-change notifications
    if (meetsAgeCriteria && !isAccountFlagged) {
      const { data: allEntriesData } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
      const eligible = (allEntriesData || []).filter((e) => e.meets_age_criteria !== false && !e.is_account_flagged);
      eligible.sort((a, b) => {
        if (b.total_score !== a.total_score) return b.total_score - a.total_score;
        return (b.streak_days || 0) - (a.streak_days || 0);
      });

      const newRankMap: Record<string, number> = {};
      for (let i = 0; i < eligible.length; i++) newRankMap[eligible[i].user_email] = i + 1;

      const newRank = newRankMap[user.email];
      if (newRank && entryId) {
        let lowestRank = previousLowestRank;
        if (lowestRank === null || newRank > lowestRank) lowestRank = newRank;

        await db.from('leaderboard_entry').update({ rank: newRank, lowest_rank_this_month: lowestRank }).eq('id', entryId);

        if (previousRank !== null && newRank !== previousRank) {
          const movedUp = newRank < previousRank;
          await db.from('notification').insert({
            user_email: user.email,
            type: 'rank_change',
            message: movedUp
              ? `You just moved up to #${newRank} on the leaderboard 🏌️`
              : `Your rank updated — you're now #${newRank}. Keep logging to climb! 💪`,
            read: false,
            created_at: new Date().toISOString(),
          });
        }

        // Comeback kid badge
        if (lowestRank && newRank < lowestRank && lowestRank > 1) {
          const { data: existingBadges } = await db.from('badge').select('*').eq('user_email', user.email);
          const hasBadge = (existingBadges || []).some((b) => b.badge_id === 'comeback_kid');
          if (!hasBadge) {
            const nowStr = new Date().toISOString();
            await db.from('badge').insert({
              user_email: user.email, badge_id: 'comeback_kid', badge_name: 'Comeback Kid',
              badge_tier: 'improvement', earned_at: nowStr,
            });
            await db.from('notification').insert({
              user_email: user.email, type: 'badge',
              message: '🔄 You earned the "Comeback Kid" badge! Dropped in rank mid-month then came back stronger.',
              read: false, created_at: nowStr,
            });
          }
        }
      }

      // Notify users who got passed (moved down)
      if (previousRank !== null) {
        for (const entry of eligible) {
          if (entry.user_email === user.email) continue;
          const theirNewRank = newRankMap[entry.user_email];
          const theirOldRank = entry.rank;
          if (theirOldRank && theirNewRank && theirNewRank > theirOldRank) {
            await db.from('notification').insert({
              user_email: entry.user_email, type: 'rank_change',
              message: `Someone just passed you — you're now #${theirNewRank}. Log a session to fight back 💪`,
              read: false, created_at: new Date().toISOString(),
            });
            await db.from('leaderboard_entry').update({ rank: theirNewRank }).eq('id', entry.id);
          }
        }
      }
    }

    return json({ success: true, totalScore, meetsAgeCriteria });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
