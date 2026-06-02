import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

// Scheduled task — deletes pending users older than 24h. Runs as service role.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = serviceClient();
    const { data: pendingUsers } = await db.from('pending_user').select('*').eq('status', 'pending');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expired = (pendingUsers || []).filter((u) => new Date(u.created_at) < oneDayAgo);
    for (const u of expired) {
      await db.from('pending_user').delete().eq('id', u.id);
    }

    return json({ success: true, deletedCount: expired.length });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
