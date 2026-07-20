import { L, L_SERIF, Eyebrow, Glass, TopoBg, SectionHeadline } from './shared';

const team = [
  {
    name: 'Parker Sundell',
    role: 'Founder & CEO',
    initial: 'P',
    photo: '/images/welcome/founder-parker.jpg',
    bio: `Parker Sundell is a lifelong golfer from Michigan, currently playing to a 13 handicap. A self-taught builder and entrepreneur, Parker saw a gap in the golf world — fitness apps had transformed how athletes train, but golfers were still showing up to the range with no plan. He built Caddie AI to change that. As Founder of Caddie AI, Parker leads product development, technology, and company vision — building the app he always wished existed for his own game.`,
  },
  {
    name: 'Teagan Miller',
    role: 'Co-Founder & Head of Brand Growth',
    initial: 'T',
    photo: '/images/welcome/founder-teagan.jpg',
    bio: `Teagan Miller is an ex-Division 1 golfer with 5 years of collegiate experience. Currently a swing coach at Conaway Golf Performance and golf content creator behind @tmillergolf. A former top 500 ranked junior golfer in the world, Teagan combines competitive experience with data-driven coaching to help players improve more efficiently. As Co-Founder of Caddie AI, Teagan helps shape the AI and software to provide proven, personalized practice plans for golfers of all skill levels.`,
  },
];

export default function FoundersV2() {
  return (
    <section id="founders" className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg2, position: 'relative' }}>
      <TopoBg opacity={0.04} count={10} />
      <div style={{ maxWidth: 1300, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Eyebrow>The team</Eyebrow>
          <SectionHeadline>
            Meet the <span style={{ fontStyle: 'italic', color: L.green }}>Founders</span>.
          </SectionHeadline>
          <p style={{ fontSize: 16, color: L.inkSoft, marginTop: 16 }}>Built by golfers who understand the game</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-[60px] md:grid-cols-2">
          {team.map((m, i) => (
            <Glass key={i} padding={0}>
              <div className="flex flex-col items-center gap-5 p-7 md:p-10">
                {/* Circular avatar with gradient ring — real founder photos exist in the repo */}
                <div style={{
                  width: 180, height: 180, borderRadius: 90, padding: 4,
                  background: `linear-gradient(135deg, ${L.green}, ${L.gold})`,
                  boxShadow: `0 0 32px ${L.greenGlow}`,
                }}>
                  <img
                    src={m.photo}
                    alt={m.name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: L_SERIF, fontSize: 32, fontWeight: 500, color: L.cream, letterSpacing: -0.5 }}>{m.name}</div>
                  <Eyebrow color={L.green} style={{ marginTop: 4 }}>{m.role}</Eyebrow>
                </div>
                <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.65, marginTop: 6, marginBottom: 0, textAlign: 'left' }}>
                  {m.bio}
                </p>
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </section>
  );
}
