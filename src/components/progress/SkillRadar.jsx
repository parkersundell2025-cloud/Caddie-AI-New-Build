import React from 'react';
import ProBadge from '@/components/pro/ProBadge';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const SKILL_LABELS = {
  skill_driving: 'Driving',
  skill_iron_play: 'Iron Play',
  skill_short_game: 'Short Game',
  skill_putting: 'Putting',
  skill_course_management: 'Course Mgmt',
};

export default function SkillRadar({ profile }) {
  if (!profile) return null;

  const data = Object.entries(SKILL_LABELS).map(([key, label]) => ({
    skill: label,
    value: profile[key] || 1,
    fullMark: 5,
  }));

  return (
    <div className="card-base p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Skill Profile</h3>
          <p className="text-xs text-muted-foreground">Updated based on your drill and round performance</p>
        </div>
        <ProBadge />
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#e5e5e5" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fontSize: 10, fill: '#888', fontWeight: 600 }}
            />
            <Radar
              name="Skills"
              dataKey="value"
              stroke="#141A17"
              fill="#5FBE7E"
              fillOpacity={0.5}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {data.map(d => (
          <div key={d.skill} className="text-center">
            <p className="text-base font-black text-foreground">{d.value}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">{d.skill.split(' ')[0]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}