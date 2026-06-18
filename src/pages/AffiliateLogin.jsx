import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, MailCheck } from 'lucide-react';
import Logo from '@/components/layout/Logo';

// Self-serve sign-in for affiliates. Uses Supabase magic-link OTP — no
// separate auth system. Affiliates and app users share the same auth.users
// table; the gating happens at /affiliate/dashboard, which only renders if
// the signed-in email has a matching affiliate.contact_email.
//
// emailRedirectTo points back to /affiliate/dashboard so the magic-link click
// lands them on their dashboard, not the regular RootRoute funnel (which
// would bounce them to /subscribe-now for not having a user_profile).

export default function AffiliateLogin() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Enter your email.');
    setSubmitting(true);
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/affiliate/dashboard`,
        // shouldCreateUser:true so first-time affiliates whose admin-created
        // affiliate row hasn't been mirrored into auth.users can still sign
        // in. The dashboard itself gates on whether an affiliate row exists
        // for the signed-in email — auth users without a matching affiliate
        // see the "Account not found" view, not the dashboard.
        shouldCreateUser: true,
      },
    });
    setSubmitting(false);
    if (otpErr) {
      setError('We could not send a sign-in link. Double-check the email and try again.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <Logo size="lg" />
          <h1 className="text-2xl font-black text-foreground">Affiliate sign in</h1>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ll email you a sign-in link. No password.
          </p>
        </div>

        {sent ? (
          <div className="card-base p-5 text-center space-y-3">
            <MailCheck className="w-10 h-10 text-green-600 mx-auto" />
            <h2 className="font-black text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <span className="font-bold text-foreground">{email}</span>.
              Click it within 1 hour to open your dashboard.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-xs text-muted-foreground underline"
            >Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground"
              placeholder="sarah@example.com"
              autoComplete="email"
              required
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Sending link…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Not an affiliate? Open the <a href="/" className="underline">main app</a>.
        </p>
      </div>
    </div>
  );
}
