import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { formatHandicap } from '@/lib/handicapUtils';

const CARD = { background: '#141414', border: '1px solid rgba(168,213,162,0.15)', borderRadius: 24 };

export default function HandicapHero({ profile }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unwrap(supabase.from('handicap_entry').select('*').eq('user_email', profile.user_email).order('entry_date', { ascending: true }).limit(60))
      .then(list => { setEntries(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [profile.user_email]);

  const current = profile.current_handicap;
  const goal = profile.goal_handicap;

  const chartData = entries.slice(-20).map(e => ({ v: e.handicap }));

  let trendColor = '#a8d5a2';
  let trendLabel = '→ Holding steady';
  if (chartData.length >= 2) {
    const first = chartData[0].v;
    const last = chartData[chartData.length - 1].v;
    const diff = Math.abs(first - last).toFixed(1);
    if (last < first - 0.1) { trendColor = '#22c55e'; trendLabel = `↓ Down ${diff} strokes — Improving`; }
    else if (last > first + 0.1) { trendColor = '#ef4444'; trendLabel = `↑ Up ${diff} strokes — Needs work`; }
  }

  const hcpColor = chartData.length >= 2
    ? (chartData[chartData.length - 1].v < chartData[0].v ? '#22c55e' : chartData[chartData.length - 1].v > chartData[0].v ? '#ef4444' : '#fff')
    : '#fff';

  return (
    <div style={CARD} className="overflow-hidden">
      <div className="px-6 pt-6 pb-5 space-y-5">
        {/* Numbers row */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Handicap Index</p>
            <p className="font-black leading-none mt-2" style={{ fontSize: 64, letterSpacing: '-3px', fontFamily: 'Fraunces, Georgia, serif', color: hcpColor }}>
              {formatHandicap(current)}
            </p>
          </div>
          <div className="text-right pb-1">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Goal</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Fraunces, Georgia, serif' }}>
              {formatHandicap(goal)}
            </p>
          </div>
        </div>

        {/* Sparkline or empty */}
        {loading ? null : chartData.length >= 2 ? (
          <div>
            <div style={{ height: 64 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line type="monotone" dataKey="v" stroke={trendColor} strokeWidth={2.5} dot={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 8, fontSize: 11 }}
                    formatter={v => [formatHandicap(v), 'HCP']}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs font-bold mt-2" style={{ color: trendColor }}>{trendLabel}</p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Log 3 rounds to see your handicap trend
          </p>
        )}
      </div>
    </div>
  );
}