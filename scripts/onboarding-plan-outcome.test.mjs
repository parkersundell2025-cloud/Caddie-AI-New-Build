// Regression test for CONVERSION_FIXES #9 — onboarding must not report a plan
// as "ready" (or silently swallow a failed generation) when nothing persisted.
//
// Before: functions.invoke does NOT throw on non-2xx, so a *returned* error from
// generateInitialPlan was treated as success; the finish screen then claimed
// "Your plan is ready" with no plan row. The emergency unblock (onboarding
// completes even if generation fails) is intentional and is preserved.
//
// Runs the ACTUAL handleFinish from Onboarding.jsx in-memory (same harness
// shape as the investigation's conversion-reproduction.mjs, but asserting the
// FIXED behavior). No network, DB, or LLM.
//
// Run: node scripts/onboarding-plan-outcome.test.mjs   (no deps)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/pages/Onboarding.jsx', import.meta.url), 'utf8');
const start = src.indexOf('  const handleFinish = async () => {');
const end = src.indexOf('\n  const variants =', start);
assert(start >= 0 && end > start, 'Could not isolate handleFinish');
const handler = src.slice(start, end);

async function run(mode) {
  const result = { writes: [], events: [], errors: [], warns: [], step: null, readyPlan: null, error: null };
  const profile = { id: 'diagnostic-profile', referral_code: 'EXISTING' };
  const plan = { id: 'diagnostic-plan', plan_data: { sessions: [{ title: 'Practice' }] } };
  const supabase = {
    from(table) {
      let mutation = null;
      const query = {
        select() { return query; }, eq() { return query; }, single() { return query; },
        update(values) { mutation = { table, operation: 'update', values }; return query; },
        insert(values) { mutation = { table, operation: 'insert', values }; return query; },
        then(resolve, reject) {
          if (mutation) result.writes.push(mutation);
          const data = mutation ? profile
            : table === 'practice_plan' ? (mode === 'success' ? [plan] : [])
            : [profile];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    functions: { async invoke(name) {
      assert.equal(name, 'generateInitialPlan');
      if (mode === 'throws') throw new Error('Injected generation failure');
      if (mode === 'returned-error') return { data: null, error: new Error('Injected generation failure') };
      return { data: { success: true }, error: null };
    } },
  };
  const ctx = vm.createContext({
    supabase, URLSearchParams,
    console: {
      error: (...a) => result.errors.push(a.map(String).join(' ')),
      warn: (...a) => result.warns.push(a.map(String).join(' ')),
      log() {},
    },
    getCurrentUser: async () => ({ email: 'diagnostic@example.invalid', full_name: 'Diagnostic User' }),
    unwrap: async (q) => { const r = await q; if (r.error) throw r.error; return r.data; },
    window: { location: { search: '' }, fbq: (...a) => result.events.push(a) },
    localStorage: { getItem: () => null, removeItem() {} },
    form: { current_handicap: '18', goal_handicap: '10', preferred_days: [], days_per_week: 3 },
    isPlus: false, clubDistances: {}, capHandicap: (v) => v,
    getDefaultDistances: () => ({}), generateReferralCode: () => 'DIAGNOSTIC',
    setLoading() {}, setError: (v) => { result.error = v; },
    setStep: (v) => { result.step = v; }, setReadyPlan: (v) => { result.readyPlan = v; },
  });
  await vm.runInContext(`${handler}\nhandleFinish();`, ctx, { timeout: 2000 });
  result.onboardingMarkedComplete = result.writes.some((w) => w.values?.onboarding_complete === true);
  return result;
}

const ok = await run('success');
assert.equal(ok.readyPlan?.id, 'diagnostic-plan', 'success: plan is set');
assert.equal(ok.onboardingMarkedComplete, true, 'success: onboarding completes');
assert.equal(ok.step, 5, 'success: reaches finish screen');
assert.equal(ok.errors.length, 0, 'success: no generation error logged');
assert.equal(ok.warns.length, 0, 'success: no "no usable plan" warning');

for (const mode of ['returned-error', 'throws']) {
  const r = await run(mode);
  assert.equal(r.readyPlan, null, `${mode}: no plan is claimed`);
  assert.equal(r.onboardingMarkedComplete, true, `${mode}: emergency unblock preserved — onboarding still completes`);
  assert.equal(r.step, 5, `${mode}: user is not stranded`);
  assert.ok(r.errors.some((e) => e.includes('generateInitialPlan failed')),
    `FIX #9 (${mode}): generation failure is LOGGED (returned-error used to be silent)`);
  assert.ok(r.warns.some((w) => w.includes('no usable plan persisted')),
    `FIX #9 (${mode}): "no usable plan" is surfaced for measurement`);
}

// --- Source guards ---------------------------------------------------------
assert.ok(src.includes("const { error: genErr } = await supabase.functions.invoke('generateInitialPlan'"),
  'handleFinish must read the invoke error envelope');
assert.ok(src.includes('plan_data?.sessions?.length'), 'readiness must derive from the persisted plan row');
assert.ok(src.includes('all <span className="italic text-cut-green">set</span>'),
  'finish screen must have an honest no-plan headline');
assert.ok(src.includes('plan is <span className="italic text-cut-green">ready</span>'),
  'finish screen keeps the "ready" headline for the real-plan case');

console.log('PASS: #9 — returned/thrown generation failures are detected + logged, "ready" only when a plan persisted, unblock preserved.');
