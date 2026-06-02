import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser, invokeLLM } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { SESSION_TYPE_COLORS } from '@/lib/sessionTypeColors';
import { getDrillClub, getDrillByName } from '@/lib/drillLibrary';
import { buildPlanPrompt, PLAN_JSON_SCHEMA } from '@/lib/planGenerator';
import CoachBriefing from '@/components/session/CoachBriefing';
import ActiveSessionMode from '@/components/session/ActiveSessionMode';
import SessionCelebration from '@/components/session/SessionCelebration';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  return (
    <>
      <div className="px-5 pt-5 pb-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>My Plan</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{getWeekRange()}</p>
          </div>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="flex items-center gap-1.5 bg-muted px-3 py-2 rounded-xl text-sm font-semibold text-foreground active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'New Plan'}
          </button>
        </div>

        {/* Day dots strip */}
        {sessions.length > 0 && (
          <div className="flex gap-2 justify-between">
            {DAYS_OF_WEEK.map(day => {
              const session = sessions.find(s => s.day === day);
              const isToday = day === todayName;
              const isDone = completedDays.includes(day);
              const isRest = session?.session_type === 'Rest & Recovery' || !session;
              const color = session ? SESSION_TYPE_COLORS[session.session_type]?.hex : null;

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-bold ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {day.slice(0, 1)}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isToday ? 'ring-2 ring-foreground ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: isDone ? color || '#a8d5a2' : isRest ? 'hsl(var(--muted))' : `${color}33` || 'hsl(var(--muted))',
                    }}
                  >
                    {isDone ? (
                      <span className="text-[10px] text-white font-black">✓</span>
                    ) : isRest ? (
                      <span className="text-[10px]">🌿</span>
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No plan state */}
        {sessions.length === 0 && (
          <div className="rounded-3xl p-8 text-center space-y-4" style={{ backgroundColor: '#1a2e1a' }}>
            <p className="text-white text-xl font-black">No plan yet</p>
            <p className="text-white/60 text-sm">Generate a personalized weekly practice plan.</p>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60"
              style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
            >
              {generating ? 'Generating...' : 'Generate Plan'}
            </button>
          </div>
        )}

        {/* Session cards */}
        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => {
            const session = sessions.find(s => s.day === day);
            if (!session) return null;

            const isToday = day === todayName;
            const isDone = completedDays.includes(day);
            const isRest = session.session_type === 'Rest & Recovery';
            const isExpanded = expandedDay === day;
            const colors = SESSION_TYPE_COLORS[session.session_type] || SESSION_TYPE_COLORS['Rest & Recovery'];
            const drills = session.drills || [];

            return (
              <div
                key={day}
                className={`rounded-2xl overflow-hidden transition-all ${
                  isToday ? 'ring-2 ring-foreground/20' : ''
                }`}
                style={{
                  backgroundColor: isToday ? '#1a2e1a' : 'hsl(var(--card))',
                  border: isToday ? 'none' : '0.5px solid hsl(var(--border))',
                }}
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedDay(isExpanded ? null : day)}
                  className="w-full flex items-center justify-between p-4 active:opacity-80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Day label */}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-foreground'}`}>
                          {day}
                          {isToday && <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}>TODAY</span>}
                        </p>
                        {isDone && <span className="text-xs" style={{ color: '#a8d5a2' }}>✓ Done</span>}
                      </div>
                      <p className={`text-xs mt-0.5 ${isToday ? 'text-white/60' : 'text-muted-foreground'}`}>
                        {session.session_type}
                        {!isRest && ` · ${session.duration || 45}m`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isRest && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colors.hex }}
                      />
                    )}
                    {isExpanded
                      ? <ChevronUp className={`w-4 h-4 ${isToday ? 'text-white/60' : 'text-muted-foreground'}`} />
                      : <ChevronDown className={`w-4 h-4 ${isToday ? 'text-white/60' : 'text-muted-foreground'}`} />
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
                          <p className={`text-sm ${isToday ? 'text-white/60' : 'text-muted-foreground'}`}>
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
                                    <div
                                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                                      style={{ backgroundColor: colors.hex }}
                                    />
                                    <div>
                                      <p className={`text-sm font-semibold leading-snug ${isToday ? 'text-white' : 'text-foreground'}`}>
                                        {drill.name}
                                      </p>
                                      {description && (
                                        <p className={`text-xs leading-snug mt-0.5 ${isToday ? 'text-white/60' : 'text-muted-foreground'}`}>
                                          {description}
                                        </p>
                                      )}
                                      {club && (
                                        <span
                                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                                          style={{ backgroundColor: `${colors.hex}22`, color: colors.hex }}
                                        >
                                          🏌️ {club}
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
                                className="w-full py-3.5 rounded-2xl text-sm font-bold mt-2 active:scale-95 transition-all"
                                style={{ backgroundColor: colors.hex, color: 'white' }}
                              >
                                {isToday ? 'Start Session →' : 'Preview Session →'}
                              </button>
                            ) : (
                              <div
                                className="w-full py-3.5 rounded-2xl text-sm font-bold text-center"
                                style={{ backgroundColor: 'rgba(168,213,162,0.15)', color: '#a8d5a2' }}
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