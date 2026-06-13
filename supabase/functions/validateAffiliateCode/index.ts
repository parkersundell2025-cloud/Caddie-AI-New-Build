import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

// Anonymous-callable. Frontend passes a ?ref=CODE captured from a link click
// and checks whether the code is real + active BEFORE stashing it in
// localStorage / Capacitor Preferences. We do not return any PII — just enough
// for the client to display a confirmation (e.g. "Welcome from Sarah").
//
// Why service-role: affiliate table RLS hides rows from anon (self-read by
// contact_email + admin only). We bypass RLS here and only echo back a
// non-sensitive subset.
//
// Why a function and not direct anon SELECT: a public RLS policy that exposed
// status/display_name to anon would also leak the full list via SELECT
// without WHERE. Pin lookup to a single code → return shape.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { code } = await req.json().catch(() => ({}));
    if (typeof code !== 'string' || !code.trim()) {
      return json({ valid: false, reason: 'missing_code' }, 400);
    }
    const normalized = code.trim().toUpperCase();

    const db = serviceClient();
    const { data, error } = await db
      .from('affiliate')
      .select('id, code, display_name, status')
      .eq('code', normalized)
      .maybeSingle();

    if (error) return json({ valid: false, reason: 'lookup_error' }, 500);
    if (!data) return json({ valid: false, reason: 'not_found' });
    if (data.status !== 'active') return json({ valid: false, reason: 'inactive' });

    return json({
      valid: true,
      affiliate: { id: data.id, code: data.code, display_name: data.display_name },
    });
  } catch (_e) {
    return json({ valid: false, reason: 'server_error' }, 500);
  }
});
