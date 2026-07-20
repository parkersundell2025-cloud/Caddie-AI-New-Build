import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser, invokeLLM } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronUp, Check, Dumbbell, Flag, Target, Leaf } from 'lucide-react';
import { getDrillClub, getDrillByName } from '@/lib/drillLibrary';
import { isRestSession } from '@/lib/sessionUtils';
import { buildPlanPrompt, PLAN_JSON_SCHEMA } from '@/lib/planGenerator';
import CoachBriefing from '@/components/session/CoachBriefing';
import ActiveSessionMode from '@/components/session/ActiveSessionMode';
import SessionCelebration from '@/components/session/SessionCelebration';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function SessionTypeIcon({ type, className, strokeWidth = 2 }) {
  const Icon =
    /fitness/i.test(type) ? Dumbbell :
    /putt|short/i.test(type) ? Flag :
    /rest/i.test(type) ? Leaf :
    Target;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function getTodayName() {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return DAYS[new Date().getDay()];
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getTodayStr() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function MyPlan() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [completedDays, setCompletedDays] = useState([]);
  const [drillRatings, setDrillRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [celebrationData, setCelebrationData] = useState(null);

  const todayName = getTodayName();
  const todayStr = getTodayStr();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getCurrentUser();
    setUser(u);
    const [profiles, plans, logs, ratings] = await Promise.all([
      unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email)),
      unwrap(supabase.from('practice_plan').select('*').eq('user_email', u.email).eq('is_active', true)),
      unwrap(supabase.from('session_log').select('*').eq('user_email', u.email)),
      unwrap(supabase.from('drill_rating').select('*').eq('user_email', u.email).order('session_date', { ascending: false }).limit(100)),
    ]);
    setProfile(profiles[0] || null);
    setPlan(plans[0] || null);
    setDrillRatings(ratings);

    // Mark completed days from logs this week
    const weekStart = getWeekStart();
    const thisWeekLogs = logs.filter(l => l.session_date >= weekStart && l.completed);
    setCompletedDays(thisWeekLogs.map(l => l.session_day));

    // Auto-expand today if it has a session
    if (plans[0]?.plan_data?.sessions) {
      const todaySession = plans[0].plan_data.sessions.find(s => s.day === todayName);
      if (todaySession) setExpandedDay(todayName);
    }

    setLoading(false);
  };

  const handleGeneratePlan = async () => {
    if (!profile) return;
    setGenerating(true);

    // Deactivate old plans
    const oldPlans = await unwrap(supabase.from('practice_plan').select('*').eq('user_email', user.email).eq('is_active', true));
    for (const p of oldPlans) {
      await unwrap(supabase.from('practice_plan').update({ is_active: false }).eq('id', p.id));
    }

    const prompt = buildPlanPrompt({ profile, drillRatings });
    const result = await invokeLLM({
      prompt,
      response_json_schema: PLAN_JSON_SCHEMA,
    });

    const newPlan = await unwrap(supabase.from('practice_plan').insert({
      user_email: user.email,
      week_start_date: getWeekStart(),
      generated_at: new Date().toISOString(),
      plan_data: result,
      is_active: true,
    }).select().single());

    setPlan(newPlan);
    setGenerating(false);

    // Re-expand today
    if (result?.sessions) {
      const todaySession = result.sessions.find(s => s.day === todayName);
      if (todaySession) setExpandedDay(todayName);
    }
  };

  const handleStartSession = (session) => {
    setSelectedSession(session);
    setShowBriefing(true);
  };

  const handleBriefingStart = () => {
    setShowBriefing(false);
    setActiveSession(selectedSession);
  };

  const handleSessionComplete = async ({ ratings, session }) => {
    const sessionDay = session.day || todayName;
    await supabase.functions.invoke('logSession', {
      body: {
      sessionData: {
        user_email: user.email,
        session_date: todayStr,
        session_type: session.session_type || 'Practice',
        session_day: sessionDay,
        completed: true,
        notes: '',
      },
      drillRatings: (session.drills || []).map(drill => ({
        user_email: user.email,
        session_date: todayStr,
        session_type: session.session_type,
        drill_name: drill.name,
        rating: ratings[drill.name] || 'Okay',
        session_note: '',
      })),
      },
    });

    setCompletedDays(prev => [...prev, sessionDay]);
    setActiveSession(null);
    setCelebrationData({ ratings, session });
    supabase.functions.invoke('updateLeaderboard', { body: {} }).catch(() => {});
    supabase.functions.invoke('checkBadges', { body: {} }).catch(() => {});
  };

  const sessions = plan?.plan_data?.sessions || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const nonRestDays = sessions.filter(s => !isRestSession(s)).map(s => s.day);
  const doneCount = new Set(completedDays.filter(d => nonRestDays.includes(d))).size;
  const pctComplete = nonRestDays.length ? Math.round((doneCount / nonRestDays.length) * 100) : 0;
  const maxMinutes = Math.max(...sessions.map(s => (isRestSession(s) ? 0 : s.duration || 45)), 60);

  return (
    <>
      <div className="px-5 pt-5 pb-6 space-y-5">
        {/* Header — serif over eyebrow, mono % complete on the right */}
        <div className="flex items-end justify-between">
          <div>
            <p className="cut-eyebrow text-cut-ink-mute">Week of {getWeekRange()}</p>
            <h1 className="cut-headline text-cut-ink text-[30px] mt-1">
              Your <span className="italic text-cut-green">plan</span>.
            </h1>
          </div>
          {sessions.length > 0 && (
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-cut-ink leading-none" style={{ letterSpacing: '-1px' }}>
                {pctComplete}<span className="text-cut-ink-mute">%</span>
              </p>
              <p className="cut-eyebrow text-cut-ink-mute mt-1">Complete</p>
            </div>
          )}
        </div>

        {/* progress bar */}
        {sessions.length > 0 && (
          <div className="h-1 rounded-sm overflow-hidden" style={{ background: 'rgba(244,239,227,.08)' }}>
            <div
              className="h-full rounded-sm bg-cut-green transition-all"
              style={{ width: `${pctComplete}%`, boxShadow: '0 0 10px rgba(95,190,126,.30)' }}
            />
          </div>
        )}

        {/* Week strip — minute bars in glass */}
        {sessions.length > 0 && (
          <div className="cut-glass p-4 flex items-center justify-between gap-2">
            <div className="flex justify-between items-end gap-1.5 w-full" style={{ height: 82 }}>
              {DAYS_OF_WEEK.map(day => {
                const session = sessions.find(s => s.day === day);
                const isToday = day === todayName;
                const isDone = completedDays.includes(day);
                const minutes = session && !isRestSession(session) ? (session.duration || 45) : 0;
                const h = Math.max((minutes / maxMinutes) * 50, 4);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className="w-full relative rounded-[3px]"
                      style={{
                        height: h,
                        background: isToday ? '#5FBE7E' : isDone ? '#0E4D2B' : 'rgba(244,239,227,.08)',
                        boxShadow: isToday ? '0 0 10px rgba(95,190,126,.30)' : 'none',
                      }}
                    >
                      {isDone && !isToday && (
                        <div className="absolute inset-0 flex items-center justify-center text-cut-green">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold ${isToday ? 'text-cut-green' : 'text-cut-ink-mute'}`} style={{ letterSpacing: '0.8px' }}>
                      {day.slice(0, 1)}
                    </span>
                    <span className={`font-mono text-[10px] font-semibold ${minutes === 0 ? 'text-cut-ink-mute' : 'text-cut-ink'}`}>
                      {minutes || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sessions header row */}
        {sessions.length > 0 && (
          <div className="flex items-center justify-between px-1.5 -mb-1">
            <p className="cut-eyebrow text-cut-ink-mute">Sessions</p>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-semibold text-cut-green active:scale-95 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'New Plan'}
            </button>
          </div>
        )}

        {/* No plan state */}
        {sessions.length === 0 && (
          <div className="cut-glass p-8 text-center space-y-4">
            <p className="cut-headline text-cut-ink text-xl">No plan yet</p>
            <p className="text-cut-ink-mute text-sm">Generate a personalized weekly practice plan.</p>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 bg-cut-green text-cut-bg"
              style={{ boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
            >
              {generating ? 'Generating...' : 'Generate Plan'}
            </button>
          </div>
        )}

        {/* Session cards */}
        <div className="space-y-2.5">
          {DAYS_OF_WEEK.map(day => {
            const session = sessions.find(s => s.day === day);
            if (!session) return null;

            const isToday = day === todayName;
            const isDone = completedDays.includes(day);
            const isRest = isRestSession(session);
            const isExpanded = expandedDay === day;
            const drills = session.drills || [];

            return (
              <div
                key={day}
                className="cut-glass overflow-hidden transition-all"
                style={{
                  border: isToday ? '1.5px solid #5FBE7E' : '1px solid rgba(244,239,227,.10)',
                  opacity: isDone && !isExpanded ? 0.55 : 1,
                }}
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedDay(isExpanded ? null : day)}
                  className="w-full flex items-center gap-3 p-3.5 active:opacity-80 transition-all"
                >
                  {/* Type icon tile */}
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
                    style={
                      isDone
                        ? { background: 'rgba(95,190,126,.12)', color: '#5FBE7E' }
                        : isToday
                          ? { background: '#5FBE7E', color: '#0B0F0C', boxShadow: '0 0 18px rgba(95,190,126,.30)' }
                          : { background: '#141A17', color: 'rgba(244,239,227,.72)', border: '1px solid rgba(244,239,227,.08)' }
                    }
                  >
                    {isDone
                      ? <Check className="w-5 h-5" strokeWidth={2.6} />
                      : <SessionTypeIcon type={session.session_type} className="w-[18px] h-[18px]" />}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <p className={`cut-eyebrow ${isToday ? 'text-cut-green' : 'text-cut-ink-mute'}`}>
                      {day}{isToday && ' · Today'}{isDone && ' · Done'}
                    </p>
                    <p className={`cut-headline text-base text-cut-ink mt-0.5 truncate ${isDone ? 'line-through' : ''}`}>
                      {isRest ? 'Rest & Recovery' : (session.title || session.session_type)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isRest && (
                      <p className="font-mono text-lg font-bold text-cut-ink" style={{ letterSpacing: '-0.5px' }}>
                        {session.duration || 45}<span className="text-[10px] text-cut-ink-mute font-semibold">m</span>
                      </p>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-cut-ink-mute" />
                      : <ChevronDown className="w-4 h-4 text-cut-ink-mute" />
                    }
                  </div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {isRest ? (
                          <p className="text-sm text-cut-ink-mute">
                            Rest and recovery day. Let your body repair and come back stronger.
                          </p>
                        ) : (
                          <>
                            {/* Drills list */}
                            <div className="space-y-2.5">
                              {drills.map((drill, i) => {
                                const club = drill.club || getDrillClub(drill.name);
                                const drillData = getDrillByName ? getDrillByName(drill.name) : null;
                                const description = drill.description || drillData?.description;
                                return (
                                  <div key={i} className="flex items-start gap-2.5">
                                    <span className="font-mono text-[10px] font-bold text-cut-green mt-1">
                                      {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <div>
                                      <p className="text-sm font-semibold leading-snug text-cut-ink">
                                        {drill.name}
                                      </p>
                                      {description && (
                                        <p className="text-xs leading-snug mt-0.5 text-cut-ink-mute">
                                          {description}
                                        </p>
                                      )}
                                      {club && (
                                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 bg-cut-gold-soft text-cut-gold">
                                          {club}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Start session button — any non-rest, non-done session */}
                            {!isDone ? (
                              <button
                                onClick={() => handleStartSession(session)}
                                className="w-full py-3.5 rounded-[14px] text-sm font-bold mt-2 active:scale-95 transition-all bg-cut-green text-cut-bg"
                                style={{ boxShadow: '0 0 28px rgba(95,190,126,.30), inset 0 1px 0 rgba(255,255,255,.2)' }}
                              >
                                {isToday ? 'Start Session →' : 'Preview Session →'}
                              </button>
                            ) : (
                              <div
                                className="w-full py-3.5 rounded-[14px] text-sm font-bold text-center"
                                style={{ backgroundColor: 'rgba(95,190,126,.12)', color: '#5FBE7E' }}
                              >
                                ✓ Session Complete
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coach Briefing */}
      <AnimatePresence>
        {showBriefing && selectedSession && (
          <CoachBriefing
            session={selectedSession}
            profile={profile}
            drillRatings={drillRatings}
            onStart={handleBriefingStart}
            onClose={() => setShowBriefing(false)}
          />
        )}
      </AnimatePresence>

      {/* Active Session */}
      <AnimatePresence>
        {activeSession && (
          <ActiveSessionMode
            session={activeSession}
            user={user}
            profile={profile}
            drillRatings={drillRatings}
            onClose={() => setActiveSession(null)}
            onComplete={handleSessionComplete}
          />
        )}
      </AnimatePresence>

      {/* Session Celebration — rendered independently so it persists after ActiveSessionMode closes */}
      <AnimatePresence>
        {celebrationData && (
          <SessionCelebration
            ratings={celebrationData.ratings}
            session={celebrationData.session}
            user={user}
            profile={profile}
            leaderboard={null}
            onBack={() => setCelebrationData(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}