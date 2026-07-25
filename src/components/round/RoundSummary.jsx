import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { computeRunningStats, formatVsPar } from '@/lib/roundDraft';

export default function RoundSummary({ draft, onSaved, onEditHole }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [limitHit, setLimitHit] = useState(false);
  const s = computeRunningStats(draft);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('logRound', {
      body: {
        roundData: {
          course_name: draft.course_name,
          round_date: draft.round_date,
          notes: null,
        },
        holes: draft.holes,
      },
    });
    setSaving(false);
    if (invokeError) {
      setError("Couldn't save — check your connection and try again. Your round is safe on this device.");
      return;
    }
    if (data?.saved) {
      onSaved({ total_score: s.totalScore, course_name: draft.course_name });
    } else {
      setLimitHit(true);
    }
  };

  return (
    <div className="px-4 flex flex-col gap-3 pb-6">
      <div className="px-1">
        <div className="cut-eyebrow text-cut-gold">Round complete</div>
        <div className="cut-headline text-[30px] text-cut-ink mt-1.5">
          {draft.holes_planned} holes at <span className="italic text-cut-green">{draft.course_name}</span>.
        </div>
      </div>

      <div className="cut-glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="cut-eyebrow text-cut-ink-mute">Final score</div>
          <div className="cut-mono text-xs font-bold text-cut-green">{formatVsPar(s.vsPar)}</div>
        </div>
        <div className="cut-headline text-[52px] text-cut-ink mt-1" data-testid="final-score">{s.totalScore}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Fairways', v: s.fairwaysEligible ? `${s.fairwaysHit}/${s.fairwaysEligible}` : '–' },
          { l: 'GIR', v: s.girSet ? `${s.girHit}/${s.girSet}` : '–' },
          { l: 'Putts', v: s.puttsSet ? s.totalPutts : '–' },
        ].map((c) => (
          <div key={c.l} className="cut-glass rounded-2xl p-3.5">
            <div className="cut-eyebrow text-cut-ink-mute">{c.l}</div>
            <div className="cut-mono text-2xl font-bold text-cut-ink mt-1.5 tracking-tight">{c.v}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="cut-glass rounded-2xl p-3.5 border border-red-500/30">
          <p className="text-[13px] text-red-400">{error}</p>
        </div>
      )}
      {limitHit && (
        <div className="cut-glass rounded-2xl p-3.5 border border-cut-gold/30">
          <p className="text-[13px] text-cut-ink-soft">
            Round limit reached for now — this one wasn't saved. Your entries are
            kept on this device, so you can try again tomorrow or discard.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-[54px] rounded-2xl bg-cut-green text-cut-bg text-[15px] font-bold shadow-[0_0_24px_rgba(95,190,126,.30)] disabled:opacity-60"
      >
        {saving ? 'Saving…' : error || limitHit ? 'Try again' : 'Save round'}
      </button>
      <button
        type="button"
        onClick={() => onEditHole(draft.holes_planned)}
        className="w-full py-2 text-[12px] text-cut-ink-mute"
      >
        Back to edit holes
      </button>
    </div>
  );
}
