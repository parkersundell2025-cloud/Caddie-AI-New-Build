import { L, L_SERIF, Eyebrow, Glass, StoreBadges } from './shared';

export default function InstallV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[100px]" style={{ background: L.bg, position: 'relative' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <Glass padding={0} style={{ overflow: 'hidden' }}>
          <div className="relative grid grid-cols-1 items-center overflow-hidden md:grid-cols-[1.1fr_1fr]" style={{
            background: `linear-gradient(135deg, ${L.greenDeep} 0%, ${L.greenSoft} 100%)`,
          }}>
            <svg width="100%" height="100%" viewBox="0 0 800 480" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const y = 40 + i * 36;
                return <path key={i} d={`M0 ${y} Q200 ${y - 16} 400 ${y} T800 ${y}`} stroke={L.cream} strokeWidth="1" fill="none" />;
              })}
            </svg>
            <div className="relative p-8 md:p-[60px]">
              <Eyebrow color={L.gold}>Tap. Tee. Train.</Eyebrow>
              <h2 style={{
                fontFamily: L_SERIF, fontSize: 'clamp(34px, 5.5vw, 56px)', fontWeight: 500,
                color: L.cream, letterSpacing: '-0.029em', lineHeight: 1, marginTop: 16, marginBottom: 16,
              }}>
                Install Caddie AI<br/>
                on your <span style={{ fontStyle: 'italic', color: L.gold }}>phone</span>.
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(244,239,227,.8)', lineHeight: 1.6, maxWidth: 460, marginBottom: 28 }}>
                Available on iOS and Android. 2-minute onboarding. Your first personalized practice plan ready before you finish your coffee.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StoreBadges placement="install-section" />
              </div>
            </div>
            {/* QR placeholder */}
            <div className="relative flex justify-center p-8 pb-16 md:p-[60px]">
              <div style={{
                width: 220, height: 220, borderRadius: 24,
                background: L.cream, padding: 18,
                boxShadow: '0 20px 40px rgba(0,0,0,.3)',
              }}>
                {/* Fake QR — decorative placeholder from the mock */}
                <svg width="100%" height="100%" viewBox="0 0 21 21">
                  {Array.from({ length: 21 * 21 }).map((_, i) => {
                    const x = i % 21, y = Math.floor(i / 21);
                    const on = ((x * 7 + y * 13 + (x ^ y)) % 5) < 2;
                    const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
                    if (corner) return null;
                    if (!on) return null;
                    return <rect key={i} x={x} y={y} width="1" height="1" fill={L.greenDeep} />;
                  })}
                  {[[0, 0], [14, 0], [0, 14]].map(([px, py], i) => (
                    <g key={i}>
                      <rect x={px} y={py} width="7" height="7" fill="none" stroke={L.greenDeep} strokeWidth="1" />
                      <rect x={px + 2} y={py + 2} width="3" height="3" fill={L.greenDeep} />
                    </g>
                  ))}
                </svg>
              </div>
              <div style={{ position: 'absolute', bottom: 36, fontSize: 11, color: 'rgba(244,239,227,.7)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Scan to install</div>
            </div>
          </div>
        </Glass>
      </div>
    </section>
  );
}
