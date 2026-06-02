import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export default function ReviewPopup({ onDismiss }) {
  const handleRate = () => {
    // Use native SKStoreReviewRequestAPI via the App Store — no external URL needed.
    // On web/PWA fallback, just dismiss (native app handles this via Capacitor/native bridge).
    if (window.webkit?.messageHandlers?.requestReview) {
      window.webkit.messageHandlers.requestReview.postMessage({});
    }
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-5"
      onClick={e => e.target === e.currentTarget && onDismiss()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-3xl w-full max-w-sm p-6 space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="flex justify-center gap-1 mb-3">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className="w-7 h-7 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <h3 className="text-xl font-black text-foreground">You've logged 3 rounds!</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enjoying Caddie AI? We'd love a quick rating — it helps us grow and keep improving.
          </p>
        </div>

        <button
          onClick={handleRate}
          className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all bg-foreground text-background"
        >
          Rate Caddie AI ⭐⭐⭐⭐⭐
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-2 text-sm text-muted-foreground"
        >
          Maybe Later
        </button>
      </motion.div>
    </motion.div>
  );
}