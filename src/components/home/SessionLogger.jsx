import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const RATINGS = [
  { label: 'Struggled', emoji: '😤', value: 'Struggled', color: 'border-red-300 bg-red-50 text-red-700' },
  { label: 'Okay', emoji: '😐', value: 'Okay', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
  { label: 'Good', emoji: '🙂', value: 'Good', color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { label: 'Clicked', emoji: '🔥', value: 'Clicked', color: 'border-green-300 bg-green-50 text-green-700' },
];

const RATING_ACTIVE = {
  Struggled: 'border-red-400 bg-red-100 text-red-800 ring-2 ring-red-300',
  Okay: 'border-yellow-400 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-300',
  Good: 'border-blue-400 bg-blue-100 text-blue-800 ring-2 ring-blue-300',
  Clicked: 'border-green-400 bg-green-100 text-green-800 ring-2 ring-green-300',
};

export default function SessionLogger({ session, onClose, onSubmit }) {
  const drills = session?.drills || [];
  const [ratings, setRatings] = useState({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setRating = (drillName, rating) => {
    setRatings(prev => ({ ...prev, [drillName]: rating }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit({ ratings, note });
    setSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end overflow-hidden"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26 }}
        className="bg-background rounded-t-3xl w-full max-w-lg mx-auto flex flex-col"
        style={{ height: '80vh' }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <h3 className="text-xl font-black text-foreground">Log Session</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{session?.session_type} · {session?.duration || 45} min</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
          {/* Drills */}
          <div className="space-y-5">
            {drills.map((drill, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{drill.name}</p>
                {drill.reps && <p className="text-xs text-muted-foreground">{drill.reps}</p>}
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map(r => {
                    const isActive = ratings[drill.name] === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => setRating(drill.name, r.value)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${isActive ? RATING_ACTIVE[r.value] : 'border-border bg-muted text-muted-foreground'}`}
                      >
                        <span className="text-base">{r.emoji}</span>
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              How did today feel? Any notes for your coach?
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional — a few sentences is perfect."
              className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border resize-none h-24"
            />
          </div>

          {/* Submit Button — inside scroll so it's always reachable */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full btn-primary py-4 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : '✓ Submit Session'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}