import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, Sparkles } from 'lucide-react';
import { getDrillByName } from '@/lib/drillLibrary';

import { SESSION_TYPE_COLORS } from '@/lib/sessionTypeColors';

const SESSION_TYPE_LABELS = {
  'Range Day': { label: 'Range Day', color: '#0E4D2B' },
  'Putting & Short Game': { label: 'Short Game', color: '#1a6b5a' },
  'Golf Fitness': { label: 'Fitness', color: '#b07d2a' },
  'Course Management': { label: 'Strategy', color: '#2a4a7a' },
  'Rest & Recovery': { label: 'Rest', color: '#3a3f4a' },
};

const DIFFICULTY_COLORS = {
  Beginner: 'rgba(95,190,126,0.2)',
  Intermediate: 'rgba(255,200,100,0.2)',
  Advanced: 'rgba(255,100,100,0.15)',
};
const DIFFICULTY_TEXT = {
  Beginner: '#5FBE7E',
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
  // Fade masks on the inner scroll area — without them, clipped content
  // starts mid-sentence and reads as a rendering bug
  const scrollRef = useRef(null);
  const [fade, setFade] = useState({ up: false, down: false });

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      up: el.scrollTop > 4,
      down: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  }, []);

  useEffect(() => {
    updateFades();
    // re-measure once instructions render
    const t = setTimeout(updateFades, 50);
    return () => clearTimeout(t);
  }, [instructions, loading, updateFades]);

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
      {/* Drill hero — topo gradient header per the Drill Detail mock */}
      <div className="pt-2 pb-3">
        <div
          className="relative overflow-hidden rounded-[22px] px-5 pt-5 pb-4"
          style={{ background: 'linear-gradient(135deg, #0E4D2B 0%, #1A6B3F 60%, #5FBE7E 160%)', minHeight: 140 }}
        >
          <svg width="100%" height="100%" viewBox="0 0 360 160" preserveAspectRatio="none" className="absolute inset-0" style={{ opacity: 0.22 }}>
            {[16, 34, 52, 70, 88, 106, 124, 142].map((y, i) => (
              <path key={i} d={`M0 ${y} Q90 ${y - 10 - (i % 2) * 5} 180 ${y} T360 ${y}`} stroke="#F4EFE3" strokeWidth="1" fill="none" />
            ))}
          </svg>
          <div className="relative">
            <div className="w-8 h-0.5 bg-cut-gold mb-2.5" />
            <p className="cut-eyebrow text-cut-gold">{typeInfo.label} · {difficulty}</p>
            <h2 className="cut-headline text-cut-cream leading-[1.05] mt-2" style={{ fontSize: 26, letterSpacing: '-0.6px', maxWidth: 280 }}>
              {drill?.name}
            </h2>
            {drill?.reps && (
              <div className="mt-3 text-cut-cream">
                <p className="font-mono text-[15px] font-bold" style={{ letterSpacing: '-0.3px' }}>{drill.reps}</p>
                <p className="text-[10px] font-semibold uppercase mt-0.5" style={{ opacity: 0.7, letterSpacing: '0.4px' }}>Reps</p>
              </div>
            )}
          </div>
        </div>
        {(drillData?.description || drill?.description) && (
          <p className="text-white/60 text-sm leading-snug mt-3">{drillData?.description || drill?.description}</p>
        )}
      </div>

      {/* Instructions */}
      <div className="relative flex-1 min-h-0">
        {fade.up && (
          <div className="absolute top-0 left-0 right-0 h-7 z-10 pointer-events-none" style={{ background: 'linear-gradient(180deg, #0B0F0C, transparent)' }} />
        )}
        {fade.down && (
          <div className="absolute bottom-0 left-0 right-0 h-7 z-10 pointer-events-none" style={{ background: 'linear-gradient(0deg, #0B0F0C, transparent)' }} />
        )}
      <div ref={scrollRef} onScroll={updateFades} className="h-full overflow-y-auto space-y-4">
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
                    <span className="text-[#5FBE7E] font-mono font-bold text-sm flex-shrink-0">{i + 1}.</span>
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
          </div>
        )}

        {/* Caddie's Note — gold pull-quote per the mock, shown for either
            instructions branch */}
        {!loading && drillData?.tip && (
          <div className="cut-glass p-3.5" style={{ borderLeft: '2px solid #D9B14A', borderRadius: 14 }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3 h-3 text-cut-gold" strokeWidth={2} />
              <p className="cut-eyebrow text-cut-gold">Caddie's Note</p>
            </div>
            <p className="cut-headline italic text-sm leading-relaxed" style={{ color: 'rgba(244,239,227,.72)' }}>
              "{drillData.tip}"
            </p>
          </div>
        )}
      </div>
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
            <p className="text-[#5FBE7E] text-sm font-semibold italic">"{coachReaction}"</p>
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
        <p className="text-center text-xs italic" style={{ color: 'rgba(244,239,227,0.4)' }}>🎬 Video demonstrations coming soon</p>
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