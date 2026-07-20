import EmailCapture from '@/components/welcome/EmailCapture';
import { L, L_SERIF, Eyebrow, TopoBg } from './shared';

export default function FinalCTAV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg2, position: 'relative', overflow: 'hidden' }}>
      <TopoBg opacity={0.06} count={12} />
      {/* Big glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: 300, maxWidth: '100vw',
        background: L.greenGlow, filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
        <Eyebrow>Be first on the green</Eyebrow>
        <h2 style={{
          fontFamily: L_SERIF, fontSize: 'clamp(42px, 8vw, 84px)', fontWeight: 500,
          color: L.cream, letterSpacing: '-0.031em', lineHeight: 0.98, marginTop: 18, marginBottom: 0,
        }}>
          Ready to transform<br/>
          your <span style={{ fontStyle: 'italic', color: L.green }}>game?</span>
        </h2>
        <p style={{ fontSize: 18, color: L.inkSoft, lineHeight: 1.55, marginTop: 24 }}>
          Start your 7-day free trial today. No commitment — cancel anytime.
        </p>
        <p style={{ fontSize: 14, color: L.gold, fontWeight: 600, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span>⚡</span> Join golfers already competing on the leaderboard and lowering their handicap.
        </p>

        {/* Email capture — shared hardened component, not the mock's inert form */}
        <div style={{ maxWidth: 540, margin: '36px auto 0' }}>
          <EmailCapture id="bottom-email-capture" variant="bottom" />
        </div>
      </div>
    </section>
  );
}
