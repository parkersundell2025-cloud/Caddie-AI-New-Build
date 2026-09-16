import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

// First-party funnel event ingestion (CONVERSION_FIXES #8).
//
// Trust boundary: user_id comes from the verified JWT, never from the body.
// Only the client-submittable events below are accepted, each with an
// allowlist of property keys; server-authoritative facts (trial_started,
// first_payment_succeeded, activation_sync_result, plan_generation_*) are
// written by server handlers through the RPC and are rejected here. Writes go
// through public.track_funnel_event (service_role only) into the non-exposed
// `analytics` schema; a retried event_id is a no-op.
const CLIENT_EVENTS: Record<string, string[]> = {
  plan_preview_shown:        ['plan_id', 'has_sessions'],
  paywall_shown:             ['variant', 'entry_source', 'initial_plan_default'],
  paywall_load_failed:       ['stage', 'code'],
  plan_selected:             ['previous', 'current', 'explicit'],
  offerings_loaded:          ['latency_ms', 'offering_id', 'package_count'],
  offerings_failed:          ['status', 'code', 'latency_ms'],
  purchase_tapped:           ['price', 'currency', 'trial_eligibility', 'entry_source'],
  purchase_preflight_failed: ['reason'],
  purchase_sdk_invoked:      [],
  purchase_result:           ['outcome', 'code'],
  access_confirmed:          ['destination', 'source'],
};
// No emails, tokens, receipts or payment details in properties — ever.
const FORBIDDEN_KEY = /(email|token|receipt|card|password|secret|jwt|auth)/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROPS_BYTES = 2048;
const MAX_SKEW_MS = 7 * 24 * 60 * 60 * 1000;
const PLATFORMS = new Set(['web', 'ios', 'android']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user?.id) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_body' }, 400);
    const {
      event_id, event_name, occurred_at, schema_version, flow_id, session_id, view_id,
      attempt_id, platform, app_version, build_number, plan_id, offering_id, product_id,
    } = body as Record<string, unknown>;

    const allowedKeys = typeof event_name === 'string' ? CLIENT_EVENTS[event_name] : undefined;
    if (!allowedKeys) return json({ error: 'event_not_allowed' }, 400);
    if (typeof event_id !== 'string' || !UUID_RE.test(event_id)) return json({ error: 'invalid_event_id' }, 400);
    const occurredMs = Date.parse(String(occurred_at));
    if (!Number.isFinite(occurredMs)) return json({ error: 'invalid_occurred_at' }, 400);

    const rawProps = (body as Record<string, unknown>).properties;
    const props = rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>) : {};
    for (const k of Object.keys(props)) {
      if (!allowedKeys.includes(k) || FORBIDDEN_KEY.test(k)) return json({ error: 'property_not_allowed' }, 400);
    }
    if (JSON.stringify(props).length > MAX_PROPS_BYTES) return json({ error: 'properties_too_large' }, 400);

    // Quarantine impossible client times rather than silently rewriting history:
    // keep the claimed time in properties, record at the trusted server time.
    const nowMs = Date.now();
    const skewed = Math.abs(nowMs - occurredMs) > MAX_SKEW_MS;
    const finalProps = skewed
      ? { ...props, _client_time_quarantined: new Date(occurredMs).toISOString() } : props;
    const occurredIso = new Date(skewed ? nowMs : occurredMs).toISOString();

    const str = (v: unknown, max = 128) => (typeof v === 'string' && v.length ? v.slice(0, max) : null);
    const version = Number.isInteger(schema_version) && (schema_version as number) > 0 ? (schema_version as number) : 1;

    const db = serviceClient();
    const { data, error } = await db.rpc('track_funnel_event', {
      p_event_id: event_id,
      p_event_name: event_name,
      p_occurred_at: occurredIso,
      p_producer: 'client',
      p_user_id: user.id, // verified JWT — a body-supplied user id is ignored
      p_schema_version: version,
      p_flow_id: str(flow_id),
      p_session_id: str(session_id),
      p_view_id: str(view_id),
      p_attempt_id: str(attempt_id),
      p_environment: null, // a client cannot attest sandbox vs production
      p_platform: typeof platform === 'string' && PLATFORMS.has(platform) ? platform : null,
      p_app_version: str(app_version, 32),
      p_build_number: str(build_number, 32),
      p_plan_id: str(plan_id, 64),
      p_offering_id: str(offering_id),
      p_product_id: str(product_id),
      p_properties: finalProps,
      p_request_id: null,
      p_provider_event_id: null,
    });
    if (error) {
      console.error('[trackFunnelEvent] rpc failed:', error.message);
      return json({ error: 'record_failed' }, 500);
    }
    return json({ recorded: data === true });
  } catch (e) {
    console.error('[trackFunnelEvent] error:', (e as Error)?.message);
    return json({ error: 'internal' }, 500);
  }
});
