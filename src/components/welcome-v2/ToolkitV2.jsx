import { L, L_SERIF, Eyebrow, Glass, TopoBg, SectionHeadline } from './shared';

const features = [
  {
    title: 'Practice Plans That Get Harder As You Improve',
    body: 'Your weekly plan is built around your specific strengths and weaknesses. As you rate each drill the plan adapts — harder when you are clicking, scaled back when you are struggling. 70 drills across 6 categories. No two weeks are the same.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="11" /><circle cx="16" cy="16" r="6" /><circle cx="16" cy="16" r="2" fill={L.green} stroke="none" />
      </svg>
    ),
    imgGradient: 'linear-gradient(135deg, #2D5239 0%, #5FBE7E 100%)',
  },
  {
    title: 'Compete for Real Golf Gear Every Month',
    body: 'The leaderboard ranks every golfer based on how much they practice AND how much they improve — not just their handicap. It is a level playing field. Right now the top player wins a free month. As we grow the prizes get bigger — rangefinders, TaylorMade drivers and Caddie AI merch. New prize every month.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 28h10M16 22v6M9 4h14v5a7 7 0 01-14 0z" />
        <path d="M23 4h4v4a4 4 0 01-4 4M9 4H5v4a4 4 0 004 4" />
      </svg>
    ),
    imgGradient: 'linear-gradient(135deg, #1A1F2D 0%, #4A3E2A 60%, #D9B14A 100%)',
  },
  {
    title: 'A Coach That Learns Your Game Over Time',
    body: 'Your AI coach knows your handicap, every round you have logged, every drill you have rated and every skill area you are working on. The more you use Caddie AI the smarter your coach gets. Ask it anything — technique, strategy, what to work on next. Real advice based on your actual game. Available 24 hours a day.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={L.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 16a12 12 0 11-5.1-9.85L28 5l-2.15 5.1A12 12 0 0128 16z" />
      </svg>
    ),
    imgGradient: 'linear-gradient(135deg, #0F1714 0%, #1A1F2D 50%, #2D5239 100%)',
  },
];

export default function ToolkitV2() {
  return (
    <section id="toolkit" className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg2, position: 'relative' }}>
      <TopoBg opacity={0.04} count={10} />
      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        <div className="mb-12 text-center md:mb-20">
          <Eyebrow>The Toolkit</Eyebrow>
          <SectionHeadline>
            Everything your<br/>
            game <span style={{ fontStyle: 'italic', color: L.green }}>needs</span>.
          </SectionHeadline>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <Glass key={i} padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Image header */}
              <div style={{
                aspectRatio: '16/10', position: 'relative',
                background: f.imgGradient,
                overflow: 'hidden',
              }}>
                <svg width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
                  {[20, 50, 80, 110, 140, 170, 200, 230].map((y, idx) => (
                    <path key={idx} d={`M0 ${y} Q100 ${y - 12} 200 ${y} T400 ${y}`} stroke={L.cream} strokeWidth="1" fill="none" />
                  ))}
                </svg>
                {/* Floating glass icon tile */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: 76, height: 76, borderRadius: 18,
                  background: 'rgba(244,239,227,.10)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid rgba(244,239,227,.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.2)',
                }}>{f.icon}</div>
              </div>
              {/* Copy */}
              <div style={{ padding: '24px 26px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  fontFamily: L_SERIF, fontSize: 22, fontWeight: 500,
                  color: L.cream, letterSpacing: -0.4, lineHeight: 1.2,
                }}>{f.title}</div>
                <p style={{
                  fontSize: 13.5, color: L.inkSoft, lineHeight: 1.6,
                  marginTop: 12, marginBottom: 0,
                }}>{f.body}</p>
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </section>
  );
}
