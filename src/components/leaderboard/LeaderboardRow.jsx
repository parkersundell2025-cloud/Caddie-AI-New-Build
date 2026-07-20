import React from 'react';

export default function LeaderboardRow({ entry, rank, tab, isMe, onTap, blurred, ptsToNext, divider }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-all active:opacity-80 ${blurred ? 'select-none' : 'cursor-pointer'}`}
      style={{
        borderBottom: divider ? '1px solid rgba(244,239,227,.08)' : 'none',
        background: isMe ? 'rgba(95,190,126,.10)' : 'transparent',
      }}
      onClick={() => !blurred && onTap && onTap(entry.user_email)}
    >
      {/* Rank */}
      <div className={`w-[18px] flex-shrink-0 font-mono text-[13px] font-semibold ${rank <= 3 ? 'text-cut-gold' : 'text-cut-ink-mute'}`}>
        {rank}
      </div>

      {/* Avatar */}
      <div
        className={`w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${blurred ? 'blur-sm' : ''} ${isMe ? 'bg-cut-green text-cut-bg' : 'bg-cut-card-solid text-cut-ink-soft'}`}
        style={!isMe ? { border: '1px solid rgba(244,239,227,.08)' } : undefined}
      >
        {(entry.display_name || 'G')[0].toUpperCase()}
      </div>

      {/* Name + detail */}
      <div className={`flex-1 min-w-0 ${blurred ? 'blur-sm' : ''}`}>
        <p className="font-semibold text-cut-ink text-sm truncate" style={{ letterSpacing: '-0.1px' }}>
          {entry.display_name || 'Golfer'}{isMe ? ' (you)' : ''}
        </p>
        {tab === 'month' && (
          <p className="text-xs text-cut-ink-mute">{entry.rounds_logged || 0} rounds · {entry.sessions_logged || 0} sessions</p>
        )}
        {tab === 'week' && (
          <p className="text-xs text-cut-ink-mute">{entry.week_activity_score || 0} pts this week</p>
        )}
        {tab === 'streaks' && (
          <p className="text-xs text-cut-ink-mute">{entry.streak_days || 0} day streak 🔥</p>
        )}
        {tab === 'alltime' && (
          <p className="text-xs text-cut-ink-mute">{entry.total_activity || (entry.rounds_logged + entry.sessions_logged) || 0} total activities</p>
        )}
        {/* Points to next rank — month tab only */}
        {tab === 'month' && ptsToNext !== null && ptsToNext > 0 && (
          <p className="font-mono text-[10px] text-cut-green font-semibold">{ptsToNext.toFixed(1)} pts to #{rank - 1}</p>
        )}
      </div>

      {/* Score */}
      <div className={`text-right flex-shrink-0 ${blurred ? 'blur-sm' : ''}`}>
        {tab === 'month' && <p className="font-mono font-bold text-cut-ink text-[13px]">{(entry.total_score || 0).toFixed(1)}</p>}
        {tab === 'week' && <p className="font-mono font-bold text-cut-ink text-[13px]">{entry.week_activity_score || 0}</p>}
        {tab === 'streaks' && <p className="font-mono font-bold text-cut-ink text-[13px]">{entry.streak_days || 0}d</p>}
        {tab === 'alltime' && <p className="font-mono font-bold text-cut-ink text-[13px]">{entry.total_activity || ((entry.rounds_logged || 0) + (entry.sessions_logged || 0))}</p>}
        <p className="text-[9px] text-cut-ink-mute">{tab === 'month' ? 'pts' : tab === 'week' ? 'pts' : tab === 'streaks' ? 'streak' : 'acts'}</p>
      </div>
    </div>
  );
}
