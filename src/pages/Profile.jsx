import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser, invokeLLM } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, LogOut, Settings, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PLANS, hasProAccess } from '@/lib/subscription';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import PracticePreferences from '@/components/profile/PracticePreferences';
import { toast } from 'sonner';
import { buildPlanPrompt, PLAN_JSON_SCHEMA } from '@/lib/planGenerator';


const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SKILLS = [
  { key: 'skill_driving', label: 'Driving' },
  { key: 'skill_iron_play', label: 'Iron Play' },
  { key: 'skill_short_game', label: 'Short Game' },
  { key: 'skill_putting', label: 'Putting' },
  { key: 'skill_course_management', label: 'Course Mgmt' },
];

const skillLabel = (v) => ['', 'Poor', 'Fair', 'Average', 'Good', 'Excellent'][v] || v;

function EditSheet({ profile, onClose, onSave }) {
  const [form, setForm] = useState({ ...profile });
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      preferred_days: (prev.preferred_days || []).includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...(prev.preferred_days || []), day]
    }));
  };

  const inputCls = "w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border";
  const labelCls = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto p-6 space-y-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-foreground">Edit Profile</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>First Name</label>
            <input className={inputCls} value={form.first_name || ''} onChange={e => update('first_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Current HCP</label>
              <input type="number" className={inputCls} value={form.current_handicap || ''} onChange={e => update('current_handicap', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Goal HCP</label>
              <input type="number" className={inputCls} value={form.goal_handicap || ''} onChange={e => update('goal_handicap', parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Target Timeline</label>
            <Drawer>
              <DrawerTrigger asChild>
                <button className="w-full bg-muted rounded-xl border border-border h-12 text-sm px-4 text-left text-foreground font-medium">
                  {form.target_timeline || '6 months'}
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

          <div className="space-y-1.5">
            <label className={labelCls}>Days Per Week</label>
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(n => (
                <button key={n} onClick={() => update('days_per_week', n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.days_per_week === n ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Practice Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(day => {
                const sel = (form.preferred_days || []).includes(day);
                return (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${sel ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className={labelCls}>Skill Ratings</label>
            {SKILLS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{label}</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => update(key, n)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${form[key] === n ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => onSave(form)} className="w-full btn-primary py-4">
          Save & Regenerate Plan
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getCurrentUser();
    setUser(u);
    const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email));
    setProfile(profiles[0] || null);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const handleDeleteAccount = async () => {
    if (profile) {
      await unwrap(supabase.from('user_profile').delete().eq('id', profile.id));
    }
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const handleSavePreferences = async (preferences) => {
    setSavingPreferences(true);
    const updatedProfile = { ...profile, ...preferences };
    await unwrap(supabase.from('user_profile').update(updatedProfile).eq('id', profile.id));
    setProfile(updatedProfile);

    const u = await getCurrentUser();
    // Fetch drill ratings to pass history into plan generator
    const [oldPlans, drillRatings] = await Promise.all([
      unwrap(supabase.from('practice_plan').select('*').eq('user_email', u.email).eq('is_active', true)),
      unwrap(supabase.from('drill_rating').select('*').eq('user_email', u.email).order('session_date', { ascending: false }).limit(100)),
    ]);

    for (const p of oldPlans) {
      await unwrap(supabase.from('practice_plan').update({ is_active: false }).eq('id', p.id));
    }

    const prompt = buildPlanPrompt({ profile: updatedProfile, drillRatings });
    const result = await invokeLLM({
      prompt,
      response_json_schema: PLAN_JSON_SCHEMA,
    });

    await unwrap(supabase.from('practice_plan').insert({
      user_email: u.email,
      week_start_date: getWeekStart(),
      generated_at: new Date().toISOString(),
      plan_data: result,
      is_active: true,
    }).select().single());

    setSavingPreferences(false);
    toast.success('Your plan has been updated based on your new preferences.');
  };

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = profile?.subscription_plan || 'basic';
  const subStatus = profile?.subscription_status || 'trial';
  const isPaid = subStatus === 'basic' || subStatus === 'pro';
  const planInfo = PLANS[currentPlan];

  return (
    <>
      <div className="px-5 pt-5 pb-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>Profile</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/edit-profile')}
              className="flex items-center gap-1.5 bg-muted px-3 py-2 rounded-xl text-sm font-semibold text-foreground active:scale-95 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <Link
              to="/settings"
              className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-all"
            >
              <Settings className="w-4 h-4 text-foreground" />
            </Link>
          </div>
        </div>

        {/* User Card */}
        <div className="card-base p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center flex-shrink-0 overflow-hidden">
              {profile?.profile_picture ? (
                <img src={profile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-background text-2xl font-black">
                  {(profile?.first_name || user?.full_name || 'G')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-black text-foreground text-lg">{profile?.first_name || user?.full_name || 'Golfer'}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Handicap & Goals */}
        <div className="card-base p-5 space-y-4">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Your Game</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-foreground">{profile?.current_handicap ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Current HCP</p>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{profile?.goal_handicap ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Goal HCP</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{profile?.target_timeline || '—'}</p>
              <p className="text-xs text-muted-foreground">Timeline</p>
            </div>
          </div>
        </div>

        {/* Skill Ratings */}
        {profile && (
          <div className="card-base p-5 space-y-3">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Skill Ratings</h3>
            {SKILLS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className={`w-2 h-2 rounded-full ${n <= (profile[key] || 0) ? 'bg-foreground' : 'bg-muted'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground w-14 text-right">{skillLabel(profile[key])}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Practice Preferences */}
        <PracticePreferences
          profile={profile}
          onSave={handleSavePreferences}
          saving={savingPreferences}
        />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-muted text-muted-foreground font-semibold text-sm active:scale-95 transition-all min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

    </>
  );
}