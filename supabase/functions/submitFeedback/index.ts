import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { feedback_type, subject, description, include_followup } = await req.json();
    if (!feedback_type || !subject || !description) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const { data: feedback } = await db.from('feedback').insert({
      feedback_type,
      subject,
      description,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || 'Anonymous',
      include_followup,
      submitted_at: new Date().toISOString(),
      app_version: '1.0.0',
      status: 'new',
    }).select('id').single();

    return json({ success: true, feedbackId: feedback?.id, userEmail: user.email });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
