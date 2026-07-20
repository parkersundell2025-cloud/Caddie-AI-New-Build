import { L, L_SERIF, L_MONO, Eyebrow, Glass, SectionHeadline } from './shared';

const phases = [
  {
    n: '01', label: 'Week 1',
    icon: '⛳',
    body: 'Your practice plan is built around your onboarding data. Your coach learns your goals, your handicap and your weakest areas.',
  },
  {
    n: '02', label: 'Month 1',
    icon: '📈',
    body: 'Your drills start adapting based on your ratings. Your coach references specific sessions and rounds in its advice. Your handicap tracker shows real movement.',
  },
  {
    n: '03', label: 'Month 3',
    icon: '🏆',
    body: 'Your coach has deep context on your game. Your skill profile shows clear trends. You are competing on the leaderboard and your drills are significantly more advanced than when you started.',
  },
  {
    n: '04', label: 'Month 6+',
    icon: '🎯',
    body: 'Your coach knows your game better than most playing partners. Your practice is fully personalized. You are a measurably better golfer.',
  },
];

export default function SmarterOverTimeV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg, position: 'relative' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Eyebrow>Built to improve with you</Eyebrow>
          <SectionHeadline>
            The more you use it<br/>
            the <span style={{ fontStyle: 'italic', color: L.green }}>smarter</span> it gets.
          </SectionHeadline>
          <p style={{
            fontSize: 17, color: L.inkSoft, lineHeight: 1.55,
            maxWidth: 720, margin: '24px auto 0',
          }}>
            Caddie AI is not a static app. Every session you complete, every round you log and every drill you rate makes your coaching more personalized.
          </p>
        </div>

        {/* Timeline rail */}
        <div className="relative mt-10 md:mt-20">
          {/* Connector line — only meaningful when cards sit on one row */}
          <div className="hidden lg:block" style={{
            position: 'absolute', top: '50%', left: '6%', right: '6%', height: 2,
            background: `linear-gradient(90deg, ${L.greenSoft} 0%, ${L.green} 50%, ${L.gold} 100%)`,
            opacity: 0.3, zIndex: 0,
          }} />
          <div className="relative z-[1] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Dot */}
                <div style={{
                  width: 14, height: 14, borderRadius: 7,
                  background: i < 2 ? L.green : L.gold,
                  boxShadow: `0 0 14px ${i < 2 ? L.greenGlow : 'rgba(217,177,74,.4)'}`,
                  marginBottom: 20,
                  border: `3px solid ${L.bg}`,
                }} />
                <Glass padding={26} style={{ width: '100%', minHeight: 230 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ fontFamily: L_MONO, fontSize: 11, fontWeight: 700, color: L.gold, letterSpacing: 1 }}>{p.n}</div>
                    <div style={{ fontSize: 22 }}>{p.icon}</div>
                  </div>
                  <div style={{
                    fontFamily: L_SERIF, fontSize: 24, fontWeight: 500,
                    color: L.cream, letterSpacing: -0.3, lineHeight: 1,
                  }}>{p.label}</div>
                  <p style={{
                    fontSize: 13, color: L.inkSoft, lineHeight: 1.6,
                    marginTop: 12, marginBottom: 0,
                  }}>{p.body}</p>
                </Glass>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
