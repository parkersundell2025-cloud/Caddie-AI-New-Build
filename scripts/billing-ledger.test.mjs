// CONVERSION_FIXES #8, increment 2 — revenueCatWebhook billing truth ledger.
// Runs the real ledgerEventType mapping and source-guards the write sites so a
// trial or payment fact can't quietly stop being recorded (or start being
// double-counted) in review. The RPC's own idempotency/grants were verified
// against prod at rollout (see CONVERSION_FIXES.md #8).
//
// Run: node scripts/billing-ledger.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const hook = read('../supabase/functions/revenueCatWebhook/index.ts');
const rollback = read('../scripts/rollback-funnel-events.sql');
const migName = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find((f) => f.endsWith('_billing_events_rpc.sql'));
assert(migName, 'local migration file for billing_events_rpc must exist (name must match the remote version)');
const mig = read(`../supabase/migrations/${migName}`);

// --- Mapping (real function) ------------------------------------------------
const m = hook.match(/export function ledgerEventType[\s\S]*?\n\}/);
assert(m, 'ledgerEventType not found');
const ledgerEventType = eval('(' + m[0].replace('export ', '').replace(/: string|: unknown/g, '') + ')');

assert.equal(ledgerEventType('TRIAL_STARTED', null), 'trial_started');
assert.equal(ledgerEventType('INITIAL_PURCHASE', 'TRIAL'), 'trial_started', 'Stripe-imported trials arrive as INITIAL_PURCHASE/TRIAL');
assert.equal(ledgerEventType('INITIAL_PURCHASE', 'NORMAL'), 'first_payment_succeeded');
assert.equal(ledgerEventType('INITIAL_PURCHASE', undefined), 'first_payment_succeeded');
assert.equal(ledgerEventType('TRIAL_CONVERTED', 'NORMAL'), 'first_payment_succeeded');
assert.equal(ledgerEventType('RENEWAL', 'NORMAL'), 'renewal_succeeded');
assert.equal(ledgerEventType('CANCELLATION', null), 'cancellation');
assert.equal(ledgerEventType('EXPIRATION', null), 'expiration');
assert.equal(ledgerEventType('initial_purchase', 'trial'), 'trial_started', 'case-insensitive');

