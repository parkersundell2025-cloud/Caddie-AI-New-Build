import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import { useNavigate } from 'react-router-dom';
import { LogOut, Copy, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import Logo from '@/components/layout/Logo';

// Self-serve affiliate dashboard. Reads via RLS-scoped queries — the
// affiliate_self_select / affiliate_*_self_select policies match on
// auth.email() == lower(affiliate.contact_email), so we don't need an
// edge function; the RLS layer enforces single-affiliate scope automatically.
//
// Gate logic:
//   1. No session → /affiliate/login
//   2. Signed in, no matching affiliate row → /affiliate/login with explanation
//   3. Signed in + affiliate found → render dashboard

function centsToUSD(c) { return `$${(c / 100).toFixed(2)}`; }

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | denied | ready
  const [affiliate, setAffiliate] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        navigate('/affiliate/login', { replace: true });
        return;
      }
      // RLS limits this to the affiliate row matching the signed-in email.
      const affs = await unwrap(supabase.from('affiliate').select('*'));
      if (!affs.length) { setState('denied'); return; }
      const aff = affs[0];
      setAffiliate(aff);
      const [comms, atts, pays] = await Promise.all([
        unwrap(supabase.from('affiliate_commission').select('*').order('occurred_at', { ascending: false })),
        unwrap(supabase.from('affiliate_attribution').select('*').order('signed_up_at', { ascending: false })),
        unwrap(supabase.from('affiliate_payout').select('*').order('created_at', { ascending: false })),
      ]);
      setCommissions(comms);
      setAttributions(atts);
      setPayouts(pays);
      setState('ready');
    })().catch(e => {
      console.error('[AffiliateDashboard] load failed:', e?.message);
      setState('denied');
    });
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/affiliate/login', { replace: true });
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center space-y-4 bg-background">
        <Logo size="md" />
        <h1 className="text-xl font-black text-foreground">Account not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The email you signed in with isn&rsquo;t linked to any affiliate. If you think this is wrong,
          contact the team.
        </p>
        <button onClick={signOut} className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-bold">
          Sign out
        </button>
      </div>
    );
  }

  const link = `https://caddieaiapp.com/?ref=${affiliate.code}`;
  function copyLink() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Roll-ups (matches admin detail page, but filtered to this affiliate by RLS).
  const sumByStatus = key => commissions.reduce((a, c) => a + (c.status === key ? c.commission_cents : 0), 0);
  const pendingCents = sumByStatus('pending');
  const approvedCents = sumByStatus('approved');
  const paidCents = sumByStatus('paid');
  const lifetimeEarned = pendingCents + approvedCents + paidCents; // excludes reversed/void
  const owed = pendingCents + approvedCents;
  const distinctConverters = new Set(commissions.filter(c => c.commission_cents > 0 && c.status !== 'reversed' && c.status !== 'void').map(c => c.user_email)).size;

  const rateLabel = affiliate.commission_type === 'percentage'
    ? `${(Number(affiliate.commission_rate) * 100).toFixed(2)}%`
    : `${centsToUSD(affiliate.commission_rate)} per signup`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <Logo size="sm" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-foreground truncate">{affiliate.display_name}</h1>
            <p className="text-[11px] text-muted-foreground font-mono">{affiliate.code} · {rateLabel}</p>
          </div>
          <button onClick={signOut} className="p-2" aria-label="Sign out">
            <LogOut className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto max-w-2xl">
        {/* Share link */}
        <div className="card-base p-4 space-y-2">
          <p className="text-xs font-bold text-foreground uppercase">Your link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate bg-muted px-3 py-2 rounded-lg text-xs">{link}</code>
            <button onClick={copyLink} className="p-2 rounded-lg bg-foreground text-background active:scale-95" aria-label="Copy">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Every signup from this link gets attributed to you forever.</p>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{attributions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Signups</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{distinctConverters}</p>
            <p className="text-xs text-muted-foreground mt-1">Paying subscribers</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-green-600">{centsToUSD(paidCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">Paid out</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-orange-600">{centsToUSD(owed)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending payout</p>
          </div>
        </div>

        {/* Lifetime band */}
        <div className="card-base p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase">Lifetime earned</p>
            <p className="text-3xl font-black text-foreground">{centsToUSD(lifetimeEarned)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase">Lifetime gross</p>
            <p className="text-base font-bold text-foreground">{centsToUSD(commissions.reduce((a, c) => a + c.gross_revenue_cents, 0))}</p>
          </div>
        </div>

        {/* Payout history */}
        <div className="space-y-2">
          <h2 className="font-bold text-foreground">Payout history</h2>
          {payouts.length === 0 ? (
            <div className="card-base p-4 text-sm text-center text-muted-foreground">No payouts sent yet.</div>
          ) : (
            <div className="card-base divide-y divide-border">
              {payouts.map(p => (
                <div key={p.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-black text-foreground">{centsToUSD(p.total_cents)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy') : format(new Date(p.created_at), 'MMM d, yyyy')}
                      {p.paid_via ? ` · ${p.paid_via}` : ''}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    p.status === 'sent' || p.status === 'reconciled' ? 'bg-green-100 text-green-700'
                    : p.status === 'draft' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{p.status === 'sent' ? 'Paid' : p.status === 'draft' ? 'Processing' : p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="space-y-2">
          <h2 className="font-bold text-foreground">Recent activity</h2>
          {commissions.length === 0 ? (
            <div className="card-base p-4 text-sm text-center text-muted-foreground">
              No commissions yet. Share your link above to start earning.
            </div>
          ) : (
            <div className="card-base divide-y divide-border">
              {commissions.slice(0, 15).map(c => (
                <div key={c.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground">{c.event_type === 'initial_purchase' ? 'New subscriber' : c.event_type === 'renewal' ? 'Renewal' : c.event_type === 'trial_converted' ? 'Trial → paid' : c.event_type === 'refund' ? 'Refund' : c.event_type}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(c.occurred_at), 'MMM d, yyyy')}</p>
                  </div>
                  <p className={`font-black ${c.commission_cents < 0 ? 'text-red-600' : 'text-foreground'}`}>{centsToUSD(c.commission_cents)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
