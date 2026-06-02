import React from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';

export default function ScoreTrendChart({ rounds }) {
  if (!rounds || rounds.length === 0) return null;

  const sorted = [...rounds].sort((a, b) => a.round_date.localeCompare(b.round_date));

  // Build chart data with 5-round rolling average
  const chartData = sorted.map((r, i) => {
    const window = sorted.slice(Math.max(0, i - 4), i + 1);
    const avg = window.reduce((s, x) => s + x.total_score, 0) / window.length;
    return {
      date: r.round_date,
      score: r.total_score,
      avg: Math.round(avg * 10) / 10,
      course: r.course_name || '',
    };
  });

  const best = Math.min(...sorted.map(r => r.total_score));
  const bestDate = sorted.find(r => r.total_score === best)?.round_date;

  const improving = sorted.length >= 3
    ? sorted[sorted.length - 1].total_score < sorted[0].total_score
    : null;

  return (
    <div className="card-base p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Score Trend</h3>
          <p className="text-xs text-muted-foreground">{rounds.length} rounds logged</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Personal Best</p>
          <p className="text-xl font-black text-foreground">{best}</p>
        </div>
      </div>
      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#888' }}
              tickFormatter={d => format(new Date(d), 'MMM d')}
              interval="preserveStartEnd"
            />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#888' }} reversed />
            <Tooltip
              formatter={(v, name) => [v, name === 'score' ? 'Score' : '5-Round Avg']}
              labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
            />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            {chartData.length >= 3 && (
              <Line type="monotone" dataKey="avg" stroke="#a8d5a2" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {chartData.length >= 3 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-foreground inline-block rounded" /> Each round</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-sage inline-block rounded" style={{ background: '#a8d5a2' }} /> 5-round avg</span>
        </div>
      )}
    </div>
  );
}