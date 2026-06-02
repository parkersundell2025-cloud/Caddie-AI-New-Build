import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { CLUBS, getDefaultForClub } from '@/lib/clubDistances';

export default function ClubDistances() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
      const p = profiles[0] || null;
      setProfile(p);
      if (p) {
        const current = {};
        CLUBS.forEach(({ key }) => {
          if (p[key] != null && p[key] > 0) current[key] = p[key];
        });
        setDistances(current);
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = (key, val) => {
    const num = val === '' ? '' : parseInt(val, 10);
    setDistances(prev => ({ ...prev, [key]: num }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const updates = {};
    CLUBS.forEach(({ key }) => {
      if (distances[key] !== '' && distances[key] != null) {
        updates[key] = distances[key];
      }
    });
    await unwrap(supabase.from('user_profile').update(updates).eq('id', profile.id).select().single());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">My Club Distances</h1>
        </div>
      </div>

      {/* Club List */}
      <div className="flex-1 px-5 pb-6">
        <div className="card-base overflow-hidden">
          {CLUBS.map(({ key, label }, i) => {
            const placeholder = String(getDefaultForClub(key, profile?.current_handicap));
            return (
              <div
                key={key}
                className={`flex items-center justify-between px-4 py-3 ${i < CLUBS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={distances[key] ?? ''}
                    onChange={e => update(key, e.target.value)}
                    className="w-20 bg-muted rounded-xl px-3 py-2 text-foreground text-sm text-right outline-none focus:ring-2 focus:ring-sage border border-border"
                  />
                  <span className="text-xs text-muted-foreground w-6">yds</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="px-5 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full btn-primary py-4 flex items-center justify-center gap-2"
        >
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Save Distances'}
        </button>
      </div>
    </div>
  );
}