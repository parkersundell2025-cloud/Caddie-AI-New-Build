import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { Gift, Check, RefreshCw } from 'lucide-react';

// Referral v1 (SOW 3b) admin view: who referred whom and what's owed.
// Fulfillment is manual — see REFERRALS.md for the grant runbook. "Earned"
// rows are the ones owed a free month; Mark granted flips them to rewarded.
export default function AdminReferrals() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const u = await getCurrentUser();
    setUser(u);
    if (u?.role !== 'admin') { navigate('/', { replace: true }); return; }
    await load();
  };

  const load = async () => {
    setLoading(true);
    const data = await unwrap(
      supabase.from('referral').select('*').order('updated_date', { ascending: false }).limit(500)
    );
    setRows(data);
    setLoading(false);
  };

  const markGranted = async (id) => {
    await unwrap(
      supabase.from('referral')
        .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
        .eq('id', id).select().single()
    );
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'rewarded' } : r));
  };

  if (!loading && user?.role !== 'admin') return null;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const earned = rows.filter(r => r.status === 'earned');
  const pending = rows.filter(r => r.status === 'pending');
  const rewarded = rows.filter(r => r.status === 'rewarded');

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-10 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center">
          <Gift className="w-5 h-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Admin — Referrals</h1>
          <p className="text-xs text-muted-foreground">{earned.length} free {earned.length === 1 ? 'month' : 'months'} owed</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-xl bg-muted">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Owed */}
      <Section title={`Owed — grant these (${earned.length})`}>
        {earned.length === 0 && <Empty text="Nothing owed right now." />}
        {earned.map(r => (
          <Row key={r.id} r={r}>
            <button onClick={() => markGranted(r.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-100 text-green-700 font-bold text-xs active:scale-95 transition-all">
              <Check className="w-3.5 h-3.5" /> Mark granted
            </button>
          </Row>
        ))}
      </Section>

      <Section title={`Pending — friend hasn't converted yet (${pending.length})`}>
        {pending.length === 0 && <Empty text="No pending referrals." />}
        {pending.map(r => <Row key={r.id} r={r} />)}
      </Section>

      <Section title={`Granted (${rewarded.length})`}>
        {rewarded.length === 0 && <Empty text="None granted yet." />}
        {rewarded.map(r => <Row key={r.id} r={r} />)}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Empty({ text }) {
  return <p className="text-sm text-muted-foreground py-3">{text}</p>;
}
function Row({ r, children }) {
  const badge = r.status === 'earned' ? 'bg-green-100 text-green-700'
    : r.status === 'rewarded' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
  return (
    <div className="card-base p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{r.referrer_email}</p>
        <p className="text-xs text-muted-foreground truncate">referred {r.referred_email}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">code {r.referral_code}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badge}`}>{r.status}</span>
        {children}
      </div>
    </div>
  );
}
