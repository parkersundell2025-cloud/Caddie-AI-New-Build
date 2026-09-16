// Source-guard test for CONVERSION_FIXES #8 — first-party funnel events.
//
// The live contract (JWT-derived user, allowlists, idempotency, grants) is
// exercised against prod by _tmp_funnel_smoke.mjs; this guards the code so the
// trust boundary can't quietly regress in review.
//
// Run: node scripts/funnel-instrumentation.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const fn = read('../supabase/functions/trackFunnelEvent/index.ts');
const emitter = read('../src/lib/funnel.js');
const rollback = read('../scripts/rollback-funnel-events.sql');
const migName = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find((f) => f.endsWith('_funnel_events_analytics.sql'));
assert(migName, 'local migration file for funnel_events_analytics must exist (name must match the remote version)');
const mig = read(`../supabase/migrations/${migName}`);

// --- Endpoint trust boundary ------------------------------------------------
assert.ok(fn.includes('p_user_id: user.id'), 'user_id comes from the verified JWT');
assert.ok(!/p_user_id:\s*(body|\(body)/.test(fn), 'user_id is never taken from the body');
for (const serverOnly of ['trial_started', 'first_payment_succeeded', 'activation_sync_result', 'plan_generation_succeeded', 'plan_generation_failed']) {
  assert.ok(!fn.includes(`${serverOnly}:`), `client allowlist must not accept server-authoritative "${serverOnly}"`);
}
assert.ok(fn.includes("p_producer: 'client'"), 'client submissions are stamped producer=client');
assert.ok(/FORBIDDEN_KEY = \/\(email\|token\|receipt/.test(fn), 'PII-ish property keys are rejected');
assert.ok(fn.includes('_client_time_quarantined'), 'impossible client times are quarantined, not rewritten silently');
assert.ok(fn.includes("p_environment: null, // a client cannot attest"), 'clients cannot claim production/sandbox');
assert.ok(fn.includes("json({ error: 'event_not_allowed' }, 400)"), 'unknown/server-only events → 400');

// --- Emitter behaviour --------------------------------------------------------
assert.ok(emitter.includes('if (error) throw error;'), 'emitter checks the invoke error envelope (no-throw footgun)');
assert.ok(emitter.includes('status >= 400 && status < 500'), 'a 4xx is dropped immediately, not retried');
assert.ok(emitter.includes('queue.length = 0'), 'an account switch drops undelivered events');
assert.ok(emitter.includes('const MAX_QUEUE = 50;'), 'queue is bounded');
assert.ok(emitter.includes('event_id: newId()'), 'event_id is assigned once at creation (idempotent retry)');
// Walkthrough 2026-09-16: an offline purchase attempt was dropped after ~3s of
// retries. Transport failures must keep the queue; only a server verdict drops.
assert.ok(emitter.includes('if (!status) return; // transport failure'), 'no HTTP status (offline) keeps the queue instead of counting toward a drop');
assert.ok(emitter.includes("window.addEventListener('online'"), 'delivery resumes when the browser comes back online');
assert.ok(emitter.includes("localStorage.setItem(STORAGE_KEY"), 'queue is persisted across navigation/reload');
assert.ok(emitter.includes('saved.user === currentUser'), 'a persisted queue is only restored for the same user (no cross-account attribution)');
assert.ok(emitter.includes('supabase.auth.onAuthStateChange'), 'account-switch guard is wired to auth state');

// --- Migration: isolation + hardening --------------------------------------
assert.equal((mig.match(/enable row level security/g) || []).length, 2, 'RLS enabled on both analytics tables');
assert.ok(mig.includes('revoke all on analytics.funnel_events  from public, anon, authenticated;'), 'clients have no table grants');
assert.ok(mig.includes('revoke all on function public.track_funnel_event'), 'default PUBLIC execute on the RPC is revoked');
assert.ok(mig.includes('to service_role;'), 'RPC execute granted to service_role only');
assert.ok(mig.includes('on conflict (event_id) do nothing;'), 'RPC is idempotent on event_id');
assert.ok(mig.includes('security definer'), 'RPC is SECURITY DEFINER (no direct table grant needed)');
assert.ok(mig.includes('set search_path = analytics, pg_temp'), 'SECURITY DEFINER search_path is pinned');
assert.ok(mig.includes('unique (provider, environment, provider_event_id)'), 'billing ledger dedupes provider deliveries');
assert.ok(!/create policy/i.test(mig), 'no permissive RLS policies exist');

// --- Rollback exists and is complete -------------------------------------------
assert.ok(rollback.includes('drop function if exists public.track_funnel_event('), 'rollback drops the RPC');
assert.ok(rollback.includes('drop schema if exists analytics cascade;'), 'rollback drops the schema');
assert.ok(!migName.includes('rollback'), 'rollback must not live under supabase/migrations');

console.log(`PASS: #8 guards — JWT trust boundary, allowlists, emitter retry policy, migration hardening (${migName}), rollback present.`);
