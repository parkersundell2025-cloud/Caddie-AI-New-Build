import { L, L_SERIF, L_SANS, L_MONO, Eyebrow, Pill, LandingWordmark, TopoBg, StoreBadges } from './shared';

// Illustrated "My Plan" app screen, shown inside the hero
function PhoneMyPlan() {
  const days = [
    { d: 'M', done: true }, { d: 'T', done: true }, { d: 'W', done: true },
    { d: 'T', today: true }, { d: 'F' }, { d: 'S' }, { d: 'S' },
  ];
  const drills = [
    { name: 'The Gate Drill — Putting', sub: 'Train your putter face square through impact', tag: 'Putter' },
    { name: 'The Up and Down Challenge', sub: 'Simulate real scrambling pressure situations', tag: 'Sand Wedge' },
    { name: 'The No Wristed Chip Drill', sub: 'Eliminate wrist breakdown in chipping', tag: 'Gap Wedge' },
  ];
  return (
    <div style={{
      width: 320, height: 660, borderRadius: 44, overflow: 'hidden',
      background: '#000',
      boxShadow: '0 40px 80px rgba(0,0,0,.5), inset 0 0 0 1.5px rgba(255,255,255,.06)',
      position: 'relative',
    }}>
      {/* Dynamic island */}
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 104, height: 30, borderRadius: 20, background: '#000', zIndex: 50 }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(120% 60% at 100% 0%, rgba(95,190,126,.10) 0%, transparent 50%), linear-gradient(180deg, ${L.bg2} 0%, ${L.bg} 60%)`,
        color: L.ink, fontFamily: L_SANS,
      }}>
        {/* status bar */}
        <div style={{ position: 'absolute', top: 14, left: 24, fontSize: 13, fontWeight: 600, color: L.ink, fontFamily: L_MONO, zIndex: 5 }}>9:41</div>
        <div style={{ position: 'absolute', top: 14, right: 24, display: 'flex', gap: 4, zIndex: 5 }}>
          <svg width="14" height="9" viewBox="0 0 16 10"><rect x="0" y="6" width="3" height="4" rx=".5" fill={L.ink}/><rect x="4.5" y="4" width="3" height="6" rx=".5" fill={L.ink}/><rect x="9" y="2" width="3" height="8" rx=".5" fill={L.ink}/><rect x="13.5" y="0" width="3" height="10" rx=".5" fill={L.ink}/></svg>
        </div>

        {/* content */}
        <div style={{ position: 'absolute', top: 50, left: 0, right: 0, bottom: 60, padding: '12px 20px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <LandingWordmark size={15} color={L.cream} />
            <div style={{
              padding: '6px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: L.cardSolid, color: L.cream, display: 'flex', alignItems: 'center', gap: 5,
              border: `1px solid ${L.cardBorder}`,
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c0-5.5 4.5-10 10-10s10 4.5 10 10M12 6v6l4 2"/></svg>
              New Plan
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: L_SERIF, fontSize: 26, fontWeight: 500, color: L.cream, letterSpacing: -0.6 }}>My Plan</div>
            <div style={{ fontSize: 11, color: L.inkMute, marginTop: 2, fontWeight: 500 }}>May 18 – May 24</div>
          </div>

          {/* Days strip */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            {days.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: d.today ? L.green : L.inkMute, letterSpacing: 0.5 }}>{d.d}</div>
                <div style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: d.done ? 'rgba(95,190,126,.18)' : 'transparent',
                  border: d.today ? `1.5px solid ${L.green}` : `1px solid ${L.line}`,
                  color: d.done ? L.green : L.inkMute,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"/></svg>}
                </div>
              </div>
            ))}
          </div>

          {/* Monday TODAY card */}
          <div style={{
            marginTop: 16, padding: '14px 14px 16px',
            background: L.card, borderRadius: 16, border: `1.5px solid ${L.green}`,
            position: 'relative', overflow: 'hidden',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 0 20px ${L.greenGlow}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontFamily: L_SERIF, fontSize: 16, fontWeight: 500, color: L.cream, letterSpacing: -0.2 }}>Monday</div>
              <Pill color={L.green} bg="rgba(95,190,126,.16)">Today</Pill>
            </div>
            <div style={{ fontSize: 11, color: L.inkMute, marginTop: 1, fontWeight: 500 }}>Putting &amp; Short Game · 45m</div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {drills.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 4, height: 4, borderRadius: 2, background: L.green, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: L.cream, letterSpacing: -0.1 }}>{d.name}</div>
                    <div style={{ fontSize: 9, color: L.inkSoft, marginTop: 1, lineHeight: 1.4 }}>{d.sub}</div>
                    <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 6px', borderRadius: 4, background: 'rgba(244,239,227,.06)', fontSize: 8, color: L.inkMute, fontWeight: 600 }}>⛳ {d.tag}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 14, width: '100%', padding: '11px 14px',
              background: L.green, color: L.bg, borderRadius: 12,
              fontFamily: L_SANS, fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 0 16px ${L.greenGlow}, inset 0 1px 0 rgba(255,255,255,.2)`,
            }}>
              Start Session →
            </div>
          </div>

          {/* Thursday + Saturday cards */}
          {[
            { day: 'Thursday', label: 'Range Day · 45m', dot: L.inkMute },
            { day: 'Saturday', label: 'Golf Fitness · 45m', dot: L.gold },
          ].map((c, i) => (
            <div key={i} style={{
              marginTop: 8, padding: '11px 14px',
              background: L.card, borderRadius: 14, border: `1px solid ${L.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backdropFilter: 'blur(20px)',
            }}>
              <div>
                <div style={{ fontFamily: L_SERIF, fontSize: 14, fontWeight: 500, color: L.cream, letterSpacing: -0.2 }}>{c.day}</div>
                <div style={{ fontSize: 10, color: L.inkMute, marginTop: 1 }}>{c.label}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: c.dot }} />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={L.inkMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12, height: 50,
          background: 'rgba(20,26,23,.78)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${L.cardBorder}`,
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}>
          {[
            { icon: 'home', label: 'Home' },
            { icon: 'plan', label: 'My Plan', active: true },
            { icon: 'chart', label: 'Progress' },
            { icon: 'chat', label: 'Coach' },
            { icon: 'cup', label: 'Leaders' },
          ].map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: t.active ? '5px 9px' : '5px 0',
              background: t.active ? L.green : 'transparent',
              color: t.active ? L.bg : L.inkMute,
              borderRadius: 14,
              fontSize: 9, fontWeight: 700, letterSpacing: -0.05,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {t.icon === 'home' && <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2z"/>}
                {t.icon === 'plan' && <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>}
                {t.icon === 'chart' && <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></>}
                {t.icon === 'chat' && <path d="M21 12a8 8 0 11-3.4-6.55L21 4l-1.45 3.4A8 8 0 0121 12z"/>}
                {t.icon === 'cup' && <><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0z"/><path d="M17 4h3v3a3 3 0 01-3 3M7 4H4v3a3 3 0 003 3"/></>}
              </svg>
              {t.active && t.label}
            </div>
          ))}
        </div>

        {/* home indicator */}
        <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 120, height: 4, background: L.ink, opacity: .4, borderRadius: 2 }} />
      </div>
    </div>
  );
}

