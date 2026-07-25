import React, { useState, useEffect, useRef } from 'react';
import { maybeRequestReview } from '@/lib/appReview';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { unwrap, invokeLLM } from '@/lib/db';
import { generateSessionShareCard, shareImageBlob } from '@/components/share/shareCard';
import Portal from '@/lib/portal';

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#5FBE7E', '#F4EFE3', '#D9B14A', '#86efac', '#0E4D2B', '#d1fae5'];
const NUM_PARTICLES = 40;

function ConfettiParticle({ delay }) {
  const angle = Math.random() * 360;
  const distance = 80 + Math.random() * 180;
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * distance;
  const ty = Math.sin(rad) * distance;
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const size = 6 + Math.random() * 8;
  const isRect = Math.random() > 0.5;

  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
      animate={{
        x: tx,
        y: ty + 120,
        opacity: 0,
        scale: [0, 1.2, 1],
        rotate: Math.random() * 720 - 360,
      }}
      transition={{ duration: 1.2 + Math.random() * 0.8, delay, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width: isRect ? size * 0.6 : size,
        height: isRect ? size * 1.4 : size,
        backgroundColor: color,
        borderRadius: isRect ? 2 : '50%',
        top: '50%',
        left: '50%',
      }}
    />
  );
}

function Confetti() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
        <ConfettiParticle key={i} delay={i * 0.02} />
      ))}
    </div>
  );
}

