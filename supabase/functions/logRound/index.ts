import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser, invokeFunction } from '../_shared/supabase.ts';

interface HoleEntry {
  hole_number: number;
  par: number;
  score: number;
  fairway: string | null;
  gir: boolean | null;
  putts: number | null;
  logged_at: string | null;
}

const FAIRWAY_VALUES = ['hit', 'miss_left', 'miss_right', 'na'];

// Aggregates on the round row stay the source of truth for every existing
// consumer — client-sent totals are ignored when holes are present.
function validateHoles(holes: unknown): string | null {
  if (!Array.isArray(holes)) return 'holes must be an array';
  if (holes.length !== 9 && holes.length !== 18) return 'holes must contain 9 or 18 entries';
  const seen = new Set<number>();
  for (const h of holes as HoleEntry[]) {
    if (!Number.isInteger(h.hole_number) || h.hole_number < 1 || h.hole_number > holes.length) return 'invalid hole_number';
    if (seen.has(h.hole_number)) return 'duplicate hole_number';
    seen.add(h.hole_number);
    if (![3, 4, 5].includes(h.par)) return 'invalid par';
    if (!Number.isInteger(h.score) || h.score < 1 || h.score > 15) return 'invalid score';
    if (h.fairway != null && !FAIRWAY_VALUES.includes(h.fairway)) return 'invalid fairway';
    if (h.gir != null && typeof h.gir !== 'boolean') return 'invalid gir';
    if (h.putts != null && (!Number.isInteger(h.putts) || h.putts < 1 || h.putts > 4)) return 'invalid putts';
    if (h.logged_at != null && isNaN(Date.parse(h.logged_at))) return 'invalid logged_at';
  }
  return null;
}

function aggregatesFromHoles(holes: HoleEntry[]) {
  const girSet = holes.filter((h) => h.gir != null);
  const puttsSet = holes.filter((h) => h.putts != null);
  // 'na' (par 3s) and unanswered holes are excluded from the denominator
  const fairwayEligible = holes.filter((h) => h.fairway != null && h.fairway !== 'na');
  return {
    total_score: holes.reduce((a, h) => a + h.score, 0),
    greens_in_regulation: girSet.length ? holes.filter((h) => h.gir === true).length : null,
    fairways_hit: fairwayEligible.length ? holes.filter((h) => h.fairway === 'hit').length : null,
    fairways_available: fairwayEligible.length ? fairwayEligible.length : null,
    total_putts: puttsSet.length ? puttsSet.reduce((a, h) => a + (h.putts as number), 0) : null,
    scrambling_saves: null,
    scrambling_attempts: null,
    holes_played: holes.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { roundData: clientRoundData, holes } = await req.json();
    const tracked = Array.isArray(holes) && holes.length > 0;

    let roundData = clientRoundData;
    if (tracked) {
      const invalid = validateHoles(holes);
      if (invalid) return json({ error: invalid }, 400);
      roundData = {
        course_name: clientRoundData?.course_name ?? null,
        round_date: clientRoundData?.round_date,
        notes: clientRoundData?.notes ?? null,
        ...aggregatesFromHoles(holes as HoleEntry[]),
      };
    }

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email);
    const profile = profiles?.[0];

    const todayStr = roundData.round_date; // client sends today's local date
    const monthStart = todayStr.substring(0, 7) + '-01';

    const { data: allRoundsData } = await db.from('round').select('*').eq('user_email', user.email);
    const allRounds = allRoundsData || [];

    // RULE 1a: Max 36 holes per day (silent ignore). Counts HOLES, not rounds,
    // so nine-hole players aren't capped at 18 holes/day — a friend's legit
    // second nine was being blocked (Parker report, 2026-08). 36 = "two rounds
    // of 18" a day, the intended limit. Legacy null holes_played = 18.
    const holesOf = (r: { holes_played?: number | null }) => (r.holes_played === 9 ? 9 : 18);
    const thisRoundHoles = tracked ? holes.length : (roundData.holes_played === 9 ? 9 : 18);
    const holesToday = allRounds
      .filter((r) => r.round_date === todayStr)
      .reduce((sum, r) => sum + holesOf(r), 0);
    if (holesToday + thisRoundHoles > 36) {
      return json({ success: true, saved: false });
    }
    // RULE 1b: Max 60 rounds per month
    if (allRounds.filter((r) => r.round_date >= monthStart && r.round_date <= todayStr).length >= 60) {
      return json({ success: true, saved: false });
    }

    const { data: saved } = await db.from('round').insert({ ...roundData, user_email: user.email }).select('id').single();

    if (tracked && saved?.id) {
      const holeRows = (holes as HoleEntry[]).map((h) => ({
        user_email: user.email,
        round_id: saved.id,
        hole_number: h.hole_number,
        par: h.par,
        score: h.score,
        fairway: h.fairway ?? null,
        gir: h.gir ?? null,
        putts: h.putts ?? null,
        logged_at: h.logged_at ?? null,
      }));
      const { error: holeError } = await db.from('round_hole').insert(holeRows);
      if (holeError) {
        // Roll back the round so the client's retained draft can retry cleanly
        await db.from('round').delete().eq('id', saved.id);
        return json({ error: holeError.message }, 500);
      }
    }

    // RULE 3: Flag suspicious scores (>10 strokes better than expected).
    // 18-hole math — 9-hole rounds would always look ~40 under and false-flag.
    const currentHandicap = profile?.current_handicap ?? 36;
    const expectedScore = 72 + currentHandicap;
    const loggedScore = roundData.total_score;
    if (roundData.holes_played !== 9 && loggedScore != null && expectedScore - loggedScore > 10) {
      await db.from('flagged_round').insert({
        user_email: user.email,
        round_id: saved?.id,
        round_date: roundData.round_date,
        logged_score: loggedScore,
        expected_score: expectedScore,
        handicap_at_time: currentHandicap,
        status: 'pending',
      });
    }

    // Background: handicap update, badge check, leaderboard update.
    // (Base44 also invoked the nonexistent 'recalculateSkills' — dropped.)
    invokeFunction('updateHandicap', req).catch(() => {});
    invokeFunction('checkBadges', req).catch(() => {});
    invokeFunction('updateLeaderboard', req).catch(() => {});

    return json({ success: true, saved: true, roundId: saved?.id });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
