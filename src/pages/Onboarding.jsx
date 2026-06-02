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
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground bg-sage/20 px-2 py-0.5 rounded-full">
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
            background: `linear-gradient(to right, #a8d5a2 0%, #a8d5a2 ${(value - 1) * 25}%, #e8e8e6 ${(value - 1) * 25}%, #e8e8e6 100%)`
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
  const [isPlus, setIsPlus] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState(null);

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
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto px-6 py-8">
      {/* Progress dots — steps 1–4 map to old steps 2–5 */}
      {step < 5 && (
        <div className="flex gap-1.5 justify-center mb-8">
          {[1,2,3,4].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-foreground' : s < step ? 'w-4 bg-foreground/40' : 'w-4 bg-border'}`} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Your Game */}
        {step === 1 && (
          <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
            className="flex flex-col flex-1 gap-8">
            <div>
              <h2 className="text-3xl font-black text-foreground">Your Game</h2>
              <p className="text-muted-foreground mt-1">Tell us about your current level and goals</p>
            </div>
            <div className="space-y-5">
              <div className="card-base p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Current Handicap</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={isPlus ? "e.g. 2" : "e.g. 18"}
                      value={form.current_handicap}
                      onChange={e => update('current_handicap', e.target.value)}
                      className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground text-base outline-none focus:ring-2 focus:ring-sage border border-border"
                    />
                    <button
                      onClick={() => setIsPlus(!isPlus)}
                      className={`px-4 py-3 rounded-xl font-bold text-base transition-all ${
                        isPlus
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {isPlus ? '+' : '−'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPlus ? 'Plus handicap (better than scratch)' : 'Regular handicap'}
                  </p>
                </div>
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
              <h2 className="text-3xl font-black text-foreground">Your Schedule</h2>
              <p className="text-muted-foreground mt-1">When can you practice each week?</p>
            </div>
            <div className="space-y-5">
              <div className="card-base p-5 space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Days per week: <span className="text-sage-dark">{form.days_per_week}</span></label>
                  <div className="flex gap-2 justify-between">
                    {[1,2,3,4,5,6].map(n => (
                      <button
                        key={n}
                        onClick={() => update('days_per_week', n)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                          form.days_per_week === n
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground'
                        }`}
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
                              ? 'bg-foreground text-background'
                              : 'bg-muted text-muted-foreground'
                          }`}
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
              <h2 className="text-3xl font-black text-foreground">Rate Your Game</h2>
              <p className="text-muted-foreground mt-1">Be honest — this shapes your practice plan</p>
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
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
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
            <div className="w-20 h-20 bg-sage/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-foreground" strokeWidth={2.5} />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-foreground">Your Caddie AI<br/>plan is ready ✦</h2>
              <p className="text-muted-foreground text-base">
                Goal: reach <span className="font-bold text-foreground">
                  {formatHandicap(isPlus && form.goal_handicap ? -parseFloat(form.goal_handicap) : form.goal_handicap || 10)}
                </span> handicap<br/>
                in <span className="font-bold text-foreground">{form.target_timeline}</span> with <span className="font-bold text-foreground">{form.days_per_week} sessions/week</span>
              </p>
            </div>
            <button onClick={() => navigate('/plan')} className="w-full btn-primary py-4 text-base">
              View My Plan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}