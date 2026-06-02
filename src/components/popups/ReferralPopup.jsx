import React from 'react';
import { motion } from 'framer-motion';
import { Gift, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReferralPopup({ onDismiss }) {
  const navigate = useNavigate();

  const handleSeeLink = () => {
    onDismiss();
    navigate('/referral');
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
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#a8d5a2' }}>
            <Gift className="w-6 h-6" style={{ color: '#1a2e1a' }} />
          </div>
          <button onClick={onDismiss} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-black text-foreground leading-tight">Share Caddie AI</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Know a golfer who wants to improve? Share your referral link — when they join, you earn a free month.
            <span className="font-semibold text-foreground"> No limit on how many you can earn.</span>
          </p>
        </div>

        <button
          onClick={handleSeeLink}
          className="w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
          style={{ backgroundColor: '#1a2e1a', color: 'white' }}
        >
          See My Referral Link
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