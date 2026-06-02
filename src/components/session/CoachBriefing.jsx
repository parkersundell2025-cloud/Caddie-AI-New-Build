import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, ChevronRight } from 'lucide-react';
import { invokeLLM } from '@/lib/db';
import { SESSION_TYPE_COLORS } from '@/lib/sessionTypeColors';
import Portal from '@/lib/portal';

const DEFAULT_BRIEFINGS = {
  'Range Day': "Let's sharpen your ball striking today. Focus on hitting it flush and building your power sequence.",
  'Putting & Short Game': "Short game wins rounds. Today is about feel, landing spot discipline and holing more putts.",
  'Golf Fitness': "A stronger, more flexible body means more speed and control. Let's build that foundation today.",
  'Course Management': "Smart golf beats long golf. Today you'll sharpen your decision making under pressure.",
  default: "Great players are made in practice. Let's get to work — every rep today is a stroke saved on the course.",
};

function getWeakestSkill(profile) {
  const skills = {
    Driving: profile?.skill_driving || 3,
    'Iron Play': profile?.skill_iron_play || 3,
    'Short Game': profile?.skill_short_game || 3,
    Putting: profile?.skill_putting || 3,
    'Course Management': profile?.skill_course_management || 3,
  };
  return Object.entries(skills).sort((a, b) => a[1] - b[1])[0]?.[0] || 'Short Game';
}

export default function CoachBriefing({ session, profile, drillRatings, onStart, onClose }) {
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);
  const colors = SESSION_TYPE_COLORS[session.session_type] || SESSION_TYPE_COLORS['Rest & Recovery'];
  const drills = session.drills || [];
  const pointsAvailable = drills.length;
  const estimatedMinutes = drills.length * 10;

  useEffect(() => {
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      setBriefing(DEFAULT_BRIEFINGS[session.session_type] || DEFAULT_BRIEFINGS.default);
      setLoading(false);
    }, 3000);

    const generate = async () => {
      try {
        const weakest = getWeakestSkill(profile);
        const recentRatings = (drillRatings || []).slice(0, 10);
        const ratingsSummary = recentRatings.length > 0
          ? recentRatings.map(r => `${r.drill_name}: ${r.rating}`).join(', ')
          : 'No recent history';

        const result = await invokeLLM({
          prompt: `Give a motivating 2 sentence pre-session briefing for a golfer about to do a ${session.session_type} session. Their weakest skill is ${weakest}. Recent drill ratings: ${ratingsSummary}. Keep it direct, specific and motivating. No fluff. No bullet points. Just 2 sentences.`,
        });

        if (!timedOut) {
          clearTimeout(timeout);
          setBriefing(typeof result === 'string' ? result : result?.text || DEFAULT_BRIEFINGS[session.session_type] || DEFAULT_BRIEFINGS.default);
          setLoading(false);
        }
      } catch (e) {
        if (!timedOut) {
          clearTimeout(timeout);
          setBriefing(DEFAULT_BRIEFINGS[session.session_type] || DEFAULT_BRIEFINGS.default);
          setLoading(false);
        }
      }
    };

    generate();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26 }}
        className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-5"
        style={{
          backgroundColor: '#0d1f16',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#a8d5a2]/70 text-xs font-bold uppercase tracking-widest">Coach's Briefing</p>
            <h3 className="text-white font-black text-xl mt-0.5">{session.title || session.session_type}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Coach avatar + briefing */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-2xl" style={{ backgroundColor: 'rgba(168,213,162,0.08)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: '#1a4d2e' }}>
            🏌️
          </div>
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#a8d5a2] animate-spin" />
                <p className="text-white/50 text-sm">Preparing your briefing...</p>
              </div>
            ) : (
              <p className="text-white/80 text-sm leading-relaxed">{briefing}</p>
            )}
          </div>
        </div>

        {/* Session overview */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Today's Drills</p>
          <div className="space-y-1.5">
            {drills.slice(0, 4).map((drill, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.hex }} />
                <p className="text-white/70 text-sm">{drill.name}</p>
              </div>
            ))}
            {drills.length > 4 && (
              <p className="text-white/40 text-xs ml-3.5">+{drills.length - 4} more</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          <div className="flex-1 px-3 py-2.5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <p className="text-white font-black text-lg">~{estimatedMinutes}m</p>
            <p className="text-white/40 text-xs">Est. time</p>
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <p className="text-white font-black text-lg">{pointsAvailable}</p>
            <p className="text-white/40 text-xs">pts available</p>
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <p className="text-white font-black text-lg">{drills.length}</p>
            <p className="text-white/40 text-xs">drills</p>
          </div>
        </div>

        {/* Let's Go button */}
        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{ backgroundColor: '#a8d5a2', color: '#0d1f16' }}
        >
          Let's Go <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
    </Portal>
  );
}