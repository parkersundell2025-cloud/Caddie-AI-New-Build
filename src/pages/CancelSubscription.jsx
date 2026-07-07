import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CancelSubscription() {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setCancelling(true);
    setError('');
    // supabase.functions.invoke returns { data, error } and does NOT throw on
    // non-2xx. Before this fix the try/catch never tripped, so a 404 from the
    // edge fn silently showed the success state — making users think they'd
    // cancelled when nothing happened.
    const { error: invErr } = await supabase.functions.invoke('cancelSubscription', { body: {} });
    setCancelling(false);
    if (invErr) {
      setError("We couldn't cancel right now. Please email support@caddieaiapp.com and we'll take care of it.");
      return;
    }
    setCancelled(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}>
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Cancel Subscription</h1>
        </div>
      </div>

      <div className="px-5 py-8 flex flex-col items-center justify-center flex-1 text-center space-y-6">
        {cancelled ? (
          <div className="space-y-4">
            <p className="text-2xl">✅</p>
            <p className="font-bold text-foreground">Subscription Cancelled</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your subscription has been cancelled. You will retain access until the end of your current billing period.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-3 rounded-2xl font-bold text-sm bg-muted text-foreground active:scale-95 transition-all"
            >
              Back to Settings
            </button>
          </div>
        ) : (
          <div className="space-y-6 w-full max-w-sm">
            <div className="space-y-2">
              <p className="font-bold text-foreground text-lg">Cancel your subscription?</p>
              <p className="text-sm text-muted-foreground">
                You will retain access until the end of your current billing period.
              </p>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-destructive/10 text-destructive active:scale-95 transition-all disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>

            <button
              onClick={() => navigate('/settings')}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-muted text-foreground active:scale-95 transition-all"
            >
              Keep Subscription
            </button>
          </div>
        )}
      </div>
    </div>
  );
}