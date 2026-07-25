import React from 'react';
import { computeRunningStats, formatVsPar } from '@/lib/roundDraft';

function HoleLine({ h, last }) {
  return (
    <div className={`flex items-center gap-2.5 py-1.5 ${last ? '' : 'border-b border-white/5'}`}>
      <span className="cut-mono text-[11px] font-bold text-cut-ink-mute w-4">{h.hole_number}</span>
      <span className="cut-mono text-sm font-bold text-cut-ink w-5">{h.score}</span>
      <div className="flex-1 flex gap-2.5 text-[11px] text-cut-ink-mute">
        {h.fairway != null && h.fairway !== 'na' && (
          <span className={h.fairway === 'hit' ? 'text-cut-green' : ''}>
            {h.fairway === 'hit' ? 'FIR' : 'Missed'}
          </span>
        )}
        {h.gir != null && (
          <span className={h.gir ? 'text-cut-green' : ''}>{h.gir ? 'GIR' : 'No GIR'}</span>
        )}
        {h.putts != null && <span>{h.putts} putt{h.putts === 1 ? '' : 's'}</span>}
      </div>
    </div>
  );
}

export default function RoundStats({ draft, onContinue, onDiscard }) {
  const s = computeRunningStats(draft);
  const nextHole = draft.current_hole;

  return (
    <div className="px-4 flex flex-col gap-3 pb-6">
      <div className="px-1">
        <div className="cut-eyebrow text-cut-gold">Live round data</div>
        <div className="cut-headline text-[26px] text-cut-ink mt-1.5">
          Through <span className="italic text-cut-green">{s.loggedCount} hole{s.loggedCount === 1 ? '' : 's'}</span>.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Fairways', v: s.fairwaysEligible ? `${s.fairwaysHit}/${s.fairwaysEligible}` : '–' },
          { l: 'GIR', v: s.girSet ? `${s.girHit}/${s.girSet}` : '–' },
          { l: 'Putts', v: s.puttsSet ? s.totalPutts : '–' },
        ].map((c) => (
          <div key={c.l} className="cut-glass rounded-2xl p-3.5">
            <div className="cut-eyebrow text-cut-ink-mute">{c.l}</div>
            <div className="cut-mono text-2xl font-bold text-cut-ink mt-1.5 tracking-tight">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="cut-glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="cut-eyebrow text-cut-ink-mute">Running score</div>
          <div className="cut-mono text-xs font-bold text-cut-green">{formatVsPar(s.vsPar)}</div>
        </div>
        <div className="cut-headline text-[44px] text-cut-ink mt-1" data-testid="running-score">{s.totalScore}</div>
      </div>

      {s.loggedCount > 0 && (
        <div className="cut-glass rounded-2xl p-3.5">
          <div className="cut-eyebrow text-cut-ink-mute mb-2">Entered so far</div>
          <div className="flex flex-col">
            {s.loggedHoles.map((h, i) => (
              <HoleLine key={h.hole_number} h={h} last={i === s.loggedHoles.length - 1} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="w-full h-[50px] rounded-[14px] bg-cut-green text-cut-bg text-sm font-bold shadow-[0_0_22px_rgba(95,190,126,.30)]"
      >
        Continue to hole {nextHole}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="w-full py-2 text-[12px] text-cut-ink-mute"
      >
        Discard round
      </button>
    </div>
  );
}
