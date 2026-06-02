import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isAuthenticated } from '@/lib/db';
import { supabase } from '@/lib/supabase';

// Thin redirect page hit via /checkout?plan=basic|pro. Verifies the user is
// signed in, asks createStripeCheckoutSession for a Session URL, then sends
// the browser to Stripe's hosted checkout. Replaces the old buy.stripe.com
// payment-link redirect — same external entry point, new server-side flow.
export default function SubscriptionCheckout() {
  const [searchParams] = useSearchParams();
  const hasRedirected = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasRedirected.current) return;

    const run = async () => {
      const isAuthed = await isAuthenticated();
      if (!isAuthed) {
        window.location.assign('/signin');
        return;
      }

      const planParam = (searchParams.get('plan') || 'basic').toLowerCase();
      const plan = ['basic', 'pro'].includes(planParam) ? planParam : 'basic';

      const { data, error: invErr } = await supabase.functions.invoke('createStripeCheckoutSession', {
        body: {
          plan,
          return_url_origin: window.location.origin,
        },
      });

      if (invErr || !data?.session_url) {
        setError("Something went wrong starting checkout. Try again or email support@caddieaiapp.com.");
        return;
      }

      hasRedirected.current = true;
      window.location.assign(data.session_url);
    };

    run();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 gap-6">
      {error ? (
        <p className="text-destructive text-sm text-center max-w-sm">{error}</p>
      ) : (
        <>
          <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
          <p className="text-muted-foreground">Redirecting to checkout...</p>
        </>
      )}
    </div>
  );
}
