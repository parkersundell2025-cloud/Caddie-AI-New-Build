import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Stamps the server-side start of a practice session (Phase 3 anti-cheat).
// Earliest-wins: an existing started_at is never overwritten, so repeated
// calls (page revisits, logger opens) can't shrink the measured duration.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { session_date, session_type, session_day } = await req.json();
    if (!session_date || !session_type) {
      return json({ error: 'session_date and session_type required' }, 400);
    }

    const { data: existing } = await db.from('session_log')
      .select('id, started_at, completed')
      .eq('user_email', user.email)
      .eq('session_date', session_date)
      .eq('session_type', session_type);

    const row = (existing || [])[0];
    if (row) {
      if (!row.completed && !row.started_at) {
        await db.from('session_log')
          .update({ started_at: new Date().toISOString() })
          .eq('id', row.id);
      }
    } else {
      await db.from('session_log').insert({
        user_email: user.email,
        session_date,
        session_type,
        session_day: session_day || null,
        completed: false,
        started_at: new Date().toISOString(),
      });
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
