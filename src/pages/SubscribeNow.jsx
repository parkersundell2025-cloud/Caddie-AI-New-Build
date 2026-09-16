import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Zap, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { hasActiveAccess } from '@/lib/subscription';
import Logo from '@/components/layout/Logo';
import { isNative, getPlatform, openExternal, NATIVE_URL_SCHEME } from '@/lib/platform';
import {
  getOfferings,
  loadOfferings,
  getIntroEligibility,
  describeOffer,
  purchasePackage,
  restorePurchases,
  planForPackage,
  hasAnyActiveEntitlement,
  identifyRevenueCatUser,
} from '@/lib/revenuecat';
import { track, newViewId, newAttemptId } from '@/lib/funnel';

// Page ground — this route renders outside AppLayout, so it paints The Cut
// ground itself instead of relying on the scoped theme class.
const GROUND = {
  background:
    'radial-gradient(120% 60% at 100% 0%, rgba(95,190,126,.10) 0%, transparent 50%), linear-gradient(180deg, #0F1714 0%, #0B0F0C 60%)',
  color: '#F4EFE3',
};

// Plan catalog — presentation only; ids map 1:1 onto the existing checkout
// plans. When freemium lands, this array becomes Free / Pro monthly / Pro
// annual without touching the row component or the handlers.
const PLANS = [
  {
    id: 'basic',
    label: 'Basic',
    price: '$15',
    per: '/mo',
    sub: 'Plans · coach · tracking · leaderboard',
    best: false,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$29',
    per: '/mo',
    sub: 'Everything in Basic + game plans & reports',
    best: true,
    badge: 'MOST POPULAR',
  },
];

// Design-preview lineup per the freemium spec (Free / Pro monthly / Pro
// annual) — the Phase 0 "design it once" deliverable. Rendered only at
// /subscribe-now?preview=freemium with purchasing disabled; becomes the
// default PLANS at freemium launch. Pricing illustrative until the SKUs
// exist.
const FREEMIUM_PREVIEW = new URLSearchParams(window.location.search).get('preview') === 'freemium';
const FREEMIUM_PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    per: '',
    sub: 'Practice plans · round logging · leaderboard',
    best: false,
  },
  {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    price: '$9.99',
    per: '/mo',
    sub: 'Everything unlocked · billed monthly',
    best: false,
  },
  {
    id: 'pro_annual',
    label: 'Pro Annual',
    price: '$59.99',
    per: '/yr',
    sub: 'Everything unlocked · 2 months free',
    best: true,
    badge: 'BEST VALUE',
  },
];

const FEATURES = [
  { l: 'Personalized practice plans', d: 'A weekly schedule built around your game' },
  { l: 'AI coach', d: 'Ask anything, trained on your rounds and sessions' },
  { l: 'Handicap tracking', d: 'Every round moves your index automatically' },
  { l: 'Leaderboard & badges', d: 'Compete every month for real prizes' },
  { l: 'Monthly Game Plan', d: 'Your month, planned around what the data says', pro: true },
  { l: 'Pre-Round Game Plan', d: 'A strategy brief before you tee off', pro: true },
  { l: 'Weekly Report', d: 'What improved, what needs attention', pro: true },
  { l: 'Competitor Intel', d: 'How you stack up against the field', pro: true },
];

