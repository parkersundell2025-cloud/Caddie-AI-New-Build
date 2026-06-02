import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';
import { invokeLLM } from '../_shared/anthropic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];
    if (!profile) return json({ error: 'No profile found' }, 404);
    if (profile.subscription_status !== 'pro') return json({ error: 'Pro plan required' }, 403);

    const [roundsRes, drillsRes] = await Promise.all([
      db.from('round').select('*').eq('user_email', user.email).order('round_date', { ascending: false }).limit(5),
      db.from('drill_rating').select('*').eq('user_email', user.email).order('created_date', { ascending: false }).limit(30),
    ]);
    const rounds = roundsRes.data || [];
    const drillRatings = drillsRes.data || [];

    const recentRoundsStr = rounds.length === 0 ? 'No rounds logged yet.' :
      rounds.slice(0, 3).map((r) =>
        `${r.round_date}: score ${r.total_score} at ${r.course_name || 'unknown'}, FW ${r.fairways_hit}/${r.fairways_available}, GIR ${r.greens_in_regulation}/18, ${r.total_putts} putts${r.notes ? `, note: "${r.notes}"` : ''}`
      ).join('\n');

    const recentDrillsStr = drillRatings.length === 0 ? 'No drill data yet.' :
      drillRatings.slice(0, 15).map((d) => `${d.drill_name}: ${d.rating}`).join(', ');

    const getDefault = (hcp: number) => {
      if (hcp <= 5) return { driver: 270, threeW: 245, fiveW: 225, fourI: 205, fiveI: 195, sixI: 183, sevenI: 170, eightI: 158, nineI: 145, pw: 132, gw: 118, sw: 100, lw: 80 };
      if (hcp <= 12) return { driver: 240, threeW: 220, fiveW: 200, fourI: 185, fiveI: 175, sixI: 163, sevenI: 150, eightI: 138, nineI: 125, pw: 112, gw: 98, sw: 82, lw: 65 };
      if (hcp <= 20) return { driver: 215, threeW: 195, fiveW: 178, fourI: 165, fiveI: 155, sixI: 143, sevenI: 130, eightI: 118, nineI: 107, pw: 95, gw: 82, sw: 68, lw: 54 };
      return { driver: 185, threeW: 168, fiveW: 153, fourI: 142, fiveI: 133, sixI: 122, sevenI: 110, eightI: 100, nineI: 90, pw: 80, gw: 68, sw: 56, lw: 44 };
    };
    const def = getDefault(profile.current_handicap || 18);
    const d = {
      driver: profile.driver_distance || def.driver,
      threeW: profile.three_wood_distance || def.threeW,
      fiveW: profile.five_wood_distance || def.fiveW,
      fourI: profile.four_iron_distance || def.fourI,
      fiveI: profile.five_iron_distance || def.fiveI,
      sixI: profile.six_iron_distance || def.sixI,
      sevenI: profile.seven_iron_distance || def.sevenI,
      eightI: profile.eight_iron_distance || def.eightI,
      nineI: profile.nine_iron_distance || def.nineI,
      pw: profile.pitching_wedge_distance || def.pw,
      gw: profile.gap_wedge_distance || def.gw,
      sw: profile.sand_wedge_distance || def.sw,
      lw: profile.lob_wedge_distance || def.lw,
    };
    const clubDistanceStr = `Driver: ${d.driver}yds, 3W: ${d.threeW}yds, 5W: ${d.fiveW}yds, 4i: ${d.fourI}yds, 5i: ${d.fiveI}yds, 6i: ${d.sixI}yds, 7i: ${d.sevenI}yds, 8i: ${d.eightI}yds, 9i: ${d.nineI}yds, PW: ${d.pw}yds, GW: ${d.gw}yds, SW: ${d.sw}yds, LW: ${d.lw}yds`;

    const prompt = `You are Caddie AI Coach. Generate a pre-round game plan for this golfer who is about to tee off right now.

GOLFER DATA:
Handicap: ${profile.current_handicap} | Goal: ${profile.goal_handicap}
Skills: Driving ${profile.skill_driving}/5, Iron Play ${profile.skill_iron_play}/5, Short Game ${profile.skill_short_game}/5, Putting ${profile.skill_putting}/5, Course Mgmt ${profile.skill_course_management}/5

CLUB DISTANCES (carry yards): ${clubDistanceStr}

RECENT ROUNDS:
${recentRoundsStr}

RECENT DRILL PERFORMANCE:
${recentDrillsStr}

Generate a pre-round game plan. EXACTLY 3 sentences. No bullet points. No headers. No numbered lists. Conversational, direct, specific — like a caddie whispering in their ear on the first tee. Must reference real data and specific clubs by distance. Must be:
Sentence 1: One specific tactical focus for today based on recent data — reference a specific club distance if relevant.
Sentence 2: One thing to actively manage or avoid based on their weakness, referencing actual clubs by yardage.
Sentence 3: Overall game plan in one sentence.

Return JSON with a single field "game_plan" containing the 3-sentence text.`;

    const result = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { game_plan: { type: 'string' } },
      },
    }) as { game_plan: string };

    return json({ game_plan: result.game_plan });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
