import React from 'react';
import { Minus, Plus } from 'lucide-react';
import ChipRow from './ChipRow';

const FAIRWAY_OPTIONS = [
  { value: 'hit', label: 'Hit' },
  { value: 'miss_left', label: 'Miss L' },
  { value: 'miss_right', label: 'Miss R' },
  { value: 'na', label: 'N/A' },
];
const GIR_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];
const PUTTS_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4+' },
];
const PAR_OPTIONS = [
  { value: 3, label: 'Par 3' },
  { value: 4, label: 'Par 4' },
  { value: 5, label: 'Par 5' },
];

function Section({ label, children }) {
  return (
    <div className="cut-glass rounded-2xl p-3.5">
      <div className="cut-eyebrow text-cut-ink-mute mb-2">{label}</div>
      {children}
    </div>
  );
}

export default function HoleEntry({ hole, loggedCount, holesPlanned, onChange, onNext, isLast }) {
  const setPar = (par) => {
    const patch = { par };
    // Untouched default score follows the par; par 3 has no fairway to hit
    if (hole.logged_at == null && hole.score === hole.par) patch.score = par;
    if (par === 3 && hole.fairway == null) patch.fairway = 'na';
    onChange(patch);
  };

  return (
    <div className="px-4 flex flex-col gap-2.5 pb-4">
      <div className="flex items-baseline justify-between px-1">
        <div>
          <div className="cut-eyebrow text-cut-gold">Hole {hole.hole_number}</div>
          <div className="cut-headline text-[26px] text-cut-ink mt-1">Par {hole.par}</div>
        </div>
        <div className="cut-mono text-[11px] font-semibold text-cut-ink-mute">
          {loggedCount} of {holesPlanned} logged
        </div>
      </div>

      <Section label="Par">
        <ChipRow options={PAR_OPTIONS} value={hole.par} onChange={setPar} />
      </Section>

      <Section label="Score">
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Decrease score"
            onClick={() => onChange({ score: Math.max(1, hole.score - 1) })}
            className="w-[38px] h-[38px] rounded-full bg-cut-card-solid border border-white/10 text-cut-ink-soft flex items-center justify-center"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="cut-headline text-[44px] text-cut-ink min-w-[58px] text-center" data-testid="hole-score">
            {hole.score}
          </div>
          <button
            type="button"
            aria-label="Increase score"
            onClick={() => onChange({ score: Math.min(15, hole.score + 1) })}
            className="w-[38px] h-[38px] rounded-full bg-cut-green text-cut-bg flex items-center justify-center shadow-[0_0_14px_rgba(95,190,126,.30)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </Section>

      <Section label="Fairway">
        <ChipRow options={FAIRWAY_OPTIONS} value={hole.fairway} onChange={(v) => onChange({ fairway: v })} />
      </Section>

      <Section label="Green in regulation">
        <ChipRow options={GIR_OPTIONS} value={hole.gir} onChange={(v) => onChange({ gir: v })} />
      </Section>

      <Section label="Putts">
        <ChipRow options={PUTTS_OPTIONS} value={hole.putts} onChange={(v) => onChange({ putts: v })} tone="gold" />
      </Section>

      <button
        type="button"
        onClick={onNext}
        className="w-full h-[54px] mt-1.5 rounded-2xl bg-cut-green text-cut-bg text-[15px] font-bold shadow-[0_0_24px_rgba(95,190,126,.30)]"
      >
        {isLast ? 'Finish round' : 'Next hole'}
      </button>
    </div>
  );
}
