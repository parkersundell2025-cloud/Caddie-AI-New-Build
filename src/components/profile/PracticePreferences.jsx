import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Clock } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SESSION_TYPES = [
  { key: 'range_day', label: 'Range Day', color: '#1a4d2e', dotColor: '#4ade80' },
  { key: 'putting_short_game', label: 'Putting & Short Game', color: '#1e3a5f', dotColor: '#60a5fa' },
  { key: 'golf_fitness', label: 'Golf Fitness', color: '#7c4f1e', dotColor: '#fbbf24' },
  { key: 'rest_recovery', label: 'Rest & Recovery', color: '#4a4a4a', dotColor: '#d1d5db' },
];

const INTENSITY_OPTIONS = [
  { value: 'short', label: 'Short', time: '30 min' },
  { value: 'medium', label: 'Medium', time: '45 min' },
  { value: 'long', label: 'Long', time: '60+ min' },
];

function SessionTypeToggle({ type, enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
        enabled
          ? 'border-foreground bg-foreground/5'
          : 'border-border bg-muted'
      }`}
    >
      <span className="font-semibold text-foreground text-sm">{type.label}</span>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
        enabled ? 'bg-foreground' : 'bg-muted-foreground'
      }`}>
        {enabled && <Check className="w-4 h-4 text-background" />}
      </div>
    </button>
  );
}

function DayDistributionVisual({ daysPerWeek, distribution, enabledTypes }) {
  const weekDays = DAYS_SHORT.slice(0, 7);
  const sessionOrder = [];

  // Build a simple distribution: assign sessions based on counts
  if (daysPerWeek > 0) {
    for (let i = 0; i < daysPerWeek; i++) {
      // Cycle through enabled session types
      let assigned = false;
      for (const type of SESSION_TYPES) {
        if (enabledTypes[type.key] && distribution[type.key] > 0) {
          sessionOrder.push(type);
          distribution[type.key]--;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        sessionOrder.push(null);
      }
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your week at a glance</p>
      <div className="flex gap-1.5 flex-wrap">
        {DAYS_SHORT.map((day, i) => {
          const session = i < sessionOrder.length ? sessionOrder[i] : null;
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-muted-foreground font-bold">{day}</p>
              {session ? (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: session.color }}
                  title={session.label}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: session.dotColor }}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-muted" title="Rest" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PracticePreferences({ profile, onSave, saving }) {
  const [form, setForm] = useState({
    days_per_week: profile?.days_per_week || 3,
    preferred_days: profile?.preferred_days || [],
    session_type_preferences: profile?.session_type_preferences || {
      range_day: true,
      putting_short_game: true,
      golf_fitness: true,
      rest_recovery: true,
    },
    session_distribution: profile?.session_distribution || {
      range_day: 0,
      putting_short_game: 0,
      golf_fitness: 0,
    },
    intensity_preference: profile?.intensity_preference || 'medium',
  });

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day]
    }));
  };

  const toggleSessionType = (typeKey) => {
    setForm(prev => ({
      ...prev,
      session_type_preferences: {
        ...prev.session_type_preferences,
        [typeKey]: !prev.session_type_preferences[typeKey]
      }
    }));
  };

  const updateDistribution = (typeKey, value) => {
    setForm(prev => ({
      ...prev,
      session_distribution: {
        ...prev.session_distribution,
        [typeKey]: Math.max(0, Math.min(value, form.days_per_week))
      }
    }));
  };

  const enabledSessionTypes = Object.entries(form.session_type_preferences)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => key);

  const totalDistributed = Object.values(form.session_distribution).reduce((a, b) => a + b, 0);
  const canAutoDistribute = totalDistributed === 0 && form.days_per_week > 0;

  const autoDistribute = () => {
    const enabled = enabledSessionTypes.filter(k => k !== 'rest_recovery');
    if (enabled.length === 0) return;

    const baseDays = Math.floor(form.days_per_week / enabled.length);
    const remainder = form.days_per_week % enabled.length;
    const newDist = {};

    enabled.forEach((type, i) => {
      newDist[type] = baseDays + (i < remainder ? 1 : 0);
    });

    setForm(prev => ({
      ...prev,
      session_distribution: newDist
    }));
  };

  const handleSave = () => {
    onSave({
      days_per_week: form.days_per_week,
      preferred_days: form.preferred_days,
      session_type_preferences: form.session_type_preferences,
      session_distribution: form.session_distribution,
      intensity_preference: form.intensity_preference,
    });
  };

  return (
    <div className="space-y-6">
      {/* Schedule Settings */}
      <div className="space-y-3">
        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Schedule Settings</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-foreground">Days per week: <span className="text-sage-dark">{form.days_per_week}</span></label>
          </div>
          <div className="flex gap-2 justify-between">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setForm(prev => ({ ...prev, days_per_week: n }))}
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

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Preferred practice days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day) => {
              const selected = form.preferred_days.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    selected
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Session Type Preferences */}
      <div className="space-y-3">
        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Session Types</h3>
        <div className="space-y-2">
          {SESSION_TYPES.map(type => (
            <SessionTypeToggle
              key={type.key}
              type={type}
              enabled={form.session_type_preferences[type.key]}
              onChange={(enabled) => toggleSessionType(type.key)}
            />
          ))}
        </div>
      </div>

      {/* Session Distribution */}
      {form.days_per_week >= 3 && (
        <div className="card-base p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm">Distribution</h3>
              {canAutoDistribute && (
                <button
                  onClick={autoDistribute}
                  className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-foreground active:scale-95 transition-all"
                >
                  Auto-fill
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Choose how to split your {form.days_per_week} practice days</p>
          </div>

          <div className="space-y-2">
            {SESSION_TYPES.slice(0, 3).map(type => (
              form.session_type_preferences[type.key] && (
                <div key={type.key} className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{type.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max={form.days_per_week}
                      value={form.session_distribution[type.key] || 0}
                      onChange={(e) => updateDistribution(type.key, Number(e.target.value))}
                      className="flex-1"
                      style={{
                        background: `linear-gradient(to right, ${type.color} 0%, ${type.color} ${((form.session_distribution[type.key] || 0) / form.days_per_week) * 100}%, rgba(244,239,227,.10) ${((form.session_distribution[type.key] || 0) / form.days_per_week) * 100}%, rgba(244,239,227,.10) 100%)`
                      }}
                    />
                    <span className="text-sm font-bold text-foreground w-4 text-right">{form.session_distribution[type.key] || 0}</span>
                  </div>
                </div>
              )
            ))}
          </div>

          <DayDistributionVisual
            daysPerWeek={form.days_per_week}
            distribution={{ ...form.session_distribution }}
            enabledTypes={form.session_type_preferences}
          />
        </div>
      )}

      {/* Intensity Preference */}
      <div className="space-y-3">
        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Session Length</h3>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setForm(prev => ({ ...prev, intensity_preference: opt.value }))}
              className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border-2 transition-all ${
                form.intensity_preference === opt.value
                  ? 'border-foreground bg-foreground/5'
                  : 'border-border bg-muted'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold text-foreground">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full btn-primary py-4 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving preferences...
          </>
        ) : (
          '✓ Save & Regenerate Plan'
        )}
      </button>
    </div>
  );
}