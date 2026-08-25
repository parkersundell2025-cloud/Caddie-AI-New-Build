import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { invokeLLM } from '../_shared/anthropic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const db = serviceClient();
    const { user_email, profile_id } = await req.json();

    if (!user_email && !profile_id) {
      return json({ error: 'user_email or profile_id required' }, 400);
    }

    // Fetch user profile. Prefer profile_id (always reliable); fall back to a
    // case-insensitive email match.
    let profile: Record<string, unknown> | null = null;
    if (profile_id) {
      const { data } = await db.from('user_profile').select('*').eq('id', profile_id).maybeSingle();
      profile = data;
    }
    if (!profile && user_email) {
      const { data } = await db.from('user_profile').select('*').ilike('user_email', user_email).limit(1);
      profile = data?.[0] ?? null;
    }
    if (!profile) {
      return json({ error: 'Profile not found' }, 404);
    }

    const userEmail = profile.user_email as string;

    // Deactivate any existing active plans
    await db.from('practice_plan')
      .update({ is_active: false })
      .eq('user_email', userEmail)
      .eq('is_active', true);

    // Build plan prompt using user data (preserved verbatim from the Base44 function)
    const skillLabel = (v: number) => ['', 'Poor', 'Fair', 'Average', 'Good', 'Excellent'][v] || v;

    const prompt = `You are this golfer's personal coach. Produce TWO things: a "coach's take" and a weekly practice plan.

Golfer profile:
Current Level: ${skillLabel(profile.skill_driving as number)}/5 driving, ${skillLabel(profile.skill_iron_play as number)}/5 iron play, ${skillLabel(profile.skill_short_game as number)}/5 short game, ${skillLabel(profile.skill_putting as number)}/5 putting, ${skillLabel(profile.skill_course_management as number)}/5 course management.
Current Handicap: ${profile.current_handicap}
Goal: ${profile.goal_handicap} handicap in ${profile.target_timeline}
Availability: ${profile.days_per_week} days/week on ${((profile.preferred_days as string[]) || []).join(', ')}
Preferred Intensity: Medium (45 min sessions)

COACH'S TAKE: Write 2-3 sentences, speaking directly to the golfer as "you", the way their coach would. Reference their specific goal and timeline, name the weakest part of their game from the ratings above, and explain concretely how the plan will help them shoot lower scores. Be specific and genuinely encouraging, not generic marketing fluff. No greeting and no sign-off, just the take itself.

PRACTICE PLAN: Create a balanced 7-day plan with the right mix of drills, weighted toward their weakest areas. Use real drill names only. Include rest days.

Return as JSON with structure:
{
  "coachs_take": "Your goal of ... By ... you'll ...",
  "sessions": [
    { "day": "Monday", "session_type": "Range Day", "duration": 45, "title": "Long Game Focus", "drills": [{"name": "Drill Name", "reps": "description"}] }
  ]
}`;

    const result = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          coachs_take: { type: 'string' },
          sessions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                session_type: { type: 'string' },
                duration: { type: 'number' },
                title: { type: 'string' },
                drills: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      reps: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get week start date (Monday)
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0];

    const { error } = await db.from('practice_plan').insert({
      user_email: userEmail,
      week_start_date: weekStart,
      generated_at: new Date().toISOString(),
      plan_data: result,
      is_active: true,
    });
    if (error) throw error;

    return json({ success: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
