import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data } = await db.from('round')
      .select('*').eq('user_email', user.email)
      .order('round_date', { ascending: false }).limit(1000);
    const allRounds = data || [];

    if (allRounds.length < 3) {
      return json({
        handicap: null,
        roundsCount: allRounds.length,
        message: `Log 3 rounds to start tracking your real handicap (${allRounds.length}/3)`,
      });
    }

    // Score Differential = (Adjusted Gross Score - Course Rating) × 113 / Slope Rating
    const differentials = allRounds.map((round) => {
      const adjustedGross = round.total_score;
      const courseRating = round.course_rating || 72.0;
      const slopeRating = round.slope_rating || 113;
      return ((adjustedGross - courseRating) * 113) / slopeRating;
    });

    const sortedDifferentials = differentials.sort((a, b) => a - b);

    let numToUse = 1;
    const totalRounds = allRounds.length;
    if (totalRounds >= 3 && totalRounds <= 6) numToUse = 1;
    else if (totalRounds >= 7 && totalRounds <= 8) numToUse = 2;
    else if (totalRounds >= 9 && totalRounds <= 11) numToUse = 3;
    else if (totalRounds >= 12 && totalRounds <= 14) numToUse = 4;
    else if (totalRounds >= 15 && totalRounds <= 16) numToUse = 5;
    else if (totalRounds >= 17 && totalRounds <= 18) numToUse = 6;
    else if (totalRounds === 19) numToUse = 7;
    else if (totalRounds >= 20) numToUse = 8;

    const selectedDifferentials = sortedDifferentials.slice(0, numToUse);
    const average = selectedDifferentials.reduce((a, b) => a + b, 0) / selectedDifferentials.length;
    let handicapIndex = average * 0.96;
    handicapIndex = Math.max(0.0, Math.min(54.0, handicapIndex));
    handicapIndex = Math.round(handicapIndex * 10) / 10;

    return json({
      handicap: handicapIndex,
      roundsCount: totalRounds,
      differentialsUsed: numToUse,
      selectedDifferentials,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
