import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { format } from 'date-fns';

// Dashboard sections
import HandicapHero from '@/components/progress/HandicapHero';
import ScoreChart from '@/components/progress/ScoreChart';
import StatGauges from '@/components/progress/StatGauges';
import CoachTake from '@/components/progress/CoachTake';
import SkillSnapshot from '@/components/progress/SkillSnapshot';
import PracticeGrid from '@/components/progress/PracticeGrid';
import RecentRounds from '@/components/progress/RecentRounds';
import BadgeGrid from '@/components/badges/BadgeGrid';

// Pro sections
import { hasProAccess } from '@/lib/subscription';
import CompetitorIntel from '@/components/pro/CompetitorIntel';
import WeeklyReports from '@/components/pro/WeeklyReports';
import PreRoundGamePlan from '@/components/pro/PreRoundGamePlan';
import MonthlyGamePlanCard from '@/components/pro/MonthlyGamePlanCard';
import ProGate from '@/components/pro/ProGate';

// Celebration
import CelebrationPopup from '@/components/share/CelebrationPopup';
import { generateRoundShareCard, shareImageBlob } from '@/components/share/shareCard';

function LogRoundModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    course_name: '',
    round_date: new Date().toISOString().split('T')[0],
    total_score: '',
    course_rating: '',
    slope_rating: '',
    fairways_hit: '',
    fairways_available: '14',
    greens_in_regulation: '',
    total_putts: '',
    scrambling_saves: '',
    scrambling_attempts: '',
    notes: '',
  });

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    onSave({
      ...form,
      total_score: Number(form.total_score),
      course_rating: form.course_rating ? Number(form.course_rating) : null,
      slope_rating: form.slope_rating ? Number(form.slope_rating) : null,
      fairways_hit: Number(form.fairways_hit),
      fairways_available: Number(form.fairways_available),
      greens_in_regulation: Number(form.greens_in_regulation),
      total_putts: Number(form.total_putts),
      scrambling_saves: Number(form.scrambling_saves),
      scrambling_attempts: Number(form.scrambling_attempts),
    });
  };

  const inputCls = "w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border";
  const labelCls = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto px-6 pt-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 6rem)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-foreground">Log a Round</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Course Name</label>
            <input className={inputCls} placeholder="Augusta National..." value={form.course_name} onChange={e => update('course_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={form.round_date} onChange={e => update('round_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Total Score</label>
            <input type="number" className={inputCls} placeholder="e.g. 84" value={form.total_score} onChange={e => update('total_score', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Course Rating (opt.)</label>
              <input type="number" step="0.1" className={inputCls} placeholder="e.g. 72.0" value={form.course_rating} onChange={e => update('course_rating', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Slope Rating (opt.)</label>
              <input type="number" className={inputCls} placeholder="e.g. 113" value={form.slope_rating} onChange={e => update('slope_rating', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Fairways Hit</label>
              <input type="number" className={inputCls} placeholder="e.g. 8" value={form.fairways_hit} onChange={e => update('fairways_hit', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Of Total</label>
              <input type="number" className={inputCls} placeholder="14" value={form.fairways_available} onChange={e => update('fairways_available', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Greens in Regulation</label>
            <input type="number" className={inputCls} placeholder="e.g. 6 (out of 18)" value={form.greens_in_regulation} onChange={e => update('greens_in_regulation', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Total Putts</label>
            <input type="number" className={inputCls} placeholder="e.g. 32" value={form.total_putts} onChange={e => update('total_putts', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Scrambling Saves</label>
              <input type="number" className={inputCls} placeholder="e.g. 3" value={form.scrambling_saves} onChange={e => update('scrambling_saves', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Attempts</label>
              <input type="number" className={inputCls} placeholder="e.g. 6" value={form.scrambling_attempts} onChange={e => update('scrambling_attempts', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Notes (optional)</label>
            <textarea className={`${inputCls} resize-none h-20`} placeholder="How did it go..." value={form.notes} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <button onClick={handleSave} className="w-full btn-primary py-4">Save Round</button>
      </motion.div>
    </motion.div>
  );
}

export default function Progress() {
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [drillRatings, setDrillRatings] = useState([]);
  const [badges, setBadges] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPreRound, setShowPreRound] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const user = await getCurrentUser();
    const [profiles, roundList, ratings, sessionList, badgeList] = await Promise.all([
      unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email)),
      unwrap(supabase.from('round').select('*').eq('user_email', user.email).order('round_date', { ascending: false }).limit(100)),
      unwrap(supabase.from('drill_rating').select('*').eq('user_email', user.email).order('created_date', { ascending: false }).limit(100)),
      unwrap(supabase.from('session_log').select('*').eq('user_email', user.email).order('session_date', { ascending: false }).limit(60)),
      unwrap(supabase.from('badge').select('*').eq('user_email', user.email).order('earned_at', { ascending: false }).limit(100)),
    ]);
    setProfile(profiles[0] || null);
    setRounds(roundList);
    setDrillRatings(ratings);
    setSessions(sessionList.filter(s => s.completed));
    setBadges(badgeList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (location.state?.openLogRound && !loading) handleLogRoundClick();
  }, [loading]);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh(loadData);

  const handleLogRoundClick = () => {
    if (hasProAccess(profile)) setShowPreRound(true);
    else setShowModal(true);
  };

  const handleSaveRound = async (roundData) => {
    const tempId = `temp_${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];
    setRounds(prev => [{ ...roundData, round_date: roundData.round_date || todayStr, id: tempId }, ...prev]);
    setShowModal(false);

    const res = await supabase.functions.invoke('logRound', {
      body: {
        roundData: { ...roundData, round_date: roundData.round_date || todayStr },
      },
    });

    if (res.data?.saved && res.data?.roundId) {
      const user = await getCurrentUser();
      const allRounds = await unwrap(supabase.from('round').select('*').eq('user_email', user.email).order('round_date', { ascending: false }).limit(100));
      setRounds(allRounds);
    } else if (!res.data?.saved) {
      setRounds(prev => prev.filter(r => r.id !== tempId));
    }

    supabase.functions.invoke('updateLeaderboard', { body: {} }).catch(() => {});
    supabase.functions.invoke('checkBadges', { body: {} }).catch(() => {});
    supabase.functions.invoke('updateHandicap', { body: {} }).catch(() => {});

    setTimeout(async () => {
      await loadData();
      if (res.data?.saved) triggerCelebration(roundData);
    }, 600);
  };

  const triggerCelebration = (roundData) => {
    const realRounds = rounds.filter(r => r.id && !r.id.startsWith('temp_'));
    const prevBest = realRounds.length > 1 ? Math.min(...realRounds.slice(1).map(r => r.total_score)) : null;
    const isPersonalBest = prevBest != null && roundData.total_score < prevBest;
    let popup;
    if (isPersonalBest) {
      popup = { emoji: '🎉', headline: 'Personal Best!', copy: "You just shot your best round ever. That's what the work is for." };
    } else if (profile?.current_handicap != null && roundData.total_score <= Math.round(72 + profile.current_handicap)) {
      popup = { emoji: '🏌️', headline: 'Played to Your Handicap!', copy: `That's exactly what you're capable of. Solid round, ${profile?.first_name || 'golfer'}.` };
    } else {
      popup = { emoji: '✅', headline: 'Round Logged!', copy: "Every round you log is data that makes your coaching smarter." };
    }
    setCelebration({ ...popup, roundData });
  };

  const handleCelebrationShare = async () => {
    if (!celebration?.roundData || !profile) return;
    const rd = celebration.roundData;
    setCelebration(null);
    const blob = await generateRoundShareCard({
      score: rd.total_score, courseName: rd.course_name || null,
      firstName: profile.first_name || 'Golfer',
      handicap: profile.current_handicap ?? null,
      handicapImproved: false, streakDays: profile.streak_days || 0,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
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

  return (
    <>
      <div
        ref={containerRef}
        className="px-4 pt-5 pb-8 space-y-4 relative"
        style={{
          background: '#0a0a0a',
          minHeight: '100vh',
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-3xl font-black text-white" style={{ letterSpacing: '-0.5px', fontFamily: 'Fraunces, Georgia, serif' }}>Progress</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Performance Dashboard</p>
          </div>
          <button
            onClick={handleLogRoundClick}
            className="flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-full active:scale-95 transition-all"
            style={{ background: '#a8d5a2', color: '#0a0a0a' }}
          >
            <Plus className="w-4 h-4" />
            Log Round
          </button>
        </div>

        {/* S1 — Handicap Hero */}
        {profile && <HandicapHero profile={profile} />}

        {/* S2 — Score trend */}
        <ScoreChart rounds={rounds} profile={profile} />

        {/* S3 — Coach's Take */}
        {profile && <CoachTake profile={profile} rounds={rounds} drillRatings={drillRatings} />}

        {/* S4 — You vs Tour */}
        <StatGauges rounds={rounds} />

        {/* S5 — Skill snapshot */}
        {profile && <SkillSnapshot profile={profile} drillRatings={drillRatings} />}

        {/* S6 — Practice consistency */}
        <PracticeGrid sessions={sessions} />

        {/* S7 — Recent rounds */}
        <RecentRounds rounds={rounds} profile={profile} />

        {/* S8 — Badges */}
        <div
          className="p-5 space-y-4"
          style={{ background: '#141414', border: '1px solid rgba(168,213,162,0.15)', borderRadius: 20 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Badges</p>
          <BadgeGrid earnedBadges={badges} />
        </div>

        {/* Pro sections — gated behind ProGate so non-Pro users see an
            upgrade CTA instead of broken empty states. */}
        {profile && (
          <>
            <ProGate profile={profile} featureName="Monthly Game Plan">
              <MonthlyGamePlanCard userEmail={profile.user_email} />
            </ProGate>
            <ProGate profile={profile} featureName="Weekly Reports">
              <WeeklyReports />
            </ProGate>
            <ProGate profile={profile} featureName="Competitor Intel">
              <CompetitorIntel />
            </ProGate>
          </>
        )}
      </div>

      <CelebrationPopup
        visible={!!celebration}
        emoji={celebration?.emoji}
        headline={celebration?.headline}
        copy={celebration?.copy}
        onShare={handleCelebrationShare}
        onDismiss={() => setCelebration(null)}
      />

      <AnimatePresence>
        {showPreRound && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end"
            onClick={e => e.target === e.currentTarget && setShowPreRound(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-background rounded-t-3xl w-full max-w-lg mx-auto p-5"
              style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 1.5rem)' }}
            >
              <PreRoundGamePlan
                onDismiss={() => { setShowPreRound(false); setShowModal(true); }}
                onProceed={() => { setShowPreRound(false); setShowModal(true); }}
              />
            </motion.div>
          </motion.div>
        )}
        {showModal && <LogRoundModal onClose={() => setShowModal(false)} onSave={handleSaveRound} />}
      </AnimatePresence>
    </>
  );
}