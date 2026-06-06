import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { ChevronLeft } from 'lucide-react';

// Single consolidated page for subscription management + account deletion.
// Was previously split across /account (AccountScreen.jsx) and
// /manage-subscription (ManageSubscription.jsx); /account is removed.
//
// Cancel Subscription branches on user_profile.subscription_source so the
// surface matches the store the sub came from — Apple Guideline 5.1.1
// requires Apple IAP subs to be cancelled in iOS Settings, not via an in-app
// button. Stripe / promotional / unknown sources keep the in-app cancel flow.
export default function ManageSubscription() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  // Cancel subscription state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
      setProfile(profiles[0] || null);
    };
    load();
  }, []);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError('');
    setCancelSuccess('');
    // supabase.functions.invoke returns { data, error } and does NOT throw on
    // non-2xx — so checking `error` first is required. Accessing data.message
    // without that check crashes with a JS NPE when the function 404s.
    const { data, error } = await supabase.functions.invoke('cancelSubscription', { body: {} });
    setCancelling(false);
    if (error) {
      setCancelError("We couldn't cancel your subscription right now. Please email support@caddieaiapp.com and we'll take care of it.");
      return;
    }
    setCancelSuccess(data?.message || 'Your subscription has been cancelled.');
    setShowCancelConfirm(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    // Same { data, error } footgun — a 404 from deleteAccount fell through
    // to signOut() in earlier versions, leaving users locked out of accounts
    // that still existed server-side. Check error explicitly before signing out.
    const { error: invErr } = await supabase.functions.invoke('deleteAccount', { body: {} });
    if (invErr) {
      setDeleteError('Something went wrong deleting your account. Please try again.');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
  };

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

      {/* Cancel success + error messages */}
      <div className="px-5 py-6 space-y-4">
        {cancelSuccess && (
          <div className="rounded-2xl p-4 bg-sage/10 border border-sage/30 text-center">
            <p className="text-sm text-foreground">{cancelSuccess}</p>
          </div>
        )}
        {cancelError && !showCancelConfirm && (
          <p className="text-xs text-destructive text-center">{cancelError}</p>
        )}
      </div>

      {/* Actions — pushed toward bottom of viewport */}
      <div className="flex-1 flex flex-col items-center justify-end pb-10 pt-8 gap-4">
        {(() => {
          const src = profile?.subscription_source;
          if (src === 'app_store' || src === 'mac_app_store') {
            return (
              <a
                href="itms-apps://apps.apple.com/account/subscriptions"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Manage Subscription in iOS Settings
              </a>
            );
          }
          if (src === 'play_store') {
            return (
              <a
                href="https://play.google.com/store/account/subscriptions"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Manage Subscription in Google Play
              </a>
            );
          }
          return (
            <button
              onClick={() => { setCancelError(''); setCancelSuccess(''); setShowCancelConfirm(true); }}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Cancel Subscription
            </button>
          );
        })()}
        <button
          onClick={() => { setDeleteError(''); setShowDeleteConfirm(true); }}
          className="text-xs text-destructive hover:text-red-700 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {/* Cancel Subscription Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-5">
          <div className="bg-background rounded-3xl p-6 w-full max-w-sm space-y-5">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-black text-foreground">Cancel Subscription</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.
              </p>
            </div>
            {cancelError && (
              <p className="text-xs text-destructive text-center">{cancelError}</p>
            )}
            <button
              onClick={() => setShowCancelConfirm(false)}
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
    </div>
  );
}
