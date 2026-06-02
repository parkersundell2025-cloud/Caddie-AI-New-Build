import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, invokeLLM } from '@/lib/db';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function WeeklyInsightCard({ userEmail }) {
  const [insight, setInsight] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    loadOrGenerateInsight();
  }, [userEmail]);

  const getThisSunday = () => {
    // Returns the most recent Sunday (or today if Sunday)
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    return d.toISOString().split('T')[0];
  };

  const loadOrGenerateInsight = async (forceRegenerate = false) => {
    const weekOf = getThisSunday();

    // Check if we already have one for this week
    const existing = await unwrap(supabase.from('weekly_insight').select('*').eq('user_email', userEmail).eq('week_of', weekOf));
    if (existing.length > 0 && !forceRegenerate) {
      setInsight(existing[0]);
      return;
    }

    // Only generate on Sundays (or if never generated yet), unless manually regenerating
    const today = new Date();
    const isSunday = today.getDay() === 0;

    const allInsights = await unwrap(supabase.from('weekly_insight').select('*').eq('user_email', userEmail));
    const hasEverGenerated = allInsights.length > 0;

    if (!isSunday && hasEverGenerated && !forceRegenerate) return;

    // Generate a new insight
    setGenerating(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const [drillRatings, sessionLogs, profiles] = await Promise.all([
        unwrap(supabase.from('drill_rating').select('*').eq('user_email', userEmail)),
        unwrap(supabase.from('session_log').select('*').eq('user_email', userEmail)),
        unwrap(supabase.from('user_profile').select('*').eq('user_email', userEmail)),
      ]);

      const recentRatings = drillRatings.filter(r => r.session_date >= sevenDaysAgoStr);
      const recentSessions = sessionLogs.filter(s => s.session_date >= sevenDaysAgoStr && s.completed);
      const profile = profiles[0];

      if (recentRatings.length === 0 && recentSessions.length === 0) {
        setGenerating(false);
        return;
      }

      const ratingsSummary = recentRatings.map(r =>
        `- ${r.drill_name} (${r.session_date}): ${r.rating}${r.session_note ? ` | Note: "${r.session_note}"` : ''}`
      ).join('\n');

      const sessionsSummary = recentSessions.map(s =>
        `- ${s.session_date}: ${s.session_type}`
      ).join('\n');

      const insightText = await invokeLLM({
        prompt: `You are an encouraging golf coach named Caddie AI. Write a personalized weekly insight for this golfer.

GOLFER PROFILE:
- Handicap: ${profile?.current_handicap} (goal: ${profile?.goal_handicap} in ${profile?.target_timeline})

SESSIONS THIS WEEK:
${sessionsSummary || 'None logged'}

DRILL RATINGS THIS WEEK:
${ratingsSummary || 'None logged'}

Write 3-5 sentences in a warm, encouraging coach voice. Reference specific drills or session types they worked on. Note any improvement or consistency in felt ratings (Struggled→Okay→Good→Clicked is improvement). Tell them what to focus on this coming week. Do NOT use bullet points — write in flowing sentences as if speaking directly to the golfer. Start with something like "This week..." or "Looking at your week..."`,
      });

      // Delete old insight if regenerating
      if (existing.length > 0) {
        await unwrap(supabase.from('weekly_insight').delete().eq('id', existing[0].id));
      }

      const saved = await unwrap(supabase.from('weekly_insight').insert({
        user_email: userEmail,
        week_of: weekOf,
        insight_text: insightText,
        generated_at: new Date().toISOString(),
      }).select().single());
      setInsight(saved);
    } catch (e) {
      // Silently fail — insight is a nice-to-have
    }
    setGenerating(false);
  };

  if (generating) {
    return (
      <div className="card-base p-4 border-l-4 space-y-2" style={{ borderLeftColor: '#a8d5a2' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sage" style={{ color: '#a8d5a2' }} />
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Your weekly insight from Caddie AI</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin" />
          Generating your insight...
        </div>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="card-base p-4 border-l-4 space-y-2" style={{ borderLeftColor: '#a8d5a2' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: '#a8d5a2' }} />
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Your weekly insight from Caddie AI</p>
        </div>
        <button
          onClick={() => loadOrGenerateInsight(true)}
          disabled={generating}
          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 text-muted-foreground ${generating ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{insight.insight_text}</p>
    </div>
  );
}