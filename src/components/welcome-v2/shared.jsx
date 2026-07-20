import { getAppStoreUrl, trackAppStoreClick } from '@/lib/campaign';
// Design tokens + shared primitives for the /welcome-preview landing page,
// translated from the "The Cut" design mock.

export const L = {
  bg: '#0B0F0C',
  bg2: '#0F1714',
  bgGrad: '#0E1A12',
  card: 'rgba(244,239,227,.04)',
  cardSolid: '#141A17',
  cardHigh: '#0E1311',
  cardBorder: 'rgba(244,239,227,.10)',
  cardBorderHover: 'rgba(95,190,126,.35)',
  line: 'rgba(244,239,227,.08)',
  ink: '#F4EFE3',
  inkSoft: 'rgba(244,239,227,.72)',
  inkMute: 'rgba(244,239,227,.45)',
  green: '#5FBE7E',
  greenDeep: '#0E4D2B',
  greenSoft: '#1F6E3F',
  greenGlow: 'rgba(95,190,126,.30)',
  gold: '#D9B14A',
  goldDeep: '#9C7A2E',
  cream: '#F4EFE3',
};

export const L_SERIF = '"Fraunces", "Cormorant Garamond", Georgia, serif';
export const L_SANS = '"Inter", -apple-system, system-ui, sans-serif';
export const L_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// Brand wordmark — matches the official logo (upright Fraunces + small "AI")
export function LandingWordmark({ size = 22, color = L.ink }) {
  const ai = size * 0.32;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: size * 0.12, lineHeight: 1 }}>
      <span style={{ fontFamily: L_SERIF, fontSize: size, fontWeight: 500, color, letterSpacing: -size * 0.018 }}>Caddie</span>
      <span style={{ fontFamily: L_SERIF, fontSize: ai, fontWeight: 500, color, letterSpacing: ai * 0.06, textTransform: 'uppercase', opacity: 0.9 }}>AI</span>
    </span>
  );
}

export function Eyebrow({ children, color = L.green, style }) {
  return (
    <div style={{
      fontFamily: L_SANS, fontSize: 11, fontWeight: 700,
      letterSpacing: 1.8, textTransform: 'uppercase', color, ...style,
    }}>{children}</div>
  );
}

export function Pill({ children, color = L.gold, bg = 'rgba(217,177,74,.16)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 999,
      background: bg, color, fontSize: 10, fontWeight: 700,
      letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: L_SANS,
    }}>{children}</span>
  );
}

export function Glass({ children, style, padding = 24, glow = false }) {
  return (
    <div style={{
      position: 'relative',
      background: L.card,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: `1px solid ${L.cardBorder}`,
      borderRadius: 20,
      padding,
      overflow: 'hidden',
      boxShadow: 'inset 0 1px 0 rgba(244,239,227,.06)',
      transition: 'border-color .25s, transform .25s',
      ...style,
    }}>
      {glow && <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: 120, background: L.greenGlow, filter: 'blur(60px)', pointerEvents: 'none' }} />}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

// Topo lines bg (used in many sections)
export function TopoBg({ opacity = 0.06, count = 12 }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 800" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const y = 50 + i * (700 / count);
        return <path key={i} d={`M0 ${y} Q360 ${y - 40} 720 ${y} T1440 ${y}`} stroke={L.cream} strokeWidth="1" fill="none" />;
      })}
    </svg>
  );
}

// Fluid section headline — the mock uses fixed 72px which overflows a 390px
// viewport, so scale with clamp instead.
export function SectionHeadline({ children, style }) {
  return (
    <h2 style={{
      fontFamily: L_SERIF, fontSize: 'clamp(38px, 6.5vw, 72px)', fontWeight: 500,
      color: L.cream, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 16, marginBottom: 0,
      ...style,
    }}>{children}</h2>
  );
}

export function AppStoreBadgeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/></svg>
  );
}

export function GooglePlayBadgeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5V3.5c0-.58.34-1.08.83-1.31l11.27 9.81L3.83 21.81C3.34 21.58 3 21.08 3 20.5m13.32-9l-2.6 2.26L4.83 3.06c.18-.08.36-.15.55-.15.27 0 .54.08.77.21L17.32 11.5M21 12c0 .35-.18.66-.46.84l-2.41 1.38-2.91-2.22 2.91-2.22 2.41 1.38c.28.18.46.49.46.84M4.83 20.94l8.89-10.49 2.6 2.26L6.15 21.81c-.23.13-.5.21-.77.21-.19 0-.37-.07-.55-.15"/></svg>
  );
}

const badgeStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 22px', background: L.cream, color: L.bg,
  border: 'none', borderRadius: 14, cursor: 'pointer', fontFamily: L_SANS,
  textDecoration: 'none',
};

export function StoreBadges({ placement = 'landing' }) {
  return (
    <>
      <a href={getAppStoreUrl()} onClick={() => trackAppStoreClick(placement)}
        target="_blank" rel="noopener noreferrer"
        aria-label="Download Caddie AI on the App Store" style={badgeStyle}>
        <AppStoreBadgeIcon />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 9, fontWeight: 600, lineHeight: 1 }}>Download on the</div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>App Store</div>
        </div>
      </a>
      {/* Android listing isn't live yet — no repo URL for it, so this badge is inert */}
      <div style={{ ...badgeStyle, cursor: 'default' }}>
        <GooglePlayBadgeIcon />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 9, fontWeight: 600, lineHeight: 1 }}>Get it on</div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>Google Play</div>
        </div>
      </div>
    </>
  );
}
