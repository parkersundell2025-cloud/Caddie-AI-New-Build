import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { parseDateLocal } from '@/lib/dateUtils';

export default function ThisWeekStrip({ userEmail }) {
  const [activityDays, setActivityDays] = useState(new Set());
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWeekData(); }, [userEmail]);

  const loadWeekData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);

      const [sessionLogs, roundList, profiles] = await Promise.all([
        unwrap(supabase.from('session_log').select('*').eq('user_email', userEmail)),
        unwrap(supabase.from('round').select('*').eq('user_email', userEmail)),
        unwrap(supabase.from('user_profile').select('*').eq('user_email', userEmail)),
      ]);

      // Find days with activity this week. Date keys come straight from the
      // 'YYYY-MM-DD' string so we don't round-trip through UTC.
      const daysWithActivity = new Set();
      sessionLogs.forEach(s => {
        const d = parseDateLocal(s.session_date);
        if (d && d >= weekStart && d <= today && s.completed) {
          daysWithActivity.add(s.session_date);
        }
      });
      roundList.forEach(r => {
        const d = parseDateLocal(r.round_date);
        if (d && d >= weekStart && d <= today) {
          daysWithActivity.add(r.round_date);
        }
      });

      setActivityDays(daysWithActivity);
      setStreak(profiles[0]?.streak_days || 0);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Format a local-time Date as 'YYYY-MM-DD' — keep keys consistent with
  // session_date / round_date strings stored in `activityDays`.
  const toLocalDateString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = toLocalDateString(today);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          {dayDates.map((d, i) => {
            const dateStr = toLocalDateString(d);
            const isToday = dateStr === todayStr;
            const hasActivity = activityDays.has(dateStr);

            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <button
                  className={`w-7 h-7 rounded-full transition-all ${
                    hasActivity
                      ? 'bg-sage/80'
                      : 'bg-transparent border border-border'
                  } ${isToday ? 'ring-2 ring-sage ring-offset-2 ring-offset-background' : ''}`}
                  disabled
                />
                <p className="text-[9px] font-semibold text-muted-foreground">{days[i]}</p>
              </div>
            );
          })}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-foreground">{streak}</p>
          <p className="text-[9px] text-muted-foreground">day streak 🔥</p>
        </div>
      </div>
    </div>
  );
}