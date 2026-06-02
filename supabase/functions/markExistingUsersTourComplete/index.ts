import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Admin one-shot: mark tour_completed for users who already have activity.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (user?.app_metadata?.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, 403);
    const db = serviceClient();

    const { data: profilesData } = await db.from('user_profile').select('*').order('created_date', { ascending: false }).limit(500);
    const profiles = profilesData || [];

    let updated = 0;
    let skipped = 0;
    const toProcess = profiles.filter((p) => p.tour_completed !== true && p.user_email);
    skipped += profiles.length - toProcess.length;

    const BATCH_SIZE = 5;
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (profile) => {
        const email = profile.user_email;
        const [r, s, d] = await Promise.all([
          db.from('round').select('id').eq('user_email', email).limit(1),
          db.from('session_log').select('id').eq('user_email', email).limit(1),
          db.from('drill_rating').select('id').eq('user_email', email).limit(1),
        ]);
        const hasActivity = (r.data?.length ?? 0) > 0 || (s.data?.length ?? 0) > 0 || (d.data?.length ?? 0) > 0;
        if (hasActivity) {
          await db.from('user_profile').update({ tour_completed: true }).eq('id', profile.id);
          updated++;
        } else {
          skipped++;
        }
      }));
      if (i + BATCH_SIZE < toProcess.length) await new Promise((r) => setTimeout(r, 300));
    }

    return json({
      success: true, updated, skipped,
      message: `Marked ${updated} existing users as tour_completed. ${skipped} skipped.`,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
