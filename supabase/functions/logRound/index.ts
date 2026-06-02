import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser, invokeFunction } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { roundData } = await req.json();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];

    const todayStr = roundData.round_date; // client sends today's local date
    const monthStart = todayStr.substring(0, 7) + '-01';

    const { data: allRoundsData } = await db.from('round').select('*').eq('user_email', user.email);
    const allRounds = allRoundsData || [];

    // RULE 1a: Max 2 rounds per day (silent ignore)
    if (allRounds.filter((r) => r.round_date === todayStr).length >= 2) {
      return json({ success: true, saved: false });
    }
    // RULE 1b: Max 60 rounds per month
    if (allRounds.filter((r) => r.round_date >= monthStart && r.round_date <= todayStr).length >= 60) {
      return json({ success: true, saved: false });
    }

    const { data: saved } = await db.from('round').insert({ ...roundData, user_email: user.email }).select('id').single();

    // RULE 3: Flag suspicious scores (>10 strokes better than expected)
    const currentHandicap = profile?.current_handicap ?? 36;
    const expectedScore = 72 + currentHandicap;
    const loggedScore = roundData.total_score;
    if (loggedScore != null && expectedScore - loggedScore > 10) {
      await db.from('flagged_round').insert({
        user_email: user.email,
        round_id: saved?.id,
        round_date: roundData.round_date,
        logged_score: loggedScore,
        expected_score: expectedScore,
        handicap_at_time: currentHandicap,
        status: 'pending',
      });
    }

    // Background: handicap update, badge check, leaderboard update.
    // (Base44 also invoked the nonexistent 'recalculateSkills' — dropped.)
    invokeFunction('updateHandicap', req).catch(() => {});
    invokeFunction('checkBadges', req).catch(() => {});
    invokeFunction('updateLeaderboard', req).catch(() => {});

    return json({ success: true, saved: true, roundId: saved?.id });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
