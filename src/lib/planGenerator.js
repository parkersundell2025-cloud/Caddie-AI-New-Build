/**
 * Shared plan generation logic used by both MyPlan and Profile pages.
 * Handles drill history, mastery detection, and prompt construction.
 */

import { DRILL_LIBRARY } from '@/lib/drillLibrary';
import { parseDateLocal } from '@/lib/dateUtils';

const DIFFICULTY_ORDER = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * Given recent drill ratings (last 14 days), compute per-skill-area mastery level.
 * Returns an object like: { Driving: 'Intermediate', 'Iron Play': 'Beginner', ... }
 * "Mastery" of a level = 2+ Clicked ratings on drills of that difficulty in that area within 14 days.
 */
export function computeSkillMastery(drillRatings) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const mastery = {};

  for (const [area, drills] of Object.entries(DRILL_LIBRARY)) {
    // For each difficulty level, count recent Clicked ratings
    for (const difficulty of DIFFICULTY_ORDER) {
      const drillNamesAtLevel = drills.filter(d => d.difficulty === difficulty).map(d => d.name);
      const clickedCount = drillRatings.filter(r => {
        if (!drillNamesAtLevel.includes(r.drill_name) || r.rating !== 'Clicked') return false;
        const d = parseDateLocal(r.session_date);
        return d && d >= cutoff;
      }).length;

      if (clickedCount >= 2) {
        // User has mastered this level — set mastery to next level up
        const nextIdx = DIFFICULTY_ORDER.indexOf(difficulty) + 1;
        if (nextIdx < DIFFICULTY_ORDER.length) {
          mastery[area] = DIFFICULTY_ORDER[nextIdx];
        }
      }
    }
  }

  return mastery;
}

/**
 * Get the list of drill names done in the last 7 days from drill ratings.
 */
export function getRecentDrillNames(drillRatings) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return [...new Set(
    drillRatings
      .filter(r => {
        const d = parseDateLocal(r.session_date);
        return d && d >= cutoff;
      })
      .map(r => r.drill_name)
  )];
}

/**
 * Build the full LLM prompt for plan generation.
 * Incorporates drill history (Fix 1), mastery levels (Fix 2), and Course Management (Fix 3).
 */
