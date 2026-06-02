import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import Logo from '@/components/layout/Logo';

const hasAccess = (profile) => {
  if (!profile) return false;

  // Must have either a Stripe linkage (web subs) or a RevenueCat linkage (iOS/Android subs)
  const hasPaymentLinkage = !!profile.stripe_customer_id || !!profile.revenuecat_app_user_id;
  if (!hasPaymentLinkage) return false;

  // Trial state additionally requires the trial not be expired
  if (profile.subscription_status === 'trial') {
    if (!profile.trial_end_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return profile.trial_end_date >= today;
  }

  // 'cancelling' = user opted to cancel at period end, still has paid access
  // until period end. Don't lock them out — they paid for this time.
  if (profile.subscription_status === 'cancelling') {
    if (!profile.trial_end_date) return true;
    const today = new Date().toISOString().split('T')[0];
    return profile.trial_end_date >= today;
  }

  return ['basic', 'pro'].includes(profile.subscription_status);
};

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

        // Retry up to 5 times if no profile found (webhook may not have fired yet)
        let profile = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const profiles = await unwrap(
            supabase.from('user_profile').select('*').eq('user_email', email)
          );
          if (profiles.length > 0) {
            profile = profiles[0];
            break;
          }
          if (attempt < 4) {
            await new Promise((res) => setTimeout(res, 2000));
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

        // Still no profile — send to subscribe
        if (!profile) {
          navigate('/subscribe-now', { replace: true });
          return;
        }

        // Has profile but no valid subscription — send to subscribe
        if (!hasAccess(profile)) {
          navigate('/subscribe-now', { replace: true });
          return;
        }

        // Has valid subscription but onboarding not complete — new user, fire CompleteRegistration
        if (!profile.onboarding_complete) {
          if (window.fbq) window.fbq('track', 'CompleteRegistration');
          navigate('/onboarding', { replace: true });
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
