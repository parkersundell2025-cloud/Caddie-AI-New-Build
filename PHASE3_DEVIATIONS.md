# Phase 3 (Anti-Cheat) — Deviations from the Scope of Work

This file records every place the Phase 3 build deviates from the anti-cheat
section (§3.1) of Parker's Scope of Work, why, and what would restore the
original intent. It is written to be pasted into a client email at delivery.
Parker pre-approved the substitutions marked ✅ (email, ~2026-07-27).

---

## 1. WhatsApp alerts → push notifications ✅

**Scope said:** "The existing Superagent system will automatically WhatsApp
Parker when new flagged sessions appear via Agent 17 or a new dedicated agent."

**What we built instead:** A push notification to designated admin devices
(via the app's existing APNs/FCM pipeline) the moment a session is flagged,
plus an in-app notification row. The admin review queue at `/admin/flagged`
is the source of truth regardless of alert delivery.

**Why:** Superagent watched the old Base44 database, which stopped receiving
data at the platform migration (May–June 2026). The current stack has no
WhatsApp integration.

**Restores original intent:** Parker re-points Superagent at the new
database (read access can be provisioned), or a Twilio WhatsApp integration
quoted as a separate item.

## 2. Score plausibility check → interim ratings-based anomaly check

**Scope said:** "If a user who has been consistently scoring below 50% on a
drill suddenly submits a perfect score of 100% that session is flagged as a
statistical anomaly for review."

**What we built instead:** An anomaly rule over the existing
Struggled/Okay/Good/Clicked ratings: a user whose rating history is
predominantly "Struggled" who submits an all-"Clicked" session gets flagged.
(Exact thresholds documented in the implementation notes below.)

**Why:** Percentage drill scores do not exist yet — they are created by
Phase 1.1 (Drill Scoring System), which is unpurchased and gated on Teagan's
annotated drill library. There are no numbers to compare.

**Restores original intent:** Phase 1.1 ships real scores; the literal
50%→100% rule drops into the same flagging plumbing with no schema changes.

## 3. Per-drill time validation → hybrid (guided mode full / quick-log session-level)

**Scope said:** "Every drill has a minimum time it physically takes to
complete … If a drill is completed in a time shorter than the physical
minimum it gets automatically flagged."

**What we built instead:** In the guided session mode (drill-by-drill flow),
each drill IS individually timed and checked, as written. In the quick-log
flow (all drills rated on one screen at the end), the app cannot observe
individual drill times, so the session's total duration is validated against
the sum of its drills' minimum times instead.

**Why:** The quick-log screen predates any per-drill structure; per-drill
timing there would require rebuilding the practice flow (that UI work
belongs to Phases 1.3/4.1).

**Restores original intent:** Phase 1.3/4.1 guided practice UI makes every
session per-drill timed.

## 4. Drill count: 70, confirmed

**Scope said:** "Jacob should calculate minimum times for all 70 drills."

**Reality:** Confirmed — the drill library contains exactly 70 drills, and
minimums are calculated for all 70 (coverage machine-verified). See
Appendix A. (An earlier working estimate of "89 drills" communicated to
Parker was a miscount on our side; the scope's number was correct.)

## 5. Session timing starts now — no retroactive checks

The app never recorded session duration before this phase (the database
stored only a date). Phase 3 adds the clock (server-side start stamp at
session start, duration computed at submit). Sessions logged before this
release have no timing data and cannot be retro-checked.

## 6. Elapsed time, not practice time (inherent limit, worth stating)

The duration checks measure elapsed wall-clock time between starting and
submitting a session. A determined cheater can start a session, wait, and
submit. This is inherent to any time-floor approach, including the scope's
own spec — the checks are friction that makes casual cheating inconvenient,
not proof of practice. The statistical checks (item 2) and admin review
exist for what slips through.

## 7. Leaderboard weighting: kept as-is (already round-heavy)

**Scope said:** "Round data should be weighted more heavily than practice
session data … The exact weighting should be discussed separately."

**Current state (unchanged by Phase 3):** A round earns 3 activity points
vs 1 per session, and the improvement component — 60% of the total
leaderboard score — is computed exclusively from round data. Phase 3 adds
the missing enforcement: sessions flagged as suspicious stop counting until
approved.

**Note for the weighting discussion:** the scope's rationale ("rounds have
geo location verification making them harder to fake") refers to Phase 2.2,
which is not yet green-lit — today rounds are protected by the
handicap-plausibility flag only. Increasing round weighting further would
increase the payoff of faking rounds, so we recommend keeping current
weights until 2.2 ships.

## 8. Existing device fingerprinting: untouched ✅

Per scope: "should continue operating as is. No changes needed." Verified
still operating post-migration (IP+UA matching inside updateLeaderboard).

---

## Appendix A — Drill minimum times

Minimum physical completion time per drill (70 drills), used by
sub-phase 3.2 to flag speed-run completions. Methodology:

1. **Reps parsed** from the drill's freeform `reps` text: sequential parts are summed ("15 swings… then 10" = 25); an explicit parenthesized total wins ("(15 total)" = 15); "X sets of Y" = X×Y; "N holes" = N; "per club/iron" (and "each side/direction/distance/stage") takes the single-unit minimum, conservatively; truly unparseable text falls back to 10 reps (noted below).
2. **Per-rep seconds** by category, deliberately low so only blatant speed-runs flag: Driving 10, Iron Play 10, Short Game 9, Putting 8, Golf Fitness 4, Course Management 15.
3. **Minimum minutes** = reps × (per-rep seconds + 5s required rest), rounded down to the nearest 0.5 minute, with an absolute floor of 2.0 minutes.

| Drill | Category | Reps parsed | Sec/rep | Min minutes | Notes |
|---|---|---|---|---|---|
| The Tempo Towel Drill | Driving | 25 | 10 | 6 |  |
| The Gate Drill — Driver | Driving | 20 | 10 | 5 |  |
| The Slow Motion Drill | Driving | 15 | 10 | 3.5 |  |
| The Tee Height Ladder | Driving | 15 | 10 | 3.5 |  |
| The Foot Together Drill | Driving | 15 | 10 | 3.5 |  |
| The Alignment Stick Path Drill | Driving | 20 | 10 | 5 |  |
| The Impact Bag Drill | Driving | 20 | 10 | 5 |  |
| The 3 Ball Progression | Driving | 15 | 10 | 3.5 |  |
| The L to L Drill | Driving | 20 | 10 | 5 | "then apply to driver" gives no count; counted the explicit 20 only |
| The Eyes Closed Drill | Driving | 10 | 10 | 2.5 |  |
| The Step Through Drill | Driving | 15 | 10 | 3.5 |  |
| The 9 Shot Shape Drill | Driving | 9 | 10 | 2 |  |
| The Speed Training Drill | Driving | 9 | 10 | 2 |  |
| The Divot Board Drill | Iron Play | 20 | 10 | 5 |  |
| The Pump Drill | Iron Play | 15 | 10 | 3.5 |  |
| The Yardage Marker Drill | Iron Play | 10 | 10 | 2.5 | "per iron"; single-club minimum |
| The Coin Drill | Iron Play | 20 | 10 | 5 |  |
| The Headcover Drill | Iron Play | 20 | 10 | 5 |  |
| The Ball Position Ladder | Iron Play | 15 | 10 | 3.5 |  |
| The Towel Under Lead Arm Drill | Iron Play | 20 | 10 | 5 |  |
| The Miss Drill | Iron Play | 10 | 10 | 2.5 | "each stage", stage count not in reps text; single-stage minimum |
| The Half Swing Compression Drill | Iron Play | 30 | 10 | 7.5 |  |
| The Knockdown Drill | Iron Play | 15 | 10 | 3.5 |  |
| The Random Club Drill | Iron Play | 15 | 10 | 3.5 |  |
| The One Handed Drill | Iron Play | 30 | 10 | 7.5 |  |
| The Par 3 Simulation Drill | Iron Play | 9 | 10 | 2 |  |
| The Landing Spot Drill | Short Game | 20 | 9 | 4.5 |  |
| The Bump and Run Drill | Short Game | 20 | 9 | 4.5 |  |
| The No Wristed Chip Drill | Short Game | 20 | 9 | 4.5 |  |
| The Fringe Ladder Drill | Short Game | 20 | 9 | 4.5 |  |
| The Bunker Line Drill | Short Game | 40 | 9 | 9 |  |
| The Towel Drill — Short Game | Short Game | 20 | 9 | 4.5 |  |
| The Clock Drill — Wedges | Short Game | 15 | 9 | 3.5 |  |
| The Flop Shot Progression | Short Game | 15 | 9 | 3.5 |  |
| The Up and Down Challenge | Short Game | 10 | 9 | 2 |  |
| The One Club Challenge | Short Game | 10 | 9 | 2 | duration-based ("30 minutes"), no rep count; 10-rep fallback |
| The Wet Towel Lie Drill | Short Game | 15 | 9 | 3.5 |  |
| The Spin Control Drill | Short Game | 20 | 9 | 4.5 |  |
| The Pressure Chip Off | Short Game | 10 | 9 | 2 | open-ended ("until you pass 3 consecutive stations"); 10-rep fallback |
| The Gate Drill — Putting | Putting | 30 | 8 | 6.5 |  |
| The Coin Putting Drill | Putting | 20 | 8 | 4 |  |
| The 3 Foot Circle Drill | Putting | 24 | 8 | 5 | 3 circles × 8 balls |
| The Metronome Drill | Putting | 20 | 8 | 4 | "at each distance"; single-distance minimum |
| The One Hand Putting Drill | Putting | 30 | 8 | 6.5 |  |
| The Pre-Round Routine Putt | Putting | 15 | 8 | 3 |  |
| The Eyes Closed Putting Drill | Putting | 20 | 8 | 4 |  |
| The Ladder Drill — Putting | Putting | 12 | 8 | 2.5 |  |
| The Gate and String Drill | Putting | 30 | 8 | 6.5 |  |
| The Breaking Putt Reading Drill | Putting | 20 | 8 | 4 |  |
| The 100 Putt Challenge | Putting | 100 | 8 | 21.5 |  |
| The Tee in Ground Drill | Putting | 30 | 8 | 6.5 |  |
| The Pressure 18 Hole Putting Round | Putting | 18 | 8 | 3.5 |  |
| The Hip 90-90 Stretch | Golf Fitness | 10 | 4 | 2 | duration-based ("2 minutes each side"); 10-rep fallback, 2.0 floor applied |
| The Thoracic Spine Rotation | Golf Fitness | 20 | 4 | 3 | "each direction"; single-direction minimum |
| The Glute Bridge | Golf Fitness | 45 | 4 | 6.5 |  |
| The Single Leg Balance Drill | Golf Fitness | 10 | 4 | 2 | duration-based ("30 seconds each leg, 3 rounds"); 10-rep fallback, 2.0 floor applied |
| The Wrist and Forearm Strengthening Routine | Golf Fitness | 3 | 4 | 2 | "3 rounds" of a circuit; counted as 3 reps, 2.0 floor applied |
| The Medicine Ball Rotation Throw | Golf Fitness | 30 | 4 | 4.5 | 3 × 10; "each side" → single-side minimum |
| The Pallof Press | Golf Fitness | 36 | 4 | 5 | 3 × 12; "each side" → single-side minimum |
| The Lateral Band Walk | Golf Fitness | 45 | 4 | 6.5 | 3 × 15; "each direction" → single-direction minimum |
| The Romanian Deadlift | Golf Fitness | 30 | 4 | 4.5 |  |
| The Cable or Band Wood Chop | Golf Fitness | 36 | 4 | 5 | 3 × 12; "each direction" → single-direction minimum |
| The Club Selection Audit | Course Management | 10 | 15 | 3 | "per club"; single-club minimum |
| The Layup Decision Drill | Course Management | 10 | 15 | 3 |  |
| The Pre-Shot Routine Builder | Course Management | 20 | 15 | 6.5 |  |
| The Trouble Shot Library | Course Management | 25 | 15 | 8 |  |
| The Wind Adjustment Drill | Course Management | 30 | 15 | 10 |  |
| The Miss Side Drill | Course Management | 10 | 15 | 3 | "per scenario"; single-scenario minimum |
| The Bogey Avoidance Drill | Course Management | 18 | 15 | 6 |  |
| The Par 18 Strategy Game | Course Management | 18 | 15 | 6 |  |
