import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { formatHandicap, capHandicap } from '@/lib/handicapUtils';
import { isNative } from '@/lib/platform';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SKILLS = [
  { key: 'skill_driving', label: 'Driving' },
  { key: 'skill_iron_play', label: 'Iron Play' },
  { key: 'skill_short_game', label: 'Short Game' },
  { key: 'skill_putting', label: 'Putting' },
  { key: 'skill_course_management', label: 'Course Mgmt' },
];

const inputCls = "w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border";
const labelCls = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export default function EditProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [user, setUser] = useState(null);
  const [isPlusHcp, setIsPlusHcp] = useState(false);
  const [isPlusGoal, setIsPlusGoal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const u = await getCurrentUser();
      setUser(u);
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', u.email));
      if (profiles[0]) {
        setProfile(profiles[0]);
        setForm({ ...profiles[0] });
        setIsPlusHcp(profiles[0].current_handicap < 0);
        setIsPlusGoal(profiles[0].goal_handicap < 0);
      }
      setLoading(false);
    };
    load();
  }, []);

  const uploadPhotoBlob = async (blob, ext) => {
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      setForm(prev => ({ ...prev, profile_picture: publicUrl }));
      await unwrap(supabase.from('user_profile').update({ profile_picture: publicUrl }).eq('id', profile.id));
    } catch (e) {
      console.error('Photo upload failed:', e);
    }
    setUploadingPhoto(false);
  };

  // Native (iOS/Android): show the OS action sheet via @capacitor/camera —
  // "Take Photo" / "Choose from Library" / "Cancel". Web: fall through to the
  // hidden <input type="file"> ref.
  const onCameraButtonClick = async () => {
    if (!isNative()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 85,
        allowEditing: false,
      });
      if (!photo?.webPath) return;
      const blob = await fetch(photo.webPath).then(r => r.blob());
      await uploadPhotoBlob(blob, photo.format || 'jpeg');
    } catch (err) {
      // User cancelled, denied permission, or plugin error — silent.
      // Permission denial returns a thrown error per the Camera plugin docs.
      if (err?.message && !/cancel/i.test(err.message)) {
        console.warn('Camera plugin error:', err.message);
      }
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    await uploadPhotoBlob(file, ext);
  };

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      preferred_days: (prev.preferred_days || []).includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...(prev.preferred_days || []), day]
    }));
  };

  const handleSave = async () => {
    if (!profile || !form) return;
    setSaving(true);

    // Apply plus handicap conversion
    let currentHcp = form.current_handicap;
    let goalHcp = form.goal_handicap;
    
    if (typeof currentHcp === 'string') {
      currentHcp = parseFloat(currentHcp) || 0;
    }
    if (isPlusHcp && currentHcp > 0) {
      currentHcp = -currentHcp;
    }
    currentHcp = capHandicap(currentHcp);
    
    if (typeof goalHcp === 'string') {
      goalHcp = parseFloat(goalHcp) || 0;
    }
    if (isPlusGoal && goalHcp > 0) {
      goalHcp = -goalHcp;
    }
    goalHcp = capHandicap(goalHcp);

    const updatedForm = { ...form, current_handicap: currentHcp, goal_handicap: goalHcp };
    await unwrap(supabase.from('user_profile').update(updatedForm).eq('id', profile.id));

    // Track handicap entry if it changed
    if (currentHcp !== profile.current_handicap && currentHcp != null) {
      const u = await getCurrentUser();
      await unwrap(supabase.from('handicap_entry').insert({
        user_email: u.email,
        handicap: currentHcp,
        entry_date: new Date().toISOString().split('T')[0],
        note: 'Manual update',
      }).select().single());
    }

    setSaving(false);
    navigate('/profile');
  };

  if (loading || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Edit Profile</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6 pb-32">
        {/* Profile Picture */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-foreground flex items-center justify-center overflow-hidden">
              {form.profile_picture ? (
                <img src={form.profile_picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-background text-3xl font-black">
                  {(form.first_name || user?.full_name || 'G')[0].toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={onCameraButtonClick}
              disabled={uploadingPhoto}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-foreground rounded-full flex items-center justify-center border-2 border-background active:scale-95 transition-all"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-3.5 h-3.5 text-background animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-background" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Tap the camera to change photo</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className={labelCls}>First Name</label>
          <input className={inputCls} value={form.first_name || ''} onChange={e => update('first_name', e.target.value)} />
        </div>

        {/* Handicaps */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Current HCP</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border"
                value={Math.abs(form.current_handicap ?? 0)}
                onChange={e => update('current_handicap', parseFloat(e.target.value) || 0)}
              />
              <button
                onClick={() => setIsPlusHcp(!isPlusHcp)}
                className={`px-4 py-3 rounded-xl font-bold transition-all ${
                  isPlusHcp
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isPlusHcp ? '+' : '−'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{formatHandicap(isPlusHcp && form.current_handicap ? -form.current_handicap : form.current_handicap)}</p>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Goal HCP</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border"
                value={Math.abs(form.goal_handicap ?? 0)}
                onChange={e => update('goal_handicap', parseFloat(e.target.value) || 0)}
              />
              <button
                onClick={() => setIsPlusGoal(!isPlusGoal)}
                className={`px-4 py-3 rounded-xl font-bold transition-all ${
                  isPlusGoal
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isPlusGoal ? '+' : '−'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{formatHandicap(isPlusGoal && form.goal_handicap ? -form.goal_handicap : form.goal_handicap)}</p>
          </div>
        </div>

        {/* Timeline */}
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
                  <button key={val} onClick={() => update('target_timeline', val)}
                    className="w-full text-left py-3 px-4 rounded-xl hover:bg-muted transition-all min-h-[44px] font-medium">
                    {val}
                  </button>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Days per week */}
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

        {/* Practice Days */}
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

        {/* Skill Ratings */}
        <div className="space-y-3">
          <label className={labelCls}>Skill Ratings</label>
          {SKILLS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => update(key, n)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${form[key] === n ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-background border-t border-border">
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-4">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}