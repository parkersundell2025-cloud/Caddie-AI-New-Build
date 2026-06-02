import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Info } from 'lucide-react';
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

  return (
    <div className="px-5 pt-5 pb-6 space-y-5 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>Leaderboard</h1>
          <p className="text-muted-foreground text-sm">{monthName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHowto(true)} className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center">
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center">
            <Trophy className="w-5 h-5 text-background" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-2xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
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
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: '#2a1f00' }}>
              <Crown className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-wide">Defending Champion</p>
                <p className="text-white font-black">{data.prevChampion.display_name}</p>
                <p className="text-yellow-400/70 text-xs">
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

          {/* Score breakdown — month tab only for paid users */}
          {isPaid && tab === 'month' && data?.myEntry && (
            <ScoreBreakdown myEntry={data.myEntry} />
          )}

          {/* Leaderboard rows */}
          <div className="space-y-2">
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
              entriesWithGap.map((entry, i) => (
                <LeaderboardRow
                  key={entry.user_email || i}
                  entry={entry}
                  rank={i + 1}
                  tab={tab}
                  isMe={entry.user_email === user?.email}
                  onTap={canSeeLeaderboard ? setSelectedPlayer : null}
                  blurred={false}
                  ptsToNext={entry.ptsToNext}
                />
              ))
            )}
          </div>

          {/* Hall of Fame */}
          {data?.hallOfFame?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <h2 className="text-sm font-black text-foreground uppercase tracking-wide">Hall of Fame</h2>
              </div>
              <div className="space-y-2">
                {data.hallOfFame.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPlayer(entry.user_email)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-yellow-400/20 active:scale-95 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-foreground text-sm">{entry.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="text-sm font-black text-yellow-400">{entry.winning_score?.toFixed(1)} pts</p>
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