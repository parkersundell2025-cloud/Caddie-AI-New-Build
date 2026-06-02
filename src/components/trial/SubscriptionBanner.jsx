import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { hasExpiredTrial } from '@/lib/subscription';

// Persistent post-trial banner rendered on Home (and any other page that
// chooses to opt in) when the user's subscription has expired and they
// haven't re-subscribed yet.
//
// History: the previous incarnation was removed for Apple Guideline 3.1.3(f)
// (anti-steering: subscription apps can't direct users out to a website to
// pay). The fix here is to link to /subscribe-now — an in-app route that
// routes through the RC Apple-IAP flow on native and the Stripe Checkout
// flow on web. No external URLs, no rule violation.
export default function SubscriptionBanner({ profile }) {
  if (!hasExpiredTrial(profile)) return null;

  return (
    <Link
      to="/subscribe-now"
      className="block rounded-2xl p-4 active:scale-[0.99] transition-all"
      style={{ backgroundColor: 'rgba(220, 100, 100, 0.12)', border: '1px solid rgba(220, 100, 100, 0.35)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Your subscription has expired</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Renew to keep your practice plan, coaching insights, and progress.
          </p>
        </div>
      </div>
    </Link>
  );
}
