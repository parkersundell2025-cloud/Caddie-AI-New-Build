import React from 'react';
import { motion } from 'framer-motion';

export default function LeaderboardHowtoPopup({ onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-5"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 22 }}
        className="bg-background rounded-3xl p-6 w-full max-w-sm space-y-4 text-center"
      >
        <div className="text-5xl">🏆</div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground">How the Leaderboard Works</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            Your monthly score is based on <strong className="text-foreground">40% activity</strong> — rounds and practice sessions logged — and <strong className="text-foreground">60% improvement</strong> relative to your own handicap baseline.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            Everyone competes on a level playing field regardless of skill level. The top player each month wins a <strong className="text-foreground">free month of Caddie AI</strong>. Rankings reset on the 1st of every month.
          </p>
          <p className="text-xs text-muted-foreground text-left">Check Settings anytime for full details.</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full btn-primary py-4"
        >
          Got It!
        </button>
      </motion.div>
    </motion.div>
  );
}