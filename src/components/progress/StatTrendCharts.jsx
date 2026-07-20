import React from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { format } from 'date-fns';

const STATS = [
  {
    key: 'gir',
    label: 'Greens in Regulation',
    unit: '%',
    tourBenchmark: 67,
    compute: r => r.greens_in_regulation != null ? Math.round((r.greens_in_regulation / 18) * 100) : null,
    valid: r => r.greens_in_regulation != null,
  },
  {
    key: 'fw',
    label: 'Fairways Hit',
    unit: '%',
    tourBenchmark: 57,
    compute: r => r.fairways_available > 0 ? Math.round((r.fairways_hit / r.fairways_available) * 100) : null,
    valid: r => r.fairways_available > 0,
  },
  {
    key: 'putts',
    label: 'Putts per Round',
    unit: '',
    tourBenchmark: 29,
    lowerIsBetter: true,
    compute: r => r.total_putts > 0 ? r.total_putts : null,
    valid: r => r.total_putts > 0,
  },
  {
    key: 'scrambling',
    label: 'Scrambling',
    unit: '%',
    tourBenchmark: 58,
    compute: r => r.scrambling_attempts > 0 ? Math.round((r.scrambling_saves / r.scrambling_attempts) * 100) : null,
    valid: r => r.scrambling_attempts > 0,
  },
];

function TrendBadge({ data, lowerIsBetter }) {
  if (data.length < 3) return null;
  const first = data.slice(0, Math.ceil(data.length / 2)).reduce((s, d) => s + d.value, 0) / Math.ceil(data.length / 2);
  const last = data.slice(-Math.ceil(data.length / 2)).reduce((s, d) => s + d.value, 0) / Math.ceil(data.length / 2);
  const improving = lowerIsBetter ? last < first : last > first;
  const diff = Math.abs(last - first).toFixed(1);
  if (Math.abs(last - first) < 0.5) return <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" />Steady</span>;
  if (improving) return <span className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" />+{diff}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-1"><TrendingDown className="w-3 h-3" />-{diff}</span>;
}

function MiniStatChart({ stat, rounds }) {
  const sorted = [...rounds].sort((a, b) => a.round_date.localeCompare(b.round_date));
  const data = sorted
    .filter(stat.valid)
    .map(r => ({ date: r.round_date, value: stat.compute(r) }))
    .filter(d => d.value !== null);

  if (data.length < 2) {
    return (
      <div className="card-base p-4 space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm font-bold text-foreground">{stat.label}</p>
        </div>
        <p className="text-xs text-muted-foreground py-2">Log more rounds to see trends.</p>
      </div>
    );
  }

  const latest = data[data.length - 1].value;

  return (
    <div className="card-base p-4 space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-foreground">{stat.label}</p>
        <div className="flex items-center gap-2">
          <TrendBadge data={data} lowerIsBetter={stat.lowerIsBetter} />
          <span className="text-base font-black text-foreground">{latest}{stat.unit}</span>
        </div>
      </div>
      <div style={{ height: 70 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -32 }}>
            <XAxis dataKey="date" hide />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#aaa' }} />
            <Tooltip
              formatter={v => [`${v}${stat.unit}`, stat.label]}
              labelFormatter={l => format(new Date(l), 'MMM d')}
            />
            <ReferenceLine y={stat.tourBenchmark} stroke="#5FBE7E" strokeDasharray="3 2" />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground">Tour avg: {stat.tourBenchmark}{stat.unit}</p>
    </div>
  );
}

export default function StatTrendCharts({ rounds }) {
  if (!rounds || rounds.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground">Stat Trends</h3>
      {STATS.map(stat => (
        <MiniStatChart key={stat.key} stat={stat} rounds={rounds} />
      ))}
    </div>
  );
}