import React from 'react';
import { motion } from 'framer-motion';

export default function LeaderboardJoinPopup({ onDismiss }) {
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
        className="bg-background rounded-3xl p-6 w-full max-w-sm space-y-5 text-center"
      >
        <div className="text-5xl">🏌️</div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground">You're in the game!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You're now on the Caddie AI leaderboard. Log rounds, complete practice sessions and improve your handicap to climb the rankings. The top player every month wins a free month.
          </p>
          <p className="text-base font-bold text-foreground">Good luck! 🏆</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full btn-primary py-4"
        >
          Let's Go!
        </button>
      </motion.div>
    </motion.div>
  );
}