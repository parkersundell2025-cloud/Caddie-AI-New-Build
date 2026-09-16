import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { hasActiveAccess } from '@/lib/subscription';
import Logo from '@/components/layout/Logo';

// The access decision lives in @/lib/subscription (hasActiveAccess) so this
// gate, Gateway, RootRoute, the paywall and the activation screen all agree (#7).
const hasActiveSubscription = hasActiveAccess;

export default function SubscriptionGate({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    // Resilient check with retry. On rate-limit (429) or other transient errors
    // we MUST NOT redirect to /subscribe-now — that locks out paying users
    // when Base44 throttles. Retry with backoff; only redirect on a confirmed
    // "no profile" / "expired" answer.
    const check = async (attempt = 0) => {
      try {
        const user = await getCurrentUser();
        if (!user) { setStatus('ready'); return; }
        const profiles = await unwrap(
          supabase.from('user_profile').select('*').eq('user_email', user.email)
        );
        if (cancelled) return;
        if (profiles.length === 0) {
          setStatus('subscribe');
          return;
        }
        setStatus(hasActiveSubscription(profiles[0]) ? 'ready' : 'subscribe');
      } catch (err) {
        const message = String(err?.message || err);
        const isTransient = message.includes('Rate limit')
          || message.includes('429')
          || message.includes('Network')
          || message.includes('timeout');
        if (isTransient && attempt < 3 && !cancelled) {
          const delay = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
          setTimeout(() => check(attempt + 1), delay);
          return;
        }
        // After retries exhausted, fail open — RootRoute already verified
        // this user, so a stuck SubscriptionGate fetch shouldn't lock them out.
        if (!cancelled) setStatus('ready');
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
        <Logo size="lg" />
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'subscribe') {
    return <Navigate to="/subscribe-now" replace />;
  }

  return children;
}
