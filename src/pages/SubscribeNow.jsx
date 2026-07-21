import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Zap, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/layout/Logo';
import { isNative, getPlatform, openExternal, NATIVE_URL_SCHEME } from '@/lib/platform';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  planForPackage,
  hasAnyActiveEntitlement,
} from '@/lib/revenuecat';

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

function PlanRow({ plan, selected, onSelect }) {
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
        <p className="text-[11px] text-cut-ink-mute mt-0.5 truncate">{plan.sub}</p>
      </div>
      <div className="flex items-baseline gap-0.5 flex-shrink-0">
        <span className="font-mono text-lg font-bold text-cut-ink" style={{ letterSpacing: '-0.6px' }}>{plan.price}</span>
        <span className="font-mono text-[11px] font-semibold text-cut-ink-mute">{plan.per}</span>
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
function Disclosure() {
  return (
    <div className="text-cut-ink-mute text-xs text-center leading-relaxed space-y-2 max-w-md mx-auto px-2">
      <p>
        <span className="text-cut-ink-soft font-semibold">Caddie AI Basic — $15/month</span> · Auto-renewing monthly subscription.
        <br />
        <span className="text-cut-ink-soft font-semibold">Caddie AI Pro — $29/month</span> · Auto-renewing monthly subscription.
      </p>
      <p>
        Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period, at the same price. You can manage and cancel your subscriptions at any time in your Apple ID account settings after purchase.
      </p>
      <p>
        <a href="/terms" className="underline text-cut-ink-soft">Terms of Use (EULA)</a>
        {' · '}
        <a href="/privacy" className="underline text-cut-ink-soft">Privacy Policy</a>
      </p>
    </div>
  );
}

function Hero() {
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
        Start your 7-day free trial. Cancel anytime. No commitment.
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
  const [selectedPlan, setSelectedPlan] = useState(FREEMIUM_PREVIEW ? 'pro_annual' : 'pro');
  // Per-plan loading state so we can disable the relevant button while we
  // wait for the Checkout Session URL.
  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'basic' | 'pro' | null
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    // Persist ref code from URL into localStorage so it survives Stripe checkout redirect
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) localStorage.setItem('caddie_ref_code', refCode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Design preview renders for anyone (even signed-out / subscribed
    // viewers) — it exists to be looked at, not purchased from
    if (FREEMIUM_PREVIEW) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    const init = async () => {
      const u = await getCurrentUser();
      if (!u) {
        const urlParams = new URLSearchParams(window.location.search);
        const emailParam = urlParams.get('email');
        const next = emailParam ? `/signin?email=${encodeURIComponent(emailParam)}` : '/signin';
        navigate(next, { replace: true });
        return;
      }
      if (cancelled) return;
      setUser(u);

      // If they already have an active subscription or active trial, don't show
      // them the plan selection again. A user who just completed Stripe checkout
      // has subscription_status='trial' + a stripe_subscription_id — keeping
      // them on this page would imply they need to subscribe again.
      const profiles = await unwrap(
        supabase.from('user_profile').select('*').eq('user_email', u.email)
      );
      if (cancelled) return;
      const profile = profiles[0];
      const today = new Date().toISOString().split('T')[0];
      const hasPaymentLinkage = !!profile?.stripe_customer_id || !!profile?.revenuecat_app_user_id;
      const isPaidSub = profile && ['basic', 'pro'].includes(profile.subscription_status) && profile.stripe_subscription_id;
      const isValidTrial = profile && profile.subscription_status === 'trial' && hasPaymentLinkage && profile.trial_end_date && profile.trial_end_date >= today;
      const isCancellingButActive = profile && profile.subscription_status === 'cancelling' && hasPaymentLinkage && (!profile.trial_end_date || profile.trial_end_date >= today);

      if (isPaidSub || isValidTrial || isCancellingButActive) {
        // Onboarding not done → send to onboarding flow first
        if (!profile.onboarding_complete) {
          navigate('/onboarding', { replace: true });
          return;
        }
        navigate('/home', { replace: true });
        return;
      }

      if (window.fbq) window.fbq('track', 'InitiateCheckout');
      setLoading(false);
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
      if (document.visibilityState === 'visible') init();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  // Server-side Stripe Checkout Session: createStripeCheckoutSession edge fn
  // creates a Session attached to the Supabase auth user's UUID
  // (client_reference_id + metadata.rc_app_user_id), then we redirect the
  // browser to the Stripe-hosted checkout page. Replaces the buy.stripe.com
  // payment links which couldn't carry user identity through to RC.
  const startCheckout = async (plan) => {
    setCheckoutLoading(plan);
    setCheckoutError('');
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

    const { data, error } = await supabase.functions.invoke('createStripeCheckoutSession', { body });
    if (error || !data?.session_url) {
      setCheckoutError("Something went wrong starting checkout. Please try again or email support@caddieaiapp.com.");
      setCheckoutLoading(null);
      return;
    }
    await openExternal(data.session_url);
  };

  const handleRestoreAccess = async () => {
    setRestoring(true);
    setRestoreMsg('');
    try {
      const profiles = await unwrap(
        supabase.from('user_profile').select('*').eq('user_email', user.email)
      );
      const profile = profiles[0];
      const activeStatuses = ['basic', 'pro'];
      if (profile && activeStatuses.includes(profile.subscription_status) && profile.stripe_subscription_id) {
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

    // If RC can't produce a purchasable package (key missing, offering not
    // configured, store products not yet propagated, network failure) the
    // handling differs by store:
    //   - Android: Google Play policy REQUIRES Play Billing for digital subs.
    //     Falling back to the Stripe web checkout would be a policy violation,
    //     so we surface a retryable error instead and never open the browser.
    //   - iOS: the App Store tolerated the Stripe fallback during the RC
    //     rollout (see 3.1.1 note), so it's preserved for that platform only.
    const offering = await getOfferings();
    const pkg = offering?.availablePackages?.find((p) => planForPackage(p) === plan);
    if (!pkg) {
      setCheckoutLoading(null);
      if (getPlatform() === 'android') {
        setCheckoutError('The store is still setting up this subscription. Please try again in a few minutes.');
        return;
      }
      startCheckout(plan);
      return;
    }

    try {
      await purchasePackage(pkg);
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
      if (!err?.userCancelled && !/cancel/i.test(err?.message || '')) {
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

  return (
    <div className="min-h-screen px-5 py-8 flex flex-col items-center" style={GROUND}>
      <div className="w-full max-w-lg mx-auto space-y-6">
        <Hero />

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
          {(FREEMIUM_PREVIEW ? FREEMIUM_PLANS : PLANS).map((p) => (
            <PlanRow key={p.id} plan={p} selected={selectedPlan === p.id} onSelect={setSelectedPlan} />
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
          disabled={checkoutLoading !== null}
          className="w-full h-[54px] rounded-2xl text-sm font-bold bg-cut-green text-cut-bg transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.22)', letterSpacing: '0.2px' }}
        >
          {checkoutLoading ? 'Loading…' : `Subscribe — ${selectedPlan === 'pro' ? 'Pro' : 'Basic'} →`}
        </button>
        )}

        {checkoutError && (
          <p className="text-sm text-center max-w-sm mx-auto" style={{ color: '#E5695E' }}>{checkoutError}</p>
        )}

        {/* Data preservation note */}
        <p className="text-cut-ink-mute text-xs text-center">
          Your existing progress, rounds, sessions and coaching history are all saved and will be waiting for you when you subscribe.
        </p>

        {FREEMIUM_PREVIEW ? null : <Disclosure />}

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