// --- Write sites: every terminal outcome after identity resolution is recorded
const sites = [...hook.matchAll(/recordBillingEvent\(db, event, \{ ?applied: (true|false), reason: '([a-z_]+)'/g)].map((x) => [x[1], x[2]]);
assert.deepEqual(sites.sort(), [
  ['false', 'no_profile'],
  ['false', 'non_native_creation_skipped'],
  ['false', 'phantom_guard'],
  ['true', 'profile_created'],
].sort(), 'expected single-line write sites');
assert.ok(/recordBillingEvent\(db, event, \{\s*applied: true,\s*reason: 'profile_updated'/.test(hook), 'successful profile update is recorded as applied');
assert.ok(hook.indexOf("reason: 'profile_updated'") > hook.indexOf('Updated ${userEmail}'), 'ledger write happens AFTER the profile update succeeded, never before');

// --- Dedupe + trust ----------------------------------------------------------
assert.ok(hook.includes("p_provider: 'revenuecat'"), 'provider stamped server-side');
assert.ok(hook.includes('p_provider_event_id: providerEventId'), 'keyed on the RC event id');
assert.ok(hook.includes('if (!providerEventId) return;'), 'no id → skip, never invent one');
assert.ok(hook.includes('p_user_id: UUID_RE.test(appUserId) ? appUserId : null'), 'user_id only when RC sent a Supabase uuid');
assert.ok(!/p_properties: \{[\s\S]*?(email|receipt|token)[\s\S]*?\}/.test(hook.slice(hook.indexOf('p_properties: {'), hook.indexOf('applied: outcome.applied'))), 'no email/receipt/token in ledger properties');
assert.ok(/billing ledger write (failed|threw)/.test(hook), 'ledger failure is logged, never thrown (RC ack must not depend on it)');
assert.ok(hook.includes('on conflict') === false, 'dedupe lives in the RPC, not the function');

// --- Stripe side (web trials never reach revenueCatWebhook) -----------------
const stripeHook = read('../supabase/functions/stripeWebhook/index.ts');
const sm = stripeHook.match(/export function ledgerEventTypeForStripe[\s\S]*?\n\}/);
assert(sm, 'ledgerEventTypeForStripe not found');
const stripeType = eval('(' + sm[0].replace('export ', '')
  .replace(/\(\s*eventType: string,\s*status: string \| null \| undefined,\s*previousStatus: string \| null \| undefined,\s*cancelAtPeriodEnd: boolean \| null \| undefined,\s*\): string/, '(eventType, status, previousStatus, cancelAtPeriodEnd)') + ')');
assert.equal(stripeType('customer.subscription.created', 'trialing', undefined, false), 'trial_started');
assert.equal(stripeType('customer.subscription.created', 'active', undefined, false), 'first_payment_succeeded');
assert.equal(stripeType('customer.subscription.updated', 'active', 'trialing', false), 'first_payment_succeeded', 'trial → active is the first payment');
assert.equal(stripeType('customer.subscription.updated', 'active', undefined, true), 'cancellation');
assert.equal(stripeType('customer.subscription.updated', 'canceled', 'active', false), 'expiration');
assert.equal(stripeType('customer.subscription.updated', 'active', 'past_due', false), 'renewal_succeeded');
assert.equal(stripeType('customer.subscription.updated', 'active', 'active', false), 'subscription_updated');
assert.equal(stripeType('customer.subscription.deleted', 'canceled', undefined, false), 'expiration');
const stripeSites = [...stripeHook.matchAll(/recordBillingEvent\(db, event, sub, \{ ?applied: (true|false), reason: '([a-z_]+)'/g)].map((x) => [x[1], x[2]]);
assert.deepEqual(stripeSites.sort(), [['false', 'no_profile'], ['false', 'plan_not_derivable']].sort(), 'stripe skip sites recorded');
assert.ok(/applied: updated > 0,\s*reason: updated > 0 \? 'profile_updated' : 'profile_update_failed'/.test(stripeHook), 'stripe update outcome recorded after the write loop');
assert.ok(stripeHook.includes("p_provider: 'stripe'") && stripeHook.includes('p_provider_event_id: event.id'), 'stripe rows keyed on the Stripe event id');
assert.ok(stripeHook.includes("event.livemode ? 'production' : 'sandbox'"), 'stripe environment from livemode');
assert.ok(/billing ledger write (failed|threw)/.test(stripeHook), 'stripe ledger failure is logged, never thrown');

// --- Web activation (completeStripeCheckout is the only server moment that
// sees a new web subscription: the Stripe endpoint lacks .created and RC never
// learns about these customers) ---------------------------------------------
const complete = read('../supabase/functions/completeStripeCheckout/index.ts');
assert.ok(complete.includes("p_provider: 'stripe'") && complete.includes('p_provider_event_id: session.id'), 'web activation keyed on the Checkout Session id (re-calls dedupe)');
assert.ok(complete.includes("p_event_type: isInTrial ? 'trial_started' : 'first_payment_succeeded'"), 'trial vs paid derived from the expanded subscription');
assert.ok(complete.includes('p_user_id: user.id'), 'user_id from the verified JWT');
assert.ok(complete.includes("await recordLedger('profile_updated')") && complete.includes("await recordLedger('profile_created')"), 'recorded after BOTH profile write paths, after the write');
assert.ok(complete.indexOf("recordLedger('profile_updated')") > complete.indexOf('Updated user_profile for'), 'ledger write after the successful update');
assert.ok(/billing ledger write (failed|threw)/.test(complete), 'ledger failure is logged, never thrown');

// --- Migration + rollback ---------------------------------------------------
assert.ok(mig.includes('on conflict (provider, environment, provider_event_id) do nothing'), 'RPC dedupes on the provider key');
assert.ok(mig.includes('security definer') && mig.includes('set search_path = analytics, pg_temp'), 'RPC is definer with pinned search_path');
assert.ok(/revoke all on function public\.record_billing_event[\s\S]*?from public, anon, authenticated/.test(mig), 'EXECUTE revoked from public/anon/authenticated');
assert.ok(/grant execute on function public\.record_billing_event[\s\S]*?to service_role/.test(mig), 'EXECUTE granted to service_role');
assert.ok(rollback.includes('drop function if exists public.record_billing_event'), 'rollback drops the new RPC');

console.log('PASS: #8 billing ledger — event-type mapping (9 cases), write sites after success only, dedupe key, no PII, rollback.');
