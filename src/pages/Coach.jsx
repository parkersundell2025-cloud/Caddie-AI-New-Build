import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser, invokeLLM } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import { isCoachFreshOpen, markCoachAsOpened } from '@/lib/appSessionState';
import { formatHandicap, isPlusHandicap } from '@/lib/handicapUtils';
import { buildClubDistanceContext } from '@/lib/clubDistances';

const DRILL_LIBRARY = `DRIVING: The Tempo Towel Drill (Beginner, 7 Iron→Driver, 15+10 swings), The Gate Drill — Driver (Beginner, Driver, 20 balls), The Slow Motion Drill (Beginner, Driver, 10 slow+5 full), The Tee Height Ladder (Beginner, Driver, 15 balls), The Foot Together Drill (Beginner, Driver, 15 balls), The Alignment Stick Path Drill (Intermediate, Driver, 20 balls), The Impact Bag Drill (Intermediate, 6 Iron, 20 strikes), The 3 Ball Progression (Intermediate, Driver, 5 sets), The L to L Drill (Intermediate, 7 Iron→Driver, 20 swings), The Eyes Closed Drill (Intermediate, Driver, 10 swings), The Step Through Drill (Intermediate, Driver, 15 balls), The 9 Shot Shape Drill (Advanced, Driver, 9 balls), The Speed Training Drill (Advanced, 3 Wood→Driver, 9 balls).
IRON PLAY: The Divot Board Drill (Beginner, 7 Iron, 20 balls), The Pump Drill (Beginner, 7 Iron, 15 swings), The Yardage Marker Drill (Beginner, 7 Iron, 10 balls/iron), The Coin Drill (Beginner, 7 Iron, 20 swings), The Headcover Drill (Beginner, 6 Iron, 20 balls), The Ball Position Ladder (Beginner, 7 Iron, 15 balls), The Towel Under Lead Arm Drill (Intermediate, 7 Iron, 20 swings), The Miss Drill (Intermediate, 7 Iron, 10 balls/stage), The Half Swing Compression Drill (Intermediate, 7 Iron, 20+10), The Knockdown Drill (Intermediate, 6 Iron, 15 balls), The Random Club Drill (Advanced, Any Iron, 15 balls), The One Handed Drill (Advanced, 9 Iron, 30 balls), The Par 3 Simulation Drill (Advanced, 8 Iron, 9 holes).
SHORT GAME: The Landing Spot Drill (Beginner, PW, 20 chips), The Bump and Run Drill (Beginner, 7 Iron, 20 chips), The No Wristed Chip Drill (Beginner, GW, 20 chips), The Fringe Ladder Drill (Beginner, PW, 20 chips), The Bunker Line Drill (Beginner, SW, 40 swings), The Towel Drill — Short Game (Intermediate, GW, 20 chips), The Clock Drill — Wedges (Intermediate, GW, 15 balls), The Flop Shot Progression (Intermediate, LW, 15 balls), The Up and Down Challenge (Intermediate, SW, 10 attempts), The One Club Challenge (Intermediate, SW, 30 min), The Wet Towel Lie Drill (Advanced, SW, 15 chips), The Spin Control Drill (Advanced, LW, 20 shots), The Pressure Chip Off (Advanced, GW, until 3 stations passed).
PUTTING: The Gate Drill — Putting (Beginner, Putter, 30 putts), The Coin Putting Drill (Beginner, Putter, 20 strokes), The 3 Foot Circle Drill (Beginner, Putter, 3 circles), The Metronome Drill (Beginner, Putter, 60 putts), The One Hand Putting Drill (Beginner, Putter, 30 putts), The Pre-Round Routine Putt (Beginner, Putter, 15 putts), The Eyes Closed Putting Drill (Intermediate, Putter, 20 putts), The Ladder Drill — Putting (Intermediate, Putter, 12 putts), The Gate and String Drill (Intermediate, Putter, 30 putts), The Breaking Putt Reading Drill (Intermediate, Putter, 20 putts), The 100 Putt Challenge (Intermediate, Putter, 100 putts), The Tee in Ground Drill (Advanced, Putter, 30 strokes), The Pressure 18 Hole Putting Round (Advanced, Putter, 18 holes).
GOLF FITNESS: The Hip 90-90 Stretch (Beginner, no club, 2 min/side), The Thoracic Spine Rotation (Beginner, no club, 20 reps), The Glute Bridge (Beginner, no club, 3x15), The Single Leg Balance Drill (Beginner, no club, 30 sec/leg), The Wrist and Forearm Strengthening Routine (Beginner, no club, 3 rounds), The Medicine Ball Rotation Throw (Intermediate, med ball, 3x10), The Pallof Press (Intermediate, band, 3x12), The Lateral Band Walk (Intermediate, band, 3x15), The Romanian Deadlift (Intermediate, dumbbells, 3x10), The Cable or Band Wood Chop (Intermediate, band, 3x12).
COURSE MANAGEMENT: The Club Selection Audit (Beginner, 9 Iron→Driver, 10 balls/club), The Layup Decision Drill (Beginner, GW, 10 shots), The Pre-Shot Routine Builder (Beginner, 7 Iron, 20 shots), The Trouble Shot Library (Intermediate, 6 Iron, 25 shots), The Wind Adjustment Drill (Intermediate, Any Iron, 30 shots), The Miss Side Drill (Intermediate, 7 Iron, 10 shots), The Bogey Avoidance Drill (Intermediate, Driver, 18 shots), The Par 18 Strategy Game (Advanced, Full Bag, 18 holes).`;

