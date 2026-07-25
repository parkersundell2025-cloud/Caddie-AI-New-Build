import React, { useEffect, useRef } from 'react';

export default function HoleStrip({ holes, activeHole, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeHole]);

  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {holes.map((h) => {
        const entered = h.logged_at != null;
        const active = h.hole_number === activeHole;
        return (
          <button
            key={h.hole_number}
            ref={active ? activeRef : null}
            type="button"
            onClick={() => (entered || active) && onSelect(h.hole_number)}
            className={`flex-none w-9 h-10 rounded-[11px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              active
                ? 'bg-cut-green shadow-[0_0_16px_rgba(95,190,126,.30)]'
                : entered
                  ? 'bg-cut-card-solid border border-white/10'
                  : 'border border-white/5'
            }`}
          >
            <span className={`text-[8.5px] font-bold ${active ? 'text-cut-bg' : 'text-cut-ink-mute'}`}>
              {h.hole_number}
            </span>
            <span className={`cut-mono text-[11px] font-bold ${active ? 'text-cut-bg' : entered ? 'text-cut-ink' : 'text-cut-ink-mute'}`}>
              {entered ? h.score : '–'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
