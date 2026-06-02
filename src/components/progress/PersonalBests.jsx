import React from 'react';

export default function PersonalBests({ rounds, profile }) {
  if (!rounds || rounds.length === 0) return null;

  const bestScore = Math.min(...rounds.map(r => r.total_score));
  const bestGIR = Math.max(...rounds.filter(r => r.greens_in_regulation != null).map(r => r.greens_in_regulation));
  const bestPutts = Math.min(...rounds.filter(r => r.total_putts > 0).map(r => r.total_putts));
  const streak = profile?.streak_days || 0;

  const items = [
    { label: 'Best Round', value: bestScore, icon: '🏆', unit: '' },
    { label: 'Best GIR', value: isFinite(bestGIR) ? bestGIR : null, icon: '🎯', unit: '/18' },
    { label: 'Fewest Putts', value: isFinite(bestPutts) ? bestPutts : null, icon: '⛳', unit: '' },
    { label: 'Longest Streak', value: streak, icon: '🔥', unit: 'd' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground">Personal Bests</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="card-base p-4 space-y-1">
            <p className="text-lg">{item.icon}</p>
            <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
            <div className="flex items-end gap-0.5">
              <p className="text-2xl font-black text-foreground">{item.value ?? '—'}</p>
              {item.value != null && item.unit && <p className="text-sm text-muted-foreground mb-0.5">{item.unit}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}