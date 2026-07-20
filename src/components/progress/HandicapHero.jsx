import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { formatHandicap } from '@/lib/handicapUtils';

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

  let trendColor = '#5FBE7E';
  let delta = null;
  let improving = null;
  if (chartData.length >= 2) {
    const first = chartData[0].v;
    const last = chartData[chartData.length - 1].v;
    const diff = Math.abs(first - last).toFixed(1);
    if (last < first - 0.1) { improving = true; delta = diff; }
    else if (last > first + 0.1) { improving = false; delta = diff; trendColor = '#E5695E'; }
  }

  // Serif hero number with the decimal digit in italic, per the design
  const hcpStr = formatHandicap(current) ?? '—';
  const [whole, decimal] = String(hcpStr).includes('.') ? String(hcpStr).split('.') : [String(hcpStr), null];

  return (
    <div className="cut-glass overflow-hidden">
      {/* glow corner */}
      <div
        className="absolute pointer-events-none"
        style={{ top: -60, right: -60, width: 200, height: 200, borderRadius: 100, background: 'rgba(95,190,126,.30)', filter: 'blur(50px)' }}
      />
      <div className="relative px-5 pt-5 pb-5 space-y-4">
        {/* Numbers row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="cut-eyebrow text-cut-gold">Handicap Index</p>
            <div className="flex items-end gap-2.5 mt-1.5">
              <p className="cut-headline text-cut-ink" style={{ fontSize: 64, letterSpacing: '-2.4px', lineHeight: 0.9 }}>
                {whole}{decimal != null && <>.<span className="italic">{decimal}</span></>}
              </p>
              {delta != null && (
                <span
                  className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg mb-1.5"
                  style={improving
                    ? { background: 'rgba(95,190,126,.15)', color: '#5FBE7E' }
                    : { background: 'rgba(229,105,94,.15)', color: '#E5695E' }}
                >
                  {improving ? '▼' : '▲'} {delta}
                </span>
              )}
            </div>
          </div>
          <div className="text-right mt-1">
            <p className="cut-eyebrow text-cut-ink-mute">Goal</p>
            <p className="font-mono text-sm font-semibold text-cut-ink-soft mt-1">{formatHandicap(goal)}</p>
          </div>
        </div>

        {/* Sparkline or empty */}
        {loading ? null : chartData.length >= 2 ? (
          <div>
            <div style={{ height: 64 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line type="monotone" dataKey="v" stroke={improving === false ? trendColor : '#5FBE7E'} strokeWidth={2.5} dot={false} />
                  <Tooltip
                    contentStyle={{ background: '#141A17', border: '1px solid rgba(244,239,227,.10)', borderRadius: 8, fontSize: 11 }}
                    formatter={v => [formatHandicap(v), 'HCP']}
                    itemStyle={{ color: '#F4EFE3' }}
                    cursor={{ stroke: 'rgba(244,239,227,0.1)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {delta != null && (
              <p className="text-xs font-bold mt-2" style={{ color: trendColor }}>
                {improving ? `↓ Down ${delta} strokes — Improving` : `↑ Up ${delta} strokes — Needs work`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-cut-ink-mute">
            Log 3 rounds to see your handicap trend
          </p>
        )}
      </div>
    </div>
  );
}
