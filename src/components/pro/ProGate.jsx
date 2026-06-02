import React from 'react';
import { hasProAccess } from '@/lib/subscription';

export default function ProGate({ profile, children }) {
  if (hasProAccess(profile)) return children;

  return (
    <div className="card-base p-6 text-center">
      <p className="text-sm text-muted-foreground leading-relaxed">
        This feature requires an active subscription.
      </p>
    </div>
  );
}