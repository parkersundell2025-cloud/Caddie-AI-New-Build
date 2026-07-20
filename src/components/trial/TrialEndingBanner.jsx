import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { getTrialDaysRemaining } from '@/lib/trialUtils';

// Compact day-6 banner: shown on Home when the user has exactly one full day
// of trial remaining. Apple's review team expects clear pre-expiration
// messaging for subscription apps with auto-converting trials. Caller decides
// whether to render — render this whenever `getTrialDaysRemaining(profile) === 1`.
//
// Tap target is /manage-subscription rather than /subscribe-now because by
// the time this fires the user already has a Stripe subscription attached
// (the trial *is* a Stripe subscription with trial_period_days set). They
// don't need to subscribe again; they may want to confirm or cancel.
export default function TrialEndingBanner({ profile }) {
  const daysRemaining = getTrialDaysRemaining(profile);
  if (daysRemaining !== 1) return null;

  return (
    <Link
      to="/manage-subscription"
      className="block rounded-2xl p-4 active:scale-[0.99] transition-all"
      style={{ backgroundColor: 'rgba(95,190,126,0.18)', border: '1px solid rgba(95,190,126,0.4)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#5FBE7E' }}>
          <Clock className="w-4 h-4" style={{ color: '#0F1714' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">1 day left in your trial</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Tomorrow your subscription begins automatically. Tap to review.
          </p>
        </div>
      </div>
    </Link>
  );
}
