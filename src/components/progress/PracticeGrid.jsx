import React from 'react';
import { parseDateLocal } from '@/lib/dateUtils';

const CARD = { background: '#141A17', border: '1px solid rgba(95,190,126,0.15)', borderRadius: 20 };

// Format a local-time Date as 'YYYY-MM-DD' — keep day keys consistent with
// session_date strings stored in Postgres.
const toLocalDateString = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function PracticeGrid({ sessions }) {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(toLocalDateString(d));
  }

  const sessionDates = new Set((sessions || []).map(s => s.session_date));

  const thisMonthSessions = (sessions || []).filter(s => {
    const d = parseDateLocal(s.session_date);
    if (!d) return false;
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const dayStr = days[days.length - 1 - i];
    if (sessionDates.has(dayStr)) streak++;
    else break;
  }

  let longest = 0, cur = 0;
  for (const d of days) {
    if (sessionDates.has(d)) { cur++; longest = Math.max(longest, cur); }
    else cur = 0;
  }

  return (
    <div style={CARD} className="p-5 space-y-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(244,239,227,0.4)' }}>Practice Consistency · Last 30 Days</p>

      {/* Dot grid — 10 columns × 3 rows */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
        {days.map(day => (
          <div
            key={day}
            title={day}
            className="rounded-full"
            style={{
              width: 12,
              height: 12,
              background: sessionDates.has(day) ? '#5FBE7E' : 'rgba(244,239,227,0.1)',
              boxShadow: sessionDates.has(day) ? '0 0 6px rgba(95,190,126,0.4)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0">
        <div className="text-center">
          <p className="font-black text-white" style={{ fontSize: 36, fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1 }}>{streak}</p>
          <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(244,239,227,0.4)' }}>Current Streak</p>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid rgba(244,239,227,0.08)', borderRight: '1px solid rgba(244,239,227,0.08)' }}>
          <p className="font-black text-white" style={{ fontSize: 36, fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1 }}>{longest}</p>
          <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(244,239,227,0.4)' }}>Best This Month</p>
        </div>
        <div className="text-center">
          <p className="font-black text-white" style={{ fontSize: 36, fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1 }}>{thisMonthSessions.length}</p>
          <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(244,239,227,0.4)' }}>Sessions</p>
        </div>
      </div>
    </div>
  );
}