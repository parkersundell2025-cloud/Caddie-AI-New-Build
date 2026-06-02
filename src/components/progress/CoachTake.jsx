import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, invokeLLM } from '@/lib/db';
import { Loader2 } from 'lucide-react';

function computeRoundStats(rounds) {
  if (!rounds || rounds.length === 0) return {};
  const last10 = rounds.slice(0, 10);
  const avgScore = Math.round(last10.reduce((s, r) => s + r.total_score, 0) / last10.length * 10) / 10;
  const withFW = last10.filter(r => r.fairways_available > 0);
  const withGIR = last10.filter(r => r.greens_in_regulation != null);
  const withPutts = last10.filter(r => r.total_putts > 0);
  const withSc = last10.filter(r => r.scrambling_attempts > 0);
  return {
    avgScore,
    girAvg: withGIR.length ? Math.round(withGIR.reduce((s, r) => s + (r.greens_in_regulation / 18) * 100, 0) / withGIR.length) : null,
    fwAvg: withFW.length ? Math.round(withFW.reduce((s, r) => s + (r.fairways_hit / r.fairways_available) * 100, 0) / withFW.length) : null,
    puttsAvg: withPutts.length ? Math.round(withPutts.reduce((s, r) => s + r.total_putts, 0) / withPutts.length) : null,
    scramblingAvg: withSc.length ? Math.round(withSc.reduce((s, r) => s + (r.scrambling_saves / r.scrambling_attempts) * 100, 0) / withSc.length) : null,
  };
}

export default function CoachTake({ profile, rounds, drillRatings }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !rounds) return;
    generate();
  }, [profile?.user_email]);

  const generate = async () => {
    setLoading(true);
    const { avgScore, girAvg, fwAvg, puttsAvg, scramblingAvg } = computeRoundStats(rounds);

    let handicapTrend = 'unknown';
    try {
      const entries = await unwrap(supabase.from('handicap_entry').select('*').eq('user_email', profile.user_email).order('entry_date', { ascending: true }).limit(10));
      if (entries.length >= 2) {
        const first = entries[0].handicap;
        const last = entries[entries.length - 1].handicap;
        const diff = Math.abs(first - last).toFixed(1);
        handicapTrend = last < first ? `Dropped ${diff} strokes (improving)` : last > first ? `Up ${diff} strokes (declining)` : 'Flat (steady)';
      }
    } catch {}

    const RATING_SCORES = { Struggled: 1, Okay: 2, Good: 3, Clicked: 4 };
    const skillTrendsText = ['Driving', 'Iron Play', 'Short Game', 'Putting', 'Course Mgmt'].map(skill => {
      const relevant = (drillRatings || []).filter(r => r.drill_name.toLowerCase().includes(skill.toLowerCase().split(' ')[0])).slice(0, 10);
      if (relevant.length < 2) return `${skill}: not enough data`;
      const avg = relevant.reduce((s, r) => s + (RATING_SCORES[r.rating] || 2), 0) / relevant.length;
      const label = avg >= 3.5 ? 'clicking' : avg >= 2.5 ? 'steady' : 'struggling';
      return `${skill}: ${label}`;
    }).join(', ');

    if (!rounds || rounds.length === 0) {
      setText("Log your first round and session to get your first coaching insight.");
      setLoading(false);
      return;
    }

    const prompt = `You are Caddie AI. Review this golfer's recent data and write one short coaching paragraph — 3 sentences maximum. Be specific, honest, and direct. Reference actual numbers. Sound like a coach texting their player after reviewing their stats. Never use bullet points or generic praise.

Golfer: ${profile.first_name || 'Golfer'}, ${profile.current_handicap} handicap, goal: ${profile.goal_handicap}
Last 10 rounds avg score: ${avgScore ?? 'unknown'}
Handicap trend: ${handicapTrend}
GIR avg: ${girAvg !== null ? girAvg + '%' : 'not tracked'}, Tour: 67%
Fairways avg: ${fwAvg !== null ? fwAvg + '%' : 'not tracked'}, Tour: 57%
Putts avg: ${puttsAvg !== null ? puttsAvg : 'not tracked'}, Tour: 29
Scrambling avg: ${scramblingAvg !== null ? scramblingAvg + '%' : 'not tracked'}, Tour: 58%
Skill trends: ${skillTrendsText}

Write the coaching paragraph now. No greeting. No sign-off. Just the coaching insight.`;

    try {
      const result = await invokeLLM({ prompt });
      setText(typeof result === 'string' ? result : result?.text || '');
    } catch {
      setText('Unable to load coaching insight right now. Log another round and check back.');
    }
    setLoading(false);
  };

  return (
    <div
      className="rounded-3xl p-5 space-y-3"
      style={{ background: '#141414', borderLeft: '3px solid #a8d5a2', border: '1px solid rgba(168,213,162,0.15)', borderRadius: 20 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#a8d5a2' }}>Coach's Take</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>What the data says</p>
        </div>
        <span className="text-2xl flex-shrink-0">🏌️</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a8d5a2' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Analysing your game...</p>
        </div>
      ) : (
        <p className="text-base leading-relaxed select-text" style={{ color: 'rgba(255,255,255,0.85)' }}>{text}</p>
      )}
    </div>
  );
}