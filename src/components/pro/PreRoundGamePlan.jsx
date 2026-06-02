import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, X, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ProBadge from '@/components/badges/ProBadge';

export default function PreRoundGamePlan({ onDismiss, onProceed }) {
  const [gamePlan, setGamePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { generate(); }, []);

  const generate = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke('generatePreRoundGamePlan', { body: {} }).catch(() => null);
    setGamePlan(res?.data?.game_plan || null);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl overflow-hidden mb-4"
      style={{ backgroundColor: '#1a2e1a' }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center text-sm flex-shrink-0">
              🏌️
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#a8d5a2' }}>
              Pre-Round Game Plan
            </p>
            <ProBadge />
          </div>
          <button onClick={onDismiss} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white/60" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-white/60" />
            <p className="text-white/60 text-sm">Your coach is setting you up...</p>
          </div>
        ) : gamePlan ? (
          <p className="text-white/90 text-sm leading-relaxed select-text">{gamePlan}</p>
        ) : (
          <p className="text-white/60 text-sm">Couldn't load your game plan right now. Go play well.</p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onProceed}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-center transition-all active:scale-95"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            Log Round →
          </button>
          <button
            onClick={() => navigate('/coach')}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <MessageCircle className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}