export default function HeroV2() {
  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      background: `radial-gradient(80% 60% at 80% 20%, rgba(63,111,79,.45) 0%, transparent 60%), linear-gradient(180deg, ${L.bgGrad} 0%, ${L.bg} 100%)`,
    }}>
      <TopoBg opacity={0.08} count={14} />

      {/* Golf-ball-on-tee aura, faint, behind the hero copy */}
      <div style={{
        position: 'absolute', top: '50%', left: '32%', transform: 'translate(-50%, -50%)',
        width: 540, height: 540, borderRadius: 270,
        background: 'radial-gradient(circle, rgba(95,190,126,.16) 0%, rgba(95,190,126,0) 70%)',
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      <div
        className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-5 pb-16 pt-12 md:px-10 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-[60px] lg:pb-[120px]"
      >
        {/* Copy */}
        <div>
          <Eyebrow>For golfers who are serious about getting better</Eyebrow>
          <h1 style={{
            fontFamily: L_SERIF, fontSize: 'clamp(46px, 9.5vw, 92px)', fontWeight: 500,
            color: L.cream, letterSpacing: '-0.033em', lineHeight: 0.96,
            marginTop: 24, marginBottom: 0,
          }}>
            A Golf Coach<br/>
            That <span style={{ fontStyle: 'italic', color: L.green }}>Knows</span><br/>
            Your Game.
          </h1>
          <p style={{
            fontSize: 18, color: L.inkSoft, lineHeight: 1.55,
            maxWidth: 510, marginTop: 28, marginBottom: 8,
          }}>
            Personalized practice plans. Real coaching based on your actual rounds and sessions. A live leaderboard competing for real prizes. <span style={{ color: L.cream, fontWeight: 600 }}>Less than one lesson a month.</span>
          </p>
          <p style={{
            fontFamily: L_SERIF, fontSize: 15, fontStyle: 'italic',
            color: L.inkMute, marginTop: 16, marginBottom: 36,
          }}>
            Built by a golfer. For golfers who are serious about improving.
          </p>

          {/* Single CTA per client: App Store badge only (email capture
              removed from the hero; the bottom-of-page capture remains) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <StoreBadges placement="hero" />
          </div>

          {/* Live counter */}
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 10, height: 10 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 5, background: L.green, boxShadow: `0 0 8px ${L.green}` }} />
              <div style={{ position: 'absolute', inset: -3, borderRadius: 8, border: `1px solid ${L.green}`, opacity: 0.4 }} />
            </div>
            <div style={{ fontSize: 13, color: L.inkSoft }}>
              <span style={{ fontFamily: L_MONO, fontWeight: 700, color: L.cream }}>198</span> golfers already joined
            </div>
          </div>
        </div>

        {/* Phone */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 480, height: 480, borderRadius: 240, maxWidth: '100vw',
            background: L.greenGlow, filter: 'blur(80px)', pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', transform: 'rotate(-2deg)' }}>
            <PhoneMyPlan />
          </div>
        </div>
      </div>

      {/* Store badges — centered under the phone, full page width */}
      <div className="relative mt-0 flex flex-wrap justify-center gap-3 px-5 pb-16 lg:mt-9 lg:pb-20">
        <StoreBadges placement="under-phone" />
      </div>

      {/* Scroll cue */}
      <div className="hidden lg:block" style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', color: L.inkMute, animation: 'cutBounce 2s infinite' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <style>{`
        @keyframes cutBounce { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 6px); } }
      `}</style>
    </section>
  );
}