export function buildPlanPrompt({ profile, drillRatings = [] }) {
  const durationMap = { short: 30, medium: 45, long: 60 };
  const sessionDuration = durationMap[profile.intensity_preference || 'medium'];
  const drillsPerSession = sessionDuration <= 30 ? '2-3' : sessionDuration === 45 ? '3-4' : '4-5';

  const recentDrills = getRecentDrillNames(drillRatings);
  const masteryLevels = computeSkillMastery(drillRatings);

  const masteryLines = Object.entries(masteryLevels).map(([area, level]) =>
    `  * ${area}: Demonstrated mastery of ${DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(level) - 1]} level — prioritize ${level} drills`
  ).join('\n');

  const recentDrillsLine = recentDrills.length > 0
    ? `DRILLS DONE IN THE LAST 7 DAYS (avoid repeating these unless no alternatives exist at the right difficulty):\n${recentDrills.map(d => `  - ${d}`).join('\n')}`
    : 'DRILLS DONE IN THE LAST 7 DAYS: None — all drills are available.';

  return `You are the Caddie AI golf coach. Generate a personalized weekly practice plan using ONLY drills from the proprietary Caddie AI Drill Library below. You must NEVER invent or use drills outside this list.

GOLFER PROFILE:
- Current handicap: ${profile.current_handicap === 0 ? 'Scratch (0)' : profile.current_handicap} | Goal: ${profile.goal_handicap} in ${profile.target_timeline}
- Available days: ${(profile.preferred_days || []).join(', ')}
- Practice days per week: ${profile.days_per_week}
- Session length: ${sessionDuration} minutes
- Skill ratings (1=Biggest weakness, 5=Best weapon):
  * Driving: ${profile.skill_driving}/5
  * Iron Play: ${profile.skill_iron_play}/5
  * Short Game: ${profile.skill_short_game}/5
  * Putting: ${profile.skill_putting}/5
  * Course Management: ${profile.skill_course_management}/5

${recentDrillsLine}

DEMONSTRATED MASTERY (based on recent Clicked ratings — use next difficulty level up for these areas):
${masteryLines || '  None yet — use skill ratings to determine difficulty as normal.'}

=== CADDIE AI PROPRIETARY DRILL LIBRARY ===

DRIVING DRILLS:
1. The Tempo Towel Drill | reps: "15 swings with 7 iron, then 10 with driver" | difficulty: Beginner
2. The Gate Drill — Driver | reps: "20 balls" | difficulty: Beginner
3. The Slow Motion Drill | reps: "10 slow motion swings then 5 at full speed" | difficulty: Beginner
4. The Tee Height Ladder | reps: "15 balls total (5 low, 5 medium, 5 high tee)" | difficulty: Beginner
5. The Foot Together Drill | reps: "15 balls" | difficulty: Beginner
6. The Alignment Stick Path Drill | reps: "20 balls" | difficulty: Intermediate
7. The Impact Bag Drill | reps: "20 strikes" | difficulty: Intermediate
8. The 3 Ball Progression | reps: "5 sets of 3 balls (15 total)" | difficulty: Intermediate
9. The L to L Drill | reps: "20 swings with 7 iron then apply to driver" | difficulty: Intermediate
10. The Eyes Closed Drill | reps: "10 swings" | difficulty: Intermediate
11. The Step Through Drill | reps: "15 balls" | difficulty: Intermediate
12. The 9 Shot Shape Drill | reps: "9 balls (3 draws, 3 straight, 3 fades)" | difficulty: Advanced
13. The Speed Training Drill | reps: "9 balls in sets" | difficulty: Advanced

IRON PLAY DRILLS:
1. The Divot Board Drill | reps: "20 balls with a 7 iron" | difficulty: Beginner
2. The Pump Drill | reps: "15 swings" | difficulty: Beginner
3. The Yardage Marker Drill | reps: "10 balls per iron" | difficulty: Beginner
4. The Coin Drill | reps: "20 swings" | difficulty: Beginner
5. The Headcover Drill | reps: "20 balls" | difficulty: Beginner
6. The Ball Position Ladder | reps: "15 balls (5 back, 5 middle, 5 forward)" | difficulty: Beginner
7. The Towel Under Lead Arm Drill | reps: "20 swings with a 7 iron" | difficulty: Intermediate
8. The Miss Drill | reps: "10 balls each stage" | difficulty: Intermediate
9. The Half Swing Compression Drill | reps: "20 half swings then 10 full swings" | difficulty: Intermediate
10. The Knockdown Drill | reps: "15 balls" | difficulty: Intermediate
11. The Random Club Drill | reps: "15 balls with random clubs" | difficulty: Advanced
12. The One Handed Drill | reps: "30 balls (10 lead only, 10 trail only, 10 both)" | difficulty: Advanced
13. The Par 3 Simulation Drill | reps: "9 holes of simulated par 3s" | difficulty: Advanced

SHORT GAME DRILLS:
1. The Landing Spot Drill | reps: "20 chips from the same spot" | difficulty: Beginner
2. The Bump and Run Drill | reps: "20 chips to a hole 15 to 20 feet away" | difficulty: Beginner
3. The No Wristed Chip Drill | reps: "20 chips" | difficulty: Beginner
4. The Fringe Ladder Drill | reps: "20 chips from 4 distances" | difficulty: Beginner
5. The Bunker Line Drill | reps: "20 practice swings then 20 with a ball" | difficulty: Beginner
6. The Towel Drill — Short Game | reps: "20 chips" | difficulty: Intermediate
7. The Clock Drill — Wedges | reps: "15 balls across 3 swing lengths" | difficulty: Intermediate
8. The Flop Shot Progression | reps: "5 at each of 3 stages" | difficulty: Intermediate
9. The Up and Down Challenge | reps: "10 up and down attempts" | difficulty: Intermediate
10. The One Club Challenge | reps: "30 minutes of open practice" | difficulty: Intermediate
11. The Wet Towel Lie Drill | reps: "15 chips from 3 different lies" | difficulty: Advanced
12. The Spin Control Drill | reps: "20 shots" | difficulty: Advanced
13. The Pressure Chip Off | reps: "Until you pass 3 consecutive stations" | difficulty: Advanced

PUTTING DRILLS:
1. The Gate Drill — Putting | reps: "30 putts from 6 feet" | difficulty: Beginner
2. The Coin Putting Drill | reps: "20 strokes" | difficulty: Beginner
3. The 3 Foot Circle Drill | reps: "3 full circles of 8 balls" | difficulty: Beginner
4. The Metronome Drill | reps: "20 putts at each distance — 5, 10, and 20 feet" | difficulty: Beginner
5. The One Hand Putting Drill | reps: "30 putts (10 lead only, 10 trail only, 10 both)" | difficulty: Beginner
6. The Pre-Round Routine Putt | reps: "15 putts as a warmup" | difficulty: Beginner
7. The Eyes Closed Putting Drill | reps: "20 putts from 20 feet" | difficulty: Intermediate
8. The Ladder Drill — Putting | reps: "12 putts (3 from each of 10, 20, 30, and 40 feet)" | difficulty: Intermediate
9. The Gate and String Drill | reps: "30 putts" | difficulty: Intermediate
10. The Breaking Putt Reading Drill | reps: "20 breaking putts" | difficulty: Intermediate
11. The 100 Putt Challenge | reps: "100 putts (25 from 3, 6, 10, and 20 feet)" | difficulty: Intermediate
12. The Tee in Ground Drill | reps: "30 strokes" | difficulty: Advanced
13. The Pressure 18 Hole Putting Round | reps: "18 holes of putting" | difficulty: Advanced

GOLF FITNESS DRILLS:
1. The Hip 90-90 Stretch | reps: "2 minutes each side" | difficulty: Beginner
2. The Thoracic Spine Rotation | reps: "20 rotations each direction" | difficulty: Beginner
3. The Glute Bridge | reps: "3 sets of 15" | difficulty: Beginner
4. The Single Leg Balance Drill | reps: "30 seconds each leg, 3 rounds" | difficulty: Beginner
5. The Wrist and Forearm Strengthening Routine | reps: "3 rounds" | difficulty: Beginner
6. The Medicine Ball Rotation Throw | reps: "3 sets of 10 each side" | difficulty: Intermediate
7. The Pallof Press | reps: "3 sets of 12 each side" | difficulty: Intermediate
8. The Lateral Band Walk | reps: "3 sets of 15 each direction" | difficulty: Intermediate
9. The Romanian Deadlift | reps: "3 sets of 10" | difficulty: Intermediate
10. The Cable or Band Wood Chop | reps: "3 sets of 12 each direction" | difficulty: Intermediate

COURSE MANAGEMENT DRILLS:
1. The Club Selection Audit | reps: "10 balls per club" | difficulty: Beginner
2. The Layup Decision Drill | reps: "10 shots" | difficulty: Beginner
3. The Pre-Shot Routine Builder | reps: "20 shots" | difficulty: Beginner
4. The Trouble Shot Library | reps: "25 shots (5 of each type)" | difficulty: Intermediate
5. The Wind Adjustment Drill | reps: "30 shots in varying wind directions" | difficulty: Intermediate
6. The Miss Side Drill | reps: "10 shots per scenario" | difficulty: Intermediate
7. The Bogey Avoidance Drill | reps: "18 simulated shots" | difficulty: Intermediate
8. The Par 18 Strategy Game | reps: "18 virtual holes" | difficulty: Advanced

=== DRILL ASSIGNMENT RULES ===

DIFFICULTY SELECTION BY SKILL RATING:
- Rating 1 (biggest weakness): 3–4 drills — Beginner difficulty only
- Rating 2 (needs work): 2–3 drills — mix Beginner and Intermediate
- Rating 3 (solid but inconsistent): 1–2 drills — Intermediate
- Rating 4 (strength): 1 drill — Intermediate to Advanced
- Rating 5 (best weapon): 1 drill every other session — Advanced only
If DEMONSTRATED MASTERY overrides a skill area, use the mastery level's difficulty instead of the rating-based difficulty.

DRILL VARIETY RULE (CRITICAL):
- Do NOT select any drill listed in "DRILLS DONE IN THE LAST 7 DAYS" unless there are literally no other appropriate drills at the correct difficulty level for that skill area.
- Rotate through the full library to give users variety each week.

SESSION TYPE → SKILL AREAS TO DRAW DRILLS FROM:
- Range Day: Driving drills + Iron Play drills + 1 Course Management drill
- Putting & Short Game: Putting drills + Short Game drills only
- Golf Fitness: Golf Fitness drills only
- Rest & Recovery: no drills

COURSE MANAGEMENT DRILL RULE (for Range Day only):
- Add exactly 1 Course Management drill per Range Day session.
- Select difficulty based on the user's Course Management skill rating using the same difficulty rules above.
- This drill is in addition to the normal Driving and Iron Play drills.

SESSION SCHEDULING RULES:
- Weight session types toward the weakest skills (rating 1 or 2 gets more sessions of that type)
- Schedule exactly ${profile.days_per_week} active sessions on: ${(profile.preferred_days || []).join(', ')}
- All other days must be "Rest & Recovery"
- Include ALL 7 days of the week
- Never schedule two Range Days back-to-back
- Golf Fitness: schedule on non-Range-Day days if golfer has 3+ days per week
- Each active session: ${drillsPerSession} drills total (including the Course Management drill for Range Days)
- Session length: ${sessionDuration} minutes

Return a JSON with this exact structure — copy drill names, reps, instructions, and tips EXACTLY from the library:
{
  "sessions": [
    {
      "day": "Monday",
      "session_type": "Range Day",
      "title": "Driving Power Session",
      "duration": ${sessionDuration},
      "drills": [
        {
          "name": "The Gate Drill — Driver",
          "reps": "20 balls",
          "instructions": "...",
          "tip": "..."
        }
      ]
    }
  ]
}`;
}

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          session_type: { type: 'string' },
          title: { type: 'string' },
          duration: { type: 'number' },
          drills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                reps: { type: 'string' },
                instructions: { type: 'string' },
                tip: { type: 'string' },
              }
            }
          }
        }
      }
    }
  }
};