import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { AnimatePresence } from 'framer-motion';
import { Crown, Info, Plus, ChevronRight } from 'lucide-react';
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow';
import PlayerProfileCard from '@/components/leaderboard/PlayerProfileCard';
import LeaderboardHowtoPopup from '@/components/popups/LeaderboardHowtoPopup';
import { getTrialDaysRemaining } from '@/lib/trialUtils';

const TABS = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'alltime', label: 'All Time' },
];

function ScoreBreakdown({ myEntry }) {
  if (!myEntry || !myEntry.total_score) return null;
  const activityPts = Math.round((myEntry.activity_score || 0) * 0.4 * 10) / 10;
  const improvePts = Math.round((myEntry.improvement_score || 0) * 0.6 * 10) / 10;
  const handicapDrop = myEntry.handicap_start != null && myEntry.handicap_current != null
    ? Math.round((myEntry.handicap_start - myEntry.handicap_current) * 10) / 10
    : null;

  return (
    <div className="rounded-2xl p-4 space-y-3 bg-sage/10 border border-sage/30">
      <p className="text-xs font-bold text-foreground uppercase tracking-wide">Your Score Breakdown</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Activity</p>
            <p className="text-xs text-muted-foreground">{myEntry.rounds_logged || 0} rounds · {myEntry.sessions_logged || 0} sessions</p>
          </div>
          <p className="font-black text-foreground">{activityPts.toFixed(1)} pts</p>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Improvement</p>
            <p className="text-xs text-muted-foreground">
              {myEntry.handicap_start != null ? `Started at ${myEntry.handicap_start}` : '—'}
              {handicapDrop !== null && handicapDrop > 0 ? ` · ↓ ${handicapDrop} strokes` : ''}
              {myEntry.improvement_pct > 0 ? ` · ${myEntry.improvement_pct.toFixed(1)}%` : ''}
            </p>
          </div>
          <p className="font-black text-foreground">{improvePts.toFixed(1)} pts</p>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Total</p>
          <p className="font-black text-foreground text-lg">{(myEntry.total_score || 0).toFixed(1)} pts</p>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showHowto, setShowHowto] = useState(false);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (data !== null) loadTab();
  }, [tab]);

  const init = async () => {
    const u = await getCurrentUser();
    setUser(u);
    const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email));
    const p = profiles[0];
    setProfile(p);

    if (p && !p.popup_leaderboard_howto_shown) {
      await unwrap(supabase.from('user_profile').update({ popup_leaderboard_howto_shown: true }).eq('id', p.id).select().single());
      setShowHowto(true);
    }

    await loadTab();
  };

  const loadTab = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke('getLeaderboard', { body: { tab } });
    setData(res.data);
    setLoading(false);
  };

  const isPaid = profile?.subscription_status === 'basic' || profile?.subscription_status === 'pro';
  const isTrial = profile?.subscription_status === 'trial';
  const canSeeLeaderboard = isPaid || isTrial;

  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute points-to-next for each entry
  const entriesWithGap = (data?.entries || []).map((entry, i, arr) => {
    const nextEntry = i > 0 ? arr[i - 1] : null;
    const ptsToNext = nextEntry ? Math.round((nextEntry.total_score - entry.total_score) * 10) / 10 : null;
    return { ...entry, ptsToNext };
  });

  // Per-tab display value, mirrors LeaderboardRow's score column
  const entryValue = (entry) => {
    if (tab === 'week') return { v: entry.week_activity_score || 0, u: 'pts' };
    if (tab === 'streaks') return { v: entry.streak_days || 0, u: 'd' };
    if (tab === 'alltime') return { v: entry.total_activity || ((entry.rounds_logged || 0) + (entry.sessions_logged || 0)), u: 'acts' };
    return { v: (entry.total_score || 0).toFixed(1), u: 'pts' };
  };

  const showPodium = entriesWithGap.length >= 3;
  const podium = showPodium ? [entriesWithGap[1], entriesWithGap[0], entriesWithGap[2]] : [];
  const podiumMeta = [
    { rank: 2, h: 50, ring: '#F4EFE3' },
    { rank: 1, h: 80, ring: '#D9B14A' },
    { rank: 3, h: 30, ring: '#C09553' },
  ];
  const listEntries = showPodium ? entriesWithGap.slice(3) : entriesWithGap;

  return (
    <div className="px-5 pt-5 pb-6 space-y-5 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="cut-eyebrow text-cut-ink-mute">
            {data?.entries?.length ? `${data.entries.length} Member${data.entries.length === 1 ? '' : 's'} · ` : ''}{monthName}
          </p>
          <h1 className="cut-headline text-cut-ink text-[30px] mt-1">
            The <span className="italic text-cut-green">Club</span>.
          </h1>
        </div>
        <button
          onClick={() => setShowHowto(true)}
          className="w-9 h-9 rounded-full bg-cut-card-solid flex items-center justify-center text-cut-green"
          style={{ border: '1px solid rgba(244,239,227,.10)' }}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-[7px] rounded-[14px] text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-cut-green text-cut-bg' : 'bg-cut-card-solid text-cut-ink-soft'
            }`}
            style={tab === t.id
              ? { boxShadow: '0 0 16px rgba(95,190,126,.30)' }
              : { border: '1px solid rgba(244,239,227,.10)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trial banner */}
      {isTrial && (
        <div className="rounded-2xl p-3 bg-muted border border-border">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            You're in trial mode — once your trial ends you'll be automatically added to the leaderboard and compete for prizes every month.
          </p>
        </div>
      )}

      {/* No account */}
      {!canSeeLeaderboard && (
        <div className="relative">
          <div className="space-y-2 pointer-events-none select-none">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-card blur-sm">
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-24" />
                  <div className="h-2 bg-muted rounded w-16" />
                </div>
                <div className="h-4 bg-muted rounded w-10" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/60 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
              This feature requires an active subscription.
            </p>
          </div>
        </div>
      )}

      {loading && canSeeLeaderboard ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
        </div>
      ) : canSeeLeaderboard ? (
        <>
          {/* Defending Champion */}
          {tab === 'month' && data?.prevChampion && (
            <div className="cut-glass p-4 flex items-center gap-3" style={{ borderLeft: '2px solid #D9B14A', borderRadius: 14 }}>
              <Crown className="w-5 h-5 text-cut-gold flex-shrink-0" />
              <div>
                <p className="cut-eyebrow text-cut-gold">Defending Champion</p>
                <p className="cut-headline text-cut-ink text-[15px] mt-0.5">{data.prevChampion.display_name}</p>
                <p className="text-cut-ink-mute text-xs">
                  {new Date(data.prevChampion.month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {data.prevChampion.winning_score?.toFixed(1)} pts
                </p>
              </div>
            </div>
          )}

          {/* Weekly tab context */}
          {tab === 'week' && (
            <div className="rounded-2xl p-3 bg-muted border border-border">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Weekly board resets every Monday · Most activity this week wins bragging rights + the <strong className="text-foreground">Weekly Grinder 💪</strong> badge
              </p>
            </div>
          )}

          {/* New account countdown */}
          {isPaid && data?.myEntry && data.myEntry.meets_age_criteria === false && (
            <div className="rounded-2xl p-4 space-y-1 bg-sage/10 border border-sage/30">
              <p className="text-sm font-black text-foreground">⏳ You'll appear on the leaderboard in {data.myEntry.days_until_eligible} day{data.myEntry.days_until_eligible !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">Keep logging rounds and sessions — your score is accumulating and will go live automatically.</p>
              <p className="text-sm font-bold text-foreground mt-1">Your current score: {(data.myEntry.total_score || 0).toFixed(1)} pts</p>
            </div>
          )}

          {/* Podium top 3 */}
          {showPodium && (
            <div className="cut-glass p-5">
              <div
                className="absolute pointer-events-none"
                style={{ top: -60, right: -60, width: 200, height: 200, borderRadius: 100, background: 'rgba(95,190,126,.30)', filter: 'blur(50px)' }}
              />
              <div className="relative flex items-end justify-center gap-2" style={{ height: 160 }}>
                {podium.map((entry, i) => {
                  const meta = podiumMeta[i];
                  const isMe = entry.user_email === user?.email;
                  const { v, u } = entryValue(entry);
                  const initials = (entry.display_name || 'G').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={entry.user_email || i}
                      onClick={() => setSelectedPlayer(entry.user_email)}
                      className="flex-1 flex flex-col items-center"
                    >
                      <div className="relative mb-1.5">
                        <div
                          className="rounded-full flex items-center justify-center cut-headline italic"
                          style={{
                            width: meta.rank === 1 ? 56 : 48,
                            height: meta.rank === 1 ? 56 : 48,
                            fontSize: meta.rank === 1 ? 22 : 18,
                            background: isMe ? '#5FBE7E' : '#141A17',
                            color: isMe ? '#0B0F0C' : '#F4EFE3',
                            border: `2px solid ${meta.ring}`,
                            boxShadow: meta.rank === 1 ? '0 0 18px rgba(95,190,126,.30)' : 'none',
                          }}
                        >
                          {initials}
                        </div>
                        {meta.rank === 1 && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-base">👑</div>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-cut-ink truncate max-w-full">{entry.display_name || 'Golfer'}{isMe ? ' (you)' : ''}</p>
                      <p className="font-mono text-[11px] font-semibold text-cut-ink-soft mt-0.5">{v}{u === 'pts' ? '' : u}</p>
                      <div
                        className="mt-2 w-full flex items-center justify-center"
                        style={{
                          height: meta.h,
                          background: isMe ? '#5FBE7E' : meta.rank === 2 ? '#141A17' : 'rgba(244,239,227,.06)',
                          borderRadius: '4px 4px 0 0',
                          border: `1px solid ${meta.ring}`,
                          borderBottom: 'none',
                          boxShadow: isMe ? 'inset 0 -2px 0 #0E4D2B, 0 0 16px rgba(95,190,126,.30)' : 'none',
                        }}
                      >
                        <span className="cut-headline italic text-[26px]" style={{ color: isMe ? '#0B0F0C' : meta.ring }}>{meta.rank}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score breakdown — month tab only for paid users */}
          {isPaid && tab === 'month' && data?.myEntry && (
            <ScoreBreakdown myEntry={data.myEntry} />
          )}

          {/* Leaderboard rows */}
          {showPodium && listEntries.length > 0 && (
            <p className="cut-eyebrow text-cut-ink-mute px-1.5 -mb-2">All Members</p>
          )}
          <div className={listEntries.length > 0 ? 'cut-glass overflow-hidden' : 'space-y-2'}>
            {(entriesWithGap || []).length === 0 ? (
              // Three empty states:
              //  1. Age-gated active user (myEntry exists, meets_age_criteria=false) — the
              //     countdown card above already explains it; suppress the empty state entirely
              //     to avoid contradicting it ("No entries yet · Log a round..." while the
              //     countdown card says "your score is accumulating").
              //  2. Eligible active user but list still empty — they're the only paid player
              //     so far this period. Frame it that way instead of telling them to log.
              //  3. No myEntry at all — genuine zero activity, keep the call-to-action.
              (isPaid && data?.myEntry && data.myEntry.meets_age_criteria === false) ? null : (
                <div className="text-center py-12 space-y-2">
                  <p className="text-4xl">⛳</p>
                  <p className="font-bold text-foreground">
                    {data?.myEntry ? "You're the only one here" : 'No entries yet'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {data?.myEntry
                      ? 'Invite friends to compete with you on the leaderboard.'
                      : 'Log a round or practice session to appear on the leaderboard.'}
                  </p>
                </div>
              )
            ) : (
              listEntries.map((entry, i) => (
                <LeaderboardRow
                  key={entry.user_email || i}
                  entry={entry}
                  rank={(showPodium ? 3 : 0) + i + 1}
                  tab={tab}
                  isMe={entry.user_email === user?.email}
                  onTap={canSeeLeaderboard ? setSelectedPlayer : null}
                  blurred={false}
                  ptsToNext={entry.ptsToNext}
                  divider={i < listEntries.length - 1}
                />
              ))
            )}
          </div>

          {/* Invite a friend — mock's gold CTA, wired to the real referral flow */}
          <button
            onClick={() => navigate('/referral')}
            className="cut-glass w-full p-4 flex items-center gap-3 text-left active:opacity-80 transition-opacity"
            style={{ borderLeft: '2px solid #D9B14A', borderRadius: 14 }}
          >
            <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-shrink-0 bg-cut-gold-soft text-cut-gold">
              <Plus className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="cut-headline text-cut-ink text-[15px]" style={{ letterSpacing: '-0.1px' }}>Invite a friend</p>
              <p className="text-[11px] text-cut-ink-soft mt-0.5">Practice is better with the foursome.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-cut-ink-soft" />
          </button>

          {/* Hall of Fame */}
          {data?.hallOfFame?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2 px-1.5">
                <Crown className="w-3.5 h-3.5 text-cut-gold" />
                <h2 className="cut-eyebrow text-cut-gold">Hall of Fame</h2>
              </div>
              <div className="cut-glass overflow-hidden">
                {data.hallOfFame.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPlayer(entry.user_email)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:opacity-80 transition-all"
                    style={{ borderBottom: i < data.hallOfFame.length - 1 ? '1px solid rgba(244,239,227,.08)' : 'none' }}
                  >
                    <div className="w-8 h-8 rounded-full bg-cut-gold-soft flex items-center justify-center flex-shrink-0">
                      <Crown className="w-4 h-4 text-cut-gold" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="cut-headline text-cut-ink text-sm">{entry.display_name}</p>
                      <p className="text-xs text-cut-ink-mute">
                        {new Date(entry.month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-cut-gold">{entry.winning_score?.toFixed(1)} pts</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <AnimatePresence>
        {selectedPlayer && (
          <PlayerProfileCard playerEmail={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
        {showHowto && <LeaderboardHowtoPopup key="howto" onDismiss={() => setShowHowto(false)} />}
      </AnimatePresence>
    </div>
  );
}