import { useEffect } from 'react';
import Logo from '@/components/layout/Logo';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/4gM8wI4u9gWk3wA3jU7ok00';

export default function CustomerPortal() {
  useEffect(() => {
    if (isIOS) return; // Don't auto-redirect on iOS
    const timer = setTimeout(() => {
      window.location.href = STRIPE_PORTAL_URL;
    }, 1000);
    return () => clearTimeout(timer);
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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
      style={{ backgroundColor: '#1a2e1a', color: '#f9f9f7' }}
    >
      <Logo size="lg" />
      <div className="flex flex-col items-center gap-4 mt-4">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-sm font-medium" style={{ color: 'rgba(249,249,247,0.75)' }}>
          Taking you to your account portal...
        </p>
      </div>
    </div>
  );
}