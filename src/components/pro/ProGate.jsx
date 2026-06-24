import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { hasProAccess, getUpgradeTarget } from '@/lib/subscription';

export default function ProGate({ profile, children, featureName = 'This feature' }) {
  const navigate = useNavigate();
  if (hasProAccess(profile)) return children;

  const handleUpgrade = () => {
    const target = getUpgradeTarget(profile);
    if (target.type === 'external') window.location.href = target.url;
    else navigate(target.path);
  };

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ backgroundColor: '#1a2e1a', border: '1px solid rgba(168,213,162,0.2)' }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5" style={{ color: '#a8d5a2' }} />
        <p
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: '#a8d5a2' }}
        >
          Pro Feature
        </p>
      </div>
      <p className="text-white font-bold text-base">{featureName}</p>
      <p className="text-white/70 text-sm leading-snug">
        Upgrade to Caddie AI Pro to unlock this.
      </p>
      <button
        onClick={handleUpgrade}
        className="w-full py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
        style={{ backgroundColor: '#a8d5a2', color: '#1a3d1a' }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
