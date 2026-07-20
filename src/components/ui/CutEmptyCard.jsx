import React from 'react';

// First-week empty-state card from the design system (extra-states mock):
// centered icon tile, serif title, muted body, optional glowing CTA.
export default function CutEmptyCard({ icon: Icon, title, body, cta, onCta }) {
  return (
    <div className="cut-glass p-7 text-center">
      <div
        className="w-[52px] h-[52px] rounded-[18px] mx-auto mb-4 flex items-center justify-center text-cut-green"
        style={{ background: 'rgba(95,190,126,.14)' }}
      >
        <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
      </div>
      <p className="cut-headline text-cut-ink text-lg" style={{ letterSpacing: '-0.3px' }}>{title}</p>
      <p className="text-[13px] text-cut-ink-mute mt-1.5 leading-relaxed max-w-[240px] mx-auto">{body}</p>
      {cta && (
        <button
          onClick={onCta}
          className="mt-4 px-5 py-2.5 rounded-xl bg-cut-green text-cut-bg text-[13px] font-bold active:scale-95 transition-all"
          style={{ boxShadow: '0 0 14px rgba(95,190,126,.30)' }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
