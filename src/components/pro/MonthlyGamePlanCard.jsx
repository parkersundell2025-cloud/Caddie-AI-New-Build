import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X, RefreshCw, Calendar, Loader2 } from 'lucide-react';
import ProBadge from '@/components/badges/ProBadge';

function MonthlyGamePlanModal({ plan, onClose, onRegenerate, regenerating }) {
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Monthly Game Plan</p>
            <h3 className="text-xl font-black text-foreground">{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${regenerating ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-5">
          {regenerating ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Generating your game plan...</p>
              </div>
            </div>
          ) : plan ? (
            <>
              <Section label="This Month's Focus" text={plan.monthly_focus} accent />
              <Section label="Why This Month" text={plan.why_this_month} />
              <Section label="What Success Looks Like" text={plan.success_looks_like} />
              <Section label="Practice Emphasis" text={plan.practice_emphasis} />
              <div className="card-base p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Drill to Master</p>
                <p className="text-sm font-bold text-foreground">{plan.key_drill}</p>
              </div>
              <div className="rounded-2xl p-4 space-y-1" style={{ backgroundColor: '#1a2e1a' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5FBE7E' }}>Coach's Note</p>
                <p className="text-white/90 text-sm leading-relaxed select-text">{plan.coachs_note}</p>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ label, text, accent }) {
  return (
    <div className={`rounded-2xl p-4 space-y-1.5 ${accent ? 'bg-muted' : 'card-base'}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground leading-relaxed select-text">{text}</p>
    </div>
  );
}

export default function MonthlyGamePlanCard({ userEmail }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { loadPlan(); }, [userEmail]);

  const loadPlan = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke('generateMonthlyGamePlan', { body: {} }).catch(() => null);
    if (res?.data?.plan) setPlan(res.data.plan);
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const res = await supabase.functions.invoke('generateMonthlyGamePlan', { body: { force: true } }).catch(() => null);
    if (res?.data?.plan) setPlan(res.data.plan);
    setRegenerating(false);
  };

  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.99] transition-all"
        style={{ backgroundColor: '#1a2e1a' }}
      >
        <div className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" style={{ color: '#5FBE7E' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5FBE7E' }}>
                This Month's Game Plan
              </p>
              <ProBadge />
            </div>
            <p className="text-white font-black text-lg" style={{ letterSpacing: '-0.5px' }}>{monthLabel}</p>
            {loading ? (
              <p className="text-white/50 text-xs">Loading your plan...</p>
            ) : plan ? (
              <p className="text-white/70 text-sm leading-snug line-clamp-2">{plan.monthly_focus}</p>
            ) : (
              <p className="text-white/50 text-xs">Tap to generate your monthly strategy</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: '#5FBE7E' }} />
        </div>
      </button>

      <AnimatePresence>
        {showModal && (
          <MonthlyGamePlanModal
            plan={plan}
            onClose={() => setShowModal(false)}
            onRegenerate={handleRegenerate}
            regenerating={regenerating}
          />
        )}
      </AnimatePresence>
    </>
  );
}