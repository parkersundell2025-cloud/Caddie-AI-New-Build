import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { getEffectiveDistances } from '@/lib/clubDistances';

export default function ExpandedDrillInstructions({ drillName, sessionType, club, reps }) {
  const navigate = useNavigate();
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadInstructions = async () => {
      try {
        const { getInstructions } = await import('@/lib/drillInstructions');
        // Load club distances for personalized instructions
        let clubDistances = null;
        try {
          const user = await getCurrentUser();
          const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
          if (profiles[0]) clubDistances = getEffectiveDistances(profiles[0]);
        } catch (e) { /* silently skip */ }
        const result = await getInstructions(drillName, sessionType, club, reps, clubDistances);
        if (result) {
          setInstructions(result);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadInstructions();
  }, [drillName, sessionType, club, reps]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="pt-3 pb-3 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
          <span className="text-white/40 text-xs">Loading instructions...</span>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="pt-3 pb-3 space-y-2">
          <p className="text-white/60 text-xs">Instructions coming soon — ask your Coach for guidance on this drill.</p>
          <button
            onClick={() => navigate('/coach')}
            className="text-sage text-xs font-semibold hover:underline"
          >
            Open Coach Chat →
          </button>
        </div>
      </motion.div>
    );
  }

  if (!instructions) return null;

  const Section = ({ label, content }) => (
    <div className="py-2.5 border-t border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">{label}</p>
      <p className="text-white/80 text-xs leading-relaxed">{content}</p>
    </div>
  );

  const StepList = ({ steps }) => (
    <div className="py-2.5 border-t border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{`How to do it`}</p>
      <ol className="space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="text-white/80 text-xs leading-relaxed">
            <span className="font-semibold">{i + 1}.</span> {step.replace(/^Step \d+:\s*/i, '')}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="pt-3 pb-2 space-y-0 bg-white/5 rounded-b-xl">
        <Section label="Setup" content={instructions.setup} />
        <StepList steps={instructions.steps} />
        <Section label="What to Feel" content={instructions.focus} />
        <Section label="Common Mistakes" content={instructions.mistakes} />
        <Section label="Why This Works" content={instructions.why} />
      </div>
    </motion.div>
  );
}