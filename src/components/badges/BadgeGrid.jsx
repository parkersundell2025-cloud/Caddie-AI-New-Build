import React from 'react';
import { ALL_BADGES } from '@/lib/badgeConfig';

const TIER_ACCENT = {
  beginner: '#9ca3af',
  consistency: '#a8d5a2',
  improvement: '#a8d5a2',
  competitive: '#facc15',
  prestige: '#f59e0b',
};

function BadgeItem({ badge, earned, earnedAt }) {
  const accent = TIER_ACCENT[badge.tier] || '#a8d5a2';
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center text-2xl transition-all"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: earned ? 'rgba(168,213,162,0.1)' : 'rgba(255,255,255,0.04)',
          border: `2px solid ${earned ? accent : 'rgba(255,255,255,0.08)'}`,
          filter: earned ? 'none' : 'grayscale(1)',
          opacity: earned ? 1 : 0.4,
          boxShadow: earned ? `0 0 12px ${accent}30` : 'none',
        }}
      >
        {badge.icon}
      </div>
      <p className="text-[10px] font-bold text-center leading-tight max-w-[60px]" style={{ color: earned ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}>
        {badge.name}
      </p>
      {earned && earnedAt && (
        <p className="text-[9px] text-center" style={{ color: 'rgba(255,255,255,0.3)', marginTop: -4 }}>
          {new Date(earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
      {!earned && (
        <p className="text-[9px] text-center leading-tight max-w-[60px]" style={{ color: 'rgba(255,255,255,0.2)', marginTop: -4 }}>
          {badge.req}
        </p>
      )}
    </div>
  );
}

export default function BadgeGrid({ earnedBadges = [] }) {
  const earnedMap = {};
  for (const b of earnedBadges) earnedMap[b.badge_id] = b.earned_at;

  // Sort: earned first, then unearned
  const sorted = [...ALL_BADGES].sort((a, b) => {
    const aE = !!earnedMap[a.id];
    const bE = !!earnedMap[b.id];
    if (aE && !bE) return -1;
    if (!aE && bE) return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      {sorted.map(badge => (
        <BadgeItem
          key={badge.id}
          badge={badge}
          earned={!!earnedMap[badge.id]}
          earnedAt={earnedMap[badge.id]}
        />
      ))}
    </div>
  );
}