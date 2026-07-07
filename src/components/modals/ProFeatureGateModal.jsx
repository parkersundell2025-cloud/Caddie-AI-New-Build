import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';

export default function ProFeatureGateModal({ visible, onDismiss, onRestoreSuccess }) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');

  const handleRestoreAccess = async () => {
    setRestoring(true);
    setError('');
    try {
      const user = await getCurrentUser();
      const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
      const profile = profiles[0];
      if (profile?.subscription_status === 'pro' || profile?.subscription_status === 'basic') {
        onRestoreSuccess(profile);
        onDismiss();
      } else {
        setError('No active subscription found for this account.');
      }
    } catch (err) {
      setError('Failed to restore access. Please try again.');
    }
    setRestoring(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-end"
          onClick={e => e.target === e.currentTarget && onDismiss()}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="bg-background rounded-t-3xl w-full max-w-lg mx-auto px-6 pt-6 space-y-5"
            style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 2rem)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-foreground">Feature Locked</h2>
              <button onClick={onDismiss} className="p-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              This feature requires an active subscription.
            </p>

            {error && (
              <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/30">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-border">
              <button
                onClick={handleRestoreAccess}
                disabled={restoring}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#a8d5a2', color: '#1a3d1a' }}
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {restoring ? 'Checking...' : 'Restore Access'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}