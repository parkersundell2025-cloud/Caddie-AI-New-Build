// Level thresholds and badge definitions

export const LEVELS = [
  { level: 1, name: 'Weekend Warrior', minXP: 0,    maxXP: 100,  emoji: '🌱' },
  { level: 2, name: 'Range Regular',   minXP: 100,  maxXP: 250,  emoji: '⛳' },
  { level: 3, name: 'Fairway Finder',  minXP: 250,  maxXP: 500,  emoji: '🏌️' },
  { level: 4, name: 'Iron Sharpener',  minXP: 500,  maxXP: 800,  emoji: '🎯' },
  { level: 5, name: 'Short Game Ace',  minXP: 800,  maxXP: 1200, emoji: '🪄' },
  { level: 6, name: 'Scratch Chaser',  minXP: 1200, maxXP: 1800, emoji: '🔥' },
  { level: 7, name: 'Club Champion',   minXP: 1800, maxXP: 9999, emoji: '🏆' },
];

export const BADGES = [
  { id: 'first_session',     emoji: '🎉', name: 'First Step',        desc: 'Logged your first practice session',    check: (d) => d.totalSessions >= 1 },
  { id: 'streak_3',          emoji: '🔥', name: 'On Fire',           desc: '3-day practice streak',                 check: (d) => d.streak >= 3 },
  { id: 'streak_7',          emoji: '⚡', name: 'Lightning Rod',     desc: '7-day practice streak',                 check: (d) => d.streak >= 7 },
  { id: 'first_round',       emoji: '⛳', name: 'Tee Time',          desc: 'Logged your first round',               check: (d) => d.totalRounds >= 1 },
  { id: 'five_rounds',       emoji: '🏌️', name: 'Course Regular',    desc: 'Logged 5 rounds',                       check: (d) => d.totalRounds >= 5 },
  { id: 'ten_rounds',        emoji: '🎖️', name: 'Veteran',           desc: 'Logged 10 rounds',                      check: (d) => d.totalRounds >= 10 },
  { id: 'monthly_plan',      emoji: '🗓️', name: 'Game Plan Ready',   desc: 'Generated your first monthly game plan', check: (d) => d.plansGenerated >= 1 },
  { id: 'coach_chat',        emoji: '💬', name: 'Ask the Coach',     desc: 'Had your first coaching conversation',  check: (d) => d.coachMessages >= 1 },
  { id: 'coach_pro',         emoji: '🧠', name: 'Knowledge Seeker',  desc: 'Sent 20 messages to the coach',         check: (d) => d.coachMessages >= 20 },
  { id: 'ten_sessions',      emoji: '💪', name: 'Dedicated',         desc: 'Completed 10 practice sessions',        check: (d) => d.totalSessions >= 10 },
  { id: 'twenty_sessions',   emoji: '🥇', name: 'Practice Makes Perfect', desc: 'Completed 20 practice sessions',  check: (d) => d.totalSessions >= 20 },
  { id: 'plan_generated',    emoji: '📋', name: 'Game Plan',         desc: 'Generated your first practice plan',   check: (d) => d.plansGenerated >= 1 },
];

export function calcXP(data) {
  let xp = 0;
  xp += data.totalSessions * 10;       // 10 XP per session
  xp += data.totalRounds * 15;         // 15 XP per round
  xp += data.coachMessages * 3;        // 3 XP per coach message
  xp += data.plansGenerated * 20;      // 20 XP per plan
  xp += Math.min(data.streak, 14) * 5; // Up to 70 bonus XP for streaks
  return Math.round(xp);
}

export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getEarnedBadges(data) {
  return BADGES.filter(b => b.check(data));
}