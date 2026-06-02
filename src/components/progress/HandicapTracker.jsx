import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatHandicap, getHandicapArrow } from '@/lib/handicapUtils';

export default function HandicapTracker({ profile }) {
  const [handicapData, setHandicapData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHandicap();
  }, [profile]);

  const loadHandicap = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke('calculateHandicap', { body: {} }).catch(() => null);
    if (res?.data) {
      setHandicapData(res.data);
    }
    setLoading(false);
  };

  if (!profile || loading) {
    return (
      <div className="card-base p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-32"></div>
        <div className="h-8 bg-muted rounded w-24"></div>
      </div>
    );
  }

  const currentHcp = handicapData?.handicap !== null ? handicapData.handicap : profile.current_handicap;
  const roundsCount = handicapData?.roundsCount || 0;
  const previousHcp = profile.current_handicap;

  // Determine change indicator using WHS-aware logic
  let change = null;
  let changeIcon = null;
  let changeColor = '';

  if (handicapData?.handicap !== null && previousHcp !== null && previousHcp !== undefined) {
    const arrow = getHandicapArrow(previousHcp, currentHcp);
    if (arrow.direction) {
      const diff = Math.abs(currentHcp - previousHcp);
      change = `${arrow.direction === 'down' ? '↓' : '↑'} ${diff.toFixed(1)}`;
      changeIcon = arrow.direction === 'down' 
        ? <TrendingDown className="w-3.5 h-3.5" />
        : <TrendingUp className="w-3.5 h-3.5" />;
      changeColor = arrow.color === 'green' ? 'text-green-600' : 'text-red-600';
    } else {
      changeIcon = <Minus className="w-3.5 h-3.5" />;
      changeColor = 'text-muted-foreground';
    }
  }

  // Show message if less than 3 rounds
  if (roundsCount < 3) {
    return (
      <div className="card-base p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Handicap Tracker</h3>
          <Minus className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-3xl font-black text-foreground">{formatHandicap(profile.current_handicap)}</p>
          </div>
          <div className="flex-1 pb-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-foreground rounded-full" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Goal</p>
            <p className="text-3xl font-black text-foreground">{formatHandicap(profile.goal_handicap)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Log 3 rounds to start tracking your real handicap ({roundsCount}/3)</p>
      </div>
    );
  }

  return (
    <div className="card-base p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Handicap Tracker</h3>
        {changeIcon && <div className={changeColor}>{changeIcon}</div>}
      </div>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-foreground">{formatHandicap(currentHcp)}</p>
            {change && <p className={`text-sm font-semibold ${changeColor}`}>{change}</p>}
          </div>
        </div>
        <div className="flex-1 pb-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-700"
              style={{
                width: profile.goal_handicap > 0
                  ? `${Math.max(0, 100 * (1 - (currentHcp - profile.goal_handicap) / profile.current_handicap))}%`
                  : '0%',
              }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Goal</p>
          <p className="text-3xl font-black text-foreground">{formatHandicap(profile.goal_handicap)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Based on your last {roundsCount} round{roundsCount !== 1 ? 's' : ''} • {profile.target_timeline}
      </p>
    </div>
  );
}