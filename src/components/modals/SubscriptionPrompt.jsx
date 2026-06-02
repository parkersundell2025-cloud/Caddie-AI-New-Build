import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function SubscriptionPrompt({ visible, onDismiss }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto p-6 space-y-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-foreground">Subscription Required</h2>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          This feature requires an active subscription. Please sign in with an account that has an active subscription to access this feature.
        </p>

        <button onClick={onDismiss} className="w-full btn-primary py-4">
          Got It
        </button>
      </motion.div>
    </motion.div>
  );
}