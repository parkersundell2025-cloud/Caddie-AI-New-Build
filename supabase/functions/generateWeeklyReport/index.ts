import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';
import { invokeLLM } from '../_shared/anthropic.ts';
import { hasProAccess } from '../_shared/subscription.ts';

const DRILL_LIBRARY_SHORT = `DRIVING: The Tempo Towel Drill, The Gate Drill — Driver, The Slow Motion Drill, The Tee Height Ladder, The Foot Together Drill, The Alignment Stick Path Drill, The Impact Bag Drill, The 3 Ball Progression, The L to L Drill, The Eyes Closed Drill, The Step Through Drill, The 9 Shot Shape Drill, The Speed Training Drill.
IRON PLAY: The Divot Board Drill, The Pump Drill, The Yardage Marker Drill, The Coin Drill, The Headcover Drill, The Ball Position Ladder, The Towel Under Lead Arm Drill, The Miss Drill, The Half Swing Compression Drill, The Knockdown Drill, The Random Club Drill, The One Handed Drill, The Par 3 Simulation Drill.
SHORT GAME: The Landing Spot Drill, The Bump and Run Drill, The No Wristed Chip Drill, The Fringe Ladder Drill, The Bunker Line Drill, The Towel Drill — Short Game, The Clock Drill — Wedges, The Flop Shot Progression, The Up and Down Challenge, The One Club Challenge, The Wet Towel Lie Drill, The Spin Control Drill, The Pressure Chip Off.
PUTTING: The Gate Drill — Putting, The Coin Putting Drill, The 3 Foot Circle Drill, The Metronome Drill, The One Hand Putting Drill, The Pre-Round Routine Putt, The Eyes Closed Putting Drill, The Ladder Drill — Putting, The Gate and String Drill, The Breaking Putt Reading Drill, The 100 Putt Challenge, The Tee in Ground Drill, The Pressure 18 Hole Putting Round.
GOLF FITNESS: The Hip 90-90 Stretch, The Thoracic Spine Rotation, The Glute Bridge, The Single Leg Balance Drill, The Wrist and Forearm Strengthening Routine, The Medicine Ball Rotation Throw, The Pallof Press, The Lateral Band Walk, The Romanian Deadlift, The Cable or Band Wood Chop.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    const isScheduled = body.scheduled === true;

    let targetEmails: string[] = [];
    if (isScheduled) {
      const { data } = await db.from('user_profile').select('user_email').eq('subscription_status', 'pro');
      targetEmails = (data || []).map((p) => p.user_email);
    } else {
      const user = await getUser(req);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
      const profile = profiles?.[0];
      if (!hasProAccess(profile)) {
        return json({ error: 'Pro plan required' }, 403);
      }
      targetEmails = [user.email];
    }

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const weekOfStr = weekAgoStr;

    const results = [];
    for (const email of targetEmails) {
      const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', email);
      const profile = profiles?.[0];
      if (!profile) continue;

      const { data: existing } = await db.from('weekly_report').select('*').eq('user_email', email).eq('week_of', weekOfStr);
      if ((existing?.length ?? 0) > 0 && !body.force) {
        results.push({ email, cached: true });
        continue;
      }

      const [roundsRes, sessionsRes, drillsRes, planRes] = await Promise.all([
        db.from('round').select('*').eq('user_email', email).order('round_date', { ascending: false }).limit(20),
        db.from('session_log').select('*').eq('user_email', email).order('created_date', { ascending: false }).limit(30),
        db.from('drill_rating').select('*').eq('user_email', email).order('created_date', { ascending: false }).limit(100),
        db.from('monthly_game_plan').select('*').eq('user_email', email),
      ]);
      const rounds = roundsRes.data || [];
      const sessionLogs = sessionsRes.data || [];
      const drillRatings = drillsRes.data || [];
      const monthlyPlan = planRes.data || [];

      const weekRounds = rounds.filter((r) => r.round_date >= weekAgoStr);
      const weekSessions = sessionLogs.filter((s) => s.completed && s.session_date >= weekAgoStr);
      const weekDrills = drillRatings.filter((d) => d.session_date >= weekAgoStr);
      const latestMonthlyPlan = monthlyPlan.sort((a, b) => b.month_year.localeCompare(a.month_year))[0];

      const weekSummary = `Rounds: ${weekRounds.length}, Sessions: ${weekSessions.length}, Drills completed: ${weekDrills.length}, Streak: ${profile.streak_days || 0} days`;
      const drillSummaryStr = weekDrills.length === 0 ? 'No drills this week.' :
        weekDrills.map((d) => `${d.drill_name}: ${d.rating}`).join(', ');
      const roundSummaryStr = weekRounds.length === 0 ? 'No rounds this week.' :
        weekRounds.map((r) => `${r.round_date}: score ${r.total_score} at ${r.course_name || 'unknown'}, FW ${r.fairways_hit}/${r.fairways_available}, GIR ${r.greens_in_regulation}/18, ${r.total_putts} putts`).join('\n');

      const prompt = `You are Caddie AI Coach. Generate a weekly performance report for this golfer covering the week of ${weekAgoStr}.

GOLFER DATA:
Handicap: ${profile.current_handicap} | Goal: ${profile.goal_handicap} in ${profile.target_timeline}
Skills: Driving ${profile.skill_driving}/5, Iron Play ${profile.skill_iron_play}/5, Short Game ${profile.skill_short_game}/5, Putting ${profile.skill_putting}/5

THIS WEEK ACTIVITY:
${weekSummary}
Rounds: ${roundSummaryStr}
Drills: ${drillSummaryStr}

MONTHLY GAME PLAN FOCUS: ${latestMonthlyPlan ? latestMonthlyPlan.monthly_focus : 'None yet — reference handicap goal instead.'}

DRILL LIBRARY (pick key_drill from exact names only): ${DRILL_LIBRARY_SHORT}

Generate the weekly performance report. Return JSON. All text fields must be conversational prose — no bullet points, no markdown headers, direct and specific like a real coach. If no activity this week, acknowledge it directly and still provide value.

Rules:
- this_week_numbers: 1-2 sentences weaving the stats into a narrative. Not a list. Example: "You got in two sessions and one round this week, with a ${profile.streak_days || 0}-day streak still running."
- what_improved: 2-3 sentences. Specific improvements from drill ratings or round data. If nothing improved, say so honestly. Reference actual drill names.
- what_needs_attention: 2-3 sentences. One or two specific areas holding them back. Reference actual data. Direct and honest.
- drill_of_the_week: Just the exact drill name — the single drill with biggest impact going into next week.
- coachs_take: 2-3 sentences. Conversational summary of the week and what tone to set for next week. Direct, no generic praise.
- looking_ahead: 1 sentence. What next week should focus on, tied to their monthly plan or handicap goal.`;

      const result = await invokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            this_week_numbers: { type: 'string' },
            what_improved: { type: 'string' },
            what_needs_attention: { type: 'string' },
            drill_of_the_week: { type: 'string' },
            coachs_take: { type: 'string' },
            looking_ahead: { type: 'string' },
          },
        },
      }) as Record<string, unknown>;

      const { data: report } = await db.from('weekly_report').insert({
        user_email: email,
        week_of: weekOfStr,
        generated_at: new Date().toISOString(),
        ...result,
      }).select('id').single();

      await db.from('notification').insert({
        user_email: email,
        type: 'weekly_report',
        message: `📊 Your weekly Caddie AI performance report is ready. Here's how your game looked this week.`,
        read: false,
        created_at: new Date().toISOString(),
      });

      results.push({ email, reportId: report?.id });
    }

    return json({ success: true, results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
