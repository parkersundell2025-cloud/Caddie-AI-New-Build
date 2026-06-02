import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CLUBS, getDefaultForClub } from '@/lib/clubDistances';

export default function ClubDistancesStep({ handicap, onNext, onBack }) {
  const [distances, setDistances] = useState({});

  const update = (key, val) => {
    const num = val === '' ? '' : parseInt(val, 10);
    setDistances(prev => ({ ...prev, [key]: num }));
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
        <h2 className="text-3xl font-black text-foreground">How Far Do You Hit Each Club?</h2>
        <p className="text-muted-foreground mt-1 text-sm">We use this to personalize your coaching and drill instructions. Enter your typical carry distance in yards.</p>
      </div>

      <div className="card-base overflow-hidden">
        {CLUBS.map(({ key, label }, i) => {
          const placeholder = String(getDefaultForClub(key, handicap));
          return (
            <div
              key={key}
              className={`flex items-center justify-between px-4 py-3 ${i < CLUBS.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="text-sm font-medium text-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={placeholder}
                  value={distances[key] ?? ''}
                  onChange={e => update(key, e.target.value)}
                  className="w-20 bg-muted rounded-xl px-3 py-2 text-foreground text-sm text-right outline-none focus:ring-2 focus:ring-sage border border-border"
                />
                <span className="text-xs text-muted-foreground w-6">yds</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">You can update these anytime in Settings</p>
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
        <button onClick={handleSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}