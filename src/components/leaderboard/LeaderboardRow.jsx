import React from 'react';

export default function LeaderboardRow({ entry, rank, tab, isMe, onTap, blurred, ptsToNext }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-95 ${isMe ? 'bg-sage/20 border border-sage/40' : 'bg-card'} ${blurred ? 'select-none' : 'cursor-pointer'}`}
      onClick={() => !blurred && onTap && onTap(entry.user_email)}
    >
      {/* Rank */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black
        ${rank === 1 ? 'bg-yellow-400 text-yellow-900' : rank === 2 ? 'bg-gray-300 text-gray-700' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'}
      `}>
        {rank}
      </div>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0 ${blurred ? 'blur-sm' : ''}`}>
        <span className="text-background text-sm font-black">
          {(entry.display_name || 'G')[0].toUpperCase()}
        </span>
      </div>

      {/* Name + detail */}
      <div className={`flex-1 min-w-0 ${blurred ? 'blur-sm' : ''}`}>
        <p className="font-bold text-foreground text-sm truncate">{entry.display_name || 'Golfer'}</p>
        {tab === 'month' && (
          <p className="text-xs text-muted-foreground">{entry.rounds_logged || 0} rounds · {entry.sessions_logged || 0} sessions</p>
        )}
        {tab === 'week' && (
          <p className="text-xs text-muted-foreground">{entry.week_activity_score || 0} pts this week</p>
        )}
        {tab === 'streaks' && (
          <p className="text-xs text-muted-foreground">{entry.streak_days || 0} day streak 🔥</p>
        )}
        {tab === 'alltime' && (
          <p className="text-xs text-muted-foreground">{entry.total_activity || (entry.rounds_logged + entry.sessions_logged) || 0} total activities</p>
        )}
        {/* Points to next rank — month tab only */}
        {tab === 'month' && ptsToNext !== null && ptsToNext > 0 && (
          <p className="text-[10px] text-sage-dark dark:text-sage font-semibold">{ptsToNext.toFixed(1)} pts to #{rank - 1}</p>
        )}
      </div>

      {/* Score */}
      <div className={`text-right flex-shrink-0 ${blurred ? 'blur-sm' : ''}`}>
        {tab === 'month' && <p className="font-black text-foreground text-sm">{(entry.total_score || 0).toFixed(1)}</p>}
        {tab === 'week' && <p className="font-black text-foreground text-sm">{entry.week_activity_score || 0}</p>}
        {tab === 'streaks' && <p className="font-black text-foreground text-sm">{entry.streak_days || 0}d</p>}
        {tab === 'alltime' && <p className="font-black text-foreground text-sm">{entry.total_activity || ((entry.rounds_logged || 0) + (entry.sessions_logged || 0))}</p>}
        <p className="text-[10px] text-muted-foreground">{tab === 'month' ? 'pts' : tab === 'week' ? 'pts' : tab === 'streaks' ? 'streak' : 'acts'}</p>
      </div>
    </div>
  );
}