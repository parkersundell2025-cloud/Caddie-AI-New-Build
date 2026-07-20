import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isNative, openExternal, NATIVE_URL_SCHEME } from '@/lib/platform';
import Logo from '@/components/layout/Logo';

// NOTE: We intentionally do NOT gate on user agent here. Anyone reaching
// /customerportal has been routed through getUpgradeTarget(), which sends
// Apple IAP subscribers to `itms-apps://` directly. By the time a user lands
// here, their subscription is in Stripe — regardless of which device they're
// holding. Previous versions of this page checked `navigator.userAgent` and
// showed iOS subscribers a deep link to Apple's Subscriptions panel; for a
// user with a Stripe sub on an iPhone, that panel correctly reports "no
// subscriptions" and the upgrade flow dies.
export default function CustomerPortal() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Return URL: on web, return to whichever origin we came from. On
      // native, use the caddieai:// custom URL scheme — iOS detects the
      // scheme, closes SafariViewController, and fires the Capacitor App
      // plugin's appUrlOpen back into the SPA. Universal Links would be
      // theoretically cleaner but they're unreliable from SafariViewController
      // context (Apple's routing differs from regular Safari), so the custom
      // scheme is what every native Stripe flow in this codebase uses.
      const returnUrl = isNative()
        ? `${NATIVE_URL_SCHEME}://manage-subscription`
        : `${window.location.origin}/manage-subscription`;

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
      // openExternal() routes via Capacitor Browser (SafariViewController) on
      // native and a plain window.location on web. We don't navigate the
      // WKWebView itself — Stripe's CSP rejects that and the user gets
      // trapped on the portal page with no way back.
      await openExternal(data.url);

      // On native, the SafariViewController is layered on top of the WebView.
      // If the user taps the X to dismiss (instead of completing the flow and
      // triggering the caddieai:// return URL), they'd land back on this
      // perpetual-spinner page. Navigate the WebView underneath to
      // /manage-subscription so dismiss/complete both land there cleanly.
      if (isNative() && !cancelled) {
        navigate('/manage-subscription', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ backgroundColor: '#0F1714', color: '#F4EFE3' }}
      >
        <Logo size="lg" />
        <div className="space-y-4 max-w-sm">
          <p className="text-base font-semibold text-white">Billing portal unavailable</p>
          <p className="text-sm" style={{ color: 'rgba(249,249,247,0.7)' }}>{error}</p>
          <button
            onClick={() => navigate('/manage-subscription')}
            className="block w-full py-4 rounded-full font-bold text-sm text-center mt-4 active:scale-95 transition-all"
            style={{ backgroundColor: '#5FBE7E', color: '#0F1714' }}
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
      style={{ backgroundColor: '#0F1714', color: '#F4EFE3' }}
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
