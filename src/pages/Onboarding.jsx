import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser, isAuthenticated } from '@/lib/db';
import Logo from '@/components/layout/Logo';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { generateReferralCode } from '@/lib/referralConfig';
import { formatHandicap, capHandicap } from '@/lib/handicapUtils';
import ClubDistancesStep from '@/components/onboarding/ClubDistancesStep';
import { getDefaultDistances } from '@/lib/clubDistances';
import { hasBasicOrBetter } from '@/lib/subscription';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Presets only — they position the handicap slider, nothing else is stored
const LEVELS = [
  { l: 'New to golf', v: 'Just starting out', hcp: 30 },
  { l: 'Casual', v: '20+ handicap', hcp: 22 },
  { l: 'Regular', v: '10–20 handicap', hcp: 15 },
  { l: 'Competitive', v: 'Under 10', hcp: 7 },
];

const SKILLS = [
  { key: 'skill_driving', label: 'Driving' },
  { key: 'skill_iron_play', label: 'Iron Play' },
  { key: 'skill_short_game', label: 'Short Game' },
  { key: 'skill_putting', label: 'Putting' },
  { key: 'skill_course_management', label: 'Course Management' },
];

function SkillSlider({ label, value, onChange }) {
  const labels = ['', 'My biggest weakness', 'Needs work', 'Solid but inconsistent', 'One of my strengths', 'My best weapon'];
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="cut-headline text-cut-ink text-sm">{label}</span>
        <span className="text-xs font-semibold text-cut-green px-2 py-0.5 rounded-full" style={{ background: 'rgba(95,190,126,.15)' }}>
          {labels[value]}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #5FBE7E 0%, #5FBE7E ${(value - 1) * 25}%, rgba(244,239,227,.10) ${(value - 1) * 25}%, rgba(244,239,227,.10) 100%)`
          }}
        />
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  // Signed handicap comes straight off the slider now (negative = plus
  // handicap); the old +/- toggle is gone but downstream math still reads
  // this flag, so it stays pinned false.
  const isPlus = false;
  const [levelChoice, setLevelChoice] = useState(null);
  const [typingHcp, setTypingHcp] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState(null);

  // The Cut theme lives on <html> (same pattern as AppLayout) so portaled
  // surfaces (Drawer) inherit the dark tokens on this standalone route.
  useEffect(() => {
    document.documentElement.classList.add('theme-cut');
    return () => document.documentElement.classList.remove('theme-cut');
  }, []);

  // On mount: verify user is authenticated and go through gateway check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuthed = await isAuthenticated();
        if (!isAuthed) {
          navigate('/signin', { replace: true });
          return;
        }
        // User is authenticated — let onboarding load normally
        } catch (e) {
        navigate('/signin', { replace: true });
        return;
        } finally {
        setCheckingAuth(false);
        }
        };
        checkAuth();
  }, [navigate]);
  const [form, setForm] = useState({
    current_handicap: '',
    goal_handicap: '',
    target_timeline: '6 months',
    days_per_week: 3,
    preferred_days: ['Saturday', 'Sunday', 'Wednesday'],
    skill_driving: 3,
    skill_iron_play: 3,
    skill_short_game: 3,
    skill_putting: 3,
    skill_course_management: 3,
  });

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleDay = (day) => {
    const fullDay = FULL_DAYS[DAYS.indexOf(day)];
    setForm(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(fullDay)
        ? prev.preferred_days.filter(d => d !== fullDay)
        : [...prev.preferred_days, fullDay]
    }));
  };

  const [clubDistances, setClubDistances] = useState({});
  // The plan generateInitialPlan just built — shown on the finish screen.
  // Nullable: plan generation is allowed to fail without blocking onboarding.
  const [readyPlan, setReadyPlan] = useState(null);

  const handleClubDistancesNext = (distances) => {
    setClubDistances(distances);
    setStep(4); // go to rate your game
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await getCurrentUser();
      const today = new Date().toISOString().split('T')[0];

      // Read referral code from URL or localStorage. Don't clear yet — only after success.
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref') || localStorage.getItem('caddie_ref_code') || '';

      const existing = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));

      // Never create a profile here. If none exists, the user reached onboarding without
      // paying — send them back to subscribe. Subscription state is owned by the webhook layer.
      if (existing.length === 0) {
        navigate('/subscribe-now', { replace: true });
        return;
      }

      const existingProfile = existing[0];

      // Parse handicap with plus-prefix handling
      let currentHcp = form.current_handicap !== '' ? parseFloat(form.current_handicap) : 18;
      if (isPlus && currentHcp > 0) currentHcp = -currentHcp;
      currentHcp = capHandicap(currentHcp);

      let goalHcp = form.goal_handicap !== '' ? parseFloat(form.goal_handicap) : 10;
      goalHcp = capHandicap(goalHcp);

      // Merge saved club distances with defaults for any missing clubs
      const defaults = getDefaultDistances(currentHcp);
      const finalDistances = { ...defaults, ...Object.fromEntries(
        Object.entries(clubDistances).filter(([, v]) => v !== '' && v != null && v > 0)
      )};

      // Only the fields onboarding owns. Subscription/trial fields are written by the
      // Stripe and RevenueCat webhooks — never overwrite them here.
      // onboarding_complete is also deferred — set only after generateInitialPlan succeeds.
      const profileData = {
        first_name: user.full_name?.split(' ')[0] || 'Golfer',
        current_handicap: currentHcp,
        goal_handicap: goalHcp,
        target_timeline: form.target_timeline,
        days_per_week: form.days_per_week,
        preferred_days: form.preferred_days,
        skill_driving: form.skill_driving,
        skill_iron_play: form.skill_iron_play,
        skill_short_game: form.skill_short_game,
        skill_putting: form.skill_putting,
        skill_course_management: form.skill_course_management,
        ...finalDistances,
      };

      // Generate referral_code only if not already set, so re-runs preserve any
      // previously-shared link. Same for referred_by_code.
      if (!existingProfile.referral_code) {
        profileData.referral_code = generateReferralCode(user.full_name?.split(' ')[0] || 'USER');
      }
      if (!existingProfile.referred_by_code && refCode) {
        profileData.referred_by_code = refCode;
      }

      // First write — save form data without onboarding_complete
      await unwrap(supabase.from('user_profile').update(profileData).eq('id', existingProfile.id).select().single());

      // Initial handicap entry
      await unwrap(supabase.from('handicap_entry').insert({
        user_email: user.email,
        handicap: currentHcp,
        entry_date: today,
        note: 'Starting handicap'
      }).select().single());

      // EMERGENCY UNBLOCK: swallow generateInitialPlan errors so users aren't
      // blocked at onboarding when the function 404s. The function intermittently
      // fails to find just-created profiles due to a Base44 read-after-write
      // lag; until that's resolved properly, prefer "completed onboarding with
      // possibly-empty /plan" over "stuck at the Build My Plan button."
      try {
        await supabase.functions.invoke('generateInitialPlan', {
          body: {
            user_email: user.email,
            profile_id: existingProfile.id,
          },
        });
      } catch (planErr) {
        console.error('[Onboarding] generateInitialPlan failed, proceeding anyway:', planErr?.message);
      }

      // Finalize onboarding regardless of plan generation success.
      await unwrap(supabase.from('user_profile').update({ onboarding_complete: true }).eq('id', existingProfile.id).select().single());

      // Now safe to clear referral code from localStorage
      if (refCode) localStorage.removeItem('caddie_ref_code');

      try {
        const plans = await unwrap(
          supabase.from('practice_plan').select('*').eq('user_email', user.email).eq('is_active', true)
        );
        setReadyPlan(plans[0] || null);
      } catch {
        // Finish screen falls back to the goal summary without a plan card
      }

      setStep(5);
    } catch (err) {
      console.error('[Onboarding] handleFinish failed:', err);
      setError('Something went wrong building your plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  if (checkingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cut-ground flex flex-col max-w-lg mx-auto px-6 py-8">
      {/* Progress rail — thin segmented bars, filled steps glow green */}
      {step < 5 && (
        <div className="flex gap-1.5 mb-8">
          {[1,2,3,4].map(s => (
            <div
              key={s}
              className="flex-1 h-[3px] rounded-sm transition-all"
              style={{
                background: s <= step ? '#5FBE7E' : 'rgba(244,239,227,.08)',
                boxShadow: s <= step ? '0 0 8px rgba(95,190,126,.30)' : 'none',
              }}
            />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Your Game */}
        {step === 1 && (
          <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 gap-8">
            <div>
              <p className="cut-eyebrow text-cut-gold">Step 1 of 4</p>
              <h2 className="cut-headline text-cut-ink text-[30px] leading-[1.08] mt-2">
                Where's your <span className="italic text-cut-green">game</span> today?
              </h2>
              <p className="text-cut-ink-mute text-sm mt-2">This tunes your starting plan — you can refine it any time.</p>
            </div>
            {/* Level cards — presets that position the handicap slider */}
            <div className="space-y-2.5">
              {LEVELS.map((lv) => {
                const active = levelChoice === lv.l;
                return (
                  <button
                    key={lv.l}
                    onClick={() => { setLevelChoice(lv.l); update('current_handicap', String(lv.hcp)); }}
                    className="cut-glass w-full p-4 flex items-center justify-between text-left transition-all active:scale-[0.99]"
                    style={{
                      border: active ? '1.5px solid #5FBE7E' : '1px solid rgba(244,239,227,.10)',
                      boxShadow: active ? '0 0 20px rgba(95,190,126,.30)' : undefined,
                    }}
                  >
                    <div>
                      <p className="cut-headline text-cut-ink text-[17px]">{lv.l}</p>
                      <p className="text-xs text-cut-ink-mute mt-0.5">{lv.v}</p>
                    </div>
                    <div
                      className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 text-cut-bg"
                      style={active
                        ? { background: '#5FBE7E' }
                        : { border: '1.5px solid rgba(244,239,227,.15)' }}
                    >
                      {active && <Check className="w-3 h-3" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Handicap slider card */}
            <div>
              <p className="cut-eyebrow text-cut-ink-mute mb-2.5">Current handicap (optional)</p>
              <div className="cut-glass p-[18px]">
                <div className="flex items-baseline justify-center">
                  {typingHcp ? (
                    <input
                      type="number"
                      step="0.1"
                      autoFocus
                      value={form.current_handicap}
                      onChange={e => { update('current_handicap', e.target.value); setLevelChoice(null); }}
                      onBlur={() => setTypingHcp(false)}
                      onKeyDown={e => e.key === 'Enter' && setTypingHcp(false)}
                      className="w-28 bg-transparent font-mono text-[38px] font-bold text-cut-ink text-center outline-none"
                      style={{ letterSpacing: '-1.5px' }}
                    />
                  ) : (
                    <button onClick={() => setTypingHcp(true)} className="font-mono text-[38px] font-bold text-cut-ink" style={{ letterSpacing: '-1.5px' }}>
                      {form.current_handicap === '' ? '—' : formatHandicap(parseFloat(form.current_handicap))}
                    </button>
                  )}
                </div>
                <input
                  type="range"
                  min={-5}
                  max={36}
                  step={0.5}
                  value={form.current_handicap === '' ? 18 : parseFloat(form.current_handicap)}
                  onChange={e => { update('current_handicap', e.target.value); setLevelChoice(null); }}
                  className="w-full mt-3.5"
                  style={{ background: 'rgba(244,239,227,.10)', height: 4 }}
                />
                <div className="flex justify-between mt-2 font-mono text-[10px] text-cut-ink-mute">
                  <span>+5</span><span>0 (scratch)</span><span>36+</span>
                </div>
                <p className="mt-2.5 text-[11px] text-cut-ink-mute leading-snug text-center">
                  Shoot under par regularly? Drag past 0 — plus handicaps (e.g. <span className="text-cut-green font-bold">+2</span>) are supported. Tap the number to type it.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="card-base p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Goal Handicap</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={form.goal_handicap}
                    onChange={e => update('goal_handicap', e.target.value)}
                    className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-base outline-none focus:ring-2 focus:ring-sage border border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Target Timeline</label>
                  <Drawer>
                    <DrawerTrigger asChild>
                      <button className="w-full bg-muted rounded-xl border border-border text-base h-12 px-4 text-left text-foreground font-medium">
                        {form.target_timeline}
                      </button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <div className="space-y-2 px-6 py-4">
                        {['3 months', '6 months', '1 year'].map(val => (
                          <button
                            key={val}
                            onClick={() => update('target_timeline', val)}
                            className="w-full text-left py-3 px-4 rounded-xl hover:bg-muted transition-all min-h-[44px] font-medium"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-auto">
              <button onClick={() => navigate('/signin')} className="flex items-center gap-1 px-4 py-3 rounded-xl text-muted-foreground font-medium">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(2)} className="flex-1 btn-primary py-4">
                Continue <ChevronRight className="inline w-4 h-4 ml-1" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Your Schedule */}
        {step === 2 && (
          <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 gap-8">
            <div>
              <p className="cut-eyebrow text-cut-gold">Step 2 of 4</p>
              <h2 className="cut-headline text-cut-ink text-[30px] leading-[1.08] mt-2">
                When can you <span className="italic text-cut-green">practice</span>?
              </h2>
              <p className="text-cut-ink-mute text-sm mt-2">Pick the days that actually fit your week</p>
            </div>
            <div className="space-y-5">
              <div className="card-base p-5 space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Days per week: <span className="font-mono text-cut-green">{form.days_per_week}</span></label>
                  <div className="flex gap-2 justify-between">
                    {[1,2,3,4,5,6].map(n => (
                      <button
                        key={n}
                        onClick={() => update('days_per_week', n)}
                        className={`flex-1 py-3 rounded-xl font-mono text-sm font-bold transition-all ${
                          form.days_per_week === n
                            ? 'bg-cut-green text-cut-bg'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        style={form.days_per_week === n ? { boxShadow: '0 0 16px rgba(95,190,126,.30)' } : undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Preferred days</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((day, i) => {
                      const fullDay = FULL_DAYS[i];
                      const selected = form.preferred_days.includes(fullDay);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                            selected
                              ? 'bg-cut-green text-cut-bg'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          style={selected ? { boxShadow: '0 0 16px rgba(95,190,126,.30)' } : undefined}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-auto">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-3 rounded-xl text-muted-foreground font-medium">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 btn-primary py-4">
                Continue <ChevronRight className="inline w-4 h-4 ml-1" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Club Distances */}
        {step === 3 && (
          <motion.div key="s4" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 gap-6 overflow-y-auto">
            <ClubDistancesStep
              handicap={form.current_handicap !== '' ? parseFloat(form.current_handicap) : 18}
              onNext={handleClubDistancesNext}
              onBack={() => setStep(2)}
            />
          </motion.div>
        )}

        {/* Step 4: Rate Your Game */}
        {step === 4 && (
          <motion.div key="s5" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 gap-8">
            <div>
              <p className="cut-eyebrow text-cut-gold">Step 4 of 4</p>
              <h2 className="cut-headline text-cut-ink text-[30px] leading-[1.08] mt-2">
                Rate your <span className="italic text-cut-green">game</span>.
              </h2>
              <p className="text-cut-ink-mute text-sm mt-2">Be honest — this shapes your practice plan</p>
            </div>
            <div className="card-base p-5 space-y-6">
              {SKILLS.map(({ key, label }) => (
                <SkillSlider
                  key={key}
                  label={label}
                  value={form[key]}
                  onChange={val => update(key, val)}
                />
              ))}
            </div>
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(229,105,94,.12)', border: '1px solid rgba(229,105,94,.35)', color: '#E5695E' }}>
                {error}
              </div>
            )}
            <div className="flex gap-3 mt-auto">
              <button onClick={() => setStep(3)} className="flex items-center gap-1 px-4 py-3 rounded-xl text-muted-foreground font-medium">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleFinish} disabled={loading} className="flex-1 btn-primary py-4">
                {loading ? 'Building your plan...' : 'Build My Plan ✦'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 5: Plan Ready */}
        {step === 5 && (
          <motion.div key="s6" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center flex-1 text-center gap-8 min-h-[80vh]">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0E4D2B, #5FBE7E)', boxShadow: '0 0 30px rgba(95,190,126,.30)' }}
            >
              <Check className="w-7 h-7 text-cut-cream" strokeWidth={2.5} />
            </div>
            <div className="space-y-3">
              <h2 className="cut-headline text-cut-ink text-[30px] leading-[1.08]">
                Your plan is <span className="italic text-cut-green">ready</span>.
              </h2>
              {readyPlan?.plan_data?.sessions?.length ? (
                <p className="text-cut-ink-mute text-sm leading-relaxed max-w-[280px] mx-auto">
                  Built from your level, your goals, and 3 minutes of questions. Adjusts every week.
                </p>
              ) : (
                <p className="text-cut-ink-mute text-base">
                  Goal: reach <span className="font-mono font-bold text-cut-ink">
                    {formatHandicap(isPlus && form.goal_handicap ? -parseFloat(form.goal_handicap) : form.goal_handicap || 10)}
                  </span> handicap<br/>
                  in <span className="font-bold text-cut-ink">{form.target_timeline}</span> with <span className="font-bold text-cut-ink">{form.days_per_week} sessions/week</span>
                </p>
              )}
            </div>

            {/* Week 1 focus card — real data from the plan just generated */}
            {(() => {
              const pd = readyPlan?.plan_data;
              if (!pd?.sessions?.length) return null;
              const working = pd.sessions.filter(s => s.session_type !== 'Rest & Recovery');
              const minutes = working.reduce((a, s) => a + (s.duration || 45), 0);
              const focus = pd.focus || pd.weekly_focus;
              return (
                <>
                <div className="cut-glass p-5 w-full text-left overflow-hidden">
                  <div
                    className="absolute pointer-events-none"
                    style={{ top: -60, right: -60, width: 200, height: 200, borderRadius: 100, background: 'rgba(95,190,126,.30)', filter: 'blur(50px)' }}
                  />
                  <div className="relative">
                    <p className="cut-eyebrow text-cut-gold">Week 1 focus</p>
                    {focus && (
                      <p className="cut-headline text-cut-ink text-[22px] mt-2" style={{ letterSpacing: '-0.4px' }}>{focus}</p>
                    )}
                    <div className="flex gap-[18px] mt-4">
                      <div>
                        <p className="font-mono text-xl font-bold text-cut-ink" style={{ letterSpacing: '-0.6px' }}>{working.length}</p>
                        <p className="text-[10px] font-semibold uppercase text-cut-ink-mute mt-0.5" style={{ letterSpacing: '0.3px' }}>Sessions</p>
                      </div>
                      <div className="w-px" style={{ background: 'rgba(244,239,227,.08)' }} />
                      <div>
                        <p className="font-mono text-xl font-bold text-cut-ink" style={{ letterSpacing: '-0.6px' }}>{minutes}</p>
                        <p className="text-[10px] font-semibold uppercase text-cut-ink-mute mt-0.5" style={{ letterSpacing: '0.3px' }}>Minutes</p>
                      </div>
                      <div className="w-px" style={{ background: 'rgba(244,239,227,.08)' }} />
                      <div>
                        <p className="font-mono text-xl font-bold text-cut-gold" style={{ letterSpacing: '-0.6px' }}>
                          {formatHandicap(isPlus && form.goal_handicap ? -parseFloat(form.goal_handicap) : form.goal_handicap || 10)}
                        </p>
                        <p className="text-[10px] font-semibold uppercase text-cut-ink-mute mt-0.5" style={{ letterSpacing: '0.3px' }}>Goal index</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* first sessions preview — plain rows below the card, per the mock */}
                <div className="w-full space-y-1 px-1">
                  {working.slice(0, 3).map((s, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2.5 text-left">
                      <span
                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center font-mono text-[11px] font-bold text-cut-green flex-shrink-0"
                        style={{ background: 'rgba(95,190,126,.14)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[13.5px] font-medium text-cut-ink truncate">
                        {s.title || s.session_type} · {s.duration || 45}m
                      </span>
                    </div>
                  ))}
                </div>
                </>
              );
            })()}

            <button onClick={() => navigate('/plan')} className="w-full btn-primary py-4 text-base">
              Enter Caddie →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}