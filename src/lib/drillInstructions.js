import { invokeLLM } from '@/lib/db';

// Cache for generated instructions (in-memory, resets on page leave)
const instructionsCache = {};

/**
 * Generate AI instructions for a drill or exercise
 * Format: 5 sections (Setup, How To Do It, What to Feel, Common Mistakes, Why This Works)
 * Cached in memory per session
 */
export async function getInstructions(drillName, sessionType, club, reps, clubDistances) {
  const cacheKey = `${drillName}_${sessionType}`;

  // Return from cache if available
  if (instructionsCache[cacheKey]) {
    return instructionsCache[cacheKey];
  }

  // Build golf-specific context for fitness exercises
  const isGolfFitness = sessionType === 'Golf Fitness';
  const contextHint = isGolfFitness
    ? `This is a golf fitness exercise. Every section must reference golf performance specifically. The Setup must reference golf posture. What to Feel must reference golf-specific sensations (e.g., "the same hip drive you use in your downswing"). Why This Works must end with a direct golf outcome like distance, consistency, stability, or rotation speed.`
    : `This is a golf drill. Instructions must be specific to this exact drill, not generic. Written in coach's tone — direct and conversational.`;

  // Build club distance context for personalized yardage references
  const distanceContext = clubDistances ? `
GOLFER'S ACTUAL CLUB DISTANCES (use ONLY these when referencing yardages):
Driver: ${clubDistances.driver_distance}yds, 3W: ${clubDistances.three_wood_distance}yds, 5W: ${clubDistances.five_wood_distance}yds, 4i: ${clubDistances.four_iron_distance}yds, 5i: ${clubDistances.five_iron_distance}yds, 6i: ${clubDistances.six_iron_distance}yds, 7i: ${clubDistances.seven_iron_distance}yds, 8i: ${clubDistances.eight_iron_distance}yds, 9i: ${clubDistances.nine_iron_distance}yds, PW: ${clubDistances.pitching_wedge_distance}yds, GW: ${clubDistances.gap_wedge_distance}yds, SW: ${clubDistances.sand_wedge_distance}yds, LW: ${clubDistances.lob_wedge_distance}yds

DISTANCE RULES (CRITICAL):
- Never reference a yardage that does not match this golfer's actual distances.
- For full swing drills, reference the actual distance for the club being used.
- For short game/chipping drills: only reference distances of 10-100 yards max.
- For putting drills: only reference distances in feet (3 feet to 40 feet). Never mention yards for putting.
- For driver drills: reference "at the range with your driver" — not a specific yardage target.
- Example: if the drill uses a pitching wedge, reference approximately ${Math.round((clubDistances.pitching_wedge_distance || 100) * 0.8)}-${clubDistances.pitching_wedge_distance || 100} yards as the relevant range.` : '';

  const prompt = `You are a direct, experienced golf coach. Generate detailed, specific instructions for this drill or exercise. Every instruction set must be golf-focused and actionable.

DRILL/EXERCISE: ${drillName}
SESSION TYPE: ${sessionType}
${club ? `CLUB: ${club}` : ''}
${reps ? `REPS: ${reps}` : ''}
${distanceContext}

${contextHint}

Generate instructions in EXACTLY this JSON format with no extra text:

{
  "setup": "2-3 sentences max. How to position yourself, where to stand, what club to use and why. Direct and specific like a coach standing next to you. Use this golfer's actual distances if referencing yardages.",
  "steps": [
    "Step 1: First instruction (one sentence)",
    "Step 2: Second instruction (one sentence)",
    "Step 3: Third instruction (one sentence). Maximum 4 steps, minimum 2."
  ],
  "focus": "2-3 sentences max. Key sensations or checkpoints to focus on. What correct execution should feel like. Coaching cue for during the drill.",
  "mistakes": "2-3 sentences max. One or two common mistakes. Write directly: 'Most golfers do X which causes Y. Instead focus on Z.'",
  "why": "One sentence only. Why this works and how it connects to on-course performance or their specific golf outcome."
}`;

  try {
    const response = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          setup: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          focus: { type: 'string' },
          mistakes: { type: 'string' },
          why: { type: 'string' },
        },
      },
    });

    instructionsCache[cacheKey] = response;
    return response;
  } catch (error) {
    console.error('Failed to generate instructions:', error);
    return null;
  }
}

/**
 * Clear the in-memory cache (called on page leave)
 */
export function clearInstructionsCache() {
  Object.keys(instructionsCache).forEach(key => delete instructionsCache[key]);
}