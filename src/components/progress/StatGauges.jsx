import React from 'react';

const CARD = { background: '#141414', border: '1px solid rgba(168,213,162,0.15)', borderRadius: 20 };
const CELL = { background: '#1e1e1e', borderRadius: 16 };

const STATS = [
  { key: 'fw', label: 'Fairways Hit', tourBenchmark: 57, unit: '%', lowerIsBetter: false },
  { key: 'gir', label: 'GIR', tourBenchmark: 67, unit: '%', lowerIsBetter: false },
  { key: 'putts', label: 'Putts / Round', tourBenchmark: 29, unit: '', lowerIsBetter: true },
  { key: 'scrambling', label: 'Scrambling', tourBenchmark: 58, unit: '%', lowerIsBetter: false },
];

function computeStats(rounds) {
  const valid = rounds.filter(r => r.total_score > 0);
  const withFW = valid.filter(r => r.fairways_available > 0);
  const withGIR = valid.filter(r => r.greens_in_regulation != null);
  const withPutts = valid.filter(r => r.total_putts > 0);
  const withScrambling = valid.filter(r => r.scrambling_attempts > 0);
  return {
    fw: withFW.length > 0 ? Math.round(withFW.reduce((s, r) => s + (r.fairways_hit / r.fairways_available) * 100, 0) / withFW.length) : null,
    gir: withGIR.length > 0 ? Math.round(withGIR.reduce((s, r) => s + (r.greens_in_regulation / 18) * 100, 0) / withGIR.length) : null,
    putts: withPutts.length > 0 ? Math.round(withPutts.reduce((s, r) => s + r.total_putts, 0) / withPutts.length) : null,
    scrambling: withScrambling.length > 0 ? Math.round(withScrambling.reduce((s, r) => s + (r.scrambling_saves / r.scrambling_attempts) * 100, 0) / withScrambling.length) : null,
  };
}

function statColor(val, tourBenchmark, lowerIsBetter) {
  if (val === null) return '#555';
  const ratio = lowerIsBetter ? tourBenchmark / val : val / tourBenchmark;
  if (ratio >= 0.9) return '#22c55e';
  if (ratio >= 0.75) return '#eab308';
  return '#ef4444';
}

function trendArrow(prev, curr, lowerIsBetter) {
  if (prev === null || curr === null || Math.abs(curr - prev) < 1) return null;
  const improving = lowerIsBetter ? curr < prev : curr > prev;
  return improving ? { label: '↑', color: '#22c55e' } : { label: '↓', color: '#ef4444' };
}

export default function StatGauges({ rounds }) {
  if (!rounds || rounds.length < 3) return null;

  const sorted = [...rounds].sort((a, b) => a.round_date.localeCompare(b.round_date));
  const last10 = sorted.slice(-10);
  const prev10 = sorted.slice(-20, -10);

  const current = computeStats(last10);
  const previous = computeStats(prev10);

  const hasAny = Object.values(current).some(v => v !== null);
  if (!hasAny) return null;

  return (
    <div style={CARD} className="p-5 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.4)' }}>You vs Tour</p>
      <div className="grid grid-cols-2 gap-3">
        {STATS.map(stat => {
          const val = current[stat.key];
          const prevVal = previous[stat.key];
          const color = statColor(val, stat.tourBenchmark, stat.lowerIsBetter);
          const arrow = trendArrow(prevVal, val, stat.lowerIsBetter);

          // Bar: 100% width = tour benchmark value
          const barPct = val === null ? 0
            : stat.lowerIsBetter
              ? Math.max(0, Math.min(100, (stat.tourBenchmark / Math.max(val, 1)) * 100))
              : Math.min(100, (val / stat.tourBenchmark) * 100);

          return (
            <div key={stat.key} style={CELL} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
                {arrow && <span className="text-xs font-black" style={{ color: arrow.color }}>{arrow.label}</span>}
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-4xl font-black leading-none" style={{ color, fontFamily: 'Fraunces, Georgia, serif' }}>
                  {val !== null ? `${val}${stat.unit}` : '—'}
                </p>
                <p className="text-xs pb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Tour<br />{stat.tourBenchmark}{stat.unit}
                </p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}