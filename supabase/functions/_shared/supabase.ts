import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected
// into every edge function by Supabase — no need to set them as secrets.

/**
 * Service-role client — bypasses RLS.
 * Use for cross-user reads/writes (leaderboard, flagging, plan generation, etc.).
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/**
 * The authenticated caller, resolved from the request's Authorization header.
 * Returns null if unauthenticated.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Invoke another edge function server-to-server, forwarding the caller's
 * Authorization header so the target function authenticates as the same user.
 * Fire-and-forget friendly.
 */
export function invokeFunction(name: string, req: Request, body: unknown = {}): Promise<Response> {
  return fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.get('Authorization') ?? `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify(body),
  });
}
