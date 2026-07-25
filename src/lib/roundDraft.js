// In-progress round draft. Lives in localStorage only — a round spans hours
// with the app backgrounded and patchy on-course connectivity, so nothing is
// written to the DB until the single logRound submit at the end.
const KEY = 'caddie_round_draft_v1';

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || !Array.isArray(draft.holes)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch { /* storage unavailable — draft survives in memory only */ }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function createDraft(courseName, holesPlanned) {
  const now = new Date();
  return {
    version: 1,
    course_name: courseName,
    holes_planned: holesPlanned,
    round_date: now.toISOString().split('T')[0],
    started_at: now.toISOString(),
    current_hole: 1,
    holes: Array.from({ length: holesPlanned }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      score: 4,
      fairway: null,
      gir: null,
      putts: null,
      logged_at: null,
    })),
  };
}

// Shared by the running-stats view and the summary so what the golfer sees
// matches the aggregates logRound recomputes server-side.
export function computeRunningStats(draft) {
  const logged = draft.holes.filter((h) => h.logged_at != null);
  const fairwayEligible = logged.filter((h) => h.fairway != null && h.fairway !== 'na');
  const girSet = logged.filter((h) => h.gir != null);
  const puttsSet = logged.filter((h) => h.putts != null);
  const totalScore = logged.reduce((a, h) => a + h.score, 0);
  const totalPar = logged.reduce((a, h) => a + h.par, 0);
  return {
    loggedCount: logged.length,
    fairwaysHit: fairwayEligible.filter((h) => h.fairway === 'hit').length,
    fairwaysEligible: fairwayEligible.length,
    girHit: girSet.filter((h) => h.gir === true).length,
    girSet: girSet.length,
    totalPutts: puttsSet.reduce((a, h) => a + h.putts, 0),
    puttsSet: puttsSet.length,
    totalScore,
    vsPar: totalScore - totalPar,
    loggedHoles: logged,
  };
}

export function formatVsPar(vsPar) {
  if (vsPar === 0) return 'E';
  return vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
}