// #5: `offer` (from describeOffer) carries the store's REAL localized price and
// period on native. When present it replaces the static catalog price; the
// static value is only the web (Stripe) fallback.
function PlanRow({ plan, selected, onSelect, offer }) {
  const price = offer?.priceString || plan.price;
  const per = offer ? offer.periodLabel : plan.per;
  return (
    <button
      onClick={() => onSelect(plan.id)}
      className="w-full p-4 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-[0.99]"
      style={{
        background: selected ? '#0B100D' : 'rgba(244,239,227,.04)',
        border: selected ? '1.5px solid #5FBE7E' : '1px solid rgba(244,239,227,.10)',
        boxShadow: selected ? '0 0 20px rgba(95,190,126,.30)' : 'none',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* radio dot */}
      <div
        className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          border: selected ? '2px solid #5FBE7E' : '2px solid rgba(244,239,227,.15)',
          background: selected ? '#5FBE7E' : 'transparent',
        }}
      >
        {selected && <div className="w-2 h-2 rounded-full" style={{ background: '#0B0F0C' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="cut-headline text-cut-ink text-base">{plan.label}</span>
          {plan.badge && (
            <span className="px-2 py-0.5 rounded-[10px] text-[9px] font-extrabold bg-cut-green text-cut-bg" style={{ letterSpacing: '0.6px' }}>
              {plan.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-cut-ink-mute mt-0.5 truncate">
          {offer?.trial ? `${offer.trial.label}${offer.trial.certain ? '' : ' (if eligible)'} · ` : ''}{plan.sub}
        </p>
      </div>
      <div className="flex items-baseline gap-0.5 flex-shrink-0">
        <span className="font-mono text-lg font-bold text-cut-ink" style={{ letterSpacing: '-0.6px' }}>{price}</span>
        <span className="font-mono text-[11px] font-semibold text-cut-ink-mute">{per}</span>
      </div>
    </button>
  );
}

function FeatureList() {
  return (
    <div className="cut-glass p-[18px]">
      {FEATURES.map((f, i) => (
        <div
          key={f.l}
          className="flex items-start gap-3 py-2.5"
          style={{ borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(244,239,227,.08)' : 'none' }}
        >
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(95,190,126,.15)', color: '#5FBE7E' }}>
            <Check className="w-3 h-3" strokeWidth={2.6} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="cut-headline text-cut-ink text-sm">{f.l}</span>
              {f.pro && (
                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-extrabold bg-cut-gold-soft text-cut-gold" style={{ letterSpacing: '0.6px' }}>PRO</span>
              )}
            </div>
            <p className="text-[11px] text-cut-ink-mute mt-0.5">{f.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Apple 3.1.2(c): subscription title/length/price + Terms (EULA) + Privacy
// Policy must be visible within the app on the paywall. Build #34 was
// rejected for missing the Terms + Privacy links here.
// #6: the billing paragraph is platform-specific. The old copy said "Apple ID"
// on Android and on web — inaccurate, and it names a cancellation route the
// user doesn't have. iOS text is kept verbatim (Apple's expected wording).
function billingDisclosure() {
  const platform = getPlatform();
  if (platform === 'ios') {
    return 'Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period, at the same price. You can manage and cancel your subscriptions at any time in your Apple ID account settings after purchase.';
  }
  if (platform === 'android') {
    return 'Payment will be charged to your Google Play account at confirmation of purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription at any time in Google Play → Subscriptions.';
  }
  return 'Payment is charged to your card at confirmation of purchase and your subscription renews monthly at the same price until cancelled. You can manage or cancel at any time from Manage Subscription in your account.';
}

// #5: on native, `byPlan` carries the store's real localized prices so the
// mandatory price disclosure matches what the store sheet will actually show.
// The static $15/$29 are the web (Stripe) prices and the fallback.
function Disclosure({ byPlan }) {
  const fmt = (offer, fallback) => (offer?.priceString ? `${offer.priceString}${offer.periodLabel || '/mo'}` : fallback);
  return (
    <div className="text-cut-ink-mute text-xs text-center leading-relaxed space-y-2 max-w-md mx-auto px-2">
      <p>
        <span className="text-cut-ink-soft font-semibold">Caddie AI Basic — {fmt(byPlan?.basic, '$15/month')}</span> · Auto-renewing monthly subscription.
        <br />
        <span className="text-cut-ink-soft font-semibold">Caddie AI Pro — {fmt(byPlan?.pro, '$29/month')}</span> · Auto-renewing monthly subscription.
      </p>
      <p>{billingDisclosure()}</p>
      <p>
        <a href="/terms" className="underline text-cut-ink-soft">Terms of Use (EULA)</a>
        {' · '}
        <a href="/privacy" className="underline text-cut-ink-soft">Privacy Policy</a>
      </p>
    </div>
  );
}

// #5: `trial` is the resolved offer for the selected plan (null when the store
// doesn't offer one, or we can't yet tell). The old copy promised a 7-day free
// trial unconditionally, before checking whether the store would honor it.
function Hero({ trial }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cut-gold-soft text-cut-gold text-[11px] font-bold uppercase" style={{ letterSpacing: '1.4px' }}>
        <Zap className="w-3 h-3" strokeWidth={2.4} />
        <span>Caddie AI</span>
      </div>
      <h1 className="cut-headline text-cut-ink leading-[1.05]" style={{ fontSize: 34, letterSpacing: '-0.8px' }}>
        A coach that <span className="italic text-cut-green">knows your game</span>.
      </h1>
      <p className="text-cut-ink-soft text-[13px] leading-relaxed max-w-xs">
        {trial
          ? `Start your ${trial.label}${trial.certain ? '' : ' (if eligible)'}. Cancel anytime.`
          : 'Cancel anytime. No commitment.'}
      </p>
    </motion.div>
  );
}

export default function SubscribeNow() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  // #8: whether the initial tier was an explicit choice (URL / persisted) or
  // the Pro default — logged separately on paywall_shown, per the design.
  const planIntentRef = useRef({ explicit: false });
  // #8: one view_id per ACTUAL paywall presentation. Focus/visibility rechecks
  // re-run init but must not count as a new view.
  const paywallViewIdRef = useRef(null);

  // #6: honor the tier the user picked on the landing page instead of always
  // defaulting to Pro. Order: ?plan= on this URL → the value SignIn/Gateway
  // persisted across the sign-in round-trip → 'pro'. Only basic/pro accepted.
  const [selectedPlan, setSelectedPlan] = useState(() => {
    if (FREEMIUM_PREVIEW) return 'pro_annual';
    const fromUrl = new URLSearchParams(window.location.search).get('plan');
    let stored = null;
    try { stored = localStorage.getItem('caddie_selected_plan'); } catch { /* storage unavailable */ }
    const intent = fromUrl || stored;
    const explicit = intent === 'basic' || intent === 'pro';
    planIntentRef.current = { explicit };
    return explicit ? intent : 'pro';
  });
  // Per-plan loading state so we can disable the relevant button while we
  // wait for the Checkout Session URL.
  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'basic' | 'pro' | null
  const [checkoutError, setCheckoutError] = useState('');
  // Paywall load state (#2): a failed profile read must surface a retry, never
  // an endless spinner. loadError renders the retry screen; initRunRef guards a
  // stale focus/visibility rerun from overwriting a newer run's result.
  const [loadError, setLoadError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const initRunRef = useRef(0);
  // #4: guards duplicate checkout submissions — a rapid double-tap can fire
  // before the disabled state re-renders.
  const checkoutInFlightRef = useRef(false);

  // #5: what the store can actually sell (native). status mirrors
  // loadOfferings() — 'web' | 'loading' | 'not_configured' | 'unavailable' |
  // 'error' | 'ready'. byPlan maps 'basic'|'pro' → describeOffer() so the rows,
  // Hero, CTA and price disclosure render the REAL localized price/period and
  // only promise a trial the store will honor. offering is kept so the purchase
  // tap can reuse it instead of a second fetch.
  const [offerState, setOfferState] = useState({
    status: isNative() ? 'loading' : 'web', byPlan: {}, offering: null, error: null,
  });
  const [offerNonce, setOfferNonce] = useState(0);
  const offerRunRef = useRef(0);

  // Load offerings UP FRONT once the paywall is actually shown (old code only
  // fetched after the Subscribe tap, so prices/eligibility were never rendered).
  useEffect(() => {
    if (FREEMIUM_PREVIEW || !isNative() || loading) return;
    let cancelled = false;
    const runId = ++offerRunRef.current;
    const stale = () => cancelled || runId !== offerRunRef.current;
    (async () => {
      setOfferState((s) => ({ ...s, status: 'loading', error: null }));
      const t0 = Date.now();
      const res = await loadOfferings();
      if (stale()) return;
      if (res.status !== 'ready') {
        // #8: which of the distinct failure reasons occurred (never the raw message).
        track('offerings_failed', { properties: { status: res.status, code: res.status, latency_ms: Date.now() - t0 } });
        setOfferState({ status: res.status, byPlan: {}, offering: null, error: res.error });
        return;
      }
      const pkgs = res.offering.availablePackages || [];
      track('offerings_loaded', {
        offeringId: res.offering.identifier ?? null,
        properties: { latency_ms: Date.now() - t0, offering_id: res.offering.identifier ?? null, package_count: pkgs.length },
      });
      const ids = pkgs.map((p) => p?.product?.identifier).filter(Boolean);
      const eligibility = await getIntroEligibility(ids);
      if (stale()) return;
      const byPlan = {};
      for (const pkg of pkgs) {
        const plan = planForPackage(pkg);
        if (plan === 'basic' || plan === 'pro') {
          byPlan[plan] = describeOffer(pkg, eligibility[pkg.product.identifier]);
        }
      }
      setOfferState({ status: 'ready', byPlan, offering: res.offering, error: null });
    })();
    return () => { cancelled = true; };
  }, [loading, offerNonce]);

  // Manual retry ONLY re-fetches the offering. It never re-runs a purchase and
  // never falls back to another billing route (Play policy; iOS 2026-08-04).
  const retryOffers = () => setOfferNonce((n) => n + 1);

  // #8: an explicit tier choice — distinct from the initial default, which is
  // logged on paywall_shown as initial_plan_default.
  const onSelectPlan = (next) => {
    if (next !== selectedPlan) {
      track('plan_selected', { planId: next, properties: { previous: selectedPlan, current: next, explicit: true } });
    }
    setSelectedPlan(next);
  };

  useEffect(() => {
    // Persist ref code from URL into localStorage so it survives Stripe checkout redirect
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) localStorage.setItem('caddie_ref_code', refCode);
    // #6: a signed-out visitor landing here with ?plan= is sent to /signin and
    // would otherwise lose the tier they chose. Persist it (the auth redirect
    // strips params) so it's honored when they come back through Gateway.
    const plan = urlParams.get('plan');
    if (plan === 'basic' || plan === 'pro') {
      try { localStorage.setItem('caddie_selected_plan', plan); } catch { /* storage unavailable */ }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Design preview renders for anyone (even signed-out / subscribed
    // viewers) — it exists to be looked at, not purchased from
    if (FREEMIUM_PREVIEW) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    // Bounded fetch: a hung request must become a retryable error, not an
    // endless spinner.
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('request timed out')), ms)),
      ]);

    const init = async ({ background = false } = {}) => {
      // Monotonic run id: a stale focus/visibility rerun must never overwrite
      // the state a newer run has already settled.
      const runId = ++initRunRef.current;
      const stale = () => cancelled || runId !== initRunRef.current;

      // Don't force the spinner on here: the initial mount already starts in
      // loading, and retryLoad sets it before re-running — so a focus/visibility
      // recheck re-validates in the background without flashing the spinner.
      // loadError is cleared on success (below), not up front, so a recheck
      // can't flash the paywall over the error screen with unloaded data.
      try {
        const u = await getCurrentUser();
        if (stale()) return;
        if (!u) {
          // getUser() needs the network, so being offline (or the auth server
          // being unreachable) ALSO yields "no user". That is not signed-out:
          // if a local session still exists, or the browser reports offline,
          // treat it as transient and offer retry instead of bouncing a
          // signed-in user to /signin (caught in the 2026-09-16 walkthrough).
          const { data: { session } = {} } = await supabase.auth.getSession().catch(() => ({ data: {} }));
          if (stale()) return;
          if (session || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
            throw Object.assign(new Error('auth server unreachable'), { stage: 'auth' });
          }
          const urlParams = new URLSearchParams(window.location.search);
          const emailParam = urlParams.get('email');
          const next = emailParam ? `/signin?email=${encodeURIComponent(emailParam)}` : '/signin';
          navigate(next, { replace: true });
          return;
        }
        setUser(u);

        // If they already have an active subscription or active trial, don't show
        // them the plan selection again. A user who just completed Stripe checkout
        // has subscription_status='trial' + a stripe_subscription_id — keeping
        // them on this page would imply they need to subscribe again.
        const profiles = await withTimeout(
          unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email)),
          12000,
        );
        if (stale()) return;
        const profile = profiles[0];

        // #7: the shared access predicate. The old inline copy required a
        // stripe_subscription_id for basic/pro, so a native Pro (RevenueCat id
        // only) passed SubscriptionGate yet was never redirected off this page.
        if (hasActiveAccess(profile)) {
          // Paywall-last flow: onboarding happens before payment, so a paid user
          // here is already onboarded → straight to home. The onboarding detour
          // is kept only as a safety net for legacy users who paid under the old
          // paywall-first order and never finished onboarding.
          if (!profile.onboarding_complete) {
            navigate('/onboarding', { replace: true });
            return;
          }
          navigate('/home', { replace: true });
          return;
        }

        // Paywall-last invariant: you can't reach the paywall before onboarding.
        // A signed-in user with no profile (or unfinished onboarding) who lands
        // here directly — deep link, stale tab, old bookmark — is sent through
        // onboarding first (it creates the profile and routes back here). Without
        // this, they could pay before onboarding and fall back to the old order.
        if (!profile || !profile.onboarding_complete) {
          navigate('/onboarding', { replace: true });
          return;
        }

        if (window.fbq) window.fbq('track', 'InitiateCheckout');
        // #8: paywall_shown fires once per ACTUAL presentation. Focus/visibility
        // rechecks re-run init but reuse the view_id and skip this, so the
        // event can be counted as unique views (unlike InitiateCheckout).
        if (!paywallViewIdRef.current) {
          paywallViewIdRef.current = newViewId();
          track('paywall_shown', {
            viewId: paywallViewIdRef.current,
            planId: selectedPlan,
            properties: {
              variant: 'v1',
              entry_source: planIntentRef.current.explicit ? 'landing_tier' : 'unknown',
              initial_plan_default: !planIntentRef.current.explicit,
            },
          });
        }
        setLoadError(null);
        setLoading(false);
      } catch (err) {
        if (stale()) return;
        // Distinguish an expired/invalid session (send to sign-in) from a
        // transient fetch failure (offer retry). Never resolve uncertainty by
        // granting access — we only ever route forward on a positive read.
        const msg = String(err?.message || err);
        if (/jwt|token|unauthor|401|not.?authenticated|session/i.test(msg)) {
          navigate('/signin', { replace: true });
          return;
        }
        // A background recheck (focus/visibility) that fails transiently must
        // not tear down a paywall the user is already looking at — what's on
        // screen is still valid. Only the initial load and an explicit Try
        // again surface the error screen (walkthrough 2026-09-16: going
        // offline while ON the paywall swapped it for "Try again").
        if (background && paywallViewIdRef.current) {
          console.warn('[SubscribeNow] background recheck failed, keeping paywall:', msg);
          return;
        }
        // #8: a recoverable load failure is a funnel fact (stage + sanitized code).
        track('paywall_load_failed', {
          properties: { stage: err?.stage ?? 'profile', code: /timed out/i.test(msg) ? 'timeout' : 'fetch_error' },
        });
        setLoadError("We couldn't load your account. Check your connection and try again.");
        setLoading(false);
      }
    };

    init();

    // Re-run init when the user comes back to this tab. Common flow:
    // user opens SubscribeNow → clicks Subscribe → completes Stripe checkout
    // in another tab/window → returns to this tab. Without this listener,
    // they'd still see the plan picker because init() only ran on mount,
    // before their profile had a Stripe subscription attached. Re-running
    // on focus/visibility picks up the post-checkout state and redirects
    // them to /onboarding or /home automatically.
    const recheck = () => {
      if (document.visibilityState === 'visible') init({ background: true });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [retryNonce]);

  // Server-side Stripe Checkout Session: createStripeCheckoutSession edge fn
  // creates a Session attached to the Supabase auth user's UUID
  // (client_reference_id + metadata.rc_app_user_id), then we redirect the
  // browser to the Stripe-hosted checkout page. Replaces the buy.stripe.com
  // payment links which couldn't carry user identity through to RC.
  const startCheckout = async (plan) => {
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;
    setCheckoutLoading(plan);
    setCheckoutError('');
    // #8: one attempt id ties tap → session creation → outcome for this click.
    const attemptId = newAttemptId();
    const ev = (name, properties) => track(name, { attemptId, planId: plan, properties });
    ev('purchase_tapped', { entry_source: isNative() ? 'native_stripe' : 'web' });
    const fail = (msg, code) => {
      ev('purchase_result', { outcome: 'error', code });
      setCheckoutError(msg);
      setCheckoutLoading(null);
      checkoutInFlightRef.current = false;
    };
    try {
      // Capacitor (ios/android): Stripe redirects back to caddieai:// custom
      // scheme so the OS reopens our app and the App plugin fires appUrlOpen,
      // which the deep-link router in App.jsx forwards into the SPA.
      // Web: standard origin-based redirect.
      const body = isNative()
        ? {
            plan,
            success_url: `${NATIVE_URL_SCHEME}://checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${NATIVE_URL_SCHEME}://subscribe-now`,
          }
        : { plan, return_url_origin: window.location.origin };

      ev('purchase_sdk_invoked');
      const { data, error } = await supabase.functions.invoke('createStripeCheckoutSession', { body });
      if (error || !data?.session_url) {
        fail("Something went wrong starting checkout. Please try again or email support@caddieaiapp.com.", error ? 'session_error' : 'no_session_url');
        return;
      }
      // Web: the outcome we can know is "handed to Stripe"; access_confirmed
      // on /checkout/success is the completion signal.
      ev('purchase_result', { outcome: 'redirected' });
      await openExternal(data.session_url);
      // Native: the system browser opens over the app and the user may come
      // back (cancelled or done) with this page still mounted — re-enable the
      // button for that return. Web: assign() navigates away; leaving it
      // disabled prevents a second Checkout Session during the handoff.
      if (isNative()) {
        setCheckoutLoading(null);
        checkoutInFlightRef.current = false;
      }
    } catch (e) {
      // A THROWN invoke rejection or a failed openExternal used to bypass the
      // handled-error branch above, leaving checkoutLoading stuck with no
      // message. Catch the whole checkout-and-redirect operation.
      console.warn('[SubscribeNow] startCheckout failed:', e?.message);
      fail("Something went wrong starting checkout. Please try again or email support@caddieaiapp.com.", 'exception');
    }
  };

  const handleRestoreAccess = async () => {
    setRestoring(true);
    setRestoreMsg('');
    try {
      const profiles = await unwrap(
        supabase.from('user_profile').select('*').eq('user_email', user.email)
      );
      const profile = profiles[0];
      // #7: shared predicate — the old check demanded a stripe_subscription_id,
      // so a native subscriber tapping Restore was told "no active subscription".
      if (hasActiveAccess(profile)) {
        navigate('/home', { replace: true });
      } else {
        setRestoreMsg('No active subscription found yet. If you just subscribed, please wait a moment and try again.');
      }
    } catch (e) {
      setRestoreMsg('Something went wrong. Please try again.');
    }
    setRestoring(false);
  };

  // iOS layout entry point — covers both Mobile Safari iOS and the Capacitor
  // app. Only the Capacitor case routes through RevenueCat IAP; Mobile Safari
  // users have no native StoreKit, so they fall through to the existing Stripe
  // Checkout via Browser plugin (which on web reduces to window.location.assign).
  const handleIOSPurchase = async (plan) => {
    if (!isNative()) {
      startCheckout(plan);
      return;
    }
    setCheckoutLoading(plan);
    setCheckoutError('');

    // #8: one attempt id per tap; preflight failures (no package, no user,
    // identity) are recorded as distinct reasons so "tapped but never reached
    // the store" is measurable instead of invisible.
    const attemptId = newAttemptId();
    const offer = offerState.byPlan?.[plan] ?? null;
    const ev = (name, properties, extra = {}) => track(name, { attemptId, planId: plan, properties, ...extra });
    ev('purchase_tapped', {
      price: offer?.priceString ?? null,
      trial_eligibility: offer?.trial ? (offer.trial.certain ? 'eligible' : 'unknown') : 'none',
      entry_source: 'native',
    });

    // If RC can't produce a purchasable package (key missing, offering not
    // configured, store products not yet propagated, network failure) the
    // handling differs by store:
    //   - Android: Google Play policy REQUIRES Play Billing for digital subs.
    //     Falling back to the Stripe web checkout would be a policy violation,
    //     so we surface a retryable error instead and never open the browser.
    //   - iOS: the App Store tolerated the Stripe fallback during the RC
    //     rollout (see 3.1.1 note), so it's preserved for that platform only.
    // #5: reuse the offering already loaded for the paywall; fall back to a
    // last-second fetch only if it isn't there. Never auto-retry a purchase.
    const offering = offerState.offering ?? await getOfferings();
    const pkg = offering?.availablePackages?.find((p) => planForPackage(p) === plan);
    if (!pkg) {
      ev('purchase_preflight_failed', { reason: 'no_package' });
      setCheckoutLoading(null);
      // No silent Stripe web fallback on iOS anymore: a native user pushed
      // into live Stripe checkout can be charged real money while the
      // native provisioning path knows nothing about them (2026-08-04).
      // Both platforms now surface a retryable error — offerings failures
      // are transient (first-launch fetch races).
      setCheckoutError('The store is still setting up this subscription. Please try again in a few minutes.');
      return;
    }

    try {
      // Strict identity contract before charging (#3). identifyRevenueCatUser
      // returns null on a RevenueCat logIn failure; the old code awaited it but
      // ignored the result and purchased anyway — so a failed alignment could
      // charge under an anonymous/stale identity the webhook can't resolve
      // (paying user provisioned nothing, 2026-08-04). Require an authenticated
      // user AND a successful alignment for THIS uuid; otherwise stop and let
      // them retry. Never call the store on an unverified identity.
      const u = await getCurrentUser();
      if (!u?.id) {
        ev('purchase_preflight_failed', { reason: 'no_user' });
        setCheckoutError('Please sign in again to finish your purchase.');
        setCheckoutLoading(null);
        return;
      }
      const identified = await identifyRevenueCatUser(u.id);
      if (!identified) {
        console.warn('[SubscribeNow] identity alignment failed before purchase — blocked');
        ev('purchase_preflight_failed', { reason: 'identity' });
        setCheckoutError("We couldn't verify your account with the store. Please try again.");
        setCheckoutLoading(null);
        return;
      }
      const productId = pkg?.product?.identifier ?? null;
      ev('purchase_sdk_invoked', {}, { productId });
      await purchasePackage(pkg);
      ev('purchase_result', { outcome: 'success' }, { productId });
      // ALWAYS route through /checkout/success after IAP, even when RC's
      // customerInfo already shows the entitlement. Why: /home is wrapped in
      // SubscriptionGate which reads subscription_status from
      // user_profile in Supabase — NOT RC's customerInfo. user_profile only
      // updates when the RC webhook lands (typically 1–5s after purchase),
      // so optimistic navigation to /home loses the race against the
      // webhook in the common case and bounces the user back to
      // /subscribe-now. The dedicated /checkout/success page polls
      // user_profile and waits for the webhook to land before forwarding
      // to /home — eliminating the bounce entirely.
      navigate('/checkout/success', { replace: true });
    } catch (err) {
      // RC throws PurchasesError on user-cancel — swallow silently. Surface
      // anything else (network, billing, App Store unavailable) to the UI.
      const cancelled = !!err?.userCancelled || /cancel/i.test(err?.message || '');
      ev('purchase_result', { outcome: cancelled ? 'cancel' : 'error', code: err?.code ?? null });
      if (!cancelled) {
        setCheckoutError(err?.message || 'Purchase failed. Please try again.');
      }
      setCheckoutLoading(null);
    }
  };

  const handleIOSRestore = async () => {
    if (!isNative()) {
      handleRestoreAccess();
      return;
    }
    setRestoring(true);
    setRestoreMsg('');
    try {
      const customerInfo = await restorePurchases();
      if (hasAnyActiveEntitlement(customerInfo)) {
        navigate('/home', { replace: true });
      } else {
        setRestoreMsg('No active subscription found to restore.');
      }
    } catch (err) {
      setRestoreMsg(err?.message || 'Restore failed. Please try again.');
    }
    setRestoring(false);
  };

  // Recoverable load failure (#2): actionable retry, not an endless spinner.
  // The selected tier is retained (selectedPlan is untouched by a retry).
  const retryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  };

  if (loadError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center" style={GROUND}>
        <div style={{ filter: 'brightness(0) invert(1)' }}><Logo size="lg" /></div>
        <p className="text-cut-ink-soft text-sm max-w-xs leading-relaxed">{loadError}</p>
        <button
          onClick={retryLoad}
          className="px-6 py-3 rounded-full text-sm font-bold bg-cut-green text-cut-bg transition-all active:scale-95"
          style={{ boxShadow: '0 0 20px rgba(95,190,126,.30)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5" style={GROUND}>
        <div style={{ filter: 'brightness(0) invert(1)' }}><Logo size="lg" /></div>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(244,239,227,.15)', borderTopColor: '#5FBE7E' }} />
      </div>
    );
  }

  // Native (iOS + Android) and web share the same layout; only the purchase
  // and restore handlers differ (RC IAP vs Stripe Checkout). isNative(), NOT
  // isIOS: the old iPad/iPhone user-agent check excluded Android, so the
  // Android app fell through to the web/Stripe layout and never reached the
  // native Play Billing path — a Google Play policy violation.
  const native = isNative();
  const onPurchase = native ? handleIOSPurchase : startCheckout;
  const onRestore = native ? handleIOSRestore : handleRestoreAccess;

  // #5: resolve what we may HONESTLY promise for the selected plan.
  // Web: the Stripe Checkout Session is configured with the 7-day trial, so
  // that promise is accurate. Native: only what describeOffer() found in the
  // store's real offer for THIS user; nothing until the offering is ready.
  const WEB_TRIAL = { label: '7-day free trial', certain: true };
  const selectedOffer = native ? offerState.byPlan[selectedPlan] || null : null;
  const selectedTrial = native
    ? (offerState.status === 'ready' ? selectedOffer?.trial ?? null : null)
    : WEB_TRIAL;
  const offersReady = !native || offerState.status === 'ready';
  const planName = selectedPlan === 'pro' ? 'Pro' : 'Basic';
  const ctaLabel = checkoutLoading
    ? 'Loading…'
    : selectedTrial
      ? `Start ${selectedTrial.label} — ${planName} →`
      : `Subscribe — ${planName} →`;
  // Distinct, truthful states instead of one "store is still setting up" line.
  const offerNotice = !native ? null : ({
    loading: 'Loading plans from the store…',
    not_configured: "In-app purchases aren't available in this build.",
    unavailable: "Plans aren't available from the store right now.",
    error: "Couldn't reach the store.",
  })[offerState.status] || null;
  const offerRetryable = native && (offerState.status === 'unavailable' || offerState.status === 'error');

  return (
    <div className="min-h-screen px-5 py-8 flex flex-col items-center" style={GROUND}>
      <div className="w-full max-w-lg mx-auto space-y-6">
        <Hero trial={selectedTrial} />

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FeatureList />
        </motion.div>

        {/* Plans */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          {offerNotice && (
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs"
              style={{ background: 'rgba(244,239,227,.04)', border: '1px solid rgba(244,239,227,.10)' }}
            >
              <span className="text-cut-ink-soft">{offerNotice}</span>
              {offerState.status === 'loading' ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(244,239,227,.15)', borderTopColor: '#5FBE7E' }} />
              ) : offerRetryable ? (
                // Manual retry of the offering fetch only — never a purchase,
                // never a silent switch to another billing route.
                <button onClick={retryOffers} className="font-bold text-cut-green underline underline-offset-4 flex-shrink-0">
                  Retry
                </button>
              ) : null}
            </div>
          )}
          {(FREEMIUM_PREVIEW ? FREEMIUM_PLANS : PLANS).map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              selected={selectedPlan === p.id}
              onSelect={onSelectPlan}
              offer={native ? offerState.byPlan[p.id] : undefined}
            />
          ))}
        </motion.div>

        {/* CTA */}
        {FREEMIUM_PREVIEW ? (
          <div className="space-y-2">
            <button
              disabled
              className="w-full h-[54px] rounded-2xl text-sm font-bold bg-cut-green text-cut-bg opacity-60"
              style={{ letterSpacing: '0.2px' }}
            >
              {selectedPlan === 'free' ? 'Continue with Free' : 'Start 7-day Free Trial →'}
            </button>
            <p className="text-center text-[11px] text-cut-gold font-semibold" style={{ letterSpacing: '0.4px' }}>
              DESIGN PREVIEW — GOES LIVE WITH THE FREEMIUM LAUNCH · PRICING ILLUSTRATIVE
            </p>
          </div>
        ) : (
        <button
          onClick={() => onPurchase(selectedPlan)}
          disabled={checkoutLoading !== null || !offersReady}
          className="w-full h-[54px] rounded-2xl text-sm font-bold bg-cut-green text-cut-bg transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.22)', letterSpacing: '0.2px' }}
        >
          {/* #5: trial wording appears only when the store's real offer (and,
              on iOS, this user's eligibility) supports it; otherwise a plain
              "Subscribe". On native the button stays disabled until the
              offering is actually loaded, so a tap can never precede terms. */}
          {ctaLabel}
        </button>
        )}

        {checkoutError && (
          <p className="text-sm text-center max-w-sm mx-auto" style={{ color: '#E5695E' }}>{checkoutError}</p>
        )}

        {/* Data preservation note */}
        <p className="text-cut-ink-mute text-xs text-center">
          Your existing progress, rounds, sessions and coaching history are all saved and will be waiting for you when you subscribe.
        </p>

        {FREEMIUM_PREVIEW ? null : <Disclosure byPlan={native ? offerState.byPlan : undefined} />}

        {FREEMIUM_PREVIEW ? null : (<>
        {/* Restore — required by Apple on the native paywall */}
        <div className="text-center space-y-3">
          {!native && <p className="text-cut-ink-mute text-xs">Already subscribed? Tap below to refresh your access.</p>}
          <button
            onClick={onRestore}
            disabled={restoring}
            className="flex items-center gap-2 mx-auto px-6 py-3 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 cut-glass text-cut-ink-soft"
          >
            <RefreshCw className="w-4 h-4" />
            {restoring ? 'Checking...' : native ? 'Restore Purchases' : 'Restore Access'}
          </button>
          {restoreMsg && <p className="text-cut-ink-mute text-xs max-w-xs mx-auto">{restoreMsg}</p>}
        </div>

        {/* Sign out — escape hatch for users who need to switch accounts */}
        <div className="text-center pt-2">
          <p className="text-cut-ink-mute text-xs mb-2">Signed in as {user?.email}</p>
          <button
            onClick={() => logout()}
            className="text-cut-ink-mute text-xs underline underline-offset-4 transition-colors"
          >
            Sign out
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
}
