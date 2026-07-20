import { useState } from 'react';
import { L, L_SANS, Eyebrow, SectionHeadline } from './shared';

const dms = [
  {
    from: 'Harrison...',
    time: 'MON 9:53 PM',
    msgs: [
      { from: 'them', text: "Hey man love the app. Seems like it's simple and good for someone to use who doesn't have a ton of time to spend at the course ❤️" },
      { from: 'me', text: "Thats great to hear. Thank you. It will get real fun when we get a ton of people competing on the leader board too" },
    ],
  },
  {
    from: 'Jordan B.',
    time: 'WED 7:14 AM',
    msgs: [
      { from: 'them', text: "Used the gate drill for 20 mins last night. Made 8 in a row from 6 feet which I literally have never done. Whatever you're doing in there is working 👀" },
      { from: 'me', text: "Hell yeah dude. Keep logging them and the plan adapts to where you need it most." },
    ],
  },
  {
    from: 'Sam K.',
    time: 'FRI 4:22 PM',
    msgs: [
      { from: 'them', text: "Honest take — the leaderboard is what hooked me. I am not above competing for free shit. App is sick though" },
      { from: 'me', text: "Haha thats exactly the idea. Prizes are about to get a lot better too 🏆" },
    ],
  },
];

const arrowStyle = {
  width: 48, height: 48, borderRadius: 24,
  background: L.card, backdropFilter: 'blur(20px)',
  border: `1px solid ${L.cardBorder}`, color: L.cream,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
};

export default function TestimonialsV2() {
  const [idx, setIdx] = useState(0);
  const len = dms.length;
  const current = dms[idx];

  return (
    <section id="reviews" className="px-5 pb-20 pt-16 md:px-10 md:pb-[100px] md:pt-[120px]" style={{ background: L.bg, position: 'relative' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Eyebrow>Real feedback</Eyebrow>
          <SectionHeadline>
            What golfers <span style={{ fontStyle: 'italic', color: L.green }}>are saying</span>.
          </SectionHeadline>
          <p style={{ fontSize: 15, color: L.inkMute, marginTop: 16 }}>Real Instagram DMs from real users</p>
        </div>

        <div className="relative mt-10 md:mt-[60px]">
          {/* Arrows — inset on mobile so they don't overflow the viewport */}
          <button onClick={() => setIdx((idx - 1 + len) % len)} aria-label="Previous testimonial"
            className="absolute left-0 top-1/2 -translate-y-1/2 md:-left-5" style={arrowStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => setIdx((idx + 1) % len)} aria-label="Next testimonial"
            className="absolute right-0 top-1/2 -translate-y-1/2 md:-right-5" style={arrowStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>

          {/* Phone w/ DM screen */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 380, maxWidth: 'calc(100vw - 80px)', borderRadius: 36, overflow: 'hidden',
              background: '#fff', color: '#000',
              boxShadow: '0 40px 80px rgba(0,0,0,.5), 0 0 0 8px #1a1a1a',
              fontFamily: L_SANS,
            }}>
              {/* iOS status */}
              <div style={{ height: 30, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontSize: 13, fontWeight: 600, color: '#000' }}>
                <span>9:41</span>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <svg width="14" height="9" viewBox="0 0 16 10"><rect x="0" y="6" width="3" height="4" rx=".5" fill="#000"/><rect x="4.5" y="4" width="3" height="6" rx=".5" fill="#000"/><rect x="9" y="2" width="3" height="8" rx=".5" fill="#000"/><rect x="13.5" y="0" width="3" height="10" rx=".5" fill="#000"/></svg>
                </span>
              </div>
              {/* IG nav */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <div style={{
                  width: 38, height: 38, borderRadius: 19, padding: 2,
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14, fontWeight: 600 }}>
                    {current.from[0]}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{current.from}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>Active 18m ago</div>
                </div>
                <div style={{ display: 'flex', gap: 12, color: '#000' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 10s.5-2 3-2 3 2 3 2M9 14a4 4 0 006 0"/></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92V20a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3.08a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72a2 2 0 011.72 2.01z"/></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                </div>
              </div>
              {/* DM body */}
              <div style={{ padding: '20px 16px 24px', background: '#fff', minHeight: 360 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 18 }}>{current.time}</div>
                {current.msgs.map((m, mi) => (
                  <div key={mi} style={{ display: 'flex', justifyContent: m.from === 'them' ? 'flex-start' : 'flex-end', marginBottom: 6 }}>
                    {m.from === 'them' && (
                      <div style={{
                        width: 28, height: 28, borderRadius: 14, alignSelf: 'flex-end', marginRight: 6,
                        background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 11, fontWeight: 600,
                      }}>{current.from[0]}</div>
                    )}
                    <div style={{
                      maxWidth: '72%',
                      padding: '10px 14px',
                      borderRadius: 22,
                      background: m.from === 'them' ? '#efefef' : '#9b59ff',
                      color: m.from === 'them' ? '#000' : '#fff',
                      fontSize: 15, lineHeight: 1.4,
                    }}>{m.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
            {dms.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Testimonial ${i + 1}`} style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
                background: i === idx ? L.green : L.cardBorder, border: 'none', cursor: 'pointer',
                transition: 'all .2s', padding: 0,
              }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
