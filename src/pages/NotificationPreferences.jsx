import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [practiceReminders, setPracticeReminders] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
      if (profiles[0]) {
        setProfile(profiles[0]);
        const prefs = profiles[0].notification_preferences || {};
        setPracticeReminders(prefs.practice_reminders !== false);
        setWeeklyInsights(prefs.weekly_insights !== false);
      }
    };
    load();
  }, []);

  const handleToggle = async (key, value) => {
    if (key === 'practice_reminders') setPracticeReminders(value);
    if (key === 'weekly_insights') setWeeklyInsights(value);

    if (!profile) return;
    setSaving(true);
    const updatedPrefs = {
      practice_reminders: key === 'practice_reminders' ? value : practiceReminders,
      weekly_insights: key === 'weekly_insights' ? value : weeklyInsights,
    };
    await unwrap(supabase.from('user_profile').update({
      notification_preferences: updatedPrefs,
    }).eq('id', profile.id).select().single());
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Notifications</h1>
        </div>
      </div>

      {/* Toggles */}
      <div className="px-5 py-4 space-y-0">
        <ToggleRow
          label="Practice Reminders"
          description="Get reminded on your scheduled practice days at 8am"
          value={practiceReminders}
          onChange={(v) => handleToggle('practice_reminders', v)}
        />
        <ToggleRow
          label="Weekly Insights"
          description="Receive your weekly AI coaching summary every Sunday."
          value={weeklyInsights}
          onChange={(v) => handleToggle('weekly_insights', v)}
        />
      </div>

      {saving && (
        <p className="text-center text-xs text-muted-foreground mt-4">Saving...</p>
      )}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-border gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}