import React from 'react';
import { maybeRequestReview } from '@/lib/appReview';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelebrationPopup — shown after a round is logged or session is completed.
 * Props:
 *   visible: bool
 *   emoji: string
 *   headline: string
 *   copy: string
 *   onShare: fn
 *   onDismiss: fn
 */
export default function CelebrationPopup({ visible, emoji, headline, copy, onShare, onDismiss }) {
  const handleDismiss = () => {
    maybeRequestReview();
    onDismiss();
  };
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26 }}
            className="w-full max-w-lg mx-auto rounded-t-3xl p-8 flex flex-col items-center text-center space-y-6"
            style={{ backgroundColor: '#0B0F0C', paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 2.5rem)' }}
          >
            {/* Celebration emoji */}
            <div className="text-6xl leading-none">{emoji}</div>

            {/* Headline */}
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white" style={{ letterSpacing: '-0.5px' }}>{headline}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{copy}</p>
            </div>

            {/* Buttons */}
            <div className="w-full space-y-3 pt-2">
              <button
                onClick={onShare}
                className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#5FBE7E', color: '#0B0F0C' }}
              >
                Share Your Achievement →
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}