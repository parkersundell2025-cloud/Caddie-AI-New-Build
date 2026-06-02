import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { formatHandicap } from '@/lib/handicapUtils';

export default function QuickStatsRow({ userEmail }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ handicap: '—', rank: '—', sessions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, [userEmail]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get handicap
      const hcpRes = await supabase.functions.invoke('calculateHandicap', { body: {} }).catch(() => null);
      const handicap = hcpRes?.data?.handicap !== null && hcpRes?.data?.handicap !== undefined
        ? formatHandicap(hcpRes.data.handicap)
        : '—';

      // Get leaderboard rank
      let rank = '—';
      try {
        const lbRes = await supabase.functions.invoke('getLeaderboard', { body: { tab: 'month' } });
        const myEntry = lbRes.data?.entries?.find(e => e.user_email === userEmail);
        rank = myEntry?.rank ? `#${myEntry.rank}` : '—';
      } catch {}

      // Count sessions this month
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const sessionLogs = await unwrap(supabase.from('session_log').select('*').eq('user_email', userEmail));
      const sessionsThisMonth = sessionLogs.filter(s => s.session_date >= monthStart && s.completed).length;

      setStats({ handicap, rank, sessions: sessionsThisMonth });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-stretch px-3 py-4 card-base">
      <button
        onClick={() => navigate('/progress')}
        className="flex-1 text-center active:scale-95 transition-transform"
      >
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Handicap</p>
        <p className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>{loading ? '—' : stats.handicap}</p>
      </button>

      <div className="w-px bg-border self-stretch" />

      <button
        onClick={() => navigate('/leaderboard')}
        className="flex-1 text-center active:scale-95 transition-transform"
      >
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">This Month</p>
        <p className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>{loading ? '—' : stats.rank}</p>
      </button>

      <div className="w-px bg-border self-stretch" />

      <button
        onClick={() => navigate('/progress')}
        className="flex-1 text-center active:scale-95 transition-transform"
      >
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Sessions</p>
        <p className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>{loading ? '—' : stats.sessions}</p>
      </button>
    </div>
  );
}