import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Flame, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import BadgeGrid from '@/components/badges/BadgeGrid';

export default function PlayerProfileCard({ playerEmail, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions.invoke('getPlayerProfile', { body: { targetEmail: playerEmail } })
      .then(res => { setData(res.data); setLoading(false); });
  }, [playerEmail]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto p-6 space-y-5 max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-foreground">Player Profile</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center flex-shrink-0">
                <span className="text-background text-2xl font-black">{(data.displayName || 'G')[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="font-black text-foreground text-lg">{data.displayName}</p>
                {data.monthRank && (
                  <p className="text-sm text-muted-foreground">#{data.monthRank} this month · {data.monthScore.toFixed(1)} pts</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card-base p-3 text-center">
                <p className="text-xl font-black text-foreground">{data.currentHandicap ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">Handicap</p>
              </div>
              <div className="card-base p-3 text-center">
                <p className="text-xl font-black text-foreground">{data.totalRounds}</p>
                <p className="text-[10px] text-muted-foreground">Rounds</p>
              </div>
              <div className="card-base p-3 text-center">
                <p className="text-xl font-black text-foreground">{data.streakDays}</p>
                <p className="text-[10px] text-muted-foreground">Day Streak</p>
              </div>
            </div>

            {/* Handicap chart */}
            {data.handicapHistory?.length > 1 && (
              <div className="card-base p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Handicap Progression</p>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={data.handicapHistory}>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={['auto', 'auto']} hide reversed />
                    <Tooltip
                      formatter={(v) => [v, 'HCP']}
                      labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <Line type="monotone" dataKey="handicap" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Badges */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Badges</p>
              <BadgeGrid earnedBadges={data.badges} />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">Could not load profile.</p>
        )}
      </motion.div>
    </motion.div>
  );
}