import React from 'react';
import { motion } from 'framer-motion';
import { LEVELS, getLevel } from './LevelSystem';

export default function PlayerLevelCard({ xp, name }) {
  const currentLevel = getLevel(xp);
  const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1);
  const progressPct = nextLevel
    ? Math.round(((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100)
    : 100;

  return (
    <div className="rounded-2xl overflow-hidden bg-foreground p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">Your Level</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl">{currentLevel.emoji}</span>
            <div>
              <p className="text-primary-foreground font-black text-lg leading-tight">{currentLevel.name}</p>
              <p className="text-primary-foreground/50 text-xs">Level {currentLevel.level}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-primary-foreground/60 text-xs">Total XP</p>
          <p className="text-primary-foreground font-black text-2xl">{xp.toLocaleString()}</p>
        </div>
      </div>

      {/* XP bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#5FBE7E' }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-primary-foreground/50">
          <span>{xp - currentLevel.minXP} XP earned</span>
          {nextLevel ? (
            <span>{nextLevel.minXP - xp} XP to {nextLevel.emoji} {nextLevel.name}</span>
          ) : (
            <span>Max Level Reached! 🏆</span>
          )}
        </div>
      </div>

      {/* XP sources hint */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Session', xp: '+10' },
          { label: 'Round', xp: '+15' },
          { label: 'Coach msg', xp: '+3' },
          { label: 'Plan', xp: '+20' },
        ].map(s => (
          <span key={s.label} className="text-[10px] bg-primary-foreground/10 px-2 py-1 rounded-full text-primary-foreground/60">
            {s.label} <span className="text-primary-foreground font-bold">{s.xp}</span>
          </span>
        ))}
      </div>
    </div>
  );
}