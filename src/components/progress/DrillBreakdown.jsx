import React from 'react';

const RATING_EMOJI = { Clicked: '✅', Good: '👍', Okay: '😐', Struggled: '😤' };
const RATING_COLOR = {
  Clicked: 'text-green-600',
  Good: 'text-blue-500',
  Okay: 'text-yellow-500',
  Struggled: 'text-red-500',
};

function inferSkill(drillName) {
  const n = drillName.toLowerCase();
  if (n.includes('putt') || n.includes('lag') || n.includes('green')) return 'Putting';
  if (n.includes('chip') || n.includes('pitch') || n.includes('wedge') || n.includes('bunker') || n.includes('short') || n.includes('flop') || n.includes('scrambl')) return 'Short Game';
  if (n.includes('drive') || n.includes('driver') || n.includes('tee') || n.includes('wood')) return 'Driving';
  if (n.includes('iron') || n.includes('approach') || n.includes('fairway') || n.includes('divot')) return 'Iron Play';
  if (n.includes('course') || n.includes('manage') || n.includes('strategy')) return 'Course Mgmt';
  return 'Other';
}

export default function DrillBreakdown({ drillRatings }) {
  if (!drillRatings || drillRatings.length === 0) return null;

  // Most practiced skill
  const skillCount = {};
  drillRatings.forEach(r => {
    const skill = inferSkill(r.drill_name);
    skillCount[skill] = (skillCount[skill] || 0) + 1;
  });
  const topSkill = Object.entries(skillCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Most struggled drill
  const struggledCount = {};
  drillRatings.filter(r => r.rating === 'Struggled').forEach(r => {
    struggledCount[r.drill_name] = (struggledCount[r.drill_name] || 0) + 1;
  });
  const mostStruggled = Object.entries(struggledCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Most clicked drill
  const clickedCount = {};
  drillRatings.filter(r => r.rating === 'Clicked').forEach(r => {
    clickedCount[r.drill_name] = (clickedCount[r.drill_name] || 0) + 1;
  });
  const mostClicked = Object.entries(clickedCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  const recent10 = drillRatings.slice(0, 10);

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground">Practice Breakdown</h3>

      {/* Summary pills */}
      <div className="grid grid-cols-1 gap-2">
        {topSkill && (
          <div className="card-base px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Most practiced</p>
            <p className="text-sm font-bold text-foreground">{topSkill}</p>
          </div>
        )}
        {mostClicked && (
          <div className="card-base px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">✅ Best drill</p>
            <p className="text-sm font-bold text-foreground truncate max-w-[180px] text-right">{mostClicked}</p>
          </div>
        )}
        {mostStruggled && (
          <div className="card-base px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">😤 Needs work</p>
            <p className="text-sm font-bold text-foreground truncate max-w-[180px] text-right">{mostStruggled}</p>
          </div>
        )}
      </div>

      {/* Recent drill log */}
      <div className="card-base overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Recent Drill Ratings</p>
        </div>
        <div className="divide-y divide-border">
          {recent10.map((r, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{r.drill_name}</p>
                <p className="text-xs text-muted-foreground">{r.session_date}</p>
              </div>
              <span className={`text-sm font-bold ${RATING_COLOR[r.rating]}`}>
                {RATING_EMOJI[r.rating]} {r.rating}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}