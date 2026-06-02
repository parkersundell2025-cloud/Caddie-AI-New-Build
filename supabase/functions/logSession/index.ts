import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser, invokeFunction } from '../_shared/supabase.ts';

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

    // Update an existing incomplete log for this day, or create a new one
    const existingForDay = sessions.find((s) => s.session_type === sessionData.session_type);
    if (existingForDay) {
      await db.from('session_log').update({ completed: true, notes: sessionData.notes }).eq('id', existingForDay.id);
    } else {
      await db.from('session_log').insert({ ...sessionData, completed: true });
    }

    // Save drill ratings
    if (drillRatings && drillRatings.length > 0) {
      await db.from('drill_rating').insert(drillRatings);
    }

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
