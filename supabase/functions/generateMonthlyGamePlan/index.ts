import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';
import { invokeLLM } from '../_shared/anthropic.ts';
// deno-lint-ignore no-explicit-any
type DB = any;

const DRILL_LIBRARY_SHORT = `DRIVING: The Tempo Towel Drill, The Gate Drill — Driver, The Slow Motion Drill, The Tee Height Ladder, The Foot Together Drill, The Alignment Stick Path Drill, The Impact Bag Drill, The 3 Ball Progression, The L to L Drill, The Eyes Closed Drill, The Step Through Drill, The 9 Shot Shape Drill, The Speed Training Drill.
IRON PLAY: The Divot Board Drill, The Pump Drill, The Yardage Marker Drill, The Coin Drill, The Headcover Drill, The Ball Position Ladder, The Towel Under Lead Arm Drill, The Miss Drill, The Half Swing Compression Drill, The Knockdown Drill, The Random Club Drill, The One Handed Drill, The Par 3 Simulation Drill.
SHORT GAME: The Landing Spot Drill, The Bump and Run Drill, The No Wristed Chip Drill, The Fringe Ladder Drill, The Bunker Line Drill, The Towel Drill — Short Game, The Clock Drill — Wedges, The Flop Shot Progression, The Up and Down Challenge, The One Club Challenge, The Wet Towel Lie Drill, The Spin Control Drill, The Pressure Chip Off.
PUTTING: The Gate Drill — Putting, The Coin Putting Drill, The 3 Foot Circle Drill, The Metronome Drill, The One Hand Putting Drill, The Pre-Round Routine Putt, The Eyes Closed Putting Drill, The Ladder Drill — Putting, The Gate and String Drill, The Breaking Putt Reading Drill, The 100 Putt Challenge, The Tee in Ground Drill, The Pressure 18 Hole Putting Round.
GOLF FITNESS: The Hip 90-90 Stretch, The Thoracic Spine Rotation, The Glute Bridge, The Single Leg Balance Drill, The Wrist and Forearm Strengthening Routine, The Medicine Ball Rotation Throw, The Pallof Press, The Lateral Band Walk, The Romanian Deadlift, The Cable or Band Wood Chop.`;

async function generateForUser(db: DB, email: string, force: boolean) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', email);
  const profile = profiles?.[0];
  if (!profile) return null;

  if (!force) {
    const { data: existing } = await db.from('monthly_game_plan').select('*').eq('user_email', email).eq('month_year', monthYear);
    if ((existing?.length ?? 0) > 0) return existing[0];
  }

  const [roundsRes, , drillsRes] = await Promise.all([
    db.from('round').select('*').eq('user_email', email).order('round_date', { ascending: false }).limit(10),
    db.from('session_log').select('*').eq('user_email', email).order('created_date', { ascending: false }).limit(20),
    db.from('drill_rating').select('*').eq('user_email', email).order('created_date', { ascending: false }).limit(50),
  ]);
  const rounds = roundsRes.data || [];
  const drillRatings = drillsRes.data || [];

  const skills = [
    { name: 'Driving', val: profile.skill_driving || 3 },
    { name: 'Iron Play', val: profile.skill_iron_play || 3 },
    { name: 'Short Game', val: profile.skill_short_game || 3 },
    { name: 'Putting', val: profile.skill_putting || 3 },
    { name: 'Course Management', val: profile.skill_course_management || 3 },
  ].sort((a, b) => a.val - b.val);

  const recentRoundsStr = rounds.length === 0 ? 'No rounds logged yet.' :
    rounds.slice(0, 5).map((r) => `${r.round_date}: score ${r.total_score}, FW ${r.fairways_hit}/${r.fairways_available}, GIR ${r.greens_in_regulation}/18, ${r.total_putts} putts`).join('\n');
  const recentDrillsStr = drillRatings.length === 0 ? 'No drill ratings yet.' :
    drillRatings.slice(0, 20).map((r) => `${r.drill_name}: ${r.rating}`).join(', ');

  const prompt = `You are Caddie AI Coach. Generate a Monthly Game Plan for this golfer for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}.

GOLFER DATA:
Current handicap: ${profile.current_handicap} | Goal: ${profile.goal_handicap} in ${profile.target_timeline}
Skills (1=worst, 5=best): Driving ${profile.skill_driving}/5, Iron Play ${profile.skill_iron_play}/5, Short Game ${profile.skill_short_game}/5, Putting ${profile.skill_putting}/5, Course Mgmt ${profile.skill_course_management}/5
Weakest: ${skills[0].name} (${skills[0].val}/5), ${skills[1].name} (${skills[1].val}/5)
Recent rounds: ${recentRoundsStr}
Recent drill performance: ${recentDrillsStr}
Practice days/week: ${profile.days_per_week}

DRILL LIBRARY (only pick from these exact names): ${DRILL_LIBRARY_SHORT}

Generate a monthly game plan. Return JSON with these exact fields. All text fields must be written in conversational prose — no bullet points, no markdown headers, no numbered lists. Direct, specific, coach-like tone.

Rules:
- monthly_focus: 1-2 sentences. What the primary focus areas are this month and why, based on their specific data.
- why_this_month: 2-3 sentences. Why these areas were chosen — reference actual skill ratings and recent performance.
- success_looks_like: 2-3 sentences. Specific measurable targets. Reference actual numbers.
- practice_emphasis: 1-2 sentences. How the weekly schedule will be weighted this month.
- key_drill: Just the exact drill name from the library — the single most impactful drill for this month.
- coachs_note: 2-3 sentences. Personal message from Coach, conversational, referencing their specific situation.`;

  const result = await invokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        monthly_focus: { type: 'string' },
        why_this_month: { type: 'string' },
        success_looks_like: { type: 'string' },
        practice_emphasis: { type: 'string' },
        key_drill: { type: 'string' },
        coachs_note: { type: 'string' },
      },
    },
  }) as Record<string, unknown>;

  if (force) {
    const { data: existing } = await db.from('monthly_game_plan').select('id').eq('user_email', email).eq('month_year', monthYear);
    for (const old of existing || []) {
      await db.from('monthly_game_plan').delete().eq('id', old.id);
    }
  }

  const { data: plan } = await db.from('monthly_game_plan').insert({
    user_email: email,
    month_year: monthYear,
    generated_at: new Date().toISOString(),
    ...result,
  }).select('*').single();

  return plan;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));

    if (body.scheduled) {
      const { data: allProfiles } = await db.from('user_profile').select('user_email').eq('subscription_status', 'pro');
      for (const p of allProfiles || []) {
        await generateForUser(db, p.user_email, false).catch(() => {});
      }
      return json({ success: true, count: (allProfiles || []).length });
    }

    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];
    if (!profile) return json({ error: 'No profile found' }, 404);
    if (profile.subscription_status !== 'pro') return json({ error: 'Pro plan required' }, 403);

    const plan = await generateForUser(db, user.email, body.force || false);
    return json({ plan, cached: false });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
