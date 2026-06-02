import React from 'react';
import { format } from 'date-fns';

const SESSION_ICONS = {
  'Range Day': '🏌️',
  'Putting & Short Game': '⛳',
  'Golf Fitness': '💪',
  'Rest & Recovery': '😴',
};

export default function SessionHistory({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-bold text-foreground">Practice History</h3>
        <div className="card-base p-8 text-center">
          <p className="text-3xl mb-2">🏌️</p>
          <p className="text-sm text-muted-foreground">No sessions logged yet.<br />Complete a session from My Plan to track your practice.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground">Practice History <span className="text-muted-foreground font-normal text-sm">(last 10)</span></h3>
      <div className="card-base overflow-hidden">
        <div className="divide-y divide-border">
          {sessions.slice(0, 10).map((s, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{SESSION_ICONS[s.session_type] || '🏌️'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{s.session_type}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {s.session_date ? format(new Date(s.session_date), 'MMM d') : ''}
                  </p>
                </div>
                {s.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}