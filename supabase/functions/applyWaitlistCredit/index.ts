import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (user?.app_metadata?.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, 403);
    const db = serviceClient();

    const { creditId, user_email, credit_amount } = await req.json();
    if (!creditId || !user_email || !credit_amount) {
      return json({ error: 'Missing required fields' }, 400);
    }

    await db.from('waitlist_credit').update({
      status: 'Applied',
      date_applied: new Date().toISOString(),
    }).eq('id', creditId);

    return json({ success: true, message: 'Credit applied successfully' });
  } catch (error) {
    return json({ error: (error as Error).message, success: false }, 500);
  }
});