function calcSkillTrends(drillRatings) {
  // Map drill names to skills
  const skillMap = {
    Driving: ['Tempo Towel', 'Gate Drill — Driver', 'Slow Motion', 'Tee Height', 'Foot Together', 'Alignment Stick', 'Impact Bag', 'Ball Progression', 'L to L', 'Eyes Closed', 'Step Through', 'Shot Shape', 'Speed Training'],
    'Iron Play': ['Divot Board', 'Pump Drill', 'Yardage Marker', 'Coin Drill', 'Headcover', 'Ball Position', 'Towel Under Lead', 'Miss Drill', 'Half Swing', 'Knockdown', 'Random Club', 'One Handed', 'Par 3 Simulation'],
    'Short Game': ['Landing Spot', 'Bump and Run', 'No Wristed', 'Fringe Ladder', 'Bunker Line', 'Towel Drill — Short', 'Clock Drill', 'Flop Shot', 'Up and Down', 'One Club', 'Wet Towel', 'Spin Control', 'Pressure Chip'],
    'Putting': ['Gate Drill — Putting', 'Coin Putting', '3 Foot Circle', 'Metronome', 'One Hand Putting', 'Pre-Round Routine', 'Eyes Closed Putting', 'Ladder Drill', 'Gate and String', 'Breaking Putt', 'Putt Challenge', 'Tee in Ground', 'Pressure 18'],
    'Course Management': ['Par 3 Simulation', 'Shot Shape', 'Random Club', 'Pressure 18', 'Putt Challenge', 'Up and Down', 'Pressure Chip'],
  };

  const skillTrends = {};
  Object.keys(skillMap).forEach(skill => {
    const recentRatings = drillRatings.filter(r => skillMap[skill].some(d => r.drill_name.includes(d))).slice(0, 14);
    if (recentRatings.length < 3) {
      skillTrends[skill] = 'Insufficient data';
    } else {
      const ratingScores = { 'Clicked': 4, 'Good': 3, 'Okay': 2, 'Struggled': 1 };
      const recent = recentRatings.slice(0, 7).reduce((acc, r) => acc + (ratingScores[r.rating] || 0), 0) / 7;
      const older = recentRatings.slice(7, 14).reduce((acc, r) => acc + (ratingScores[r.rating] || 0), 0) / Math.max(1, recentRatings.slice(7).length);
      if (recent > older + 0.3) skillTrends[skill] = 'Improving';
      else if (recent < older - 0.3) skillTrends[skill] = 'Declining';
      else skillTrends[skill] = 'Steady';
    }
  });
  return skillTrends;
}

