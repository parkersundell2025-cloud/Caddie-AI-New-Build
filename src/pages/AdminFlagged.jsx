import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { Shield, Check, X, RefreshCw } from 'lucide-react';

export default function AdminFlagged() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [flaggedRounds, setFlaggedRounds] = useState([]);
  const [flaggedAccounts, setFlaggedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('rounds');

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const u = await getCurrentUser();
    setUser(u);
    // Non-admins are bounced to /; RootRoute then sends them to the correct landing
    // (/home, /signin, or /subscribe-now). Matches AdminFeedback/WaitlistCredits/FixUser.
    if (u?.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    await load();
  };

  const load = async () => {
    setLoading(true);
    const [rounds, accounts] = await Promise.all([
      unwrap(supabase.from('flagged_round').select('*').order('created_date', { ascending: false }).limit(100)),
      unwrap(supabase.from('flagged_account').select('*').order('created_date', { ascending: false }).limit(100)),
    ]);
    setFlaggedRounds(rounds);
    setFlaggedAccounts(accounts);
    setLoading(false);
  };

  const updateRound = async (id, status) => {
    await unwrap(supabase.from('flagged_round').update({ status }).eq('id', id).select().single());
    setFlaggedRounds(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const updateAccount = async (id, status) => {
    await unwrap(supabase.from('flagged_account').update({ status }).eq('id', id).select().single());
    setFlaggedAccounts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  // Render nothing while the navigate('/') redirect is in flight — prevents a
  // flash of "Access denied" between the role check and the route change.
  if (!loading && user?.role !== 'admin') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const pendingRounds = flaggedRounds.filter(r => r.status === 'pending');
  const resolvedRounds = flaggedRounds.filter(r => r.status !== 'pending');
  const pendingAccounts = flaggedAccounts.filter(a => a.status === 'pending');
  const resolvedAccounts = flaggedAccounts.filter(a => a.status !== 'pending');

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-10 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center">
          <Shield className="w-5 h-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Admin — Flagged Items</h1>
          <p className="text-xs text-muted-foreground">Leaderboard integrity review</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-xl bg-muted">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-2xl p-1 gap-1">
        <button
          onClick={() => setTab('rounds')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === 'rounds' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Flagged Rounds ({pendingRounds.length})
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === 'accounts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Flagged Accounts ({pendingAccounts.length})
        </button>
      </div>

      {tab === 'rounds' && (
        <div className="space-y-4">
          {pendingRounds.length === 0 && <p className="text-center text-muted-foreground py-8">No pending flagged rounds.</p>}
          {pendingRounds.map(r => (
            <FlaggedRoundCard key={r.id} item={r} onApprove={() => updateRound(r.id, 'approved')} onIgnore={() => updateRound(r.id, 'ignored')} />
          ))}
          {resolvedRounds.length > 0 && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">Resolved</p>
              <div className="space-y-2">
                {resolvedRounds.map(r => (
                  <FlaggedRoundCard key={r.id} item={r} resolved />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="space-y-4">
          {pendingAccounts.length === 0 && <p className="text-center text-muted-foreground py-8">No pending flagged accounts.</p>}
          {pendingAccounts.map(a => (
            <FlaggedAccountCard key={a.id} item={a} onApprove={() => updateAccount(a.id, 'approved')} onIgnore={() => updateAccount(a.id, 'ignored')} />
          ))}
          {resolvedAccounts.length > 0 && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">Resolved</p>
              <div className="space-y-2">
                {resolvedAccounts.map(a => (
                  <FlaggedAccountCard key={a.id} item={a} resolved />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlaggedRoundCard({ item, onApprove, onIgnore, resolved }) {
  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-sm text-foreground">{item.user_email}</p>
          <p className="text-xs text-muted-foreground">{item.round_date}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          item.status === 'approved' ? 'bg-green-100 text-green-700' :
          item.status === 'ignored' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {item.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center bg-muted rounded-xl p-3">
        <div>
          <p className="text-lg font-black text-foreground">{item.logged_score}</p>
          <p className="text-xs text-muted-foreground">Logged</p>
        </div>
        <div>
          <p className="text-lg font-black text-foreground">{item.expected_score}</p>
          <p className="text-xs text-muted-foreground">Expected</p>
        </div>
        <div>
          <p className="text-lg font-black text-foreground">{item.handicap_at_time}</p>
          <p className="text-xs text-muted-foreground">HCP</p>
        </div>
      </div>
      <p className="text-xs text-destructive font-medium">
        {item.expected_score - item.logged_score} strokes better than expected
      </p>
      {!resolved && (
        <div className="flex gap-2">
          <button onClick={onApprove} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold text-sm active:scale-95 transition-all">
            <Check className="w-4 h-4" /> Approve
          </button>
          <button onClick={onIgnore} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-100 text-red-700 font-bold text-sm active:scale-95 transition-all">
            <X className="w-4 h-4" /> Ignore
          </button>
        </div>
      )}
    </div>
  );
}

function FlaggedAccountCard({ item, onApprove, onIgnore, resolved }) {
  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-sm text-foreground">{item.user_email}</p>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          item.status === 'approved' ? 'bg-green-100 text-green-700' :
          item.status === 'ignored' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {item.status}
        </span>
      </div>
      {item.matched_email && (
        <p className="text-xs text-muted-foreground">Matched with: <span className="font-semibold text-foreground">{item.matched_email}</span></p>
      )}
      {item.fingerprint_hash && (
        <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
          FP: {item.fingerprint_hash.substring(0, 16)}…
        </p>
      )}
      {item.flagged_at && (
        <p className="text-xs text-muted-foreground">Flagged: {new Date(item.flagged_at).toLocaleDateString()}</p>
      )}
      {!resolved && (
        <div className="flex gap-2">
          <button onClick={onApprove} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold text-sm active:scale-95 transition-all">
            <Check className="w-4 h-4" /> Approve
          </button>
          <button onClick={onIgnore} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-100 text-red-700 font-bold text-sm active:scale-95 transition-all">
            <X className="w-4 h-4" /> Ignore
          </button>
        </div>
      )}
    </div>
  );
}