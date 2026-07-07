import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/db';

export default function AdminFixUser() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    email: '',
    stripeSubscriptionId: '',
    plan: 'basic',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Check if user is admin
  useEffect(() => {
    const check = async () => {
      try {
        const u = await getCurrentUser();
        // Non-admins are bounced to /; RootRoute then sends them to the correct landing.
        // (Was /settings — but a non-paying non-admin can't reach /settings either, so
        // they'd just get redirected again. Going to / via RootRoute is the right hop.)
        if (u?.role !== 'admin') {
          navigate('/', { replace: true });
          return;
        }
        setUser(u);
      } catch (e) {
        navigate('/signin', { replace: true });
      }
      setLoading(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // Validation
    if (!form.email || !form.stripeSubscriptionId || !form.plan) {
      setError('All fields are required');
      return;
    }

    if (!form.email.includes('@')) {
      setError('Invalid email address');
      return;
    }

    if (!form.stripeSubscriptionId.startsWith('sub_')) {
      setError('Subscription ID must start with sub_');
      return;
    }

    setSubmitting(true);

    try {
      // Normalize email here too (defense in depth — the edge fn also lowercases).
      // RLS on user_profile is case-sensitive: user_email = auth.email(). A
      // mixed-case email would orphan the user from their own row.
      const res = await supabase.functions.invoke('createManualUserProfile', {
        body: {
          email: form.email.toLowerCase().trim(),
          stripeSubscriptionId: form.stripeSubscriptionId,
          plan: form.plan,
        },
      });

      if (res.data?.success) {
        setResult({
          success: true,
          message: res.data.message,
          action: res.data.action,
        });
        setForm({ email: '', stripeSubscriptionId: '', plan: 'basic' });
      } else {
        setError(res.data?.error || 'Something went wrong');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create/update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border';
  const labelCls = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Fix User Account</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6">
        <div className="max-w-md mx-auto space-y-6">
          <p className="text-sm text-muted-foreground">
            Manually create or update a UserProfile for a user who completed Stripe checkout but their account wasn't created by the webhook.
          </p>

          {result && (
            <div className={`rounded-2xl p-4 flex gap-3 ${result.success ? 'bg-sage/10 border border-sage/30' : 'bg-destructive/10 border border-destructive/30'}`}>
              <Check className={`w-5 h-5 flex-shrink-0 ${result.success ? 'text-sage-dark' : 'text-destructive'}`} />
              <div>
                <p className={`text-sm font-semibold ${result.success ? 'text-sage-dark' : 'text-destructive'}`}>
                  {result.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.action === 'created' ? 'New profile created.' : 'Existing profile updated.'}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl p-4 flex gap-3 bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Email Address</label>
              <input
                type="email"
                className={inputCls}
                placeholder="user@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Stripe Subscription ID</label>
              <input
                type="text"
                className={inputCls}
                placeholder="sub_1234567890abcdef"
                value={form.stripeSubscriptionId}
                onChange={e => setForm({ ...form, stripeSubscriptionId: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">Must start with sub_</p>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Plan</label>
              <select
                className={inputCls}
                value={form.plan}
                onChange={e => setForm({ ...form, plan: e.target.value })}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50 bg-foreground text-background"
            >
              {submitting ? 'Creating profile...' : 'Create/Update Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}