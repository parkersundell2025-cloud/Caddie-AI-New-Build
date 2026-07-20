import { L, L_SERIF, Eyebrow, Glass, Pill, SectionHeadline } from './shared';

const tiers = [
  {
    status: 'NOW', color: L.green, bg: 'rgba(95,190,126,.15)',
    icon: '🏆',
    title: 'Free Month of Caddie AI',
    body: 'Top ranked golfer every month wins a free month — automatically applied to their account',
  },
  {
    status: 'COMING SOON', color: '#E89A3D', bg: 'rgba(232,154,61,.15)',
    icon: '🧢',
    title: 'Caddie AI Merch Pack',
    body: 'Branded hat, shirt and bag tag — rep the brand on the course',
  },
  {
    status: 'GROWING', color: '#5189E8', bg: 'rgba(81,137,232,.15)',
    icon: '🔭',
    title: 'Premium Rangefinder',
    body: 'A top rated golf rangefinder for the monthly champion',
  },
  {
    status: 'SCALING', color: '#A375E8', bg: 'rgba(163,117,232,.15)',
    icon: '🏌',
    title: 'Tour Level Driver',
    body: 'A brand new TaylorMade or Callaway driver — every single month',
  },
];

export default function PrizesV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg, position: 'relative' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Eyebrow>The prizes get bigger</Eyebrow>
          <SectionHeadline>
            We are just <span style={{ fontStyle: 'italic', color: L.green }}>getting started</span>.
          </SectionHeadline>
          <p style={{ fontSize: 17, color: L.inkSoft, lineHeight: 1.55, maxWidth: 720, margin: '24px auto 0' }}>
            Right now our monthly leaderboard winner gets a free month of Caddie AI. As our community grows so do the prizes. Help us grow and the prizes grow with you.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-[18px] sm:grid-cols-2 md:mt-[60px] lg:grid-cols-4">
          {tiers.map((t, i) => (
            <Glass key={i} padding={26} style={{ minHeight: 240 }}>
              <Pill color={t.color} bg={t.bg}>{t.status}</Pill>
              <div style={{ fontSize: 36, marginTop: 18 }}>{t.icon}</div>
              <div style={{
                fontFamily: L_SERIF, fontSize: 20, fontWeight: 500,
                color: L.cream, letterSpacing: -0.3, marginTop: 10, lineHeight: 1.15,
              }}>{t.title}</div>
              <p style={{ fontSize: 13, color: L.inkSoft, lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{t.body}</p>
            </Glass>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: L.inkMute, marginTop: 44, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
          Prize upgrades are tied to subscriber milestones. Every referral gets us closer. Refer a friend after joining and earn a free month while helping unlock bigger prizes for everyone.
        </p>
      </div>
    </section>
  );
}
