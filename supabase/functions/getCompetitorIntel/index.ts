import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Pro feature — anonymized competitive comparison. No LLM; pure aggregation.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: myProfiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const myProfile = myProfiles?.[0];
    if (!myProfile) return json({ error: 'No profile found' }, 404);
    if (myProfile.subscription_status !== 'pro') return json({ error: 'Pro plan required' }, 403);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const { data: allProfiles } = await db.from('user_profile').select('*');
    const paidProfiles = (allProfiles || []).filter((p) =>
      p.user_email !== user.email &&
      (p.subscription_status === 'pro' || p.subscription_status === 'basic') &&
      p.current_handicap != null);

    const { data: allRounds } = await db.from('round').select('*');
    const monthRounds = (allRounds || []).filter((r) => r.round_date >= monthStart);

    // deno-lint-ignore no-explicit-any
    const userStats: any[] = [];
    for (const p of paidProfiles) {
      const userMonthRounds = monthRounds.filter((r) => r.user_email === p.user_email);
      if (userMonthRounds.length < 2) continue;
      const handicapStart = p.leaderboard_month_handicap_start || p.current_handicap;
      const improvement = handicapStart > 0 ? ((handicapStart - p.current_handicap) / handicapStart) * 100 : 0;
      userStats.push({
        user_email: p.user_email,
        display_name: (p.first_name || 'User').split(' ')[0],
        handicap: p.current_handicap,
        improvement_pct: Math.round(improvement * 10) / 10,
        total_activity: userMonthRounds.length,
      });
    }

    const myMonthRounds = monthRounds.filter((r) => r.user_email === user.email);
    const myHandicapStart = myProfile.leaderboard_month_handicap_start || myProfile.current_handicap;
    const myImprovement = myHandicapStart > 0 ? ((myHandicapStart - myProfile.current_handicap) / myHandicapStart) * 100 : 0;
    const myStats = {
      handicap: myProfile.current_handicap,
      improvement_pct: Math.round(myImprovement * 10) / 10,
      total_activity: myMonthRounds.length,
    };

    const totalComparators = userStats.length;
    const improvingFasterCount = userStats.filter((u) => myStats.improvement_pct > u.improvement_pct).length;
    const fullAppPercentile = totalComparators > 0 ? Math.round((improvingFasterCount / totalComparators) * 100) : null;

    const myHcp = myProfile.current_handicap;
    const rangeMin = myHcp - 3;
    const rangeMax = myHcp + 3;
    const rangeUsers = userStats.filter((u) => u.handicap >= rangeMin && u.handicap <= rangeMax);
    const rangeImprovingFaster = rangeUsers.filter((u) => myStats.improvement_pct > u.improvement_pct).length;
    const rangePercentile = rangeUsers.length > 0 ? Math.round((rangeImprovingFaster / rangeUsers.length) * 100) : null;
    const myRangeRank = rangeUsers.length > 0 ? rangeUsers.filter((u) => u.improvement_pct > myStats.improvement_pct).length + 1 : null;

    // deno-lint-ignore no-explicit-any
    const allActivityStats: any[] = [...userStats];
    const { data: selfSessions } = await db.from('session_log').select('*').eq('user_email', user.email);
    const selfMonthSessions = (selfSessions || []).filter((s) => s.session_date >= monthStart && s.completed);
    allActivityStats.push({
      user_email: user.email,
      display_name: myProfile.first_name || 'You',
      handicap: myProfile.current_handicap,
      improvement_pct: myStats.improvement_pct,
      total_activity: myMonthRounds.length + selfMonthSessions.length,
      is_me: true,
    });

    for (const u of allActivityStats) {
      if (!u.is_me) {
        const { data: sessions } = await db.from('session_log').select('*').eq('user_email', u.user_email);
        const monthSessions = (sessions || []).filter((s) => s.session_date >= monthStart && s.completed);
        u.total_activity = monthRounds.filter((r) => r.user_email === u.user_email).length + monthSessions.length;
      }
    }

    const mostActive = allActivityStats
      .sort((a, b) => b.total_activity - a.total_activity)
      .slice(0, 5)
      .map((u) => ({ display_name: u.is_me ? 'You' : u.display_name, total_activity: u.total_activity, is_me: u.is_me || false }));

    return json({
      myStats,
      fullApp: { percentile: fullAppPercentile, totalUsers: totalComparators },
      handicapRange: {
        percentile: rangePercentile,
        rank: myRangeRank,
        totalInRange: rangeUsers.length,
        rangeMin: Math.round(rangeMin * 10) / 10,
        rangeMax: Math.round(rangeMax * 10) / 10,
        hasEnoughData: rangeUsers.length >= 5,
      },
      mostActive,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