function calcHandicapContext(handicapData, profile) {
  if (!handicapData?.handicap) return `${formatHandicap(profile.current_handicap)}, based on onboarding`;

  const current = handicapData.handicap;
  const diffs = handicapData.selectedDifferentials;

  // Calculate previous handicap by excluding the most recent differential
  let direction = 'steady';
  let changeAmount = null;
  if (diffs && diffs.length >= 2) {
    // Remove the best (lowest) diff that would have been included without newest round
    // Re-average the remaining diffs to get an approximate prior handicap
    const prevDiffs = diffs.slice(1);
    const prevAvg = prevDiffs.reduce((a, b) => a + b, 0) / prevDiffs.length;
    const prevHandicap = Math.round(prevAvg * 0.96 * 10) / 10;
    const delta = Math.round(Math.abs(current - prevHandicap) * 10) / 10;

    if (delta >= 0.1) {
      const isPlus = isPlusHandicap(current);
      if (isPlus) {
        // Plus handicap: more negative = better
        direction = current < prevHandicap ? 'improving' : 'declining';
      } else {
        // Regular handicap: lower = better
        direction = current < prevHandicap ? 'improving' : 'declining';
      }
      changeAmount = delta;
    }
  }

  const directionStr = changeAmount
    ? `${direction === 'improving' ? '↓' : '↑'} ${changeAmount} from last`
    : 'steady';

  return `${formatHandicap(current)} (${directionStr}), based on ${handicapData.roundsCount || 0} rounds`;
}

function calcRoundTrajectory(rounds) {
  if (rounds.length < 2) return null;
  const last5 = rounds.slice(0, 5);
  const last30days = rounds.filter(r => {
    const d = new Date(r.round_date);
    return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  });
  const prev30days = rounds.filter(r => {
    const d = new Date(r.round_date);
    const msAgo = Date.now() - d.getTime();
    return msAgo >= 30 * 24 * 60 * 60 * 1000 && msAgo < 60 * 24 * 60 * 60 * 1000;
  });

  const avg30 = last30days.length > 0 ? (last30days.reduce((a, r) => a + r.total_score, 0) / last30days.length).toFixed(1) : null;
  const avgPrev30 = prev30days.length > 0 ? (prev30days.reduce((a, r) => a + r.total_score, 0) / prev30days.length).toFixed(1) : null;
  const best30 = last30days.length > 0 ? Math.min(...last30days.map(r => r.total_score)) : null;

  let trajectory = null;
  if (last5.length >= 3) {
    const first3avg = (last5[2].total_score + last5[1].total_score + last5[0].total_score) / 3;
    const recent3 = last5.slice(0, 2).length >= 2 ? (last5[0].total_score + last5[1].total_score) / 2 : last5[0].total_score;
    trajectory = recent3 < first3avg - 1 ? 'improving' : recent3 > first3avg + 1 ? 'declining' : 'steady';
  }

  return {
    last5: last5.map(r => r.total_score),
    trajectory,
    best30,
    avg30,
    avgPrev30,
  };
}

