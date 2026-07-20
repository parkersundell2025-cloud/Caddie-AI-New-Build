import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { Sparkles, Target, Play, Flag, CalendarDays } from 'lucide-react';
import CutEmptyCard from '@/components/ui/CutEmptyCard';
import { getDrillClub } from '@/lib/drillLibrary';
import { isRestSession } from '@/lib/sessionUtils';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import TrialEndingBanner from '@/components/trial/TrialEndingBanner';
import TrialExpiredModal from '@/components/trial/TrialExpiredModal';
import SubscriptionBanner from '@/components/trial/SubscriptionBanner';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { AnimatePresence } from 'framer-motion';
import SessionLogger from '@/components/home/SessionLogger';
import CelebrationPopup from '@/components/share/CelebrationPopup';
import { generateSessionShareCard, shareImageBlob } from '@/components/share/shareCard';
import CoachDailyInsight from '@/components/home/CoachDailyInsight';
import ThisWeekStrip from '@/components/home/ThisWeekStrip';
import QuickStatsRow from '@/components/home/QuickStatsRow';
import LeaderboardWidget from '@/components/home/LeaderboardWidget';
import WeeklyGoalRings from '@/components/home/WeeklyGoalRings';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [user, setUser] = useState(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [showLogger, setShowLogger] = useState(false);
  const [showLogRound, setShowLogRound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState(null);
  // Defaults true so returning users never flash the first-week empty cards
  const [hasActivity, setHasActivity] = useState(true);

  const today = new Date();
  // Use locale-aware date string to get the correct local date (avoids UTC offset issues)
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = DAYS[today.getDay()];

  const loadData = async () => {
    const u = await getCurrentUser();
    setUser(u);
    const [profiles, plans, logs, anyRound, anySession] = await Promise.all([
      unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email)),
      unwrap(supabase.from('practice_plan').select('*').eq('user_email', u.email).eq('is_active', true)),
      unwrap(supabase.from('session_log').select('*').eq('user_email', u.email).eq('session_date', todayStr)),
      unwrap(supabase.from('round').select('id').eq('user_email', u.email).limit(1)),
      unwrap(supabase.from('session_log').select('id').eq('user_email', u.email).eq('completed', true).limit(1)),
    ]);
    const prof = profiles[0] || null;
    setProfile(prof);
    setPlan(plans[0] || null);
    setCompletedToday(logs.some(l => l.completed));
    setHasActivity(anyRound.length > 0 || anySession.length > 0);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // Silently apply club distance defaults for existing users who don't have them yet
    supabase.functions.invoke('applyClubDistanceDefaults', { body: {} }).catch(() => {});
  }, []);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh(loadData);

  const getTodaySession = () => {
    if (!plan?.plan_data?.sessions) return null;
    return plan.plan_data.sessions.find(s => s.day === dayName);
  };

  const handleSessionSubmit = async ({ ratings, note }) => {
    const session = getTodaySession();
    if (!session) return;

    // Close logger immediately for good UX
    setShowLogger(false);
    const wasAlreadyCompleted = completedToday;
    setCompletedToday(true);

    const drillRatings = (session.drills || []).map(drill => ({
      user_email: user.email,
      session_date: todayStr,
      session_type: session.session_type,
      drill_name: drill.name,
      rating: ratings[drill.name] || 'Okay',
      session_note: note || '',
    }));

    // Use logSession backend function — enforces rate limits silently
    const res = await supabase.functions.invoke('logSession', {
      body: {
        sessionData: {
          user_email: user.email,
          session_date: todayStr,
          session_type: session.session_type || 'Practice',
          session_day: dayName,
          completed: true,
          notes: note,
        },
        drillRatings,
      },
    });

    // If rate-limited, silently revert optimistic mark
    if (res.data && !res.data.saved) {
      setCompletedToday(false);
      return;
    }

    // Update leaderboard and badges in background
    supabase.functions.invoke('updateLeaderboard', { body: {} }).catch(() => {});
    supabase.functions.invoke('checkBadges', { body: {} }).catch(() => {});
    // Update streak
    let newStreak = profile?.streak_days || 0;
    if (profile && !wasAlreadyCompleted && session && !isRestSession(session)) {
      const lastDate = profile.last_session_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      newStreak = (lastDate === yesterdayStr || lastDate === todayStr)
        ? (profile.streak_days || 0) + 1
        : 1;
      await unwrap(
        supabase.from('user_profile').update({
          streak_days: newStreak,
          last_session_date: todayStr,
        }).eq('id', profile.id)
      );
      setProfile(prev => ({ ...prev, streak_days: newStreak }));
    }

    // Trigger celebration popup — fire unless explicitly rate-limited
    if (res.data?.saved !== false) {
      triggerSessionCelebration(session, ratings, newStreak);
    }
  };

  const triggerSessionCelebration = (session, ratings, streakDays) => {
    const firstName = profile?.first_name || 'golfer';
    const totalSessions = (profile?.session_distribution?.range_day || 0) +
      (profile?.session_distribution?.putting_short_game || 0) +
      (profile?.session_distribution?.golf_fitness || 0);
    const hasClicked = Object.values(ratings || {}).some(r => r === 'Clicked');
    const isFirstEver = totalSessions <= 1;

    let popup;
    if (isFirstEver) {
      popup = { emoji: '🌱', headline: 'First Session Complete!', copy: `The journey to a lower handicap starts exactly like this. Well done, ${firstName}.` };
    } else if (streakDays >= 30) {
      popup = { emoji: '👑', headline: '30 Day Streak!', copy: "30 days of consistent practice. That's elite level dedication." };
    } else if (streakDays >= 14) {
      popup = { emoji: '🔥🔥', headline: '14 Day Streak!', copy: `Two weeks straight. You're building a real habit, ${firstName}.` };
    } else if (streakDays >= 7) {
      popup = { emoji: '🔥', headline: '7 Day Streak!', copy: "A week of consistent practice. This is how handicaps actually drop." };
    } else if (hasClicked) {
      popup = { emoji: '⚡', headline: 'Something Clicked!', copy: "That feeling when it all comes together — that's a breakthrough moment." };
    } else {
      popup = { emoji: '✅', headline: 'Session Complete!', copy: `Another session in the bank. That's how ${firstName} gets better.` };
    }
    setCelebration({ ...popup, session, streakDays });
  };

  const handleCelebrationShare = async () => {
    if (!celebration?.session || !profile) return;
    const s = celebration.session;
    // Dismiss first so the share sheet opens cleanly from a direct user gesture
    const sessionSnapshot = celebration.session;
    const streakSnapshot = celebration.streakDays || 0;
    setCelebration(null);
    const blob = await generateSessionShareCard({
      sessionType: s.session_type || 'Practice',
      duration: s.duration || 45,
      drillCount: (s.drills || []).length || null,
      firstName: profile.first_name || 'Golfer',
      streakDays: streakSnapshot,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      improvingSkill: null,
    });
    await shareImageBlob(blob);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const todaySession = getTodaySession();

  return (
    <><div ref={containerRef} className="px-5 pt-5 pb-6 space-y-6 relative overflow-y-auto" style={{ transform: `translateY(${pullDistance}px)`, transition: pullDistance === 0 ? 'transform 0.3s ease' : 'none' }}>
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      
      {/* Header — editorial serif over eyebrow date; first-week variant
          per the empty-states mock */}
      {plan && !hasActivity ? (
        <div>
          <p className="cut-eyebrow text-cut-ink-mute">Welcome</p>
          <h1 className="cut-headline text-cut-ink text-[30px] leading-[1.08] mt-2">
            Hi {profile?.first_name || 'Golfer'}. Let's <span className="italic text-cut-green">log your first one</span>.
          </h1>
          <p className="text-cut-ink-mute text-sm mt-2 leading-relaxed">
            Your plan is ready — nothing logged yet. Play a round or run a drill and Caddie starts learning your game.
          </p>
        </div>
      ) : (
        <div>
          <p className="cut-eyebrow text-cut-ink-mute">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="cut-headline text-cut-ink text-[32px] leading-[1.05] mt-2">
            {getGreeting()},<br />
            <span className="italic text-cut-green">{profile?.first_name || 'Golfer'}</span>.
          </h1>
        </div>
      )}

      {/* Trial / subscription state banners — each one self-gates on the
          relevant subscription_status, so it's safe to render all of them
          together. Order matters: TrialExpiredModal is a full-screen overlay
          if active, so it sits above the rest of the page. */}
      <SubscriptionBanner profile={profile} />
      <TrialEndingBanner profile={profile} />

      {/* Today's Focus Card — glass hero with topo header */}
      {!plan ? (
        <div className="cut-glass p-6 text-center space-y-4">
          <p className="cut-headline text-cut-ink text-xl">Generate your first practice plan</p>
          <p className="text-cut-ink-mute text-sm">Create a personalized weekly schedule tailored to your game.</p>
          <Link
            to="/plan"
            className="inline-block px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 bg-cut-green text-cut-bg"
            style={{ boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
          >
            Create Plan →
          </Link>
        </div>
      ) : !hasActivity ? (
        /* First week, plan generated but nothing logged — empty-states mock */
        (() => {
          const sessions = plan.plan_data?.sessions || [];
          const working = sessions.filter(s => !isRestSession(s));
          const drillCount = working.reduce((a, s) => a + (s.drills?.length || 0), 0);
          const firstDuration = (!isRestSession(todaySession) ? todaySession : working[0])?.duration || 45;
          return (
            <div className="space-y-3">
              <CutEmptyCard
                icon={Flag}
                title="No rounds yet"
                body="Log your first round to start tracking fairways, greens, and putts."
                cta="Log a round"
                onCta={() => navigate('/progress', { state: { openLogRound: true } })}
              />
              <CutEmptyCard
                icon={CalendarDays}
                title="No sessions yet"
                body={drillCount > 0
                  ? `Your plan has ${drillCount} drill${drillCount === 1 ? '' : 's'} queued this week — first session's ${firstDuration} minutes.`
                  : 'Your weekly plan is ready when you are.'}
                cta="Start today's session"
                onCta={() => navigate('/plan')}
              />
            </div>
          );
        })()
      ) : todaySession && !isRestSession(todaySession) ? (
        <div className="cut-glass overflow-hidden cursor-pointer active:scale-[0.99] transition-all" onClick={() => navigate('/plan')}>
          {/* topo image header */}
          <div className="relative min-h-[110px] overflow-hidden pb-3.5 pt-9" style={{ background: 'linear-gradient(135deg, #0E4D2B 0%, #1A6B3F 100%)' }}>
            <svg width="100%" height="100%" viewBox="0 0 360 110" preserveAspectRatio="none" className="absolute inset-0 opacity-25">
              {[14, 28, 42, 56, 70, 84, 98].map((y, i) => (
                <path key={i} d={`M0 ${y} Q90 ${y - 8 - (i % 2) * 4} 180 ${y} T360 ${y}`} stroke="#F4EFE3" strokeWidth="1" fill="none" />
              ))}
            </svg>
            <p className="cut-eyebrow text-cut-gold absolute top-3.5 left-[18px]">{todaySession.session_type}</p>
            <div className="relative flex items-end justify-between px-[18px] gap-3">
            <div className="text-cut-cream" style={{ maxWidth: '70%' }}>
              <h3 className="cut-headline text-[24px] leading-[1.05]">{todaySession.title || "Today's Session"}</h3>
              {(todaySession.drills || []).length > 0 && (
                <p className="mt-1 text-xs font-medium" style={{ color: 'rgba(244,239,227,.75)' }}>
                  {(todaySession.drills || []).length} drill{(todaySession.drills || []).length === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-[22px] font-bold text-cut-cream leading-none" style={{ letterSpacing: '-1px' }}>
                {todaySession.duration || 45}:00
              </p>
              <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(244,239,227,.6)', letterSpacing: '1.2px' }}>EST.</p>
            </div>
            </div>
          </div>

          {/* numbered drill chips */}
          <div className="px-4 pt-3.5 flex gap-1.5 flex-wrap">
            {(todaySession.drills || []).map((drill, i) => {
              const club = drill.club || getDrillClub(drill.name);
              return (
                <div key={i} className="px-2.5 py-1.5 rounded-full bg-cut-card-solid flex items-center gap-1.5 text-[11px] font-semibold text-cut-ink" style={{ border: '1px solid rgba(244,239,227,.08)' }}>
                  <span className="font-mono text-cut-green text-[10px] font-bold">{String(i + 1).padStart(2, '0')}</span>
                  <span>{drill.name}</span>
                  {club && <span className="font-mono text-cut-ink-mute text-[10px]">{club}</span>}
                </div>
              );
            })}
          </div>

          {/* Start button — neon edge */}
          <div className="px-4 pt-3.5 pb-[18px]">
            <button
              onClick={(e) => { e.stopPropagation(); if (!completedToday) setShowLogger(true); }}
              disabled={completedToday}
              className={`w-full h-[50px] rounded-[14px] text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                completedToday
                  ? 'bg-cut-card text-cut-ink-mute cursor-default'
                  : 'bg-cut-green text-cut-bg active:scale-95'
              }`}
              style={!completedToday ? { boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' } : {}}
            >
              {completedToday ? (
                '✓ Session Complete'
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
                  <span>Begin Session</span>
                  <span className="opacity-60">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="cut-glass p-6">
          <h3 className="cut-headline text-cut-ink text-xl">Rest Day 🌿</h3>
          <p className="text-cut-ink-mute text-sm mt-2">Recovery is part of the plan.</p>
        </div>
      )}

      {/* Zero-value widgets stay hidden during the first-week empty state,
          per the empty-states mock — they all render as 0%/dashes until
          something is logged */}
      {hasActivity && (
        <>
          {/* This Week Strip */}
          {user && <ThisWeekStrip userEmail={user.email} />}

          {/* Leaderboard Widget */}
          {user && <LeaderboardWidget userEmail={user.email} />}

          {/* Weekly Goal Rings */}
          {user && plan && <WeeklyGoalRings userEmail={user.email} plan={plan} />}

          {/* Coach Daily Insight */}
          {user && <CoachDailyInsight userEmail={user.email} />}

          {/* Quick Stats Row */}
          {user && <QuickStatsRow userEmail={user.email} />}
        </>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/coach" className="cut-glass p-5 flex items-center gap-3 active:scale-95 transition-all">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-cut-green text-cut-bg">
            <Sparkles className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-cut-ink">Caddie</p>
            <p className="text-[11px] text-cut-ink-mute">Ask anything</p>
          </div>
        </Link>
        <button
          onClick={() => navigate('/progress', { state: { openLogRound: true } })}
          className="cut-glass p-5 flex items-center gap-3 active:scale-95 transition-all text-left"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-cut-gold text-cut-bg">
            <Target className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-cut-ink">Log Round</p>
            <p className="text-[11px] text-cut-ink-mute">Track stats</p>
          </div>
        </button>
      </div>
      <AnimatePresence>
        {showLogger && todaySession && (
          <SessionLogger
            session={todaySession}
            onClose={() => setShowLogger(false)}
            onSubmit={handleSessionSubmit}
          />
        )}
      </AnimatePresence>
    </div>

    <CelebrationPopup
      visible={!!celebration}
      emoji={celebration?.emoji}
      headline={celebration?.headline}
      copy={celebration?.copy}
      onShare={handleCelebrationShare}
      onDismiss={() => setCelebration(null)}
    />

    {/* Full-screen overlay if the trial date has passed but the RC webhook
        hasn't flipped status yet. Self-gates on isTrialExpired(profile). */}
    <TrialExpiredModal profile={profile} />
    </>
  );
}