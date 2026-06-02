import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

// Public count for the marketing/welcome page. No auth gate; service role
// bypasses the admin-only RLS on waitlist_email.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = serviceClient();
    const { count } = await db.from('waitlist_email').select('*', { count: 'exact', head: true });
    return json({ count: count || 0 });
  } catch (_error) {
    return json({ count: 0 });
  }
});
