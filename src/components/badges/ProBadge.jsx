import React from 'react';

// Small "PRO" chip rendered next to Pro feature titles. Visible when the
// user has Pro access (either subscription_status === 'pro' or a non-expired
// trial — see hasProAccess in src/lib/subscription.js). The presence of the
// badge tells the user "this is a Pro-tier feature, and yes — you have
// access to it." Cards that the user can't access show ProGate's lock card
// instead and skip the badge entirely.
export default function ProBadge({ className = '' }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider align-middle ${className}`}
      style={{ backgroundColor: '#5FBE7E', color: '#0F1714' }}
    >
      PRO
    </span>
  );
}
