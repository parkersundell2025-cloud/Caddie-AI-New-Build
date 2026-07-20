import { Link } from 'react-router-dom';
import { L, L_SERIF, L_SANS, L_MONO, Eyebrow, Glass, Pill, TopoBg, SectionHeadline } from './shared';

const plans = [
  {
    name: 'Caddie AI Basic',
    price: '15',
    per: '/ month',
    features: [
      'Personalized weekly practice plans',
      'AI coach with real-time game knowledge',
      'Round and session logging',
      'Handicap tracking and progress monitoring',
      'Competitive leaderboard and badges',
      '7-day free trial',
    ],
    best: false,
  },
  {
    name: 'Caddie AI Pro',
    price: '29',
    per: '/ month',
    features: [
      'Everything in Basic',
      'Monthly Game Plan — personalized strategic roadmap updated every month',
      'Pre-Round Game Plan — tactical briefing from your coach before every round',
      'Weekly Performance Report — every Monday morning breakdown of your game',
      'Competitor Intel — see how your improvement compares to golfers at your level',
      'Deeper coach memory and context — your full history, not just recent sessions',
      '7-day free trial',
    ],
    best: true,
  },
];

export default function PricingV2() {
  return (
    <section id="pricing" className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg2, position: 'relative' }}>
      <TopoBg opacity={0.04} count={10} />
      <div style={{ maxWidth: 1300, margin: '0 auto', position: 'relative' }}>
        <div className="mb-12 text-center md:mb-20">
          <Eyebrow>The Value</Eyebrow>
          <SectionHeadline>
            A better way to<br/>
            <span style={{ fontStyle: 'italic', color: L.green }}>invest</span> in your game.
          </SectionHeadline>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {plans.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {p.best && (
                <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                  <Pill color={L.bg} bg={L.gold}>★ Most Popular</Pill>
                </div>
              )}
              <Glass padding={0} glow={p.best} style={{
                height: '100%',
                border: p.best ? `1.5px solid ${L.green}` : `1px solid ${L.cardBorder}`,
                boxShadow: p.best ? `0 0 32px ${L.greenGlow}` : 'inset 0 1px 0 rgba(244,239,227,.06)',
              }}>
                <div className="flex h-full flex-col p-7 md:p-10">
                  <div style={{
                    fontFamily: L_SERIF, fontSize: 26, fontWeight: 500,
                    color: p.best ? L.green : L.cream, letterSpacing: -0.4,
                  }}>{p.name}</div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div style={{ fontFamily: L_MONO, fontSize: 18, color: L.inkMute, fontWeight: 600 }}>$</div>
                    <div style={{ fontFamily: L_MONO, fontSize: 68, color: L.cream, fontWeight: 700, letterSpacing: -2.5, lineHeight: 0.9 }}>{p.price}</div>
                    <div style={{ fontSize: 16, color: L.inkMute, fontWeight: 500 }}>{p.per}</div>
                  </div>

                  <div style={{ height: 1, background: L.line, marginTop: 24, marginBottom: 20 }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    {p.features.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 2,
                          background: 'rgba(95,190,126,.15)', color: L.green,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"/></svg>
                        </div>
                        <div style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.5 }}>{f}</div>
                      </div>
                    ))}
                  </div>

                  <Link to="/signin" style={{
                    marginTop: 28, padding: '16px 24px',
                    background: p.best ? L.green : 'transparent',
                    color: p.best ? L.bg : L.cream,
                    border: p.best ? 'none' : `1px solid ${L.cardBorder}`,
                    borderRadius: 14, fontFamily: L_SANS, fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
                    textAlign: 'center', textDecoration: 'none', display: 'block',
                    boxShadow: p.best ? `0 0 18px ${L.greenGlow}, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
                  }}>{p.best ? 'START 7-DAY FREE TRIAL' : 'GET STARTED'} →</Link>
                </div>
              </Glass>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
