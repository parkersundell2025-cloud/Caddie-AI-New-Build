import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { formatHandicap } from '@/lib/handicapUtils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { format } from 'date-fns';

export default function HandicapChart({ profile }) {
  const [entries, setEntries] = useState([]);
  const [currentHcp, setCurrentHcp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [hcpRes, entryList] = await Promise.all([
        supabase.functions.invoke('calculateHandicap', { body: {} }).catch(() => null),
        unwrap(supabase.from('handicap_entry').select('*').eq('user_email', profile.user_email).order('entry_date', { ascending: true }).limit(100)).catch(() => []),
      ]);
      if (hcpRes?.data?.handicap !== undefined) setCurrentHcp(hcpRes.data.handicap);
      setEntries(entryList);
      setLoading(false);
    };
    load();
  }, [profile]);

  if (loading) {
    return (
      <div className="card-base p-5 animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-40" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  const displayed = currentHcp !== null ? currentHcp : profile.current_handicap;
  const goal = profile.goal_handicap;

  // Trend vs previous entry
  let trendEl = null;
  if (entries.length >= 2) {
    const prev = entries[entries.length - 2].handicap;
    const curr = entries[entries.length - 1].handicap;
    const diff = Math.abs(curr - prev).toFixed(1);
    const improving = curr < prev;
    trendEl = improving
      ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><TrendingDown className="w-3.5 h-3.5" />↓ {diff}</span>
      : curr > prev
        ? <span className="flex items-center gap-1 text-red-500 text-xs font-semibold"><TrendingUp className="w-3.5 h-3.5" />↑ {diff}</span>
        : <span className="flex items-center gap-1 text-muted-foreground text-xs font-semibold"><Minus className="w-3.5 h-3.5" />Steady</span>;
  }

  const chartData = entries.map(e => ({
    date: e.entry_date,
    handicap: e.handicap,
  }));

  // Progress bar — safe for plus handicaps and zero edge cases
  const start = entries.length > 0 ? entries[0].handicap : profile.current_handicap;
  const totalDrop = start - goal;
  const achieved = start - displayed;
  let pct = 0;
  if (totalDrop > 0) {
    pct = Math.max(0, Math.min(100, (achieved / totalDrop) * 100));
  }

  return (
    <div className="card-base p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Handicap Tracker</h3>
        {trendEl}
      </div>

      {/* Current + Goal row */}
      <div className="flex items-end gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-3xl font-black text-foreground">{formatHandicap(displayed)}</p>
        </div>
        <div className="flex-1 pb-1.5">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            {pct.toFixed(0)}% to goal
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Goal</p>
          <p className="text-3xl font-black text-foreground">{formatHandicap(goal)}</p>
        </div>
      </div>

      {/* Line chart */}
      {chartData.length >= 2 ? (
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#888' }}
                tickFormatter={d => format(new Date(d), 'MMM d')}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 9, fill: '#888' }}
                reversed={goal >= 0}
              />
              <Tooltip
                formatter={v => [formatHandicap(v), 'HCP']}
                labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
              />
              {goal !== null && goal !== undefined && (
                <ReferenceLine y={goal} stroke="#a8d5a2" strokeDasharray="4 3" label={{ value: 'Goal', fontSize: 9, fill: '#a8d5a2', position: 'right' }} />
              )}
              <Line type="monotone" dataKey="handicap" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Log {3 - entries.length} more round{3 - entries.length !== 1 ? 's' : ''} to see your handicap chart.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Based on {entries.length} round{entries.length !== 1 ? 's' : ''} · Target: {profile.target_timeline}
      </p>
    </div>
  );
}