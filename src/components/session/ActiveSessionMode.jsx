import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { applyProgressiveOverload } from '@/lib/drillLibrary';
import ActiveDrillCard from './ActiveDrillCard';
import Portal from '@/lib/portal';

const COACH_REACTIONS = {
  Clicked: ["That's the one ⚡", "Locked in.", "Breakthrough moment.", "That's what we're building."],
  Good: ["Building momentum.", "Solid work.", "Getting there."],
  Okay: ["Keep grinding.", "Progress is progress.", "Show up tomorrow too."],
  Struggled: ["Tough ones make you better.", "That's why we practice.", "It'll click."],
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ActiveSessionMode({ session, user, profile, drillRatings, onClose, onComplete }) {
  const drills = (session.drills || []).map(d => {
    const { drill } = applyProgressiveOverload(d, drillRatings);
    return drill;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [coachReaction, setCoachReaction] = useState(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [direction, setDirection] = useState(1);
  const [floatingPoints, setFloatingPoints] = useState(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const pointsIdRef = useRef(0);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const entries = await unwrap(supabase.from('leaderboard_entry').select('*').eq('month_year', monthYear));
      const sorted = [...entries].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
      const myIdx = sorted.findIndex(e => e.user_email === user?.email);
      const myEntry = myIdx >= 0 ? sorted[myIdx] : null;
      const nextEntry = myIdx > 0 ? sorted[myIdx - 1] : null;
      setLeaderboard({ sorted, myIdx, myEntry, nextEntry });
    } catch (e) {
      // silently fail
    }
  };

  const completedCount = Object.keys(ratings).length;
  const totalCount = drills.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const minutesRemaining = (totalCount - completedCount) * 10;

  const currentDrill = drills[currentIndex];

  const handleRate = async (drillName, rating) => {
    if (ratings[drillName] || isAdvancing) return;
    setIsAdvancing(true);

    const newRatings = { ...ratings, [drillName]: rating };
    setRatings(newRatings);

    // Floating points
    pointsIdRef.current += 1;
    setFloatingPoints({ id: pointsIdRef.current, rating });

    // Coach reaction
    const reaction = getRandom(COACH_REACTIONS[rating] || COACH_REACTIONS.Okay);
    setCoachReaction(reaction);

    // Clear floating points after animation
    setTimeout(() => setFloatingPoints(null), 1200);

    // After 1.5s, advance
    setTimeout(() => {
      setCoachReaction(null);
      if (currentIndex < drills.length - 1) {
        setDirection(1);
        setCurrentIndex(prev => prev + 1);
        setIsAdvancing(false);
      } else {
        // Last drill — trigger completion
        setIsAdvancing(false);
        onComplete({ ratings: newRatings, session });
      }
    }, 1500);
  };

  const myRank = leaderboard ? leaderboard.myIdx + 1 : null;
  const myScore = leaderboard?.myEntry?.total_score || 0;
  const nextScore = leaderboard?.nextEntry?.total_score || null;
  const pointsToNext = nextScore ? Math.ceil(nextScore - myScore + 0.01) : null;

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: '#0a1a0f', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <button
          onClick={() => setShowConfirmExit(true)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">{session.session_type}</p>
          <p className="text-white text-sm font-bold">Drill {currentIndex + 1} of {totalCount}</p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs">{minutesRemaining}m left</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-2 flex-shrink-0">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#a8d5a2' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Leaderboard widget */}
      {leaderboard && myRank && (
        <div className="mx-5 mb-3 px-4 py-2.5 rounded-2xl flex items-center justify-between flex-shrink-0" style={{ backgroundColor: 'rgba(168,213,162,0.08)', border: '1px solid rgba(168,213,162,0.2)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[#a8d5a2] font-black text-lg">#{myRank}</span>
            <span className="text-white/50 text-xs">this month</span>
          </div>
          <div className="text-right">
            <p className="text-white/80 text-xs font-semibold">{myScore.toFixed(1)} pts</p>
            {pointsToNext && <p className="text-white/40 text-[10px]">{pointsToNext.toFixed(1)} to #{myRank - 1}</p>}
          </div>
        </div>
      )}

      {/* Drill card — animated */}
      <div className="flex-1 px-5 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -60, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="absolute inset-0 px-5"
          >
            <ActiveDrillCard
              drill={currentDrill}
              sessionType={session.session_type}
              onRate={handleRate}
              currentRating={ratings[currentDrill?.name]}
              coachReaction={coachReaction}
              drillRatings={drillRatings}
            />
          </motion.div>
        </AnimatePresence>

        {/* Floating points */}
        <AnimatePresence>
          {floatingPoints && (
            <motion.div
              key={floatingPoints.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <span className="text-2xl font-black" style={{ color: '#a8d5a2', textShadow: '0 0 20px rgba(168,213,162,0.6)' }}>+1 pt</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exit confirm */}
      <AnimatePresence>
        {showConfirmExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center p-5"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              className="w-full max-w-sm bg-card rounded-3xl p-6 space-y-4"
            >
              <div className="text-center">
                <h3 className="text-lg font-black text-foreground">Exit Session?</h3>
                <p className="text-sm text-muted-foreground mt-1">Your progress won't be saved if you leave now.</p>
              </div>
              <button
                onClick={() => { setShowConfirmExit(false); onClose(); }}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-destructive/10 text-destructive active:scale-95 transition-all"
              >
                Exit Session
              </button>
              <button
                onClick={() => setShowConfirmExit(false)}
                className="w-full py-3 rounded-2xl font-semibold text-sm bg-muted text-foreground active:scale-95 transition-all"
              >
                Keep Going
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </Portal>
  );
}