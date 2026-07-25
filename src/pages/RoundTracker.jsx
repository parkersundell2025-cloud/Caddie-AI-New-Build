import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BarChart3 } from 'lucide-react';
import { loadDraft, saveDraft, clearDraft, createDraft, computeRunningStats } from '@/lib/roundDraft';
import { ensureReminderPermission, clearRoundReminder } from '@/lib/roundReminder';
import RoundSetup from '@/components/round/RoundSetup';
import HoleStrip from '@/components/round/HoleStrip';
import HoleEntry from '@/components/round/HoleEntry';
import RoundStats from '@/components/round/RoundStats';
import RoundSummary from '@/components/round/RoundSummary';

export default function RoundTracker() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => loadDraft());
  const [phase, setPhase] = useState(() => (loadDraft() ? 'hole' : 'setup'));
  const [showExitSheet, setShowExitSheet] = useState(false);

  // Page lives outside AppLayout (no bottom nav), so it owns the Cut theme
  useEffect(() => {
    document.documentElement.classList.add('theme-cut');
    return () => document.documentElement.classList.remove('theme-cut');
  }, []);

  const updateDraft = (fn) => {
    setDraft((prev) => {
      const next = fn(prev);
      saveDraft(next);
      return next;
    });
  };

  const handleStart = (courseName, holes) => {
    const fresh = createDraft(courseName, holes);
    saveDraft(fresh);
    setDraft(fresh);
    setPhase('hole');
    // Ask now — the one moment "remind me to log each hole" is self-evident
    ensureReminderPermission();
  };

  const handleHoleChange = (patch) => {
    updateDraft((prev) => ({
      ...prev,
      holes: prev.holes.map((h) => (h.hole_number === prev.current_hole ? { ...h, ...patch } : h)),
    }));
  };

  const handleNext = () => {
    const holes = draft.holes.map((h) =>
      // First completion stamps the tap time; re-edits keep the original
      // stamp (Phase 3 time-plausibility wants the real walk cadence)
      h.hole_number === draft.current_hole && h.logged_at == null
        ? { ...h, logged_at: new Date().toISOString() }
        : h,
    );
    const nextUnlogged = holes.find((h) => h.logged_at == null);
    const next = { ...draft, holes, current_hole: nextUnlogged ? nextUnlogged.hole_number : draft.current_hole };
    saveDraft(next);
    setDraft(next);
    setPhase(nextUnlogged ? 'hole' : 'summary');
  };

  const handleSelectHole = (holeNumber) => {
    updateDraft((prev) => ({ ...prev, current_hole: holeNumber }));
    setPhase('hole');
  };

  const handleDiscard = () => {
    clearDraft();
    clearRoundReminder();
    navigate('/progress');
  };

  const handleSaved = (celebrateRound) => {
    clearDraft();
    clearRoundReminder();
    navigate('/progress', { state: { celebrateRound } });
  };

  const currentHole = draft?.holes.find((h) => h.hole_number === draft.current_hole);
  const loggedCount = draft ? computeRunningStats(draft).loggedCount : 0;

  return (
    <div
      className="min-h-screen bg-cut-bg cut-ground flex flex-col"
      style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (draft && phase !== 'setup' ? setShowExitSheet(true) : navigate('/progress'))}
          className="w-[34px] h-[34px] rounded-full bg-cut-card-solid border border-white/10 flex items-center justify-center text-cut-ink-soft"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="cut-eyebrow text-cut-ink-mute truncate max-w-[55%]">
          {draft ? draft.course_name : 'Track a round'}
        </div>
        {draft && phase !== 'setup' && phase !== 'summary' ? (
          <button
            type="button"
            aria-label="Round stats"
            onClick={() => setPhase(phase === 'stats' ? 'hole' : 'stats')}
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border ${
              phase === 'stats'
                ? 'bg-cut-green text-cut-bg border-transparent'
                : 'bg-cut-card-solid border-white/10 text-cut-ink-soft'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-[34px]" />
        )}
      </div>

      {draft && phase !== 'setup' && phase !== 'summary' && (
        <div className="pb-2">
          <HoleStrip holes={draft.holes} activeHole={draft.current_hole} onSelect={handleSelectHole} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pt-1 pb-[max(16px,env(safe-area-inset-bottom))]">
        {phase === 'setup' && <RoundSetup onStart={handleStart} />}
        {phase === 'hole' && currentHole && (
          <HoleEntry
            hole={currentHole}
            loggedCount={loggedCount}
            holesPlanned={draft.holes_planned}
            onChange={handleHoleChange}
            onNext={handleNext}
            isLast={loggedCount >= draft.holes_planned - 1 && currentHole.logged_at == null}
          />
        )}
        {phase === 'stats' && draft && (
          <RoundStats draft={draft} onContinue={() => setPhase('hole')} onDiscard={handleDiscard} />
        )}
        {phase === 'summary' && draft && (
          <RoundSummary draft={draft} onSaved={handleSaved} onEditHole={handleSelectHole} />
        )}
      </div>

      {showExitSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowExitSheet(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full bg-cut-card-solid rounded-t-3xl p-5 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cut-headline text-xl text-cut-ink mb-1">Leave this round?</div>
            <p className="text-[13px] text-cut-ink-mute -mt-1 mb-2">
              Your entries stay on this device — resume anytime from Progress.
            </p>
            <button
              type="button"
              onClick={() => setShowExitSheet(false)}
              className="w-full h-12 rounded-xl bg-cut-green text-cut-bg text-sm font-bold"
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              className="w-full h-12 rounded-xl bg-cut-bg border border-white/10 text-cut-ink text-sm font-semibold"
            >
              Leave — resume later
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="w-full py-2.5 text-[12px] text-red-400"
            >
              Discard round
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
