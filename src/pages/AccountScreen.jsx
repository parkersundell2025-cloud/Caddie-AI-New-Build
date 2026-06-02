import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';

export default function AccountScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
      setProfile(profiles[0] || null);
      setLoading(false);
    };
    load();
  }, []);

  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    // supabase.functions.invoke returns { data, error } — it does NOT throw on
    // non-2xx. Before this fix a 404 from deleteAccount fell through to
    // signOut(), leaving the user locked out of an account that still existed
    // on the server. Check the error explicitly and abort sign-out on failure.
    const { error: invErr } = await supabase.functions.invoke('deleteAccount', { body: {} });
    if (invErr) {
      setDeleteError('Something went wrong deleting your account. Please try again.');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError('');
    setCancelSuccess('');
    // Same footgun as ManageSubscription/CancelSubscription — { data, error }
    // on non-2xx, doesn't throw. Reading res.data.message without that check
    // crashed with a JS NPE shown to the user.
    const { data, error } = await supabase.functions.invoke('cancelSubscription', { body: {} });
    setCancelling(false);
    if (error) {
      setCancelError("We couldn't cancel your subscription right now. Please email support@caddieaiapp.com and we'll take care of it.");
      return;
    }
    setCancelSuccess(data?.message || 'Your subscription has been cancelled.');
    setShowConfirm(false);
  };

  const subStatus = profile?.subscription_status || 'trial';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Manage Subscription</h1>
        </div>
      </div>

      {/* Account Info */}
      <div className="px-5 py-6">
        <div className="card-base p-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Your subscription is managed through your account. Sign out and sign back in to refresh your subscription status.</p>
        </div>
      </div>

      {/* Cancel + Delete — small text at bottom */}
      <div className="flex-1 flex flex-col items-center justify-end pb-10 pt-8 gap-4">
        {cancelSuccess && (
          <div className="mx-5 rounded-2xl p-4 bg-sage/10 border border-sage/30 text-center">
            <p className="text-sm text-foreground">{cancelSuccess}</p>
          </div>
        )}
        <button
          onClick={() => { setCancelError(''); setCancelSuccess(''); setShowConfirm(true); }}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Cancel Subscription
        </button>
        <button
          onClick={() => { setDeleteError(''); setShowDeleteConfirm(true); }}
          className="text-xs text-destructive hover:text-red-700 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-5">
          <div className="bg-background rounded-3xl p-6 w-full max-w-sm space-y-5">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-black text-foreground">Delete Account</h2>
              <p className="text-sm text-muted-foreground">Are you sure? This will permanently delete all your data including all rounds, sessions, progress and coaching history. Your subscription will be cancelled immediately and this cannot be undone.</p>
            </div>
            {deleteError && (
              <p className="text-xs text-destructive text-center">{deleteError}</p>
            )}
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
              style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
            >
              Keep Account
            </button>
            <div className="text-center">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="text-xs text-destructive hover:text-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-5">
          <div className="bg-background rounded-3xl p-6 w-full max-w-sm space-y-5">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-black text-foreground">Cancel Subscription</h2>
              <p className="text-sm text-muted-foreground">Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.</p>
            </div>
            {cancelError && (
              <p className="text-xs text-destructive text-center">{cancelError}</p>
            )}
            <button
              onClick={() => setShowConfirm(false)}
              className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
              style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
            >
              Keep Subscription
            </button>
            <div className="text-center">
              <button
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="text-xs text-destructive hover:text-red-700 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}