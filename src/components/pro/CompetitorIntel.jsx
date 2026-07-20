import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Users, Loader2 } from 'lucide-react';
import ProBadge from '@/components/badges/ProBadge';

function PercentileBar({ percentile }) {
  if (percentile == null) return null;
  return (
    <div className="space-y-1.5">
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${percentile}%`, backgroundColor: '#5FBE7E' }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>0%</span>
        <span className="font-bold text-foreground">{percentile}th percentile</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function CompetitorIntel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke('getCompetitorIntel', { body: {} }).catch(() => null);
    if (res?.data) setData(res.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card-base p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading competitor data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-base p-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn't load competitor data right now.</p>
      </div>
    );
  }

  const { myStats, fullApp, handicapRange, mostActive } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-bold text-foreground">Competitor Intel</h3>
        <ProBadge />
      </div>

      {/* Handicap Range */}
      <div className="card-base p-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Your Handicap Range ({Math.round(handicapRange.rangeMin * 10) / 10}–{Math.round(handicapRange.rangeMax * 10) / 10})
        </p>
        {!handicapRange.hasEnoughData ? (
          <p className="text-sm text-muted-foreground">
            Not enough golfers at your level yet — showing full app comparison below.
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground">
              You are improving faster than{' '}
              <span className="font-black text-foreground">{handicapRange.percentile}%</span>{' '}
              of golfers at your handicap level.
            </p>
            {handicapRange.rank && (
              <p className="text-xs text-muted-foreground">
                Ranked <span className="font-bold text-foreground">{handicapRange.rank}{ordinal(handicapRange.rank)}</span> out of {handicapRange.totalInRange} golfers between {Math.round(handicapRange.rangeMin * 10) / 10}–{Math.round(handicapRange.rangeMax * 10) / 10} handicap this month.
              </p>
            )}
          </>
        )}
      </div>

      {/* Full App */}
      <div className="card-base p-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full App Comparison</p>
        {fullApp.percentile != null ? (
          <>
            <p className="text-sm text-foreground">
              You are improving faster than{' '}
              <span className="font-black text-foreground">{fullApp.percentile}%</span>{' '}
              of all Caddie AI golfers this month.
            </p>
            <PercentileBar percentile={fullApp.percentile} />
            <p className="text-xs text-muted-foreground">{fullApp.totalUsers} active golfers in comparison.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Log at least 2 rounds this month to appear in comparisons.</p>
        )}
      </div>

      {/* Most Active */}
      <div className="card-base p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Most Active This Month</p>
        </div>
        {mostActive.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity data yet this month.</p>
        ) : (
          <div className="space-y-2">
            {mostActive.map((u, i) => (
              <div key={i} className={`flex items-center justify-between py-2 ${i < mostActive.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${u.is_me ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <p className={`text-sm font-semibold ${u.is_me ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {u.display_name}{u.is_me ? ' (You)' : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{u.total_activity} activities</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}