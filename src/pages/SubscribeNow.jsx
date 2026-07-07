import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default function SubscribeNow() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
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
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5" style={{ backgroundColor: '#1a2e1a' }}>
        <Logo size="lg" />
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Native app (iOS + Android): store IAP flow via RevenueCat ───────
  // Must be isNative(), NOT isIOS: the old iPad/iPhone user-agent check
  // excluded Android, so the Android app fell through to the web/Stripe
  // layout below and never reached the native Play Billing path — a Google
  // Play policy violation and the reason Android purchases opened Chrome.
  // handleIOSPurchase works for both stores (RC purchasePackage is
  // cross-platform); mobile Safari / desktop web still get the web layout.
  if (isNative()) {
    return (
      <div className="min-h-screen px-6 py-10 flex flex-col items-center" style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}>
        <div className="w-full max-w-lg mx-auto space-y-10">
          <div className="flex justify-center" style={{ filter: 'brightness(0) invert(1)' }}><Logo size="md" /></div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
            <h1 className="text-4xl font-black text-white leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              Welcome to Caddie AI 👋
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              Subscribe through the app — tap below to get started with your free trial.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
            {/* Basic IAP button */}
            <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#a8d5a2' }}>Basic</p>
                <p className="text-3xl font-black text-white mb-1">$15<span className="text-base font-normal text-white/50">/mo</span></p>
                <p className="text-sm text-white/60">Personalized practice plans · AI coach · Handicap tracking · Leaderboard & badges</p>
              </div>
              <button
                onClick={() => handleIOSPurchase('basic')}
                className="w-full py-3.5 rounded-full font-bold text-sm text-center transition-all active:scale-95"
                style={{ backgroundColor: 'rgba(168,213,162,0.15)', color: '#a8d5a2', border: '1.5px solid rgba(168,213,162,0.4)' }}
              >
                Subscribe — Basic →
              </button>
            </div>

            {/* Pro IAP button */}
            <div className="rounded-2xl p-6 flex flex-col gap-4 relative" style={{ backgroundColor: 'rgba(168,213,162,0.12)', border: '2px solid rgba(168,213,162,0.6)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}>Most Popular</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#a8d5a2' }}>Pro</p>
                <p className="text-3xl font-black text-white mb-1">$29<span className="text-base font-normal text-white/50">/mo</span></p>
                <p className="text-sm text-white/60">Everything in Basic · Monthly Game Plan · Pre-Round Game Plan · Weekly Report · Competitor Intel</p>
              </div>
              <button
                onClick={() => handleIOSPurchase('pro')}
                className="w-full py-3.5 rounded-full font-bold text-sm text-center transition-all active:scale-95"
                style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
              >
                Subscribe — Pro →
              </button>
            </div>
          </motion.div>

          <p className="text-white/40 text-xs text-center">
            Your existing progress, rounds, sessions and coaching history are all saved and will be waiting for you when you subscribe.
          </p>

          {/* Apple 3.1.2(c): subscription title/length/price + Terms (EULA) +
              Privacy Policy must be visible within the app on the paywall.
              Build #34 was rejected for missing the Terms + Privacy links here. */}
          <div className="text-white/40 text-xs text-center leading-relaxed space-y-2 max-w-md mx-auto px-2">
            <p>
              <span className="text-white/70 font-semibold">Caddie AI Basic — $15/month</span> · Auto-renewing monthly subscription.
              <br />
              <span className="text-white/70 font-semibold">Caddie AI Pro — $29/month</span> · Auto-renewing monthly subscription.
            </p>
            <p>
              Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period, at the same price. You can manage and cancel your subscriptions at any time in your Apple ID account settings after purchase.
            </p>
            <p>
              <a href="/terms" className="underline text-white/70">Terms of Use (EULA)</a>
              {' · '}
              <a href="/privacy" className="underline text-white/70">Privacy Policy</a>
            </p>
          </div>

          {/* Restore Purchases — required by Apple */}
          <div className="text-center space-y-3">
            <button
              onClick={handleIOSRestore}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-full text-sm font-semibold transition-all active:scale-95"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Restore Purchases
            </button>
          </div>

          {/* Sign out — escape hatch for users who need to switch accounts */}
          <div className="text-center pt-2">
            <p className="text-white/40 text-xs mb-2">Signed in as {user?.email}</p>
            <button
              onClick={() => logout()}
              className="text-white/50 text-xs underline underline-offset-4 hover:text-white/80 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Web: existing Stripe flow ──────────────────────────────────────
  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center" style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}>
      <div className="w-full max-w-lg mx-auto space-y-10">

        {/* Logo */}
        <div className="flex justify-center" style={{ filter: 'brightness(0) invert(1)' }}>
          <Logo size="md" />
        </div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <h1 className="text-4xl font-black text-white leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
            Welcome to Caddie AI 👋
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Start your 7-day free trial. Cancel anytime. No commitment.
          </p>
        </motion.div>

        {/* Plan cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* Basic */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#a8d5a2' }}>Basic</p>
              <p className="text-3xl font-black text-white">$15<span className="text-base font-normal text-white/50">/mo</span></p>
            </div>
            <ul className="space-y-1.5 text-sm text-white/70 flex-1">
              <li>✓ Personalized practice plans</li>
              <li>✓ AI coach</li>
              <li>✓ Handicap tracking</li>
              <li>✓ Leaderboard & badges</li>
            </ul>
            <button
              onClick={() => startCheckout('basic')}
              disabled={checkoutLoading !== null}
              className="w-full block py-3.5 rounded-full font-bold text-sm text-center transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: 'rgba(168,213,162,0.15)', color: '#a8d5a2', border: '1.5px solid rgba(168,213,162,0.4)' }}
            >
              {checkoutLoading === 'basic' ? 'Loading…' : 'Choose Basic →'}
            </button>
          </div>

          {/* Pro — highlighted */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 relative"
            style={{ backgroundColor: 'rgba(168,213,162,0.12)', border: '2px solid rgba(168,213,162,0.6)' }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}>
                Most Popular
              </span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#a8d5a2' }}>Pro</p>
              <p className="text-3xl font-black text-white">$29<span className="text-base font-normal text-white/50">/mo</span></p>
            </div>
            <ul className="space-y-1.5 text-sm text-white/70 flex-1">
              <li>✓ Everything in Basic</li>
              <li>✓ Monthly Game Plan</li>
              <li>✓ Pre-Round Game Plan</li>
              <li>✓ Weekly Report</li>
              <li>✓ Competitor Intel</li>
            </ul>
            <button
              onClick={() => startCheckout('pro')}
              disabled={checkoutLoading !== null}
              className="w-full block py-3.5 rounded-full font-bold text-sm text-center transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
            >
              {checkoutLoading === 'pro' ? 'Loading…' : 'Choose Pro →'}
            </button>
          </div>
        </motion.div>

        {checkoutError && (
          <p className="text-red-300 text-sm text-center max-w-sm mx-auto">{checkoutError}</p>
        )}

        {/* Data preservation note */}
        <p className="text-white/40 text-xs text-center">
          Your existing progress, rounds, sessions and coaching history are all saved and will be waiting for you when you subscribe.
        </p>

        {/* Auto-renew disclosure — required by Apple for IAP listings */}
        <div className="text-white/40 text-xs text-center leading-relaxed space-y-2 max-w-md mx-auto px-2">
          <p>
            <span className="text-white/60 font-semibold">Caddie AI Basic — $15/month</span> · Auto-renewing monthly subscription.
            <br />
            <span className="text-white/60 font-semibold">Caddie AI Pro — $29/month</span> · Auto-renewing monthly subscription.
          </p>
          <p>
            Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period, at the same price. You can manage and cancel your subscriptions at any time in your Apple ID account settings after purchase.
          </p>
          <p>
            <a href="/terms" className="underline">Terms of Use (EULA)</a>
            {' · '}
            <a href="/privacy" className="underline">Privacy Policy</a>
          </p>
        </div>

        {/* Restore access */}
        <div className="text-center space-y-3">
          <p className="text-white/40 text-xs">Already subscribed? Tap below to refresh your access.</p>
          <button
            onClick={handleRestoreAccess}
            disabled={restoring}
            className="px-6 py-3 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {restoring ? 'Checking...' : 'Restore Access'}
          </button>
          {restoreMsg && <p className="text-white/50 text-xs max-w-xs mx-auto">{restoreMsg}</p>}
        </div>

        {/* Sign out — escape hatch for users who need to switch accounts */}
        <div className="text-center pt-2">
          <p className="text-white/40 text-xs mb-2">Signed in as {user?.email}</p>
          <button
            onClick={() => logout()}
            className="text-white/50 text-xs underline underline-offset-4 hover:text-white/80 transition-colors"
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}