import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser, invokeFunction } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];
    if (!profile) return json({ error: 'Profile not found' }, 404);

    // Reuse the calculateHandicap function (forwarding the caller's JWT)
    const res = await invokeFunction('calculateHandicap', req);
    const { handicap, roundsCount, message } = await res.json();

    if (handicap === null || handicap === undefined) {
      return json({ success: true, updated: false, message });
    }

    const previousHandicap = profile.current_handicap || 0;
    await db.from('user_profile').update({
      current_handicap: handicap,
      handicap_last_updated: new Date().toISOString(),
    }).eq('id', profile.id);

    return json({ success: true, updated: true, previousHandicap, currentHandicap: handicap, roundsCount });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
