import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CARD = { background: '#141414', border: '1px solid rgba(168,213,162,0.15)', borderRadius: 20 };

const SKILLS = [
  { key: 'skill_driving', label: 'Driving' },
  { key: 'skill_iron_play', label: 'Iron Play' },
  { key: 'skill_short_game', label: 'Short Game' },
  { key: 'skill_putting', label: 'Putting' },
  { key: 'skill_course_management', label: 'Course Mgmt' },
];

const RATING_SCORES = { Struggled: 1, Okay: 2, Good: 3, Clicked: 4 };

function inferSkill(drillName) {
  const n = drillName.toLowerCase();
  if (n.includes('putt') || n.includes('green') || n.includes('lag')) return 'skill_putting';
  if (n.includes('chip') || n.includes('pitch') || n.includes('wedge') || n.includes('bunker') || n.includes('short') || n.includes('flop')) return 'skill_short_game';
  if (n.includes('drive') || n.includes('driver') || n.includes('tee') || n.includes('wood')) return 'skill_driving';
  if (n.includes('iron') || n.includes('approach') || n.includes('fairway') || n.includes('divot')) return 'skill_iron_play';
  if (n.includes('course') || n.includes('strategy') || n.includes('manage')) return 'skill_course_management';
  return null;
}

function calcTrend(drillRatings, skillKey) {
  const relevant = (drillRatings || []).filter(r => inferSkill(r.drill_name) === skillKey).slice(0, 14);
  if (relevant.length < 3) return 'flat';
  const half = Math.ceil(relevant.length / 2);
  const recent = relevant.slice(0, half).reduce((s, r) => s + (RATING_SCORES[r.rating] || 2), 0) / half;
  const older = relevant.slice(half).reduce((s, r) => s + (RATING_SCORES[r.rating] || 2), 0) / Math.max(1, relevant.length - half);
  if (recent > older + 0.3) return 'up';
  if (recent < older - 0.3) return 'down';
  return 'flat';
}

function barColor(val) {
  if (val >= 4) return '#22c55e';
  if (val >= 3) return '#eab308';
  return '#ef4444';
}

export default function SkillSnapshot({ profile, drillRatings }) {
  if (!profile) return null;

  const data = SKILLS.map(s => ({ skill: s.label, value: profile[s.key] || 1, fullMark: 5 }));

  return (
    <div style={CARD} className="p-5 space-y-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Skill Snapshot</p>

      {/* Radar */}
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 10, right: 28, bottom: 10, left: 28 }}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)', fontWeight: 600 }} />
            <Radar name="Skills" dataKey="value" stroke="#a8d5a2" fill="#a8d5a2" fillOpacity={0.25} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Skill bars */}
      <div className="space-y-4">
        {SKILLS.map(({ key, label }) => {
          const val = profile[key] || 1;
          const trend = calcTrend(drillRatings, key);
          const color = barColor(val);
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
                <div className="flex items-center gap-2">
                  {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />}
                  {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />}
                  {trend === 'flat' && <Minus className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />}
                  <span className="text-sm font-black" style={{ color }}>{val}/5</span>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(val / 5) * 100}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}