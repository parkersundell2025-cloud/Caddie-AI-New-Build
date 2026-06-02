import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefreshIndicator({ pullDistance, refreshing }) {
  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const show = pullDistance > 4 || refreshing;

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
      style={{ height: pullDistance || 40, paddingTop: 8 }}
    >
      <div className="w-8 h-8 rounded-full bg-card shadow-sm border border-border flex items-center justify-center">
        <RefreshCw
          className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${progress * 180}deg)`, transition: refreshing ? 'none' : 'transform 0.1s' }}
        />
      </div>
    </motion.div>
  );
}