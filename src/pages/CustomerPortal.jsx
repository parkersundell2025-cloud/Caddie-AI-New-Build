import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/layout/Logo';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default function CustomerPortal() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (isIOS) return;
    let cancelled = false;
    (async () => {
      // Return user to /manage-subscription so they see the updated state.
      // Origin-relative so localhost dev and prod both work.
      const returnUrl = `${window.location.origin}/manage-subscription`;
      const { data, error: invErr } = await supabase.functions.invoke('createStripePortalSession', {
        body: { return_url: returnUrl },
      });
      if (cancelled) return;
      if (invErr) {
        setError("Couldn't open the billing portal. Try again in a moment, or contact support@caddieaiapp.com.");
        return;
      }
      if (!data?.url) {
        setError(data?.error || 'Billing portal unavailable for this account.');
        return;
      }
      window.location.href = data.url;
    })();
    return () => { cancelled = true; };
  }, []);

  if (isIOS) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}
      >
        <Logo size="lg" />
        <div className="space-y-4 max-w-sm">
          <p className="text-base font-semibold text-white">Manage your subscription in iOS Settings.</p>
          <p className="text-sm" style={{ color: 'rgba(249,249,247,0.6)' }}>
            Go to Settings → Apple ID → Subscriptions → Caddie AI
          </p>
          <a
            href="itms-apps://apps.apple.com/account/subscriptions"
            className="block w-full py-4 rounded-full font-bold text-sm text-center mt-4 active:scale-95 transition-all"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            Manage Subscription in iOS Settings →
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}
      >
        <Logo size="lg" />
        <div className="space-y-4 max-w-sm">
          <p className="text-base font-semibold text-white">Billing portal unavailable</p>
          <p className="text-sm" style={{ color: 'rgba(249,249,247,0.7)' }}>{error}</p>
          <button
            onClick={() => navigate('/manage-subscription')}
            className="block w-full py-4 rounded-full font-bold text-sm text-center mt-4 active:scale-95 transition-all"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
      style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}
    >
      <Logo size="lg" />
      <div className="flex flex-col items-center gap-4 mt-4">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-sm font-medium" style={{ color: 'rgba(249,249,247,0.75)' }}>
          Opening your billing portal...
        </p>
      </div>
    </div>
  );
}
