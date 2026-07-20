import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { parseDateLocal } from '@/lib/dateUtils';

const CARD = { background: '#141A17', border: '1px solid rgba(95,190,126,0.15)', borderRadius: 20 };

function RoundCard({ round, handicapPar }) {
  const scramblingValid = round.scrambling_attempts > 0;
  const scramblingPct = scramblingValid ? Math.round((round.scrambling_saves / round.scrambling_attempts) * 100) : null;
  const atPar = handicapPar && round.total_score <= handicapPar;
  const scoreColor = !handicapPar ? '#fff' : atPar ? '#22c55e' : '#ef4444';

  const pills = [
    round.fairways_available > 0 && `FW ${round.fairways_hit}/${round.fairways_available}`,
    round.greens_in_regulation != null && `GIR ${round.greens_in_regulation}/18`,
    round.total_putts > 0 && `${round.total_putts} putts`,
    scramblingPct !== null && `SCR ${scramblingPct}%`,
  ].filter(Boolean);

  return (
    <div style={CARD} className="p-5 space-y-3">
      <div className="flex items-center gap-4">
        <p className="font-black leading-none flex-shrink-0" style={{ fontSize: 48, color: scoreColor, fontFamily: 'Fraunces, Georgia, serif' }}>
          {round.total_score}
        </p>
        <div className="min-w-0">
          <p className="font-bold truncate" style={{ color: 'rgba(244,239,227,0.9)' }}>{round.course_name || 'Unknown Course'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(244,239,227,0.4)' }}>
            {round.round_date ? format(parseDateLocal(round.round_date), 'MMM d, yyyy') : ''}
          </p>
        </div>
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map(p => (
            <span
              key={p}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(244,239,227,0.07)', color: 'rgba(244,239,227,0.6)' }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {round.notes && (
        <p className="text-xs italic" style={{ color: 'rgba(244,239,227,0.4)', borderTop: '1px solid rgba(244,239,227,0.06)', paddingTop: 10 }}>
          {round.notes}
        </p>
      )}
    </div>
  );
}

export default function RecentRounds({ rounds, profile }) {
  const [showAll, setShowAll] = useState(false);
  const handicapPar = profile?.current_handicap != null ? Math.round(72 + profile.current_handicap) : null;
  const displayed = showAll ? rounds : rounds.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(244,239,227,0.4)' }}>Recent Rounds</p>
        {handicapPar && (
          <p className="text-[10px]" style={{ color: 'rgba(244,239,227,0.3)' }}>
            <span style={{ color: '#22c55e' }}>●</span> at/under {handicapPar}
          </p>
        )}
      </div>
      {rounds.length === 0 ? (
        <div style={CARD} className="p-8 text-center space-y-2">
          <p className="text-4xl">⛳</p>
          <p className="text-sm" style={{ color: 'rgba(244,239,227,0.4)' }}>No rounds logged yet.<br />Tap "Log Round" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(r => <RoundCard key={r.id} round={r} handicapPar={handicapPar} />)}
          {rounds.length > 5 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ background: 'rgba(244,239,227,0.05)', color: 'rgba(244,239,227,0.5)', border: '1px solid rgba(244,239,227,0.08)' }}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show less' : `Show all ${rounds.length} rounds`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}