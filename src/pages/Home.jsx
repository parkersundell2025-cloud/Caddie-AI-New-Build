import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { MessageCircle, Target, Plus, X } from 'lucide-react';
import { formatHandicap } from '@/lib/handicapUtils';
import { getDrillClub } from '@/lib/drillLibrary';
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
import { getSessionTypeColor } from '@/lib/sessionTypeColors';

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
    const [profiles, plans, logs] = await Promise.all([
      unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email)),
      unwrap(supabase.from('practice_plan').select('*').eq('user_email', u.email).eq('is_active', true)),
      unwrap(supabase.from('session_log').select('*').eq('user_email', u.email).eq('session_date', todayStr)),
    ]);
    const prof = profiles[0] || null;
    setProfile(prof);
    setPlan(plans[0] || null);
    setCompletedToday(logs.some(l => l.completed));
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
    if (profile && !wasAlreadyCompleted && session && session.session_type !== 'Rest & Recovery') {
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
      
      {/* Header */}
      <div>
        <p className="text-muted-foreground text-sm tracking-wide">{getGreeting()},</p>
        <h1 className="text-3xl font-black text-foreground tracking-tight" style={{ letterSpacing: '-0.5px' }}>
          {profile?.first_name || 'Golfer'} 👋
        </h1>
        <p className="text-muted-foreground text-xs mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Trial / subscription state banners — each one self-gates on the
          relevant subscription_status, so it's safe to render all of them
          together. Order matters: TrialExpiredModal is a full-screen overlay
          if active, so it sits above the rest of the page. */}
      <SubscriptionBanner profile={profile} />
      <TrialEndingBanner profile={profile} />

      {/* Today's Focus Card */}
      {!plan ? (
        <div className="rounded-3xl p-6 text-center space-y-4" style={{ backgroundColor: '#1a2e1a' }}>
          <p className="text-white text-lg font-black">Generate your first practice plan</p>
          <p className="text-white/60 text-sm">Create a personalized weekly schedule tailored to your game.</p>
          <Link
            to="/plan"
            className="inline-block px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            Create Plan →
          </Link>
        </div>
      ) : todaySession && todaySession.session_type !== 'Rest & Recovery' ? (
        (() => {
          // Use the safe-fallback lookup helper rather than direct
          // SESSION_TYPE_COLORS[] access — when the plan was authored by the
          // LLM with a session_type variant that isn't one of the four known
          // keys (typo, new category, missing value), direct lookup returns
          // undefined and `.hex` crashes the whole tree, leaving the user on
          // a blank screen with a console error. getSessionTypeColor falls
          // back to the 'Rest & Recovery' palette which is at least visible.
          const sessionColors = getSessionTypeColor(todaySession.session_type);
          return (
        <div className="rounded-3xl p-6 space-y-5 cursor-pointer active:scale-[0.99] transition-all" style={{ backgroundColor: '#1a2e1a' }} onClick={() => navigate('/plan')}>
          <div className="space-y-2">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full inline-block" style={{ backgroundColor: sessionColors.hex, color: 'white' }}>
              {todaySession.session_type}
            </span>
            <p className="text-white/50 text-xs tracking-wide">{todaySession.duration || 45} MIN</p>
            <h3 className="text-white text-2xl font-black leading-tight" style={{ letterSpacing: '-0.5px' }}>{todaySession.title || "Today's Session"}</h3>
          </div>

          {/* Drills list - max 3 shown */}
          <div className="space-y-2.5">
            {(todaySession.drills || []).slice(0, 3).map((drill, i) => {
              const club = drill.club || getDrillClub(drill.name);
              const dotColor = sessionColors.dot;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <div>
                    <p className="text-white/75 text-sm leading-snug">{drill.name}</p>
                    {club && (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: `${dotColor}33`, color: dotColor }}>
                        🏌️ {club}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {(todaySession.drills || []).length > 3 && (
              <p className="text-white/50 text-xs">+{(todaySession.drills || []).length - 3} more</p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); if (!completedToday) setShowLogger(true); }}
            disabled={completedToday}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all ${
              completedToday
                ? 'bg-white/15 text-white/50 cursor-default'
                : 'active:scale-95'
            }`}
            style={!completedToday ? { backgroundColor: sessionColors.hex, color: 'white' } : {}}
          >
            {completedToday ? '✓ Session Complete' : 'Start Session →'}
          </button>
        </div>
          );
        })()
      ) : (
        <div className="rounded-3xl p-6" style={{ backgroundColor: '#1a2e1a' }}>
          <h3 className="text-white text-xl font-black" style={{ letterSpacing: '-0.5px' }}>Rest Day 🌿</h3>
          <p className="text-white/60 text-sm mt-2">Recovery is part of the plan.</p>
        </div>
      )}

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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/coach" className="card-base p-5 flex items-center gap-3 active:scale-95 transition-all">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#a8d5a2' }}>
            <MessageCircle className="w-4 h-4" style={{ color: '#1a2e1a' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Coach</p>
            <p className="text-[11px] text-muted-foreground">Ask anything</p>
          </div>
        </Link>
        <button
          onClick={() => navigate('/progress', { state: { openLogRound: true } })}
          className="card-base p-5 flex items-center gap-3 active:scale-95 transition-all text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#a8d5a2' }}>
            <Target className="w-4 h-4" style={{ color: '#1a2e1a' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Log Round</p>
            <p className="text-[11px] text-muted-foreground">Track stats</p>
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