import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';

const RING_CONFIG = [
  { key: 'Range Day', label: 'Range', icon: '🏌️', color: '#1a4d2e', lightColor: '#5FBE7E' },
  { key: 'Putting & Short Game', label: 'Short Game', icon: '⛳', color: '#1a6b5a', lightColor: '#6ee7d7' },
  { key: 'Golf Fitness', label: 'Fitness', icon: '💪', color: '#b07d2a', lightColor: '#fcd34d' },
];

const SIZE = 72;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ config, pct, complete }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(pct, 1));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(244,239,227,0.08)"
            strokeWidth={STROKE}
          />
          {/* Fill */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={config.lightColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{
              strokeDashoffset: offset,
            }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-xl"
            animate={complete ? { scale: [1, 1.3, 1] } : {}}
            transition={complete ? { repeat: Infinity, duration: 1.5, repeatDelay: 1 } : {}}
          >
            {config.icon}
          </motion.span>
        </div>
        {/* Complete glow */}
        {complete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 16px ${config.lightColor}` }}
          />
        )}
      </div>
      <p className="text-[10px] font-semibold text-muted-foreground text-center">{config.label}</p>
      <p className="text-[10px] text-muted-foreground">{Math.round(pct * 100)}%</p>
    </div>
  );
}

export default function WeeklyGoalRings({ userEmail, plan }) {
  const [sessionData, setSessionData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    const load = async () => {
      try {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const logs = await unwrap(
          supabase.from('session_log').select('*').eq('user_email', userEmail)
        );
        const thisWeek = logs.filter(l => l.session_date >= weekStartStr && l.completed);
        const completed = {};
        thisWeek.forEach(l => {
          completed[l.session_type] = (completed[l.session_type] || 0) + 1;
        });
        setSessionData(completed);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, [userEmail]);

  if (loading || !plan?.plan_data?.sessions) return null;

  const sessions = plan.plan_data.sessions || [];
  const scheduled = {};
  sessions.forEach(s => {
    if (s.session_type !== 'Rest & Recovery') {
      scheduled[s.session_type] = (scheduled[s.session_type] || 0) + 1;
    }
  });

  const getRingData = (sessionType) => {
    const done = sessionData[sessionType] || 0;
    const total = scheduled[sessionType] || 0;
    if (total === 0) return { pct: 0, done: 0, total: 0 };
    return { pct: done / total, done, total };
  };

  return (
    <div className="card-base p-4 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Weekly Goals</p>
      <div className="flex items-center justify-around">
        {RING_CONFIG.map(config => {
          const { pct } = getRingData(config.key);
          return (
            <Ring key={config.key} config={config} pct={pct} complete={pct >= 1} />
          );
        })}
      </div>
    </div>
  );
}