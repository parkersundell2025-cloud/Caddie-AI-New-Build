import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// Called by the frontend ONCE per signup, immediately after the user is
// authenticated. Reads the ref code that was stashed on the device pre-signup
// and writes an affiliate_attribution row that binds this user to the
// affiliate forever.
//
// Idempotent: affiliate_attribution.user_email is UNIQUE, so a second call
// for the same user (e.g. tabs racing, retries) does nothing. The first bind
// wins — there is no "rebind" path. This is intentional; an attacker
// otherwise could overwrite a legitimate attribution by clicking another ref
// link after signup.
//
// Requires auth. Service-role for the actual write so RLS does not need an
// INSERT policy on affiliate_attribution.

const VALID_SOURCES = ['web', 'ios', 'android'] as const;
type Source = typeof VALID_SOURCES[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user?.email) return json({ error: 'Unauthenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const source: Source = VALID_SOURCES.includes(body?.source) ? body.source : 'web';
    const firstSeenAt: string | null =
      typeof body?.first_seen_at === 'string' ? body.first_seen_at : null;

    if (!code) return json({ bound: false, reason: 'missing_code' }, 400);

    const db = serviceClient();

    // Resolve affiliate; reject if inactive or unknown.
    const { data: aff, error: affErr } = await db
      .from('affiliate')
      .select('id, code, status')
      .eq('code', code)
      .maybeSingle();
    if (affErr) return json({ bound: false, reason: 'lookup_error' }, 500);
    if (!aff) return json({ bound: false, reason: 'not_found' });
    if (aff.status !== 'active') return json({ bound: false, reason: 'inactive' });

    // Lowercased — matches user_profile.user_email normalization trigger and
    // the affiliate_attribution lookup index.
    const userEmail = user.email.toLowerCase();

    // Insert; if a row already exists for this user, do nothing and return
    // the existing affiliate_id so the client sees a consistent answer.
    const { error: insertErr } = await db.from('affiliate_attribution').insert({
      affiliate_id: aff.id,
      user_email: userEmail,
      first_seen_at: firstSeenAt,
      attribution_source: source,
      code_at_bind: aff.code,
    });

    if (insertErr) {
      // 23505 = unique_violation → already bound. Look up existing row so we
      // can echo back which affiliate they belong to.
      const isDup = (insertErr as { code?: string }).code === '23505';
      if (isDup) {
        const { data: existing } = await db
          .from('affiliate_attribution')
          .select('affiliate_id, code_at_bind')
          .eq('user_email', userEmail)
          .maybeSingle();
        return json({
          bound: true,
          already_bound: true,
          affiliate_id: existing?.affiliate_id ?? null,
          code: existing?.code_at_bind ?? null,
        });
      }
      return json({ bound: false, reason: 'insert_error', detail: insertErr.message }, 500);
    }

    return json({ bound: true, already_bound: false, affiliate_id: aff.id, code: aff.code });
  } catch (e) {
    return json({ bound: false, reason: 'server_error', detail: (e as Error).message }, 500);
  }
});
