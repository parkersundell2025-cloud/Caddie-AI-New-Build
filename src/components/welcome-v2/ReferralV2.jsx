import { L, L_SERIF, Eyebrow, Glass, TopoBg, SectionHeadline } from './shared';

const perks = [
  { l: '1 Referral', sub: '= 1 Free Month', icon: '🎁' },
  { l: 'No Limit', sub: 'On Earnings', icon: '∞' },
  { l: 'Automatic', sub: 'No codes needed', icon: '✓' },
];

export default function ReferralV2() {
  return (
    <section className="px-5 py-16 md:px-10 md:py-[120px]" style={{ background: L.bg2, position: 'relative', overflow: 'hidden' }}>
      <TopoBg opacity={0.05} count={10} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow>Earn free golf</Eyebrow>
          <SectionHeadline>
            Refer a friend —<br/>
            get a <span style={{ fontStyle: 'italic', color: L.gold }}>free month</span>.
          </SectionHeadline>
          <p style={{
            fontSize: 17, color: L.inkSoft, lineHeight: 1.55,
            maxWidth: 720, margin: '24px auto 0',
          }}>
            Every golfer you refer who subscribes earns you one free month of Caddie AI. No limit. The more golfers you bring in the more free months you earn. Some of our members will never pay again.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-[18px] sm:grid-cols-3 md:mt-14">
          {perks.map((c, i) => (
            <Glass key={i} padding={32} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, color: L.gold, marginBottom: 12, fontFamily: L_SERIF, fontWeight: 500 }}>{c.icon}</div>
              <div style={{
                fontFamily: L_SERIF, fontSize: 26, fontWeight: 500,
                color: L.cream, letterSpacing: -0.4,
              }}>{c.l}</div>
              <div style={{ fontSize: 13, color: L.inkSoft, marginTop: 6 }}>{c.sub}</div>
            </Glass>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: L.inkMute, marginTop: 40 }}>
          Referral tracking is built into the app. Share your unique link and we handle the rest.
        </p>
      </div>
    </section>
  );
}
