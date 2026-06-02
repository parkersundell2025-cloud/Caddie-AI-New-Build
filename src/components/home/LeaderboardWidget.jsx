import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';

export default function LeaderboardWidget({ userEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const entries = await unwrap(
        supabase.from('leaderboard_entry').select('*').eq('month_year', monthYear)
      );
      const sorted = [...entries].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
      const myIdx = sorted.findIndex(e => e.user_email === userEmail);
      const myEntry = myIdx >= 0 ? sorted[myIdx] : null;
      const nextEntry = myIdx > 0 ? sorted[myIdx - 1] : null;
      const prevEntry = myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null;
      setData({ myIdx, myEntry, nextEntry, prevEntry, total: sorted.length });
    } catch (e) {
      // silently fail
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [userEmail]);

  if (loading || !data || !data.myEntry) return null;

  const rank = data.myIdx + 1;
  const score = data.myEntry.total_score || 0;
  const nextScore = data.nextEntry?.total_score || null;
  const pointsToNext = nextScore ? (nextScore - score) : null;

  // Position bar: where you sit between rank below and rank above
  const prevScore = data.prevEntry?.total_score || 0;
  const barPct = nextScore && nextScore > prevScore
    ? Math.max(5, Math.min(95, ((score - prevScore) / (nextScore - prevScore)) * 100))
    : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Leaderboard</p>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-US', { month: 'long' })}</p>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-4xl font-black text-foreground leading-none">#{rank}</p>
          <p className="text-xs text-muted-foreground mt-1">{score.toFixed(1)} pts this month</p>
        </div>
        {pointsToNext !== null && (
          <div className="text-right">
            <p className="text-sm font-black text-foreground">{pointsToNext.toFixed(1)} pts</p>
            <p className="text-xs text-muted-foreground">to reach #{rank - 1}</p>
          </div>
        )}
      </div>

      {/* Position bar */}
      <div className="space-y-1">
        <div className="h-2 bg-muted rounded-full relative overflow-hidden">
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'hsl(var(--accent))', width: `${barPct}%` }} />
          <div
            className="absolute top-0 bottom-0 w-3 h-3 rounded-full border-2 border-background -translate-y-0.5"
            style={{ left: `calc(${barPct}% - 6px)`, backgroundColor: 'hsl(var(--foreground))' }}
          />
        </div>
        <div className="flex justify-between">
          <p className="text-[10px] text-muted-foreground">#{rank + 1}</p>
          {pointsToNext !== null && <p className="text-[10px] text-muted-foreground">#{rank - 1}</p>}
        </div>
      </div>
    </motion.div>
  );
}