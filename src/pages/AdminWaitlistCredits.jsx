import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function AdminWaitlistCredits() {
  const navigate = useNavigate();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);

  useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      const user = await getCurrentUser();
      // Non-admins are bounced to /; RootRoute then sends them to the correct landing.
      if (user?.role !== 'admin') {
        navigate('/', { replace: true });
        return;
      }
      const records = await unwrap(supabase.from('waitlist_credit').select('*').order('date_applied', { ascending: false }).limit(100));
      setCredits(records);
    } catch (err) {
      console.error('Failed to load credits:', err);
    }
    setLoading(false);
  };

  const handleApplyCredit = async (creditId, email, amount, waitlistSignupDate) => {
    setApplyingId(creditId);
    try {
      // Call backend function to apply the credit
      const res = await supabase.functions.invoke('applyWaitlistCredit', {
        body: {
          creditId,
          user_email: email,
          credit_amount: amount,
          waitlist_signup_date: waitlistSignupDate,
        },
      });

      if (res.data?.success) {
        // Reload credits
        await loadCredits();
      } else {
        alert('Failed to apply credit: ' + (res.data?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error applying credit: ' + err.message);
    }
    setApplyingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // waitlist_credit.status CHECK constraint allows ('Applied','Failed') plus NULL.
  // NULL = never attempted (fresh credit, awaiting action); 'Failed' = attempt errored
  // and needs retry. Both need the Apply button. Surface them in distinct buckets so
  // admins can triage new work separately from retries.
  const pendingCredits = credits.filter(c => c.status == null);
  const failedCredits  = credits.filter(c => c.status === 'Failed');
  const appliedCredits = credits.filter(c => c.status === 'Applied');
  const openCount = pendingCredits.length + failedCredits.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/feedback')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Waitlist Credits</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-foreground">{credits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-green-600">{appliedCredits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Applied</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-black text-orange-600">{openCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Open</p>
          </div>
        </div>

        {/* Pending Credits — status IS NULL (never attempted) */}
        {pendingCredits.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-foreground">Pending Credits ({pendingCredits.length})</h2>
            {pendingCredits.map(credit => (
              <div key={credit.id} className="card-base p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{credit.user_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Credit: ${credit.credit_amount} | Waitlist: {format(new Date(credit.waitlist_signup_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                    Pending
                  </span>
                </div>
                <button
                  onClick={() => handleApplyCredit(credit.id, credit.user_email, credit.credit_amount, credit.waitlist_signup_date)}
                  disabled={applyingId === credit.id}
                  className="w-full py-2 rounded-xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {applyingId === credit.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  {applyingId === credit.id ? 'Applying...' : 'Apply Credit'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Failed Credits */}
        {failedCredits.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-foreground">Failed Credits ({failedCredits.length})</h2>
            {failedCredits.map(credit => (
              <div key={credit.id} className="card-base p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{credit.user_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Credit: ${credit.credit_amount} | Waitlist: {format(new Date(credit.waitlist_signup_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    Failed
                  </span>
                </div>
                <button
                  onClick={() => handleApplyCredit(credit.id, credit.user_email, credit.credit_amount, credit.waitlist_signup_date)}
                  disabled={applyingId === credit.id}
                  className="w-full py-2 rounded-xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {applyingId === credit.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  {applyingId === credit.id ? 'Applying...' : 'Apply Credit'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Applied Credits */}
        {appliedCredits.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-foreground">Applied Credits ({appliedCredits.length})</h2>
            {appliedCredits.map(credit => (
              <div key={credit.id} className="card-base p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{credit.user_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Credit: ${credit.credit_amount} | Applied: {format(new Date(credit.date_applied), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    Applied
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {credits.length === 0 && (
          <div className="card-base p-8 text-center">
            <p className="text-muted-foreground">No waitlist credits yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}