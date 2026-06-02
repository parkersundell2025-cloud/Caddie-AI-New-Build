import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';
import { invokeLLM } from '../_shared/anthropic.ts';

// Authenticated proxy for the 9 former frontend InvokeLLM call sites. Keeps the
// Anthropic key server-side (the migration's goal). The client passes the same
// { prompt, response_json_schema } it used to pass to Base44's InvokeLLM, and
// the function returns the result value directly (object for schema mode, string
// for text mode) so the call site can use it as before.
//
// NOTE: this accepts a client-supplied prompt, so any authenticated user can
// drive Anthropic spend. Acceptable for an auth-gated app; add per-user rate
// limiting before opening signups widely.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { prompt, response_json_schema } = await req.json();
    if (!prompt) return json({ error: 'prompt is required' }, 400);

    const result = await invokeLLM({ prompt, response_json_schema });

    // Return the result value directly as the response body.
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
