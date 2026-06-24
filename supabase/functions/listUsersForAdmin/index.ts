// supabase/functions/listUsersForAdmin/index.ts
//
// Returns the user list with subscription + auth metadata for the /admin/accounts
// page. Service-role only — requires the caller to be an authenticated admin.
//
// Joins user_profile with auth.users so admins can see signup date,
// last_sign_in_at, and admin role status without reading auth.users from the
// client (which RLS doesn't allow).
//
// Pagination is keep-it-simple for now: returns up to MAX_USERS rows ordered
// by created_date desc. Caddie's user count is small enough that client-side
// filtering is fine. If the count grows past ~1000, switch to server-side
// search + cursor pagination.

import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

const MAX_USERS = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const caller = await getUser(req);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    // Admin gate. We trust the JWT's app_metadata.role since it was set by
    // server-side SQL (auth.users.raw_app_meta_data) and signed by Supabase.
    const callerRole = (caller.app_metadata as Record<string, unknown> | undefined)?.role;
    if (callerRole !== 'admin') return json({ error: 'Forbidden' }, 403);

    const db = serviceClient();

    // 1) All user_profile rows (subscription state).
    const { data: profiles, error: profErr } = await db
      .from('user_profile')
      .select('id, user_email, first_name, current_handicap, subscription_status, subscription_plan, subscription_source, trial_end_date, created_date, stripe_customer_id, revenuecat_app_user_id')
      .order('created_date', { ascending: false })
      .limit(MAX_USERS);
    if (profErr) return json({ error: 'Profile lookup failed', detail: profErr.message }, 500);

    // 2) auth.users data (signup date, last sign-in, admin role). One page at
    //    a time because the admin API is paginated.
    const authByEmail: Record<string, { created_at: string; last_sign_in_at: string | null; role: string | null }> = {};
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.warn(`[listUsersForAdmin] auth.admin.listUsers page ${page} failed:`, error.message);
        break;
      }
      for (const u of data.users) {
        if (!u.email) continue;
        const role = ((u.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined) ?? null;
        authByEmail[u.email.toLowerCase()] = {
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          role,
        };
      }
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 20) break; // hard safety cap (4000 users)
    }

    // 3) Merge.
    const merged = (profiles || []).map((p) => {
      const auth = authByEmail[String(p.user_email).toLowerCase()] || null;
      return {
        id: p.id,
        user_email: p.user_email,
        first_name: p.first_name,
        current_handicap: p.current_handicap,
        subscription_status: p.subscription_status,
        subscription_plan: p.subscription_plan,
        subscription_source: p.subscription_source,
        trial_end_date: p.trial_end_date,
        profile_created_date: p.created_date,
        auth_created_at: auth?.created_at ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        role: auth?.role ?? null,
        has_stripe: !!p.stripe_customer_id,
        has_revenuecat: !!p.revenuecat_app_user_id,
      };
    });

    return json({ users: merged, count: merged.length });
  } catch (e) {
    const err = e as Error;
    console.error('[listUsersForAdmin] unhandled error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
