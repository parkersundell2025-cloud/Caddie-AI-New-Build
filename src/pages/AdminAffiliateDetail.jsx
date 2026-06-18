import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { ChevronLeft, Loader2, Copy, Check } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';

// Admin page #3: per-affiliate detail.
//
// Shows the live commission ledger and exposes the three admin actions that
// move money through the system:
//
//   1. Status toggle  active ⇄ paused (terminated is one-way; we hide it
//      behind a confirm).
//   2. Approve pending commissions — staging step before a payout batch.
//   3. Void / restore commissions — one-off cleanup (e.g. spam signup).
//
// Payout creation lives on /admin/affiliates/payouts (task #104).

function centsToUSD(c) { return `$${(c / 100).toFixed(2)}`; }

function statusPill(status) {
  const map = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    paid:     'bg-green-100 text-green-700',
    reversed: 'bg-gray-100 text-gray-600',
    void:     'bg-red-100 text-red-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${map[status] || 'bg-gray-100'}`}>{status}</span>;
}

export default function AdminAffiliateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [affiliate, setAffiliate] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user?.role !== 'admin') { navigate('/', { replace: true }); return; }
      setAuthed(true);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const aff = await unwrap(supabase.from('affiliate').select('*').eq('id', id).limit(1));
      if (!aff[0]) { navigate('/admin/affiliates', { replace: true }); return; }
      setAffiliate(aff[0]);
      const [comms, atts] = await Promise.all([
        unwrap(supabase.from('affiliate_commission').select('*').eq('affiliate_id', id).order('occurred_at', { ascending: false })),
        unwrap(supabase.from('affiliate_attribution').select('*').eq('affiliate_id', id).order('signed_up_at', { ascending: false })),
      ]);
      setCommissions(comms);
      setAttributions(atts);
    } catch (e) {
      console.error('[AdminAffiliateDetail] load failed:', e?.message);
    }
    setLoading(false);
  }

  async function setStatus(next) {
    if (next === 'terminated' && !window.confirm('Terminate this affiliate? They will stop earning commission immediately. Existing rows are kept.')) return;
    setBusy(true);
    const patch = { status: next };
    if (next === 'terminated') patch.terminated_at = new Date().toISOString();
    await supabase.from('affiliate').update(patch).eq('id', id);
    await load();
    setBusy(false);
  }

  async function setCommissionStatus(commissionId, next) {
    setBusy(true);
    await supabase.from('affiliate_commission').update({ status: next }).eq('id', commissionId);
    await load();
    setBusy(false);
  }

  async function approveAllPending() {
    setBusy(true);
    await supabase.from('affiliate_commission').update({ status: 'approved' })
      .eq('affiliate_id', id).eq('status', 'pending');
    await load();
    setBusy(false);
  }

  const link = affiliate ? `https://caddieaiapp.com/?ref=${affiliate.code}` : '';
  function copyLink() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading || !affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!authed) return null;

  // Per-status totals.
  const sum = key => commissions.reduce((a, c) => a + (c.status === key ? c.commission_cents : 0), 0);
  const pendingTotal = sum('pending');
  const approvedTotal = sum('approved');
  const paidTotal = sum('paid');
  const grossTotal = commissions.reduce((a, c) => a + c.gross_revenue_cents, 0);
  const owed = pendingTotal + approvedTotal;
  const distinctConverters = new Set(commissions.filter(c => c.commission_cents > 0 && c.status !== 'reversed' && c.status !== 'void').map(c => c.user_email)).size;

  const rateLabel = affiliate.commission_type === 'percentage'
    ? `${(Number(affiliate.commission_rate) * 100).toFixed(2)}%`
    : `${centsToUSD(affiliate.commission_rate)} flat`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/affiliates')} className="p-2" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground flex-1 truncate">{affiliate.display_name}</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto max-w-3xl">
        {/* Identity block */}
        <div className="card-base p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-sm">{affiliate.code}</p>
            <div className="flex gap-2">
              {['active','paused','terminated'].map(s => (
                <button key={s} disabled={busy || affiliate.status === s}
                  onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${affiliate.status === s ? 'bg-foreground text-background' : 'bg-muted text-foreground'} disabled:opacity-50`}
                >{s}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{affiliate.contact_email}</p>
          <p className="text-xs text-muted-foreground">Terms: <span className="font-bold text-foreground">{rateLabel}</span> · payout via {affiliate.payout_method || '—'}</p>
          <div className="flex items-center gap-2 pt-1">
            <code className="text-[11px] flex-1 truncate bg-muted px-2 py-1 rounded">{link}</code>
            <button onClick={copyLink} className="p-2 rounded-lg bg-muted active:scale-95" aria-label="Copy link">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-foreground" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-foreground">{attributions.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Signups</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-foreground">{distinctConverters}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Converted</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-green-600">{centsToUSD(grossTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Gross</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-orange-600">{centsToUSD(owed)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Owed</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-amber-700">{centsToUSD(pendingTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Pending</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-blue-700">{centsToUSD(approvedTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Approved</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-green-700">{centsToUSD(paidTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Paid</p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-xl font-black text-foreground">{commissions.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase">Ledger rows</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={approveAllPending}
            disabled={busy || pendingTotal === 0}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            Approve all pending ({centsToUSD(pendingTotal)})
          </button>
          <Link
            to="/admin/affiliates/payouts"
            className="flex-1 py-2.5 rounded-xl border border-foreground text-foreground text-xs font-bold active:scale-95 transition-all text-center"
          >Payouts</Link>
        </div>

        {/* Commission ledger */}
        <div className="space-y-3">
          <h2 className="font-bold text-foreground">Commission ledger</h2>
          {commissions.length === 0 ? (
            <div className="card-base p-4 text-sm text-center text-muted-foreground">
              No commissions yet. Drive a signup through <code>?ref={affiliate.code}</code> and a paying RC event will populate this.
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map(c => (
                <div key={c.id} className="card-base p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] truncate text-foreground">{c.user_email}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.event_type} · {c.store} · {format(new Date(c.occurred_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-black ${c.commission_cents < 0 ? 'text-red-600' : 'text-foreground'}`}>
                        {centsToUSD(c.commission_cents)}
                      </p>
                      <div className="mt-1">{statusPill(c.status)}</div>
                    </div>
                  </div>
                  {/* Row actions */}
                  <div className="flex gap-1.5 mt-2">
                    {c.status === 'pending' && (
                      <button onClick={() => setCommissionStatus(c.id, 'approved')} disabled={busy}
                        className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-[11px] font-bold disabled:opacity-40">Approve</button>
                    )}
                    {(c.status === 'pending' || c.status === 'approved') && (
                      <button onClick={() => setCommissionStatus(c.id, 'void')} disabled={busy}
                        className="px-2 py-1 rounded-md bg-red-100 text-red-700 text-[11px] font-bold disabled:opacity-40">Void</button>
                    )}
                    {c.status === 'void' && (
                      <button onClick={() => setCommissionStatus(c.id, 'pending')} disabled={busy}
                        className="px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold disabled:opacity-40">Restore</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