function buildSystemPrompt(profile, rounds, sessionLogs, drillRatings, plan, badges, leaderboardRank, conversationHistory, isPro, handicapData, clubDistanceCtx, monthlyGamePlan, weeklyInsight, weeklyReport) {
  const skills = [
    { name: 'Driving', val: profile.skill_driving },
    { name: 'Iron Play', val: profile.skill_iron_play },
    { name: 'Short Game', val: profile.skill_short_game },
    { name: 'Putting', val: profile.skill_putting },
    { name: 'Course Management', val: profile.skill_course_management },
  ].sort((a, b) => a.val - b.val);

  const weakest = skills.slice(0, 2).map(s => `${s.name} (${s.val}/5)`).join(', ');
  const strongest = skills.slice(-2).reverse().map(s => `${s.name} (${s.val}/5)`).join(', ');
  
  // Add skill trends
  const skillTrends = calcSkillTrends(drillRatings);
  const skillsWithTrends = [
    { name: 'Driving', val: profile.skill_driving, trend: skillTrends['Driving'] },
    { name: 'Iron Play', val: profile.skill_iron_play, trend: skillTrends['Iron Play'] },
    { name: 'Short Game', val: profile.skill_short_game, trend: skillTrends['Short Game'] },
    { name: 'Putting', val: profile.skill_putting, trend: skillTrends['Putting'] },
    { name: 'Course Management', val: profile.skill_course_management, trend: skillTrends['Course Management'] },
  ];

  // Calculated handicap context
  const handicapContext = calcHandicapContext(handicapData, profile);

  // Round trajectory
  const roundTraj = calcRoundTrajectory(rounds);
  const roundContext = roundTraj
    ? `Last 5 rounds: ${roundTraj.last5.join(', ')} (${roundTraj.trajectory}). Best this month: ${roundTraj.best30}. This month avg: ${roundTraj.avg30}, last month: ${roundTraj.avgPrev30}.`
    : 'No round history yet.';

  const recentRounds = rounds.length === 0
    ? 'No rounds logged yet.'
    : rounds.slice(0, isPro ? rounds.length : 5).map(r => {
        const scrambling = (r.scrambling_saves != null && r.scrambling_attempts != null)
          ? ` Scrambling ${r.scrambling_saves}/${r.scrambling_attempts}.`
          : '';
        return `${r.round_date}: ${r.total_score} at ${r.course_name || 'unknown course'}. FW ${r.fairways_hit}/${r.fairways_available}, GIR ${r.greens_in_regulation}/18, ${r.total_putts} putts.${scrambling}${r.notes ? ` Note: "${r.notes}"` : ''}`;
      }).join('\n');

  const recentSessions = sessionLogs.length === 0
    ? 'No sessions logged yet.'
    : sessionLogs.slice(0, isPro ? sessionLogs.length : 10).map(s =>
        `${s.session_date}: ${s.session_type}${s.notes ? ` — "${s.notes}"` : ''}`
      ).join('\n');

  const recentDrills = drillRatings.length === 0
    ? 'No drill ratings yet.'
    : drillRatings.slice(0, 30).map(r =>
        `${r.session_date} | ${r.drill_name}: ${r.rating}${r.session_note ? ` — "${r.session_note}"` : ''}`
      ).join('\n');

  const recentBadges = badges.length > 0
    ? `Recently earned: ${badges.map(b => b.badge_name).join(', ')}`
    : 'No recent badges.';

  // Practice plan details
  const planContext = (() => {
    if (!plan?.plan_data) return 'No active practice plan.';
    const pd = plan.plan_data;
    const focus = pd.focus || pd.weekly_focus || '';
    const sessions = Array.isArray(pd.sessions) ? pd.sessions.map(s => {
      const drills = Array.isArray(s.drills) ? s.drills.map(d => d.name || d).join(', ') : '';
      return `${s.day}: ${s.session_type}${drills ? ` — Drills: ${drills}` : ''}${s.duration ? ` (${s.duration})` : ''}`;
    }).join('\n') : '';
    return `Week of ${plan.week_start_date}. Focus: ${focus}\n${sessions}`;
  })();

  // Monthly game plan
  const monthlyContext = monthlyGamePlan
    ? `Monthly focus: ${monthlyGamePlan.monthly_focus}. Why: ${monthlyGamePlan.why_this_month}. Key drill: ${monthlyGamePlan.key_drill}. Coach's note: ${monthlyGamePlan.coachs_note}. Success looks like: ${monthlyGamePlan.success_looks_like}.`
    : 'No monthly game plan yet.';

  // Weekly insight + report
  const weeklyInsightContext = weeklyInsight?.insight_text
    ? `Most recent weekly insight (${weeklyInsight.week_of}): ${weeklyInsight.insight_text}`
    : 'No weekly insight yet.';

  const weeklyReportContext = weeklyReport
    ? `Most recent weekly report (${weeklyReport.week_of}): What improved: ${weeklyReport.what_improved}. Needs attention: ${weeklyReport.what_needs_attention}. Drill of the week: ${weeklyReport.drill_of_the_week}. Coach's take: ${weeklyReport.coachs_take}.`
    : 'No weekly report yet.';

  // Session preferences
  const sessionPrefs = (() => {
    const prefs = profile.session_type_preferences || {};
    const enabled = Object.entries(prefs).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' ')).join(', ');
    const intensity = profile.intensity_preference || 'medium';
    return `Preferred session types: ${enabled || 'all'}. Preferred session intensity: ${intensity}.`;
  })();

  const historyLimit = isPro ? 50 : 20;
  const historyContext = conversationHistory.length === 0
    ? 'No previous conversations.'
    : conversationHistory.slice(-historyLimit).map(m =>
        `${m.role === 'user' ? 'Golfer' : 'Coach'}: ${m.content}`
      ).join('\n');

  const daysSinceStart = profile.trial_start_date
    ? Math.floor((Date.now() - new Date(profile.trial_start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return `You are Caddie AI — a direct, sharp, deeply personalized golf coach. You are having a real coaching conversation, not generating a report.

GOLFER DATA (live, loaded fresh this session):
Name: ${profile.first_name || 'Golfer'} | Handicap: ${handicapContext} → Goal: ${formatHandicap(profile.goal_handicap)} in ${profile.target_timeline}
Plan: ${profile.days_per_week} days/week on ${(profile.preferred_days || []).join(', ')}
Days on app: ${daysSinceStart} | Plan: ${isPro ? 'Pro' : 'Basic'}
Leaderboard rank this month: ${leaderboardRank || 'not ranked'}
Weakest: ${weakest} | Strongest: ${strongest}
Skills with Trends: ${skillsWithTrends.map(s => `${s.name} ${s.val}/5 (${s.trend})`).join(', ')}
${clubDistanceCtx || ''}

ROUND TRAJECTORY:
${roundContext}

RECENT ROUNDS:
${recentRounds}

RECENT SESSIONS:
${recentSessions}

RECENT DRILL RATINGS:
${recentDrills}

BADGES: ${recentBadges}

SESSION PREFERENCES:
${sessionPrefs}

THIS WEEK'S PRACTICE PLAN:
${planContext}

MONTHLY GAME PLAN:
${monthlyContext}

WEEKLY INSIGHT:
${weeklyInsightContext}

WEEKLY REPORT:
${weeklyReportContext}

PREVIOUS CONVERSATIONS:
${historyContext}

DRILL LIBRARY (only ever recommend drills from this list, exact names):
${DRILL_LIBRARY}

CRITICAL COACHING RULES — FOLLOW THESE EXACTLY:

1. RESPONSE LENGTH: Match the depth of the question. Simple questions get 2-3 sentences. When a golfer asks about technique, a drill, their game, or wants advice — give a full coaching response of 3-5 sentences minimum. Never truncate advice just to keep it short. A real coach gives complete answers. Always end with one direct question or clear next action.

2. NO FORMATTING: Never use bullet points, numbered lists, headers, or section titles. Ever.

3. NO FILLER PHRASES: Never say "Here's a recap", "Great job!", "Keep it up!", "Moving forward", "Key takeaways", "Action items", or any generic praise.

4. SOUND LIKE A COACH TEXTING THEIR PLAYER: Direct. Specific. Conversational. Short sentences. One thought at a time. Never corporate, never robotic.

5. EVERY RESPONSE MUST USE REAL DATA: Reference their actual handicap number, their actual scores, their actual drill ratings, their actual skill trends. If your response could apply to any golfer, rewrite it.

6. CONNECT EVERYTHING TO THEIR GOAL: They want to get from their current handicap to their goal handicap in their target timeline. Every piece of advice should connect to that specific journey.

7. REFERENCE PREVIOUS CONVERSATIONS: Use history naturally. "Last time you mentioned your driver felt off — how did that go?" or "You told me the Gate Drill wasn't clicking — did you run it again?"

8. PROACTIVELY CALL OUT DECLINING SKILLS: If any skill shows Declining, bring it up directly. "Your short game has been trending down the last few weeks — what's feeling off?"

9. READ THE SCORECARD LIKE A COACH: If GIR was low, that's the story — not the total score. If fairways were high but score was bad, short game is leaking. Connect the stats to the actual problem.

10. ONE THING AT A TIME: End every response with one clear next action. Not three. One. Real coaches don't overwhelm.

11. BE HONEST WHEN PROGRESS STALLS: If sessions are being logged but scores aren't moving, say it. "You've put in 8 sessions this month but the scoring average hasn't moved — let's figure out why."

12. USE THEIR ACTUAL CLUB DISTANCES: Never use generic yardages. "At 155 that's your 6 iron" not "a mid iron."

13. CELEBRATE SPECIFICALLY NOT GENERICALLY: If scores are improving, say exactly how much and what's driving it. "You've dropped 3 shots off your average in the last month — your GIR has gone from 4 to 7 per round. That's the irons work paying off."

14. MATCH THEIR EMOTIONAL STATE: If they're frustrated, acknowledge it before coaching. If they just shot their best round, celebrate the specific number before analyzing it.

15. MAKE THEM FEEL SEEN: The goal of every response is to make this golfer feel like someone has been watching their game closely and actually cares about their improvement. Use their name occasionally. Reference their specific numbers. Make every message feel like it could only have been written for them and no one else.

16. NEW USERS: If no rounds or sessions exist yet, don't pretend you know their game. Ask directly about what they're working on and what's felt most off lately.

17. NEVER REPEAT THE SAME ADVICE: Check conversation history. If you already told them to work on lag putting, don't repeat it unless new data justifies it. Always move the conversation forward.

18. OPENING MESSAGE RULE: The very first message must reference something specific from their data — a recent score, a struggling drill, a declining skill, a pending session today. Never open with a generic welcome.

19. NEW USER DEPTH: When a golfer has no rounds or sessions logged yet, you still have their handicap, their goal, their skill ratings, their schedule, and their practice plan. Use all of it. Don't give a short answer just because their history is empty. Ask deep questions about their game — what their miss is off the tee, what their short game feels like, what their putting stroke does under pressure. Build a picture of their game through conversation even before they log anything. The first 5 conversations set the tone for whether they stick with Caddie AI or leave.`;
}

function getSkillTrendsForOpening(drillRatings) {
  const trends = calcSkillTrends(drillRatings);
  const declining = Object.entries(trends).filter(([k, v]) => v === 'Declining').map(([k]) => k);
  return declining;
}

function buildOpeningPrompt(profile, rounds, sessionLogs, drillRatings, badges, conversationHistory, isPro, handicapData, plan, clubDistanceCtx, monthlyGamePlan, weeklyInsight, weeklyReport) {
  const hasRounds = rounds.length > 0;
  const hasSessions = sessionLogs.length > 0;
  const lastRound = rounds[0];
  const lastSession = sessionLogs[0];
  const lastConvo = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null;

  const daysSinceLastActivity = (() => {
    const dates = [
      lastRound?.round_date,
      lastSession?.session_date,
    ].filter(Boolean).map(d => new Date(d));
    if (dates.length === 0) return null;
    const mostRecent = new Date(Math.max(...dates));
    return Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const recentBadge = badges[0];
  const recentDrill = drillRatings[0];
  const decliningSkills = getSkillTrendsForOpening(drillRatings);
  const roundTraj = calcRoundTrajectory(rounds);

  let contextClues = [];
  if (!hasRounds && !hasSessions) contextClues.push('NEW_USER');
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 7) contextClues.push(`INACTIVE_${daysSinceLastActivity}_DAYS`);
  if (lastRound) contextClues.push(`LAST_ROUND_${lastRound.total_score}_ON_${lastRound.round_date}`);
  if (recentBadge) contextClues.push(`RECENT_BADGE_${recentBadge.badge_name}`);
  if (lastConvo) contextClues.push('HAS_HISTORY');
  if (recentDrill && recentDrill.rating === 'Struggled') contextClues.push(`STRUGGLED_${recentDrill.drill_name}`);
  if (decliningSkills.length > 0) contextClues.push(`DECLINING_${decliningSkills.join('_')}`);
  if (roundTraj?.trajectory === 'improving') contextClues.push('SCORES_IMPROVING');
  if (roundTraj?.trajectory === 'declining') contextClues.push('SCORES_DECLINING');
  if (plan?.plan_data?.sessions) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaySession = plan.plan_data.sessions.find(s => s.day === today);
    if (todaySession && todaySession.session_type !== 'Rest & Recovery') {
      const completedToday = sessionLogs.some(s => s.session_date === new Date().toISOString().split('T')[0] && s.completed);
      if (!completedToday) contextClues.push(`PENDING_${todaySession.session_type.replace(/ /g, '_')}`);
    }
  }

  const systemPrompt = buildSystemPrompt(profile, rounds, sessionLogs, drillRatings, plan, badges, null, conversationHistory, isPro, handicapData, clubDistanceCtx, monthlyGamePlan, weeklyInsight, weeklyReport);

  return `${systemPrompt}

TASK: Generate your opening message for this coaching session. This is the FIRST thing the golfer sees when they open Coach.

RULES FOR OPENING MESSAGE:
- Maximum 2 sentences. No more.
- Must reference something SPECIFIC and REAL from the golfer's data above.
- Must end with exactly ONE direct question.
- No bullet points. No lists. No headers.
- Do NOT start with "Hey", "Hi", "Hello", or any formal greeting.
- Do NOT start with "Great to see you" or similar filler.
- Sound like a coach who has been watching their progress — observational, direct, curious.
- If no activity data exists, reference their handicap goal and ask about their game.

Context signals: ${contextClues.join(', ')}

Generate the opening message only. Nothing else.`;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed select-text ${
        isUser
          ? 'bg-foreground text-background rounded-br-sm'
          : 'bg-card border border-border text-foreground rounded-bl-sm'
      }`}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
      </div>
    </motion.div>
  );
}

export default function Coach() {
  const [contextData, setContextData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generatingOpening, setGeneratingOpening] = useState(false);
  const bottomRef = useRef(null);
  const topRef = useRef(null);
  const userRef = useRef(null);
  const isFreshOpen = useRef(isCoachFreshOpen());

  useEffect(() => {
    loadContextAndOpen();
  }, []);

  useEffect(() => {
    // On fresh open with only the opening message, scroll to top so user sees it
    if (isFreshOpen.current && messages.length <= 1) {
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, generatingOpening]);

  const loadContextAndOpen = async () => {
    try {
      const user = await getCurrentUser();
      userRef.current = user;
      const isPro = false; // will be set from profile

      // Load all live data fresh every session
      const [profiles, roundList, chatHistory, drillRatings, sessionLogs, badgeList, planList, monthlyPlanList, weeklyInsightList, weeklyReportList] = await Promise.all([
        unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email)),
        unwrap(supabase.from('round').select('*').eq('user_email', user.email).order('round_date', { ascending: false }).limit(50)),
        unwrap(supabase.from('chat_message').select('*').eq('user_email', user.email).order('created_date', { ascending: true }).limit(200)),
        unwrap(supabase.from('drill_rating').select('*').eq('user_email', user.email).order('created_date', { ascending: false }).limit(100)),
        unwrap(supabase.from('session_log').select('*').eq('user_email', user.email).order('created_date', { ascending: false }).limit(50)),
        unwrap(supabase.from('badge').select('*').eq('user_email', user.email).order('earned_at', { ascending: false }).limit(10)),
        unwrap(supabase.from('practice_plan').select('*').eq('user_email', user.email).eq('is_active', true)),
        unwrap(supabase.from('monthly_game_plan').select('*').eq('user_email', user.email).order('generated_at', { ascending: false }).limit(1)),
        unwrap(supabase.from('weekly_insight').select('*').eq('user_email', user.email).order('week_of', { ascending: false }).limit(1)),
        unwrap(supabase.from('weekly_report').select('*').eq('user_email', user.email).order('week_of', { ascending: false }).limit(1)),
      ]);

      const profile = profiles[0] || null;
      const isProUser = !!(profile?.subscription_status === 'pro' && profile?.stripe_subscription_id);
      const plan = planList[0] || null;
      const monthlyGamePlan = monthlyPlanList[0] || null;
      const weeklyInsight = weeklyInsightList[0] || null;
      const weeklyReport = weeklyReportList[0] || null;
      const clubDistanceCtx = profile ? buildClubDistanceContext(profile) : null;

      // Get calculated handicap data
      let handicapData = null;
      try {
        const hcpRes = await supabase.functions.invoke('calculateHandicap', { body: {} }).catch(() => null);
        handicapData = hcpRes?.data || null;
      } catch {}

      // Try to get leaderboard rank
      let leaderboardRank = null;
      try {
        const lbRes = await supabase.functions.invoke('getLeaderboard', { body: { tab: 'month' } });
        const myEntry = lbRes.data?.entries?.find(e => e.user_email === user.email);
        leaderboardRank = myEntry?.rank || null;
      } catch {}

      const conversationHistory = chatHistory.map(m => ({ role: m.role, content: m.content }));

      const data = {
        profile,
        rounds: roundList,
        sessionLogs,
        drillRatings,
        badges: badgeList,
        leaderboardRank,
        conversationHistory,
        isPro: isProUser,
        handicapData,
        plan,
        monthlyGamePlan,
        weeklyInsight,
        weeklyReport,
        clubDistanceCtx,
      };

      setContextData(data);

      // Load all conversation history as context but only display if within session
      // conversationHistory is always available in contextData for LLM context
      if (isFreshOpen.current) {
        // Fresh app open: show only opening message
        setMessages([]);
        markCoachAsOpened();
        
        // Generate proactive opening message
        if (profile) {
          setGeneratingOpening(true);
          const openingPrompt = buildOpeningPrompt(
            profile, roundList, sessionLogs, drillRatings, badgeList, conversationHistory, isProUser, handicapData, plan, clubDistanceCtx, monthlyGamePlan, weeklyInsight, weeklyReport
          );
          const openingMsg = await invokeLLM({ prompt: openingPrompt });

          const openingEntry = { role: 'assistant', content: openingMsg };
          setMessages(prev => [...prev, openingEntry]);

          // Persist the opening to chat history
          await unwrap(supabase.from('chat_message').insert({
            user_email: user.email,
            role: 'assistant',
            content: openingMsg,
            timestamp: new Date().toISOString(),
          }).select().single());
          setGeneratingOpening(false);
        }
      } else {
        // Within-session navigation: show full conversation from this session
        markCoachAsOpened();
        setMessages(conversationHistory);
      }
      
      setInitialLoading(false);
    } catch (err) {
      setInitialLoading(false);
      setGeneratingOpening(false);
      // Graceful failure
      const fallback = { role: 'assistant', content: "I'm having trouble loading your latest stats — tell me how your game has been feeling." };
      setMessages([fallback]);
    }
  };

  const sendMessage = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;
    if (!contextData) {
      // contextData not ready yet, just show a fallback
      return;
    }
    setInput('');

    const userMsg = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const user = userRef.current;

    // Persist user message
    await unwrap(supabase.from('chat_message').insert({
      user_email: user.email,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    }).select().single());

    // Build full conversation for context (current session messages + new user message)
    const allHistory = [...contextData.conversationHistory, userMsg];
    const { profile, rounds, sessionLogs, drillRatings, badges, leaderboardRank, isPro, handicapData, clubDistanceCtx, plan, monthlyGamePlan, weeklyInsight, weeklyReport } = contextData;

    const systemPrompt = buildSystemPrompt(profile, rounds, sessionLogs, drillRatings, plan, badges, leaderboardRank, allHistory, isPro, handicapData, clubDistanceCtx, monthlyGamePlan, weeklyInsight, weeklyReport);

    const aiResponse = await invokeLLM({
      prompt: `${systemPrompt}\n\nGolfer: ${messageText}\n\nCoach:`,
    });

    const assistantMsg = { role: 'assistant', content: aiResponse };
    setMessages(prev => [...prev, assistantMsg]);

    // Persist assistant response
    await unwrap(supabase.from('chat_message').insert({
      user_email: user.email,
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    }).select().single());

    // Update contextData conversation history
    setContextData(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, userMsg, assistantMsg],
    }));

    setLoading(false);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-3 flex-shrink-0 bg-background border-b border-border">
        <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center">
          <span className="text-background text-sm">🏌️</span>
        </div>
        <div>
          <h1 className="font-black text-foreground text-lg" style={{ letterSpacing: '-0.5px' }}>Caddie AI Coach</h1>
          <p className="text-muted-foreground text-xs">
            {contextData?.isPro ? 'Pro Coach · Full history' : 'Always here to help your game'}
          </p>
        </div>

      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ overscrollBehavior: 'contain' }}>
        <div ref={topRef} />
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {(loading || generatingOpening) && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 pt-3 pb-4 bg-background border-t border-border flex-shrink-0">
        <div className="flex items-end gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !loading && sendMessage()}
            placeholder="Talk to your coach..."
            className="flex-1 bg-muted rounded-2xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-foreground rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4 text-background" />
          </button>
        </div>
      </div>
    </div>
  );
}