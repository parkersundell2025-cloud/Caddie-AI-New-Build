import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BADGES } from './LevelSystem';

function BadgeItem({ badge, earned }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative flex flex-col items-center gap-1" onClick={() => setShowTooltip(v => !v)}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${
        earned ? 'bg-foreground shadow-sm' : 'bg-muted'
      }`}>
        <span style={{ filter: earned ? 'none' : 'grayscale(1) opacity(0.35)' }}>{badge.emoji}</span>
      </div>
      <p className={`text-[10px] text-center leading-tight font-medium ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
        {badge.name}
      </p>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] rounded-xl px-3 py-2 w-36 text-center z-10 shadow-lg"
          >
            <p className="font-bold mb-0.5">{badge.name}</p>
            <p className="text-background/70">{badge.desc}</p>
            {!earned && <p className="text-background/50 mt-1">🔒 Not yet earned</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BadgesGrid({ earnedIds }) {
  const [showAll, setShowAll] = useState(false);
  const earnedCount = BADGES.filter(b => earnedIds.includes(b.id)).length;
  const displayed = showAll ? BADGES : BADGES.slice(0, 8);

  return (
    <div className="card-base p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Badges</h3>
          <p className="text-xs text-muted-foreground">{earnedCount}/{BADGES.length} earned</p>
        </div>
        <button onClick={() => setShowAll(v => !v)} className="text-xs font-semibold text-muted-foreground underline">
          {showAll ? 'Show less' : 'See all'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {displayed.map(badge => (
          <BadgeItem key={badge.id} badge={badge} earned={earnedIds.includes(badge.id)} />
        ))}
      </div>
    </div>
  );
}