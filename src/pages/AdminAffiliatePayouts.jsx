import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Admin page #4: build payouts, mark them paid.
//
// Flow (per scope, "Payouts tracked in the system, marked as paid manually
// by admin. Actual payment made via PayPal, Wise, or bank transfer outside
// the app."):
//
//   1. Pick an affiliate.
//   2. Eligible commissions = status='approved' AND payout_id is null.
//   3. Click "Create payout" — INSERT affiliate_payout, UPDATE the eligible
//      rows to payout_id=new + status='paid' (status='paid' actually only
//      flips when the payout itself is marked sent; see step 5).
//   4. Payout sits in 'draft'. Admin sends money externally (PayPal, etc.).
//   5. Paste external_reference + click "Mark sent" → payout.status='sent',
//      paid_at=now, paid_via=<method>. Commissions flip to 'paid'.
//   6. "Void" returns commissions to 'approved' so they can be re-batched.
//
// Reasoning for the two-step (draft → sent) split: if the admin creates a
// payout, walks away, and never sends money, we don't want commissions
// permanently locked. Voiding the draft puts them back in the pool.

function centsToUSD(c) { return `$${(c / 100).toFixed(2)}`; }

export default function AdminAffiliatePayouts() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [affiliates, setAffiliates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [eligible, setEligible] = useState([]);
  const [pastPayouts, setPastPayouts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refsByPayout, setRefsByPayout] = useState({});
  const [methodsByPayout, setMethodsByPayout] = useState({});

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user?.role !== 'admin') { navigate('/', { replace: true }); return; }
      setAuthed(true);
      const affs = await unwrap(supabase.from('affiliate').select('*').order('display_name'));
      setAffiliates(affs);
      if (affs.length === 1) setSelectedId(affs[0].id);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!selectedId) { setEligible([]); setPastPayouts([]); return; }
    loadAffiliateData(selectedId);
  }, [selectedId]);

  async function loadAffiliateData(id) {
    const [comms, payouts] = await Promise.all([
      unwrap(supabase.from('affiliate_commission').select('*').eq('affiliate_id', id).eq('status', 'approved').is('payout_id', null).order('occurred_at')),
      unwrap(supabase.from('affiliate_payout').select('*').eq('affiliate_id', id).order('created_at', { ascending: false })),
    ]);
    setEligible(comms);
    setPastPayouts(payouts);
  }

  async function createPayout() {
    if (!eligible.length) return;
    setBusy(true);
    const totalCents = eligible.reduce((a, c) => a + c.commission_cents, 0);
    const { data: payout, error: payoutErr } = await supabase.from('affiliate_payout')
      .insert({ affiliate_id: selectedId, total_cents: totalCents, status: 'draft' })
      .select('id')
      .single();
    if (payoutErr) {
      console.error('[Payouts] create payout failed:', payoutErr.message);
      setBusy(false);
      alert('Failed to create payout: ' + payoutErr.message);
      return;
    }
    // Attach commissions to the new payout. Keep commission.status='approved'
    // until the payout is actually 'sent' — see the docstring for why.
    const ids = eligible.map(c => c.id);
    const { error: upErr } = await supabase.from('affiliate_commission')
      .update({ payout_id: payout.id })
      .in('id', ids);
    if (upErr) {
      console.error('[Payouts] commission attach failed:', upErr.message);
      // Rollback the payout — leaving orphan payouts behind would inflate totals.
      await supabase.from('affiliate_payout').delete().eq('id', payout.id);
      alert('Failed: ' + upErr.message);
    }
    await loadAffiliateData(selectedId);
    setBusy(false);
  }

  async function markPayoutSent(payout) {
    const externalRef = refsByPayout[payout.id]?.trim();
    const method = methodsByPayout[payout.id] || 'paypal';
    if (!externalRef) {
      alert('Paste an external reference (PayPal transaction id, Wise tx id, bank ref, etc.) first.');
      return;
    }
    setBusy(true);
    // Two-step: flip commissions to paid first, then payout to sent. If the
    // second update errors, the commissions are stuck in 'paid' but with a
    // draft payout — visible in the admin UI to fix manually.
    await supabase.from('affiliate_commission')
      .update({ status: 'paid' })
      .eq('payout_id', payout.id);
    await supabase.from('affiliate_payout')
      .update({
        status: 'sent',
        paid_at: new Date().toISOString(),
        paid_via: method,
        external_reference: externalRef,
      })
      .eq('id', payout.id);
    await loadAffiliateData(selectedId);
    setBusy(false);
  }

  async function voidPayout(payout) {
    if (!window.confirm('Void this payout? Attached commissions return to "approved" so they can be re-batched. Only do this if the payment did NOT go out.')) return;
    setBusy(true);
    // Detach + return to approved.
    await supabase.from('affiliate_commission')
      .update({ payout_id: null, status: 'approved' })
      .eq('payout_id', payout.id);
    await supabase.from('affiliate_payout')
      .update({ status: 'void' })
      .eq('id', payout.id);
    await loadAffiliateData(selectedId);
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!authed) return null;

  const eligibleTotal = eligible.reduce((a, c) => a + c.commission_cents, 0);
  const draftPayouts = pastPayouts.filter(p => p.status === 'draft');
  const sentPayouts = pastPayouts.filter(p => p.status === 'sent' || p.status === 'reconciled');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/affiliates')} className="p-2" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Payouts</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto max-w-3xl">
        {/* Affiliate picker */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground uppercase">Affiliate</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
          >
            <option value="">— Select an affiliate —</option>
            {affiliates.map(a => (
              <option key={a.id} value={a.id}>{a.display_name} ({a.code}) — {a.status}</option>
            ))}
          </select>
        </div>

        {!selectedId ? (
          <div className="card-base p-6 text-center text-sm text-muted-foreground">
            Pick an affiliate above to view their eligible commissions and payout history.
          </div>
        ) : (
          <>
            {/* Eligible commissions → create payout */}
            <div className="space-y-3">
              <h2 className="font-bold text-foreground">Eligible commissions</h2>
              {eligible.length === 0 ? (
                <div className="card-base p-4 text-sm text-center text-muted-foreground">
                  Nothing in the "approved" bucket. Approve pending commissions on the affiliate's detail page first.
                </div>
              ) : (
                <>
                  <div className="card-base divide-y divide-border">
                    {eligible.map(c => (
                      <div key={c.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] truncate text-foreground">{c.user_email}</p>
                          <p className="text-[11px] text-muted-foreground">{c.event_type} · {format(new Date(c.occurred_at), 'MMM d, yyyy')}</p>
                        </div>
                        <p className="font-black text-foreground shrink-0">{centsToUSD(c.commission_cents)}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={createPayout}
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create payout — {eligible.length} row{eligible.length === 1 ? '' : 's'} · {centsToUSD(eligibleTotal)}
                  </button>
                </>
              )}
            </div>

            {/* Draft payouts → mark sent / void */}
            {draftPayouts.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold text-foreground">Draft payouts (awaiting external send)</h2>
                {draftPayouts.map(p => (
                  <div key={p.id} className="card-base p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-foreground">{centsToUSD(p.total_cents)}</p>
                        <p className="text-[11px] text-muted-foreground">created {format(new Date(p.created_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Draft</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['paypal','wise','bank','other'].map(m => (
                        <button
                          key={m}
                          onClick={() => setMethodsByPayout(s => ({ ...s, [p.id]: m }))}
                          className={`py-1.5 rounded-lg border text-[11px] font-bold uppercase ${ (methodsByPayout[p.id] || 'paypal') === m ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground'}`}
                        >{m}</button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="External reference (PayPal txn id, Wise txn id, bank memo)"
                      value={refsByPayout[p.id] || ''}
                      onChange={e => setRefsByPayout(s => ({ ...s, [p.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => markPayoutSent(p)}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                      >Mark sent</button>
                      <button
                        onClick={() => voidPayout(p)}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl border border-red-300 text-red-700 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                      >Void</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sent payouts */}
            <div className="space-y-3">
              <h2 className="font-bold text-foreground">Past payouts</h2>
              {sentPayouts.length === 0 ? (
                <div className="card-base p-4 text-sm text-center text-muted-foreground">No payouts sent yet.</div>
              ) : (
                <div className="card-base divide-y divide-border">
                  {sentPayouts.map(p => (
                    <div key={p.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-foreground">{centsToUSD(p.total_cents)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.paid_at ? `paid ${format(new Date(p.paid_at), 'MMM d, yyyy')}` : ''} via {p.paid_via}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">{p.status}</span>
                      </div>
                      {p.external_reference && (
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">{p.external_reference}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
