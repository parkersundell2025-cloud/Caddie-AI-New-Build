import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ChevronLeft } from 'lucide-react';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default function ManageSubscription() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

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
    setShowConfirm(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Subscription</h1>
        </div>
      </div>

      <div className="px-5 py-6 flex-1 space-y-6">
        <div className="card-base p-5 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your subscription is managed through your account. Sign out and sign back in to refresh your subscription status.
          </p>
        </div>

        {cancelSuccess && (
          <div className="rounded-2xl p-4 bg-sage/10 border border-sage/30 text-center">
            <p className="text-sm text-foreground">{cancelSuccess}</p>
          </div>
        )}

        {cancelError && (
          <p className="text-xs text-destructive text-center">{cancelError}</p>
        )}
      </div>

      {/* Cancel Subscription — required by Apple guideline 5.1.1 */}
      <div className="px-5 py-6 border-t border-border text-center">
        {isIOS ? (
          <a
            href="itms-apps://apps.apple.com/account/subscriptions"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage Subscription in iOS Settings
          </a>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showConfirm && (
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