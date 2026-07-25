import React from 'react';

export default function ChipRow({ options, value, onChange, tone = 'green' }) {
  const activeClasses = tone === 'gold'
    ? 'bg-cut-gold text-cut-bg shadow-[0_0_12px_rgba(217,177,74,.35)]'
    : 'bg-cut-green text-cut-bg shadow-[0_0_12px_rgba(95,190,126,.30)]';
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 text-center py-2.5 px-1 rounded-[11px] text-xs font-bold transition-colors ${
              active ? activeClasses : 'bg-cut-card-solid text-cut-ink-mute border border-white/10'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
