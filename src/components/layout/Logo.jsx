import React from 'react';

// Golf bag SVG — clear silhouette with clubs sticking out
function GolfBagIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Club shafts sticking out the top */}
      <line x1="9.5" y1="2" x2="9.5" y2="7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="12" y1="1.5" x2="12" y2="7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="14.5" y1="2" x2="14.5" y2="7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      {/* Bag body — wider at top, slight taper at bottom */}
      <path d="M7 7 Q7 6 8 6 L16 6 Q17 6 17 7 L17.5 19 Q17.5 20.5 16 21 L8 21 Q6.5 20.5 6.5 19 Z" fill="white" />
      {/* Carry strap across the bag */}
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="#1a3d1a" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      {/* Lower pocket divider */}
      <line x1="8" y1="16" x2="16" y2="16" stroke="#1a3d1a" strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
      {/* Bag base stand feet */}
      <line x1="9.5" y1="21" x2="8.5" y2="23" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14.5" y1="21" x2="15.5" y2="23" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>);

}

export default function Logo({ size = 'md' }) {
  const configs = {
    sm: { circle: 'w-7 h-7', iconSize: 16, caddie: 'text-[17px]', ai: 'text-[11px]', gap: 'gap-2' },
    md: { circle: 'w-9 h-9', iconSize: 20, caddie: 'text-[22px]', ai: 'text-[14px]', gap: 'gap-2.5' },
    lg: { circle: 'w-12 h-12', iconSize: 27, caddie: 'text-[30px]', ai: 'text-[18px]', gap: 'gap-3' }
  };
  const c = configs[size];

  return (
    <div className={`flex items-center ${c.gap}`}>
      {/* Icon mark — dark forest green circle */}
      




      

      {/* Wordmark */}
      <div className="flex items-baseline gap-1">
        <span
          className={`${c.caddie} font-bold leading-none text-foreground`}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.02em' }}>
          
          Caddie
        </span>
        <span
          className={`${c.ai} font-light leading-none`}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' }}>
          
          AI
        </span>
      </div>
    </div>);

}