// Behavioral test for the funnel emitter's identity boundary (review finding
// 3, 2026-09-16). Runs the ACTUAL src/lib/funnel.js in a sandbox with mocked
// auth, storage and transport — no network. Sequences covered:
//   A → null → B (sign-out then sign-in), direct A → B, reload restoration,
//   and a user switch while a delivery is in flight.
//
// Run: node scripts/funnel-queue.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/lib/funnel.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
  .replace(/import\.meta\.env/g, '__env');

// One sandboxed module instance. `storage` is shared across instances to model
// a reload; `session` is the mocked auth state.
function instance({ storage, session = null, online = true, transport }) {
  const authListeners = [];
  const sent = [];
  const values = {
    console: { warn() {}, log() {}, error() {} },
    setTimeout: (fn) => { fn(); return 0; }, // no real backoff waits
    crypto,
    __env: {},
    getPlatform: () => 'web',
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = v; },
      removeItem: (k) => { delete storage[k]; },
    },
    navigator: { onLine: online },
    window: { addEventListener() {} },
    supabase: {
      auth: {
        onAuthStateChange: (cb) => { authListeners.push(cb); },
        getSession: async () => ({ data: { session: session ? { user: { id: session } } : null } }),
      },
      functions: {
        invoke: async (_name, { body }) => {
          sent.push(body);
          if (transport) return transport(body);
          return { data: { recorded: true }, error: null };
        },
      },
    },
  };
  const ctx = vm.createContext(values);
  const api = vm.runInContext(
    `(function(){\n${src}\nreturn { track, setFunnelUser, startFlow, getFlowId, _queue: queue };\n})()`,
    ctx,
  );
  const auth = {
    signIn: (uid) => { values.navigator.onLine; for (const cb of authListeners) cb('SIGNED_IN', { user: { id: uid } }); },
    signOut: () => { for (const cb of authListeners) cb('SIGNED_OUT', null); },
    initial: (uid) => { for (const cb of authListeners) cb('INITIAL_SESSION', uid ? { user: { id: uid } } : null); },
  };
  const setOnline = (v) => { values.navigator.onLine = v; };
  return { api, auth, sent, setOnline, storage, values };
}
const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };

// ---- A → null → B ----------------------------------------------------------
{
  const storage = {};
  const m = instance({ storage, session: 'A', online: false });
  m.auth.initial('A');
  m.api.startFlow();
  const flowA = m.api.getFlowId();
  m.api.track('purchase_tapped', { attemptId: 'att-A' });
  await settle();
  assert.equal(m.api._queue.length, 1, 'A: event queued while offline');
  assert.ok(storage.caddie_funnel_queue.includes('"user":"A"'), 'A: persisted item carries its owner');

  m.auth.signOut();
  await settle();
  assert.equal(m.api._queue.length, 0, 'sign-out clears the queue');
  assert.equal(storage.caddie_funnel_queue, undefined, 'sign-out clears storage');
  assert.equal(m.api.getFlowId(), null, 'sign-out resets the journey id');

  m.auth.signIn('B');
  m.setOnline(true);
  m.api.track('paywall_shown', { viewId: 'v-B' });
  await settle();
  assert.deepEqual(m.sent.map((e) => e.attempt_id ?? e.view_id), ['v-B'], 'FIX: only B\'s event is delivered; A\'s never rides B\'s session');
  assert.notEqual(m.api.getFlowId(), flowA, 'B gets a fresh journey');
}

// ---- direct A → B ----------------------------------------------------------
{
  const storage = {};
  const m = instance({ storage, session: 'A', online: false });
  m.auth.initial('A');
  m.api.track('purchase_tapped', { attemptId: 'att-A' });
  await settle();
  m.auth.signIn('B');
  m.setOnline(true);
  m.api.track('paywall_shown', { viewId: 'v-B' });
  await settle();
  assert.deepEqual(m.sent.map((e) => e.attempt_id ?? e.view_id), ['v-B'], 'FIX: direct switch drops A\'s queued event');
}

// ---- reload restoration ----------------------------------------------------
{
  const storage = {};
  const first = instance({ storage, session: 'A', online: false });
  first.auth.initial('A');
  first.api.track('purchase_tapped', { attemptId: 'att-A' });
  await settle();
  assert.ok(storage.caddie_funnel_queue, 'persisted before "reload"');

  // Reload as a different user: nothing restored, storage purged.
  const asB = instance({ storage: { ...storage }, session: 'B', online: true });
  asB.auth.initial('B');
  await settle();
  assert.equal(asB.sent.length, 0, 'FIX: reload as B does not deliver A\'s persisted event');
  assert.equal(asB.storage.caddie_funnel_queue, undefined, 'foreign persisted items are purged');

  // Reload as the same user: delivered.
  const asA = instance({ storage: { ...storage }, session: 'A', online: true });
  asA.auth.initial('A');
  await settle();
  assert.deepEqual(asA.sent.map((e) => e.attempt_id), ['att-A'], 'reload as A delivers A\'s persisted event');
}

// ---- switch while a request is in flight -----------------------------------
{
  const storage = {};
  let release;
  const gate = new Promise((r) => { release = r; });
  const m = instance({
    storage, session: 'A', online: true,
    transport: async (body) => { if (body.attempt_id === 'att-A') await gate; return { data: {}, error: null }; },
  });
  m.auth.initial('A');
  m.api.track('purchase_tapped', { attemptId: 'att-A' });
  await settle(); // A's request is now pending on the gate
  assert.equal(m.sent.length, 1, 'A\'s request went out');

  m.auth.signIn('B');
  m.api.track('paywall_shown', { viewId: 'v-B' });
  await settle();
  assert.equal(m.api._queue.length, 1, 'B\'s event is queued behind the in-flight request');

  release();
  await settle();
  assert.deepEqual(m.sent.map((e) => e.attempt_id ?? e.view_id), ['att-A', 'v-B'], 'FIX: completing A\'s request does not remove B\'s event; B\'s is then delivered');
  assert.equal(m.api._queue.length, 0, 'queue fully drained');
}

// ---- signed-out events are never held for the next user ---------------------
{
  const storage = {};
  const m = instance({ storage, session: null, online: true });
  m.auth.initial(null);
  m.api.track('paywall_shown', { viewId: 'v-anon' });
  await settle();
  m.auth.signIn('B');
  await settle();
  assert.equal(m.sent.length, 0, 'an event recorded while signed out is dropped, not attributed to the next sign-in');
}

console.log('PASS: funnel identity boundary — A→null→B, direct A→B, reload restore (same user only), in-flight switch, signed-out drop.');
