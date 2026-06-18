import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { ChevronLeft, Plus, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Admin page #1: list of all affiliates with per-row roll-ups.
//
// Per scope: signups, conversions, active subscribers, revenue generated,
// commissions owed, payout status. We compute these client-side from the
// commission + attribution tables to avoid a migration for an aggregate view.
// At low affiliate counts (< 100), one query per dimension is fine.

function centsToUSD(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusPill(status) {
  const cls =
    status === 'active' ? 'bg-green-100 text-green-700'
    : status === 'paused' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${cls}`}>
      {status}
    </span>
  );
}

export default function AdminAffiliates() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const user = await getCurrentUser();
      if (user?.role !== 'admin') { navigate('/', { replace: true }); return; }
      const affiliates = await unwrap(
        supabase.from('affiliate').select('*').order('created_at', { ascending: false })
      );
      // Pull the entire commission + attribution sets and roll up client-side.
      // For ~100 affiliates and a few thousand commissions this is fine; once
      // we cross 10k rows we should move this to a view or RPC.
      const [attributions, commissions] = await Promise.all([
        unwrap(supabase.from('affiliate_attribution').select('affiliate_id, user_email')),
        unwrap(supabase.from('affiliate_commission').select('affiliate_id, user_email, commission_cents, gross_revenue_cents, status')),
      ]);

      const grouped = new Map();
      for (const a of affiliates) {
        grouped.set(a.id, {
          affiliate: a,
          signups: 0,
          conversions: new Set(),
          gross_cents: 0,
          owed_cents: 0,   // pending + approved (unpaid)
          paid_cents: 0,
          refunded_cents: 0,
        });
      }
      for (const att of attributions) {
        const g = grouped.get(att.affiliate_id);
        if (g) g.signups += 1;
      }
      for (const c of commissions) {
        const g = grouped.get(c.affiliate_id);
        if (!g) continue;
        if (c.commission_cents > 0 && c.status !== 'reversed' && c.status !== 'void') {
          g.conversions.add(c.user_email);
        }
        g.gross_cents += c.gross_revenue_cents;
        if (c.status === 'pending' || c.status === 'approved') g.owed_cents += c.commission_cents;
        else if (c.status === 'paid') g.paid_cents += c.commission_cents;
        else if (c.status === 'reversed' && c.commission_cents < 0) g.refunded_cents += -c.commission_cents;
      }
      setRows([...grouped.values()].map(r => ({ ...r, conversions: r.conversions.size })));
    } catch (e) {
      console.error('[AdminAffiliates] load failed:', e?.message);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const totals = rows.reduce((acc, r) => ({
    affiliates: acc.affiliates + 1,
    signups: acc.signups + r.signups,
    conversions: acc.conversions + r.conversions,
    gross: acc.gross + r.gross_cents,
    owed: acc.owed + r.owed_cents,
  }), { affiliates: 0, signups: 0, conversions: 0, gross: 0, owed: 0 });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/feedback')} className="p-2" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground flex-1">Affiliates</h1>
          <button
            onClick={() => navigate('/admin/affiliates/new')}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{totals.affiliates}</p>
            <p className="text-xs text-muted-foreground mt-1">Affiliates</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{totals.signups}</p>
            <p className="text-xs text-muted-foreground mt-1">Signups</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{totals.conversions}</p>
            <p className="text-xs text-muted-foreground mt-1">Conversions</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-green-600">{centsToUSD(totals.gross)}</p>
            <p className="text-xs text-muted-foreground mt-1">Gross revenue</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-orange-600">{centsToUSD(totals.owed)}</p>
            <p className="text-xs text-muted-foreground mt-1">Owed</p>
          </div>
        </div>

        {/* Per-affiliate rows */}
        {rows.length === 0 ? (
          <div className="card-base p-8 text-center space-y-3">
            <p className="text-muted-foreground">No affiliates yet.</p>
            <button
              onClick={() => navigate('/admin/affiliates/new')}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-bold"
            >
              Create the first one
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <button
                key={r.affiliate.id}
                onClick={() => navigate(`/admin/affiliates/${r.affiliate.id}`)}
                className="card-base p-4 text-left w-full active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">{r.affiliate.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.affiliate.code}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{r.affiliate.contact_email}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {statusPill(r.affiliate.status)}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                  <div><p className="text-base font-black text-foreground">{r.signups}</p><p className="text-[10px] text-muted-foreground">Signups</p></div>
                  <div><p className="text-base font-black text-foreground">{r.conversions}</p><p className="text-[10px] text-muted-foreground">Converted</p></div>
                  <div><p className="text-base font-black text-green-600">{centsToUSD(r.gross_cents)}</p><p className="text-[10px] text-muted-foreground">Gross</p></div>
                  <div><p className="text-base font-black text-orange-600">{centsToUSD(r.owed_cents)}</p><p className="text-[10px] text-muted-foreground">Owed</p></div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
