import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { Loader2 } from 'lucide-react';
import { parseDateLocal } from '@/lib/dateUtils';

function calcSkillTrends(drillRatings) {
  const skillMap = {
    Putting: ['Putting', 'Gate Drill — Putting', 'Coin', 'Putt'],
    'Short Game': ['Landing Spot', 'Bump and Run', 'Chip', 'Bunker'],
    'Iron Play': ['Divot', 'Iron', 'Yardage'],
    'Driving': ['Driver', 'Gate Drill — Driver', 'Tempo Towel'],
  };

  const skillTrends = {};
  Object.keys(skillMap).forEach(skill => {
    const recentRatings = drillRatings.filter(r => skillMap[skill].some(d => r.drill_name.includes(d))).slice(0, 14);
    if (recentRatings.length < 3) {
      skillTrends[skill] = null;
    } else {
      const ratingScores = { 'Clicked': 4, 'Good': 3, 'Okay': 2, 'Struggled': 1 };
      const recent = recentRatings.slice(0, 7).reduce((acc, r) => acc + (ratingScores[r.rating] || 0), 0) / 7;
      const older = recentRatings.slice(7).reduce((acc, r) => acc + (ratingScores[r.rating] || 0), 0) / Math.max(1, recentRatings.slice(7).length);
      if (recent > older + 0.3) skillTrends[skill] = 'Improving';
      else if (recent < older - 0.3) skillTrends[skill] = 'Declining';
    }
  });
  return skillTrends;
}

export default function CoachDailyInsight({ userEmail }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInsight(); }, [userEmail]);

  const loadInsight = async () => {
    setLoading(true);
    try {
      const [profiles, rounds, drillRatings, sessionLogs] = await Promise.all([
        unwrap(supabase.from('user_profile').select('*').eq('user_email', userEmail)),
        unwrap(supabase.from('round').select('*').eq('user_email', userEmail).order('round_date', { ascending: false }).limit(10)),
        unwrap(supabase.from('drill_rating').select('*').eq('user_email', userEmail).order('created_date', { ascending: false }).limit(30)),
        unwrap(supabase.from('session_log').select('*').eq('user_email', userEmail).order('session_date', { ascending: false }).limit(10)),
      ]);

      const profile = profiles[0];
      if (!profile) {
        setInsight({ text: 'Welcome to Caddie AI. Complete your first session to get personalized insights.' });
        setLoading(false);
        return;
      }

      const lastRound = rounds[0];
      const trends = calcSkillTrends(drillRatings);
      const decliningSkills = Object.entries(trends).filter(([k, v]) => v === 'Declining').map(([k]) => k);
      const improvingSkills = Object.entries(trends).filter(([k, v]) => v === 'Improving').map(([k]) => k);
      const lastSession = sessionLogs[0];

      let text = '';

      // Declining skill message
      if (decliningSkills.length > 0) {
        text = `Your ${decliningSkills[0].toLowerCase()} drill ratings have dropped — let's refocus there today.`;
      }
      // Improving skill message
      else if (improvingSkills.length > 0) {
        text = `Your ${improvingSkills[0].toLowerCase()} has improved several sessions in a row. Keep that momentum going.`;
      }
      // Recent round message
      else if (lastRound) {
        text = `Shot a ${lastRound.total_score} yesterday — what felt good that you can build on today?`;
      }
      // Inactive message
      else {
        const lastActivityDate = parseDateLocal(lastSession?.session_date);
        if (lastActivityDate) {
          const daysSince = Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince >= 3) {
            text = `You haven't logged a session in ${daysSince} days — your streak is at risk. Let's get back on it.`;
          } else {
            text = 'Ready to keep the streak alive? Your plan is waiting for you.';
          }
        } else {
          text = 'Welcome to Caddie AI. Complete your first session to get personalized insights.';
        }
      }

      setInsight({ text });
    } catch (err) {
      setInsight({ text: 'Tell me how your game has been feeling lately.' });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card-base p-5 flex items-center justify-center gap-2 h-16">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading insight...</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">From your coach</p>
      <div className="card-base p-4">
        <p className="text-sm text-foreground leading-relaxed select-text">{insight?.text || 'Tell me how your game has been.'}</p>
      </div>
    </div>
  );
}