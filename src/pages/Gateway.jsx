import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { isNative } from '@/lib/platform';
import { hasActiveAccess } from '@/lib/subscription';
import Logo from '@/components/layout/Logo';

// Access decision is centralized in @/lib/subscription so Gateway, RootRoute,
// SubscriptionGate, the paywall and the activation screen all agree (#7).
const hasAccess = hasActiveAccess;

// Supabase exchanges the magic-link / OAuth token in the URL into a session
// asynchronously (detectSessionInUrl). Wait briefly for that to land.
const waitForSession = async (timeoutMs = 6000) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return new Promise((resolve) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve(s);
      }
    });
    const timer = setTimeout(() => {
      subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
};

export default function Gateway() {
  const navigate = useNavigate();

  useEffect(() => {
    // Persist ref code from URL into localStorage so it survives through checkout
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) localStorage.setItem('caddie_ref_code', refCode);
    // #6: a direct/deep link may carry the chosen tier; persist it so the
    // paywall honors it. (The auth redirect itself strips params — SignIn
    // persists it before the round-trip for that path.)
    const plan = urlParams.get('plan');
    if (plan === 'basic' || plan === 'pro') localStorage.setItem('caddie_selected_plan', plan);
  }, []);

  useEffect(() => {
    const route = async () => {
      try {
        const session = await waitForSession();
        if (!session) {
          navigate('/signin', { replace: true });
          return;
        }

        const email = session.user.email;

        // Profile lookup retry policy is platform-aware:
        //   - Native (iOS): keep a small retry budget so an in-flight RC
        //     INITIAL_PURCHASE webhook (which CREATES the profile for first-
        //     time iOS subscribers) has time to land between sign-in and
        //     this lookup.
        //   - Web: skip retries — for OAuth sign-ins (Apple/Google) and
        //     email magic-link, no webhook creates a profile during sign-in.
        //     completeStripeCheckout creates the profile after Stripe
        //     Checkout, but that flow runs on /checkout/success, not here.
        //     Polling here for web wasted up to 8s of blank time before
        //     bailing to /subscribe-now, which felt broken to users.
        const POLL_ATTEMPTS = isNative() ? 3 : 1;
        const POLL_INTERVAL_MS = isNative() ? 1000 : 0;

        let profile = null;
        for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
          const profiles = await unwrap(
            supabase.from('user_profile').select('*').eq('user_email', email)
          );
          if (profiles.length > 0) {
            profile = profiles[0];
            break;
          }
          if (attempt < POLL_ATTEMPTS - 1 && POLL_INTERVAL_MS > 0) {
            await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
          }
        }

        // No profile found after retries — try Stripe fallback (handles Google/Apple email mismatch)
        if (!profile) {
          try {
            const { data } = await supabase.functions.invoke('findProfileByStripeCustomer', {
              body: { email },
            });
            if (data?.found && data?.profile) {
              profile = data.profile;
            }
          } catch (err) {
            console.error('[Gateway] Stripe fallback failed:', err);
          }
        }

        // Paywall-last flow: onboarding comes BEFORE payment now, so a brand-new
        // user with no profile goes to onboarding (which creates the profile),
        // not to the paywall.
        if (!profile) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Profile exists but onboarding not finished — resume onboarding.
        if (!profile.onboarding_complete) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Onboarded but no valid subscription — this is the paywall moment.
        if (!hasAccess(profile)) {
          navigate('/subscribe-now', { replace: true });
          return;
        }

        // Everything good — send to home
        navigate('/home', { replace: true });
      } catch (err) {
        console.error('[Gateway] error:', err);
        navigate('/signin', { replace: true });
      }
    };

    route();
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
      <Logo size="lg" />
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Getting your account ready...</p>
      </div>
    </div>
  );
}
