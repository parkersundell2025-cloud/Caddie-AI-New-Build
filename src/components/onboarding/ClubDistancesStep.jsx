import React, { useState } from 'react';
import { ChevronLeft, Minus, Plus } from 'lucide-react';
import { CLUBS, getDefaultForClub } from '@/lib/clubDistances';

// Mock's line icons (design export) — lucide has no golf clubs
function ClubIcon({ kind }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'driver' && <><circle cx="6" cy="18" r="3" /><path d="M8 16l11-11" /><path d="M16 4h4v4" /></>}
      {kind === 'iron' && <><path d="M4 20l14-16" /><path d="M16 4h4v4" /></>}
      {kind === 'wedge' && <><circle cx="17" cy="17" r="2" /><path d="M3 21l13-5M3 21l5-13" /></>}
    </svg>
  );
}

const iconFor = (key) =>
  /driver|wood/.test(key) ? 'driver' : /wedge/.test(key) ? 'wedge' : 'iron';

export default function ClubDistancesStep({ handicap, onNext, onBack }) {
  const [distances, setDistances] = useState({});

  const update = (key, val) => {
    const num = val === '' ? '' : parseInt(val, 10);
    setDistances(prev => ({ ...prev, [key]: num }));
  };

  // Steppers move off whatever the user currently sees — their value if
  // they've set one, otherwise the level-based default in the placeholder
  const nudge = (key, delta) => {
    const base = distances[key] !== '' && distances[key] != null
      ? distances[key]
      : getDefaultForClub(key, handicap);
    update(key, String(Math.max(10, base + delta)));
  };

  const handleSkip = () => {
    // Pass empty object — caller will apply defaults
    onNext({});
  };

  const handleSave = () => {
    onNext(distances);
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div>
        <p className="cut-eyebrow text-cut-gold">Step 3 of 4</p>
        <h2 className="cut-headline text-cut-ink text-[28px] leading-[1.08] mt-2">
          What's in your <span className="italic text-cut-green">bag</span>?
        </h2>
        <p className="text-cut-ink-mute mt-2 text-sm">
          We prefilled typical distances for your level — tap +/− only where you're different.
        </p>
      </div>

      <div className="flex flex-col gap-[7px]">
        {CLUBS.map(({ key, label }) => {
          const placeholder = String(getDefaultForClub(key, handicap));
          return (
            <div key={key} className="cut-glass p-3 flex items-center gap-2.5">
              <div
                className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center flex-shrink-0 text-cut-green"
                style={{ background: 'rgba(95,190,126,.14)' }}
              >
                <ClubIcon kind={iconFor(key)} />
              </div>
              <span className="cut-headline text-cut-ink text-[14.5px] flex-1 min-w-0 truncate">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => nudge(key, -5)}
                  className="w-6 h-6 rounded-full bg-cut-card-solid text-cut-ink-soft flex items-center justify-center active:scale-90 transition-all"
                  style={{ border: '1px solid rgba(244,239,227,.10)' }}
                  aria-label={`${label} minus 5 yards`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex items-baseline">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={distances[key] ?? ''}
                    onChange={e => update(key, e.target.value)}
                    className="w-10 bg-transparent font-mono text-[15px] font-bold text-cut-ink text-right outline-none placeholder:text-cut-ink-mute"
                  />
                  <span className="font-mono text-[11px] text-cut-ink-mute ml-0.5">y</span>
                </div>
                <button
                  onClick={() => nudge(key, 5)}
                  className="w-6 h-6 rounded-full bg-cut-green text-cut-bg flex items-center justify-center active:scale-90 transition-all"
                  aria-label={`${label} plus 5 yards`}
                >
                  <Plus className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <p className="text-xs text-cut-ink-mute">{CLUBS.length} clubs prefilled · adjust anytime in Settings</p>
      </div>

      <div className="flex gap-3 mt-auto">
        <button onClick={onBack} className="flex items-center gap-1 px-4 py-3 rounded-xl text-muted-foreground font-medium">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={handleSave} className="flex-1 btn-primary py-4">
          Continue →
        </button>
      </div>

      <div className="text-center -mt-2">
        <button onClick={handleSkip} className="text-xs text-cut-ink-mute hover:text-cut-ink transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}
