import { L, L_SERIF, Eyebrow, Glass, SectionHeadline } from './shared';

const steps = [
  {
    n: '01',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="10" r="5" />
        <path d="M5 28c0-6 5-10 11-10s11 4 11 10" />
        <circle cx="22" cy="6" r="2" fill={L.gold} stroke="none" />
      </svg>
    ),
    title: 'Tell Us About Your Game',
    body: 'Answer a few quick questions about your handicap, goals and how often you can practice. Takes 2 minutes. Your personalized plan is ready immediately.',
  },
  {
    n: '02',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="20" height="24" rx="2.5" />
        <path d="M11 4v3h10V4" />
        <path d="M11 13h10M11 18h10M11 23h6" />
      </svg>
    ),
    title: 'Practice With Purpose',
    body: 'Every session has specific drills targeting your exact weaknesses. Rate each drill after you complete it — Struggled, Okay, Good or Clicked — and your plan adapts automatically. The more you use it the smarter it gets.',
  },
  {
    n: '03',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 28h10M16 22v6M9 4h14v5a7 7 0 01-14 0z" />
        <path d="M23 4h4v4a4 4 0 01-4 4M9 4H5v4a4 4 0 004 4" />
      </svg>
    ),
    title: 'Compete and Win',
    body: 'Log your rounds, track your handicap and compete on the leaderboard. Top ranked golfer every month wins real prizes — free months, Caddie AI merch, rangefinders and eventually tour level drivers. The more you practice the higher you rank.',
  },
];

export default function HowItWorksV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg, position: 'relative' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="mb-12 text-center md:mb-20">
          <Eyebrow>Simple by design</Eyebrow>
          <SectionHeadline>
            Stop guessing what to<br/>
            practice <span style={{ fontStyle: 'italic', color: L.green }}>in 3 steps</span>.
          </SectionHeadline>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Glass key={i} padding={32} style={{ minHeight: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  fontFamily: L_SERIF, fontSize: 44, fontWeight: 400,
                  color: L.gold, letterSpacing: -2, lineHeight: 1, fontStyle: 'italic',
                }}>{s.n}</div>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'rgba(217,177,74,.10)', border: '1px solid rgba(217,177,74,.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.icon}</div>
              </div>
              <div style={{
                fontFamily: L_SERIF, fontSize: 26, fontWeight: 500,
                color: L.cream, letterSpacing: -0.4, lineHeight: 1.15,
              }}>{s.title}</div>
              <p style={{
                fontSize: 14, color: L.inkSoft, lineHeight: 1.65,
                marginTop: 14, marginBottom: 0,
              }}>{s.body}</p>
            </Glass>
          ))}
        </div>
      </div>
    </section>
  );
}
