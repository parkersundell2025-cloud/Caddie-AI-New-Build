import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/db';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Admin page #2: create a new affiliate.
//
// commission_type:
//   - 'percentage' — commission_rate stored as 0..1 (e.g. 0.20 = 20%)
//   - 'flat'       — commission_rate stored as cents (e.g. 500 = $5 bounty)
// We render two different rate inputs so the admin enters the natural unit
// and the JSX converts before sending.
//
// Code must match the schema CHECK: ^[A-Z0-9][A-Z0-9_-]{2,31}$ (3–32 chars).
// We uppercase + validate client-side so the user gets a fast hint; the
// server trigger normalizes anyway.

function generateSuggestedCode(name) {
  const clean = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.slice(0, 10);
}

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export default function AdminAffiliateNew() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [commissionType, setCommissionType] = useState('percentage');
  const [percentPct, setPercentPct] = useState('20');      // user types 20 → store 0.20
  const [flatDollars, setFlatDollars] = useState('5');     // user types 5 → store 500 cents
  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [payoutDetail, setPayoutDetail] = useState('');    // PayPal email / Wise tag / IBAN

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user?.role !== 'admin') { navigate('/', { replace: true }); return; }
      setAuthed(true);
    })();
  }, [navigate]);

  // Auto-suggest a code from the display name while the user types — only
  // overwrites when the code field is empty / matches the previous suggestion.
  useEffect(() => {
    const suggested = generateSuggestedCode(displayName);
    setCode(prev => (!prev || prev === generateSuggestedCode(displayName.slice(0, -1)) ? suggested : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const normalizedCode = code.trim().toUpperCase();
    if (!displayName.trim()) return setError('Display name is required.');
    if (!CODE_RE.test(normalizedCode)) return setError('Code must be 3–32 chars: letters, digits, dash, underscore (starts with letter or digit).');
    if (!contactEmail.trim()) return setError('Contact email is required.');

    let commissionRate;
    if (commissionType === 'percentage') {
      const pct = Number(percentPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return setError('Percentage must be 0–100.');
      commissionRate = pct / 100;
    } else {
      const usd = Number(flatDollars);
      if (!Number.isFinite(usd) || usd < 0) return setError('Flat amount must be a positive number.');
      commissionRate = Math.round(usd * 100);  // cents
    }

    setSubmitting(true);
    const payoutDetails = payoutDetail.trim()
      ? (payoutMethod === 'bank' ? { iban: payoutDetail.trim() } : { handle: payoutDetail.trim() })
      : {};

    const { data, error: insErr } = await supabase
      .from('affiliate')
      .insert({
        display_name: displayName.trim(),
        code: normalizedCode,
        contact_email: contactEmail.trim().toLowerCase(),
        commission_type: commissionType,
        commission_rate: commissionRate,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
        status: 'active',
      })
      .select('id')
      .single();

    setSubmitting(false);
    if (insErr) {
      // 23505 = unique_violation on the code.
      if (insErr.code === '23505') return setError(`Code "${normalizedCode}" is already taken. Try another.`);
      return setError(insErr.message || 'Failed to create affiliate.');
    }
    navigate(`/admin/affiliates/${data.id}`, { replace: true });
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/affiliates')} className="p-2" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">New Affiliate</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-5 py-6 space-y-5 overflow-y-auto max-w-lg">
        {error && (
          <div className="card-base p-3 bg-red-50 border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Display name</label>
          <input
            type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
            placeholder="Sarah Johnson"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Code</label>
          <input
            type="text" value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-mono"
            placeholder="SARAH"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Lands in URLs as <code>caddieaiapp.com/?ref={code || 'SARAH'}</code>. Letters/digits + dash/underscore, 3–32 chars.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Contact email</label>
          <input
            type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
            placeholder="sarah@example.com"
            required
          />
          <p className="text-[11px] text-muted-foreground">Magic-link sign-ins to the affiliate dashboard land here.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Commission</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCommissionType('percentage')}
              className={`py-2 rounded-xl border text-sm font-bold ${commissionType === 'percentage' ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground'}`}
            >% of revenue</button>
            <button
              type="button"
              onClick={() => setCommissionType('flat')}
              className={`py-2 rounded-xl border text-sm font-bold ${commissionType === 'flat' ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground'}`}
            >Flat $ per signup</button>
          </div>
          {commissionType === 'percentage' ? (
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="1"
                value={percentPct} onChange={e => setPercentPct(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl border border-border bg-background text-foreground"
              />
              <span className="text-sm text-muted-foreground">% of each paying event</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number" min="0" step="0.01"
                value={flatDollars} onChange={e => setFlatDollars(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl border border-border bg-background text-foreground"
              />
              <span className="text-sm text-muted-foreground">per first paid signup (one-time)</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Payout method</label>
          <div className="grid grid-cols-4 gap-2">
            {['paypal', 'wise', 'bank', 'other'].map(m => (
              <button
                key={m} type="button"
                onClick={() => setPayoutMethod(m)}
                className={`py-2 rounded-xl border text-xs font-bold uppercase ${payoutMethod === m ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground'}`}
              >{m}</button>
            ))}
          </div>
          <input
            type="text" value={payoutDetail} onChange={e => setPayoutDetail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground mt-2"
            placeholder={payoutMethod === 'bank' ? 'IBAN / account #' : payoutMethod === 'paypal' ? 'PayPal email' : 'Handle / details'}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Creating…' : 'Create affiliate'}
        </button>
      </form>
    </div>
  );
}
