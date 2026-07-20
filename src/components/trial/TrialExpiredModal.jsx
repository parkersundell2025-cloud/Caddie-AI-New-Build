import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/layout/Logo';
import { isTrialExpired } from '@/lib/trialUtils';

// Full-screen modal shown the moment a trial expires. Race-condition coverage:
// SubscriptionGate is the upstream gate that bounces expired-trial users to
// /subscribe-now, but there's a brief window between trial_end_date passing
// (local clock) and the RC webhook actually flipping subscription_status off
// 'trial'. During that window the user can still reach Home — this modal
// catches them and gives an obvious next step instead of letting them poke
// around in a half-broken Pro-gated state.
//
// No dismiss button — Apple's review team treats trial-end as a forced
// upgrade prompt for subscription apps. The only way out is to subscribe.
export default function TrialExpiredModal({ profile }) {
  const navigate = useNavigate();
  if (!isTrialExpired(profile)) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
         style={{ backgroundColor: '#0F1714' }}>
      <div className="w-full max-w-sm mx-auto space-y-8 text-center">
        <div className="flex justify-center" style={{ filter: 'brightness(0) invert(1)' }}>
          <Logo size="md" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black text-white leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
            Your trial has ended
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Continue with Caddie AI Pro to keep your personalized plan, AI coach, and progress.
          </p>
        </div>

        <button
          onClick={() => navigate('/subscribe-now')}
          className="w-full py-4 rounded-full font-bold text-base transition-all active:scale-95"
          style={{ backgroundColor: '#5FBE7E', color: '#0F1714' }}
        >
          View Plans →
        </button>

        <p className="text-white/40 text-xs">
          Questions? Email{' '}
          <a href="mailto:support@caddieaiapp.com" className="underline" style={{ color: '#5FBE7E' }}>
            support@caddieaiapp.com
          </a>
        </p>
      </div>
    </div>
  );
}
