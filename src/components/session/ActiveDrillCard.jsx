import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { getDrillByName } from '@/lib/drillLibrary';

import { SESSION_TYPE_COLORS } from '@/lib/sessionTypeColors';

const SESSION_TYPE_LABELS = {
  'Range Day': { label: 'Range Day', color: '#1a4d2e' },
  'Putting & Short Game': { label: 'Short Game', color: '#1a6b5a' },
  'Golf Fitness': { label: 'Fitness', color: '#b07d2a' },
  'Course Management': { label: 'Strategy', color: '#2a4a7a' },
  'Rest & Recovery': { label: 'Rest', color: '#3a3f4a' },
};

const DIFFICULTY_COLORS = {
  Beginner: 'rgba(168,213,162,0.2)',
  Intermediate: 'rgba(255,200,100,0.2)',
  Advanced: 'rgba(255,100,100,0.15)',
};
const DIFFICULTY_TEXT = {
  Beginner: '#a8d5a2',
  Intermediate: '#f5c842',
  Advanced: '#ff7070',
};

const RATING_CONFIG = [
  { value: 'Struggled', emoji: '😤', label: 'Struggled', bg: '#7f1d1d', text: '#fca5a5', activeBg: '#991b1b' },
  { value: 'Okay', emoji: '😐', label: 'Okay', bg: '#1f2937', text: '#9ca3af', activeBg: '#374151' },
  { value: 'Good', emoji: '😊', label: 'Good', bg: '#1e3a5f', text: '#93c5fd', activeBg: '#1d4ed8' },
  { value: 'Clicked', emoji: '⚡', label: 'Clicked', bg: '#14532d', text: '#86efac', activeBg: '#15803d' },
];

export default function ActiveDrillCard({ drill, sessionType, onRate, currentRating, coachReaction }) {
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCheck, setShowCheck] = useState(false);

  const drillData = getDrillByName(drill?.name) || drill;
  const typeInfo = SESSION_TYPE_LABELS[sessionType] || SESSION_TYPE_LABELS['Range Day'];
  const difficulty = drillData?.difficulty || 'Beginner';

  useEffect(() => {
    if (!drill?.name) return;
    setLoading(true);
    setInstructions(null);

    const load = async () => {
      try {
        const { getInstructions } = await import('@/lib/drillInstructions');
        const result = await getInstructions(drill.name, sessionType, drill.club, drill.reps);
        setInstructions(result);
      } catch (e) {
        // Use static instructions
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [drill?.name]);

  useEffect(() => {
    if (currentRating) {
      setShowCheck(true);
    }
  }, [currentRating]);

  const ratedConfig = RATING_CONFIG.find(r => r.value === currentRating);

  return (
    <div className="flex flex-col h-full pb-4">
      {/* Drill name + badges */}
      <div className="pt-2 pb-4 space-y-3">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${typeInfo.color}60`, color: 'white' }}>
            {typeInfo.label}
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: DIFFICULTY_COLORS[difficulty], color: DIFFICULTY_TEXT[difficulty] }}>
            {difficulty}
          </span>
        </div>
        <h2 className="text-2xl font-black text-white leading-tight" style={{ letterSpacing: '-0.5px' }}>
          {drill?.name}
        </h2>
        {(drillData?.description || drill?.description) && (
          <p className="text-white/60 text-sm leading-snug">{drillData?.description || drill?.description}</p>
        )}
        {drill?.reps && (
          <p className="text-white/50 text-sm">⏱ {drill.reps}</p>
        )}
      </div>

      {/* Instructions */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6">
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
            <span className="text-white/30 text-sm">Loading instructions...</span>
          </div>
        ) : instructions ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Setup</p>
              <p className="text-white/75 text-sm leading-relaxed">{instructions.setup}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">How To Do It</p>
              <ol className="space-y-2">
                {(instructions.steps || []).slice(0, 3).map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#a8d5a2] font-black text-sm flex-shrink-0">{i + 1}.</span>
                    <p className="text-white/75 text-sm leading-relaxed">{step.replace(/^Step \d+:\s*/i, '')}</p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Instructions</p>
            <p className="text-white/75 text-sm leading-relaxed">{drillData?.instructions}</p>
            {drillData?.tip && (
              <p className="text-[#a8d5a2]/80 text-xs italic mt-2">💡 {drillData.tip}</p>
            )}
          </div>
        )}
      </div>

      {/* Coach reaction */}
      <AnimatePresence>
        {coachReaction && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="py-3 text-center"
          >
            <p className="text-[#a8d5a2] text-sm font-semibold italic">"{coachReaction}"</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check overlay */}
      <AnimatePresence>
        {showCheck && ratedConfig && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: ratedConfig.activeBg }}>
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video notice */}
      <div className="flex-shrink-0">
        <div className="h-px bg-white/10 my-3" />
        <p className="text-center text-xs italic" style={{ color: 'rgba(255,255,255,0.4)' }}>🎬 Video demonstrations coming soon</p>
        <div className="h-px bg-white/10 my-3" />
      </div>

      {/* Rating buttons */}
      <div className="grid grid-cols-4 gap-2 flex-shrink-0">
        {RATING_CONFIG.map((r) => {
          const isActive = currentRating === r.value;
          const isDisabled = !!currentRating;
          return (
            <motion.button
              key={r.value}
              whileTap={!isDisabled ? { scale: 0.92 } : {}}
              onClick={() => !isDisabled && onRate(drill.name, r.value)}
              disabled={isDisabled}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all"
              style={{
                backgroundColor: isActive ? r.activeBg : r.bg,
                opacity: isDisabled && !isActive ? 0.4 : 1,
                border: isActive ? `2px solid ${r.text}` : '2px solid transparent',
              }}
            >
              <span className="text-xl">{r.emoji}</span>
              <span className="text-[11px] font-bold" style={{ color: r.text }}>{r.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}