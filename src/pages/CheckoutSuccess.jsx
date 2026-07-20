import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/layout/Logo';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isAuthenticated, getCurrentUser, unwrap } from '@/lib/db';

// Landing page after a successful Stripe Checkout.
//
// Behavior depends on whether the user is already signed in:
//   - SIGNED IN (the new flow — they were authenticated before purchasing):
//     poll user_profile.subscription_status until it flips from 'expired' to
//     anything else (which means the RC webhook landed). Then auto-redirect
//     to / so RootRoute hands them to /home. If polling times out after
//     ~30 seconds without an update, fall back to a manual "Continue to
//     Caddie AI" button.
//   - SIGNED OUT (the legacy anonymous-purchase flow — purchased via the old
//     buy.stripe.com link without first creating a Supabase auth user): show
//     the original "Sign in to access your account" CTA.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState('checking'); // checking | activating | ready | manual | unauth

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const init = async () => {
      const authed = await isAuthenticated();
      if (cancelled) return;
      if (!authed) {
        setPhase('unauth');
        return;
      }
      setPhase('activating');

      const user = await getCurrentUser();
      if (cancelled || !user?.email) {
        setPhase('unauth');
        return;
      }

      // Kick off the Stripe ID hydration in parallel with the polling loop.
      // The RC webhook updates subscription_status/trial_end_date, but does
      // not write stripe_customer_id / stripe_subscription_id /
      // subscription_source — completeStripeCheckout retrieves those from
      // the Checkout Session and writes them. Fire-and-forget: a failure
      // here doesn't block activation since the RC webhook still updates
      // the access-gating fields independently.
      const sessionIdToHydrate = searchParams.get('session_id');
      if (sessionIdToHydrate) {
        supabase.functions
          .invoke('completeStripeCheckout', { body: { session_id: sessionIdToHydrate } })
          .then(({ data, error }) => {
            if (error) {
              console.warn('[CheckoutSuccess] completeStripeCheckout error:', error.message);
            } else if (data?.success) {
              console.log('[CheckoutSuccess] Stripe IDs hydrated:', data.updated);
            }
          })
          .catch((e) => console.warn('[CheckoutSuccess] completeStripeCheckout threw:', e?.message));
      }

      const start = Date.now();
      const poll = async () => {
        if (cancelled) return;
        try {
          const rows = await unwrap(
            supabase
              .from('user_profile')
              .select('subscription_status, revenuecat_app_user_id, stripe_customer_id')
              .eq('user_email', user.email),
          );
          const profile = rows?.[0];
          // Webhook has landed if subscription_status is anything other than
          // 'expired' AND there's a payment linkage (covers brand-new
          // accounts that are seeded 'expired' too).
          if (
            profile &&
            profile.subscription_status &&
            profile.subscription_status !== 'expired' &&
            (profile.revenuecat_app_user_id || profile.stripe_customer_id)
          ) {
            cancelled = true;
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            setPhase('ready');
            // Hand off to RootRoute — it routes /home or /onboarding.
            window.location.assign('/');
            return;
          }
        } catch (e) {
          // Soft fail; we'll try again on the next poll tick.
          console.warn('[CheckoutSuccess] poll error:', e?.message);
        }
        if (Date.now() - start >= POLL_TIMEOUT_MS) {
          cancelled = true;
          if (pollTimer) clearInterval(pollTimer);
          setPhase('manual');
        }
      };

      // Immediate first attempt — webhook may have already fired between
      // checkout completion and this page mounting.
      poll();
      pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      timeoutTimer = setTimeout(() => {
        if (cancelled) return;
        cancelled = true;
        if (pollTimer) clearInterval(pollTimer);
        setPhase('manual');
      }, POLL_TIMEOUT_MS);
    };

    init();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, []);

  const sessionId = searchParams.get('session_id');

  return (
    <div
      style={{ background: 'radial-gradient(120% 60% at 100% 0%, rgba(95,190,126,.10) 0%, transparent 50%), linear-gradient(180deg, #0F1714 0%, #0B0F0C 60%)' }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
    >
      <div className="w-full mb-10 flex justify-center" style={{ filter: 'brightness(0) invert(1)' }}>
        <Logo size="md" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto space-y-8 text-center"
      >
        {/* Checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10, delay: 0.1 }}
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0E4D2B, #5FBE7E)', boxShadow: '0 0 30px rgba(95,190,126,.30)' }}
        >
          <CheckCircle2 className="w-14 h-14" style={{ color: '#F4EFE3' }} />
        </motion.div>

        {/* Headline + body by phase */}
        {phase === 'checking' && (
          <div className="space-y-3">
            <h1 className="cut-headline text-3xl leading-tight" style={{ color: '#F4EFE3' }}>
              You're in. Welcome to Caddie AI.
            </h1>
            <p className="text-cut-ink-soft text-sm leading-relaxed">Your payment was received.</p>
          </div>
        )}

        {phase === 'activating' && (
          <div className="space-y-4">
            <h1 className="cut-headline text-3xl leading-tight" style={{ color: '#F4EFE3' }}>
              You're in. Welcome to Caddie AI.
            </h1>
            <p className="text-cut-ink-soft text-sm leading-relaxed">
              Activating your subscription… we'll take you to your account in a moment.
            </p>
            <div className="flex justify-center pt-2">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(244,239,227,.15)', borderTopColor: '#5FBE7E' }} />
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-3">
            <h1 className="cut-headline text-3xl leading-tight" style={{ color: '#F4EFE3' }}>
              All set. Taking you in…
            </h1>
          </div>
        )}

        {phase === 'manual' && (
          <>
            <div className="space-y-3">
              <h1 className="cut-headline text-3xl leading-tight" style={{ color: '#F4EFE3' }}>
                You're in. Welcome to Caddie AI.
              </h1>
              <p className="text-cut-ink-soft text-sm leading-relaxed">
                Your payment was received. Tap below to continue.
              </p>
            </div>
            <div className="h-px w-full" style={{ backgroundColor: 'rgba(244,239,227,.10)' }} />
            <div className="space-y-4">
              <a
                href="/"
                className="w-full block py-4 rounded-full font-bold text-base text-center transition-all active:scale-95"
                style={{ backgroundColor: '#5FBE7E', color: '#0B0F0C', boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
              >
                Continue to Caddie AI →
              </a>
              <p className="text-cut-ink-mute text-xs text-center">
                If you're not redirected, your subscription is still active — just continue above.
              </p>
            </div>
          </>
        )}

        {phase === 'unauth' && (
          <>
            <div className="space-y-3">
              <h1 className="cut-headline text-3xl leading-tight" style={{ color: '#F4EFE3' }}>
                You're in. Welcome to Caddie AI.
              </h1>
              <p className="text-cut-ink-soft text-sm leading-relaxed">
                Your payment was received. Sign in to access your account.
              </p>
            </div>
            <div className="h-px w-full" style={{ backgroundColor: 'rgba(244,239,227,.10)' }} />
            <div className="space-y-4">
              <a
                href="/signin"
                className="w-full block py-4 rounded-full font-bold text-base text-center transition-all active:scale-95"
                style={{ backgroundColor: '#5FBE7E', color: '#0B0F0C', boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
              >
                Sign In to Caddie AI →
              </a>
              <p className="text-cut-ink-mute text-xs text-center">Sign in with the email you used at checkout.</p>
            </div>
          </>
        )}

        <p className="text-cut-ink-mute text-xs">
          Questions? Email us at{' '}
          <a href="mailto:support@caddieaiapp.com" className="underline" style={{ color: '#5FBE7E' }}>
            support@caddieaiapp.com
          </a>
        </p>

        {sessionId && phase === 'manual' && (
          <p className="text-cut-ink-mute text-[10px] mt-4 break-all">Reference: {sessionId}</p>
        )}
      </motion.div>
    </div>
  );
}
