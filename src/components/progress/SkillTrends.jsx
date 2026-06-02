import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const RATING_SCORES = { Struggled: 1, Okay: 2, Good: 3, Clicked: 4 };

// Map session_type keywords to skill keys
const SESSION_SKILL_MAP = {
  'Range Day': ['skill_driving', 'skill_iron_play'],
  'Putting & Short Game': ['skill_putting', 'skill_short_game'],
  'Golf Fitness': [],
};

// Map drill name keywords to skills
function inferSkillFromDrill(drillName) {
  const name = drillName.toLowerCase();
  if (name.includes('putt') || name.includes('green') || name.includes('lag')) return 'skill_putting';
  if (name.includes('chip') || name.includes('pitch') || name.includes('wedge') || name.includes('bunker') || name.includes('short')) return 'skill_short_game';
  if (name.includes('drive') || name.includes('driver') || name.includes('wood') || name.includes('tee')) return 'skill_driving';
  if (name.includes('iron') || name.includes('approach') || name.includes('fairway')) return 'skill_iron_play';
  if (name.includes('course') || name.includes('strategy') || name.includes('manage')) return 'skill_course_management';
  return null;
}

const SKILLS = [
  { key: 'skill_driving', label: 'Driving' },
  { key: 'skill_iron_play', label: 'Iron Play' },
  { key: 'skill_short_game', label: 'Short Game' },
  { key: 'skill_putting', label: 'Putting' },
  { key: 'skill_course_management', label: 'Course Mgmt' },
];

function calcTrend(ratings, skillKey) {
  const relevant = ratings.filter(r => {
    const inferred = inferSkillFromDrill(r.drill_name);
    if (inferred) return inferred === skillKey;
    // Fall back to session type
    const sessionSkills = SESSION_SKILL_MAP[r.session_type] || [];
    return sessionSkills.includes(skillKey);
  });

  if (relevant.length < 2) return 'flat';

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recent = relevant.filter(r => r.session_date >= cutoffStr);
  const older = relevant.filter(r => r.session_date < cutoffStr);

  if (recent.length === 0 || older.length === 0) return 'flat';

  const avgRecent = recent.reduce((s, r) => s + (RATING_SCORES[r.rating] || 2), 0) / recent.length;
  const avgOlder = older.reduce((s, r) => s + (RATING_SCORES[r.rating] || 2), 0) / older.length;

  const diff = avgRecent - avgOlder;
  if (diff > 0.3) return 'up';
  if (diff < -0.3) return 'down';
  return 'flat';
}

function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-yellow-500" />;
}

export default function SkillTrends({ drillRatings }) {
  if (!drillRatings || drillRatings.length < 4) {
    return (
      <div className="card-base p-5 space-y-3">
        <div>
          <h3 className="font-bold text-foreground">Skill Trends</h3>
          <p className="text-xs text-muted-foreground">Based on your drill ratings (last 14 days)</p>
        </div>
        <p className="text-muted-foreground text-sm text-center py-4">
          Log practice sessions to see your skill trends develop.
        </p>
      </div>
    );
  }

  return (
    <div className="card-base p-5 space-y-3">
      <div>
        <h3 className="font-bold text-foreground">Skill Trends</h3>
        <p className="text-xs text-muted-foreground">Based on your drill ratings (last 14 days)</p>
      </div>
      <div className="space-y-2">
        {SKILLS.map(({ key, label }) => {
          const trend = calcTrend(drillRatings, key);
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex items-center gap-1.5">
                <TrendIcon trend={trend} />
                <span className={`text-xs font-semibold ${
                  trend === 'up' ? 'text-green-500' :
                  trend === 'down' ? 'text-red-500' :
                  'text-yellow-500'
                }`}>
                  {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}