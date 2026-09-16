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
const ledgerEventType = eval('(' + m[0].replace('export ', '').replace(/: Record<string, unknown>|: string/g, '') + ')');

// Payloads follow RC's documented event fields (event-types-and-fields): a
// trial conversion is RENEWAL + is_trial_conversion:true, never a
// "TRIAL_CONVERTED" type (review finding 1).
assert.equal(ledgerEventType({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', price: 0, is_trial_conversion: false }), 'trial_started');
assert.equal(ledgerEventType({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: true, price: 19.99 }), 'first_payment_succeeded', 'FIX 1: documented trial conversion is the first payment');
assert.equal(ledgerEventType({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: true, price: 0 }), 'trial_converted_no_charge', 'zero-price conversion is not revenue');
assert.equal(ledgerEventType({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: false, price: 19.99 }), 'renewal_succeeded', 'later renewals stay distinct');
assert.equal(ledgerEventType({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: false, price: 0 }), 'renewal_no_charge');
assert.equal(ledgerEventType({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', price: 29 }), 'first_payment_succeeded', 'paid purchase with no trial');
assert.equal(ledgerEventType({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', price: 0 }), 'initial_purchase_no_charge', 'promo / zero-price purchase is not revenue');
assert.equal(ledgerEventType({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', price: null, price_in_purchased_currency: 39 }), 'first_payment_succeeded', 'falls back to purchased-currency price');
assert.equal(ledgerEventType({ type: 'TRIAL_CONVERTED' }), 'trial_converted', 'the invented type is no longer special-cased');
assert.equal(ledgerEventType({ type: 'CANCELLATION' }), 'cancellation');
assert.equal(ledgerEventType({ type: 'EXPIRATION' }), 'expiration');
assert.equal(ledgerEventType({ type: 'initial_purchase', period_type: 'trial' }), 'trial_started', 'case-insensitive');
assert.ok(hook.includes('is_trial_conversion: event.is_trial_conversion === true') && hook.includes('transaction_id: event.transaction_id'), 'conversion flag and transaction identity preserved in the ledger row');

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
// Subscription events are STATE facts only (review finding 2): no status
// transition is ever labeled a payment.
assert.equal(stripeType('customer.subscription.created', 'trialing', undefined, false), 'trial_started');
assert.equal(stripeType('customer.subscription.created', 'active', undefined, false), 'subscription_created', 'FIX 2: created-active ($0 coupon possible) is not a payment');
assert.equal(stripeType('customer.subscription.updated', 'active', 'trialing', false), 'trial_ended', 'FIX 2: trial → active is a state change; the payment comes from invoice.paid');
assert.equal(stripeType('customer.subscription.updated', 'active', undefined, true), 'cancellation');
assert.equal(stripeType('customer.subscription.updated', 'canceled', 'active', false), 'expiration');
assert.equal(stripeType('customer.subscription.updated', 'active', 'past_due', false), 'subscription_reactivated', 'FIX 2: past_due → active can be an uncollectible write-off, not a payment');
assert.equal(stripeType('customer.subscription.updated', 'active', 'active', false), 'subscription_updated');
assert.equal(stripeType('customer.subscription.deleted', 'canceled', undefined, false), 'expiration');
for (const t of ['created', 'updated', 'deleted']) {
  for (const s of ['trialing', 'active', 'past_due', 'canceled']) {
    for (const p of [undefined, 'trialing', 'active', 'past_due']) {
      const r = stripeType(`customer.subscription.${t}`, s, p, false);
      assert.ok(!/payment|renewal_succeeded/.test(r), `no subscription transition claims a payment (${t} ${p}→${s} gave ${r})`);
    }
  }
}

// Payment facts come from invoice.paid with real amounts and history.
const im = stripeHook.match(/export function ledgerEventTypeForInvoice[\s\S]*?\n\}/);
assert(im, 'ledgerEventTypeForInvoice not found');
const invoiceType = eval('(' + im[0].replace('export ', '').replace(/\(amountPaid: number \| null \| undefined, priorPaidInvoices: number\): string/, '(amountPaid, priorPaidInvoices)') + ')');
assert.equal(invoiceType(1500, 0), 'first_payment_succeeded', 'first invoice with money collected');
assert.equal(invoiceType(1500, 1), 'renewal_succeeded', 'FIX 2: ordinary renewal is recorded as a payment');
assert.equal(invoiceType(1500, 7), 'renewal_succeeded');
assert.equal(invoiceType(0, 0), 'invoice_paid_no_charge', 'FIX 2: $0 invoice (trial / 100% coupon) is not revenue');
assert.equal(invoiceType(0, 3), 'invoice_paid_no_charge');
assert.equal(invoiceType(null, 0), 'invoice_paid_no_charge');
assert.ok(stripeHook.includes("'invoice.paid',") && stripeHook.includes("if (event.type === 'invoice.paid')"), 'invoice.paid is handled, not acknowledged as a no-op');
assert.ok(/invoices\.list\(\{ subscription: subscriptionId, status: 'paid'/.test(stripeHook), 'first vs subsequent decided from the subscription\'s paid-invoice history');
assert.ok(/p\.id !== inv\.id && Number\(p\.amount_paid\) > 0 && p\.created < inv\.created/.test(stripeHook), 'only EARLIER invoices with money collected count as prior payments');
for (const k of ['invoice_id:', 'payment_intent:', 'charge:', 'amount_paid:', 'billing_reason:', 'discount_amount:']) {
  assert.ok(stripeHook.includes(k), `invoice ledger row keeps ${k.replace(':', '')}`);
}
assert.ok(stripeHook.includes("reason: 'payment_evidence'"), 'invoice rows are marked as payment evidence');
assert.ok(stripeHook.includes('stripe().invoices.retrieve(inv.id)'), 'payment_intent / charge are read back through the pinned SDK version (2025-10-29 payloads omit them)');
assert.ok(stripeHook.includes('tax: taxAmount'), 'tax kept separately so revenue can exclude it');
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
assert.ok(complete.includes("p_event_type: isInTrial ? 'trial_started' : 'subscription_activated'"), 'FIX 2: checkout completion records subscription state, never a payment (dedupes with invoice.paid by construction)');
assert.ok(!complete.includes("'first_payment_succeeded'") && !complete.includes("'renewal_succeeded'"), 'checkout completion never claims a payment');
assert.ok(complete.includes('payment_status: session.payment_status') && complete.includes('amount_total: session.amount_total'), 'payment evidence kept on the state row');
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