// ── Animated count-up ─────────────────────────────────────────────────────────
function CountUp({ target, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    startRef.current = null;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.min(elapsed / duration, 1);
      setDisplay(Math.round(pct * target));
      if (pct < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return <span>{display}</span>;
}

// ── Headline logic ─────────────────────────────────────────────────────────────
function getHeadline(ratings) {
  const vals = Object.values(ratings);
  const clicked = vals.filter(r => r === 'Clicked').length;
  const good = vals.filter(r => r === 'Good').length;
  const struggled = vals.filter(r => r === 'Struggled').length;
  const total = vals.length;
  if (total === 0) return 'Session Complete! ✅';
  if (clicked === total) return "You're dialed in today 🔥";
  if (clicked + good >= total * 0.7) return "Locked in. That's a great session.";
  if (good + vals.filter(r => r === 'Okay').length >= total * 0.6) return "Solid work. Keep showing up.";
  if (struggled > 0) return "Tough day makes a better golfer. Well done.";
  return "Session Complete! ✅";
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SessionCelebration({ ratings, session, user, profile, leaderboard, onBack }) {
  // Success moment (completed session / new badge) — ask for a store review
  // at the natural pause when the golfer leaves the celebration
  const handleBack = () => {
    maybeRequestReview();
    onBack();
  };
  const [newLeaderboard, setNewLeaderboard] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [coachNote, setCoachNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(true);
  const [streak, setStreak] = useState(profile?.streak_days || 0);
  const [confettiKey] = useState(Date.now());

  const sessionPoints = 1; // 1 point per session in the scoring system
  const headline = getHeadline(ratings);
  const oldRank = leaderboard ? leaderboard.myIdx + 1 : null;

  useEffect(() => {
    // Fetch updated leaderboard after slight delay (let updateLeaderboard finish)
    const t = setTimeout(async () => {
      try {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const entries = await unwrap(supabase.from('leaderboard_entry').select('*').eq('month_year', monthYear));
        const sorted = [...entries].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        const myIdx = sorted.findIndex(e => e.user_email === user?.email);
        const nextEntry = myIdx > 0 ? sorted[myIdx - 1] : null;
        setNewLeaderboard({ sorted, myIdx, myEntry: sorted[myIdx] || null, nextEntry });
      } catch (e) {}
    }, 2000);

    // Fetch coach note
    const generateNote = async () => {
      try {
        const ratingsText = Object.entries(ratings)
          .map(([drill, rating]) => `${drill}: ${rating}`)
          .join(', ');
        const note = await invokeLLM({
          prompt: `Give a 2 sentence post-session coaching note based on these drill ratings: ${ratingsText}. Highlight what clicked and what to focus on next session. Be specific and direct.`,
        });
        setCoachNote(typeof note === 'string' ? note : note?.text || '');
      } catch (e) {
        setCoachNote('Great effort today. Keep focusing on the fundamentals and show up again tomorrow.');
      } finally {
        setLoadingNote(false);
      }
    };

    // Check for new badges
    const getBadges = async () => {
      try {
        const res = await supabase.functions.invoke('checkBadges', { body: {} });
        if (res.data?.newBadges?.length > 0) setNewBadges(res.data.newBadges);
      } catch (e) {}
    };

    generateNote();
    getBadges();
    return () => clearTimeout(t);
  }, []);

  const displayLeaderboard = newLeaderboard || leaderboard;
  const newRank = displayLeaderboard ? displayLeaderboard.myIdx + 1 : null;
  const rankImproved = oldRank && newRank && newRank < oldRank;
  const currentScore = displayLeaderboard?.myEntry?.total_score || 0;
  const nextScore = displayLeaderboard?.nextEntry?.total_score || null;
  const pointsToNext = nextScore ? Math.ceil(nextScore - currentScore + 0.01) : null;

  const handleShare = async () => {
    try {
      const blob = await generateSessionShareCard({
        sessionType: session.session_type || 'Practice',
        duration: session.duration || 45,
        drillCount: (session.drills || []).length || null,
        firstName: profile?.first_name || 'Golfer',
        streakDays: streak,
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      });
      await shareImageBlob(blob);
    } catch (e) {}
  };

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #0E4D2B 0%, #0B0F0C 60%)',
        paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))',
        paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 1.5rem)',
      }}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Confetti key={confettiKey} />
      </div>

      <div className="flex flex-col items-center px-6 pt-8 pb-6 space-y-6 relative z-10">
        {/* Headline */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 15 }}
          className="text-center space-y-2"
        >
          <h1 className="cut-headline text-3xl text-white leading-tight">
            {headline}
          </h1>
        </motion.div>

        {/* Points */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center px-8 py-5 rounded-3xl w-full max-w-xs"
          style={{ backgroundColor: 'rgba(95,190,126,0.12)', border: '1px solid rgba(95,190,126,0.25)' }}
        >
          <p className="text-6xl font-mono font-bold text-white" style={{ letterSpacing: '-2px' }}>
            <CountUp target={sessionPoints} duration={1000} />
          </p>
          <p className="text-[#5FBE7E] text-sm font-semibold mt-1">Session Points Earned</p>
        </motion.div>

        {/* Rank */}
        {newRank && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="w-full px-5 py-4 rounded-2xl"
            style={{ backgroundColor: 'rgba(244,239,227,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                {rankImproved ? (
                  <p className="text-[#5FBE7E] font-bold text-sm">📈 You moved up to #{newRank} this month!</p>
                ) : (
                  <p className="text-white/70 font-bold text-sm">You're holding at #{newRank} this month</p>
                )}
                {pointsToNext && (
                  <p className="text-white/40 text-xs mt-0.5">{pointsToNext.toFixed(1)} pts behind #{newRank - 1}</p>
                )}
              </div>
              <span className="text-3xl font-black" style={{ color: rankImproved ? '#5FBE7E' : 'white' }}>
                #{newRank}
              </span>
            </div>
          </motion.div>
        )}

        {/* Streak */}
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.85 }}
            className="flex items-center gap-2"
          >
            <span className="text-2xl">🔥</span>
            <span className="text-white font-black text-lg">{streak} day streak</span>
          </motion.div>
        )}

        {/* Badge earned */}
        {newBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, type: 'spring', damping: 16 }}
            className="w-full px-5 py-4 rounded-2xl text-center"
            style={{ backgroundColor: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)' }}
          >
            <p className="text-[#f5c842] text-xs font-bold uppercase tracking-widest mb-1">Badge Earned!</p>
            <p className="text-white font-black text-lg">🏅 {newBadges[0].name}</p>
            <p className="text-white/50 text-xs capitalize">{newBadges[0].tier}</p>
          </motion.div>
        )}

        {/* Coach note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="w-full px-5 py-4 rounded-2xl space-y-2"
          style={{ backgroundColor: 'rgba(244,239,227,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🎙️</span>
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Coach's Note</p>
          </div>
          {loadingNote ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-white/40 text-sm">Generating...</p>
            </div>
          ) : (
            <p className="text-white/75 text-sm leading-relaxed">{coachNote}</p>
          )}
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="w-full space-y-3"
        >
          <button
            onClick={handleBack}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all"
            style={{ backgroundColor: '#5FBE7E', color: '#0B0F0C', boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
          >
            Back to Plan
          </button>
          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all"
            style={{ backgroundColor: 'rgba(95,190,126,0.15)', color: '#5FBE7E', border: '1px solid rgba(95,190,126,0.3)' }}
          >
            Share Achievement →
          </button>
        </motion.div>
      </div>
    </motion.div>
    </Portal>
  );
}