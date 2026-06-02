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
    if (!profile || profile.subscription_status !== 'pro') {
      return json({ skipped: true, reason: 'Not a Pro subscriber' });
    }

    const [roundsRes, sessionsRes, drillsRes] = await Promise.all([
      db.from('round').select('*').eq('user_email', user.email).order('round_date', { ascending: false }).limit(10),
      db.from('session_log').select('*').eq('user_email', user.email).order('session_date', { ascending: false }).limit(15),
      db.from('drill_rating').select('*').eq('user_email', user.email).order('session_date', { ascending: false }).limit(30),
    ]);
    const rounds = roundsRes.data || [];
    const sessionLogs = sessionsRes.data || [];
    const drillRatings = drillsRes.data || [];

    const recentRounds = rounds.map((r) => `${r.round_date}: ${r.total_score} (${r.total_putts} putts, GIR ${r.greens_in_regulation}/18)`).join('\n');
    const recentSessions = sessionLogs.map((s) => `${s.session_date}: ${s.session_type}`).join('\n');
    const struggledDrills = drillRatings.filter((d) => d.rating === 'Struggled').slice(0, 3).map((d) => d.drill_name).join(', ');

    const prompt = `You are Caddie AI — a direct, sharp golf coach. Generate a short proactive weekly check-in message for this Pro subscriber. This message will be waiting for them when they open the Coach tab.

GOLFER DATA:
Name: ${profile.first_name || 'Golfer'}
Handicap: ${profile.current_handicap} → Goal: ${profile.goal_handicap}
Skills: Driving ${profile.skill_driving}/5, Iron Play ${profile.skill_iron_play}/5, Short Game ${profile.skill_short_game}/5, Putting ${profile.skill_putting}/5
Recent rounds: ${recentRounds || 'none'}
Recent sessions: ${recentSessions || 'none'}
Drills struggled with recently: ${struggledDrills || 'none'}

RULES:
- 2 sentences maximum. End with exactly one question.
- No bullet points. No headers. No "Here's your weekly recap."
- Reference something specific from the data.
- Sound like a coach who has been watching all week, not an AI generating a report.
- Do NOT start with Hi, Hey, Hello, or any greeting.

Generate the weekly message only.`;

    const response = await invokeLLM({ prompt }) as string;

    await db.from('chat_message').insert({
      user_email: user.email,
      role: 'assistant',
      content: `[Weekly check-in] ${response}`,
      timestamp: new Date().toISOString(),
    });

    return json({ success: true, message: response });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
