import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { isNative } from '@/lib/platform';
import {
  checkPushPermission,
  enablePushAndGetToken,
} from '@/lib/push-notifications';

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [practiceReminders, setPracticeReminders] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(true);
  // pushState: 'unsupported' | 'loading' | 'enabled' | 'disabled' | 'denied'
  //   unsupported → web build, hide the row entirely
  //   loading     → mid-permission-request, show spinner
  //   denied      → iOS user revoked permission, show Settings hint
  //   enabled     → permission granted + push_enabled=true in profile
  //   disabled    → permission granted but user toggled push off in-app
  const [pushState, setPushState] = useState('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const u = await getCurrentUser();
      setUser(u);
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email));
      if (profiles[0]) {
        setProfile(profiles[0]);
        const prefs = profiles[0].notification_preferences || {};
        setPracticeReminders(prefs.practice_reminders !== false);
        setWeeklyInsights(prefs.weekly_insights !== false);

        if (!isNative()) {
          setPushState('unsupported');
          return;
        }
        // Reconcile iOS permission state with the user's stored preference.
        const perm = await checkPushPermission();
        if (perm === 'denied') {
          setPushState('denied');
        } else if (perm === 'granted' && prefs.push_enabled) {
          setPushState('enabled');
        } else {
          setPushState('disabled');
        }
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
      ...(profile.notification_preferences || {}),
      practice_reminders: key === 'practice_reminders' ? value : practiceReminders,
      weekly_insights: key === 'weekly_insights' ? value : weeklyInsights,
    };
    await unwrap(supabase.from('user_profile').update({
      notification_preferences: updatedPrefs,
    }).eq('id', profile.id).select().single());
    setProfile((p) => ({ ...p, notification_preferences: updatedPrefs }));
    setSaving(false);
  };

  const handlePushToggle = async () => {
    if (!profile || !user) return;

    // Enable: request iOS permission, register, persist token + flip flag.
    if (pushState !== 'enabled') {
      setPushState('loading');
      try {
        const { token, platform } = await enablePushAndGetToken();
        // device_token row — upsert on token (each physical device is uniquely
        // identified by its APNs token; the OS rotates these so we let the
        // unique constraint handle dedupe across registrations).
        await supabase
          .from('device_token')
          .upsert(
            { user_email: user.email.toLowerCase().trim(), platform, token },
            { onConflict: 'token' },
          );
        const updatedPrefs = {
          ...(profile.notification_preferences || {}),
          push_enabled: true,
        };
        await unwrap(supabase.from('user_profile')
          .update({ notification_preferences: updatedPrefs })
          .eq('id', profile.id)
          .select()
          .single());
        setProfile((p) => ({ ...p, notification_preferences: updatedPrefs }));
        setPushState('enabled');
      } catch (e) {
        if (e?.code === 'permission_denied') {
          setPushState('denied');
        } else {
          console.warn('[NotificationPreferences] enable push failed:', e?.message);
          setPushState('disabled');
        }
      }
      return;
    }

    // Disable: only flip the preference flag. Token stays in device_token so
    // re-enabling doesn't require another iOS permission prompt.
    setPushState('loading');
    const updatedPrefs = {
      ...(profile.notification_preferences || {}),
      push_enabled: false,
    };
    await unwrap(supabase.from('user_profile')
      .update({ notification_preferences: updatedPrefs })
      .eq('id', profile.id)
      .select()
      .single());
    setProfile((p) => ({ ...p, notification_preferences: updatedPrefs }));
    setPushState('disabled');
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}>
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
        {/* Push notifications — only on native; hidden on the web build. */}
        {pushState !== 'unsupported' && (
          <ToggleRow
            label="Push Notifications"
            description={
              pushState === 'denied'
                ? "You've blocked notifications. Open iOS Settings → Caddie AI → Notifications to allow."
                : pushState === 'loading'
                  ? "…"
                  : "Allow Caddie AI to send you reminders and coaching insights on your phone."
            }
            value={pushState === 'enabled'}
            disabled={pushState === 'loading' || pushState === 'denied'}
            onChange={handlePushToggle}
          />
        )}
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

function ToggleRow({ label, description, value, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-border gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-foreground' : 'bg-muted-foreground/30'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}