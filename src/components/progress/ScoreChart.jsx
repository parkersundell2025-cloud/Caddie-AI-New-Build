import React from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';

const CARD = { background: '#141A17', border: '1px solid rgba(95,190,126,0.15)', borderRadius: 20 };

export default function ScoreChart({ rounds, profile }) {
  if (!rounds || rounds.length < 3) {
    return (
      <div style={CARD} className="p-6 text-center space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(244,239,227,0.4)' }}>Scoring Trend</p>
        <p className="text-4xl">⛳</p>
        <p className="text-sm" style={{ color: 'rgba(244,239,227,0.4)' }}>Log rounds to see your scoring trend</p>
      </div>
    );
  }

  const sorted = [...rounds].sort((a, b) => a.round_date.localeCompare(b.round_date));
  const last15 = sorted.slice(-15);

  const chartData = last15.map(r => ({ date: r.round_date, score: r.total_score }));
  const handicapPar = profile?.current_handicap != null ? Math.round(72 + profile.current_handicap) : null;

  const half = Math.floor(chartData.length / 2);
  const firstAvg = chartData.slice(0, half).reduce((s, d) => s + d.score, 0) / (half || 1);
  const lastAvg = chartData.slice(half).reduce((s, d) => s + d.score, 0) / ((chartData.length - half) || 1);
  const improving = lastAvg < firstAvg;
  const diff = Math.abs(firstAvg - lastAvg).toFixed(1);
  const trendLabel = improving ? `↓ ${diff} shots better` : `↑ ${diff} shots higher`;

  return (
    <div style={CARD} className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(244,239,227,0.4)' }}>Scoring Trend</p>
        <span className="text-xs font-bold" style={{ color: improving ? '#22c55e' : '#ef4444' }}>{trendLabel}</span>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 40, bottom: 0, left: -24 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(244,239,227,0.3)' }} tickFormatter={d => format(new Date(d), 'MMM d')} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'rgba(244,239,227,0.3)' }} reversed />
            <Tooltip
              formatter={v => [v, 'Score']}
              labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
              contentStyle={{ background: '#141A17', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff' }}
              itemStyle={{ color: '#5FBE7E' }}
            />
            {handicapPar && (
              <ReferenceLine
                y={handicapPar}
                stroke="rgba(244,239,227,0.3)"
                strokeDasharray="5 4"
                label={{ value: 'Your Par', position: 'right', fontSize: 9, fill: 'rgba(244,239,227,0.4)' }}
              />
            )}
            <Line type="monotone" dataKey="score" stroke="#5FBE7E" strokeWidth={2.5} dot={{ r: 3, fill: '#5FBE7E', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#5FBE7E' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}