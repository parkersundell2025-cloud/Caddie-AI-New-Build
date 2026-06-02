export const ALL_BADGES = [
  // Beginner
  { id: 'first_tee', name: 'First Tee', tier: 'beginner', icon: '⛳', desc: 'Log your first round', req: 'Log your first round' },
  { id: 'range_day', name: 'Range Day', tier: 'beginner', icon: '🎯', desc: 'Complete your first practice session', req: 'Complete your first practice session' },
  { id: 'showing_up', name: 'Showing Up', tier: 'beginner', icon: '🏌️', desc: 'Log 3 rounds', req: 'Log 3 rounds' },
  { id: 'on_the_bag', name: 'On The Bag', tier: 'beginner', icon: '🏷️', desc: 'Use Caddie AI for 7 consecutive days', req: '7-day streak' },
  // Consistency
  { id: 'the_grind', name: 'The Grind', tier: 'consistency', icon: '💪', desc: 'Complete 10 practice sessions', req: '10 practice sessions' },
  { id: 'regular', name: 'Regular', tier: 'consistency', icon: '📋', desc: 'Log 10 rounds', req: 'Log 10 rounds' },
  { id: 'iron_man', name: 'Iron Man', tier: 'consistency', icon: '🦾', desc: '30 day streak of activity', req: '30-day streak' },
  { id: 'hot_streak', name: 'Hot Streak', tier: 'consistency', icon: '🔥', desc: 'Log sessions 5 days in a row', req: '5-day streak' },
  // Improvement
  { id: 'moving_the_needle', name: 'Moving the Needle', tier: 'improvement', icon: '📈', desc: 'Improve your handicap for the first time', req: 'Improve your handicap' },
  { id: 'scratch_chaser', name: 'Scratch Chaser', tier: 'improvement', icon: '🔻', desc: 'Drop handicap by 5 strokes total', req: 'Drop handicap by 5 strokes' },
  { id: 'comeback_kid', name: 'Comeback Kid', tier: 'improvement', icon: '🔄', desc: 'Drop in rank mid-month then come back stronger', req: 'Recover from a rank drop' },
  // Competitive
  { id: 'weekly_grinder', name: 'Weekly Grinder', tier: 'competitive', icon: '💪', desc: 'Top the weekly mini-leaderboard', req: 'Top the weekly leaderboard' },
  { id: 'on_the_board', name: 'On The Board', tier: 'competitive', icon: '📊', desc: 'Appear in the top 50 on the leaderboard', req: 'Finish top 50 in a monthly leaderboard' },
  { id: 'contender', name: 'Contender', tier: 'competitive', icon: '🥈', desc: 'Finish top 10 in a monthly leaderboard', req: 'Finish top 10 in a monthly leaderboard' },
  { id: 'podium', name: 'Podium', tier: 'competitive', icon: '🥉', desc: 'Finish top 3 in a monthly leaderboard', req: 'Finish top 3 in a monthly leaderboard' },
  { id: 'champion', name: 'Champion', tier: 'competitive', icon: '🏆', desc: 'Win the monthly leaderboard', req: 'Win the monthly leaderboard' },
  { id: 'back_to_back', name: 'Back to Back', tier: 'competitive', icon: '🔁', desc: 'Win two months in a row', req: 'Win two consecutive months' },
  { id: 'dynasty', name: 'Dynasty', tier: 'competitive', icon: '👑', desc: 'Win three months in a row', req: 'Win three consecutive months' },
  // Prestige
  { id: 'hall_of_famer', name: 'Hall of Famer', tier: 'prestige', icon: '⭐', desc: 'Permanent badge — won the monthly leaderboard', req: 'Win the monthly leaderboard' },
  { id: 'century_club', name: 'Century Club', tier: 'prestige', icon: '💯', desc: 'Log 100 total rounds and practice sessions combined', req: '100 total activities' },
  { id: 'caddie_ai_og', name: 'Caddie AI OG', tier: 'prestige', icon: '🏷️', desc: 'One of the first 100 users on Caddie AI', req: 'Be one of the first 100 users' },
  { id: 'all_in', name: 'All In', tier: 'prestige', icon: '💎', desc: 'Subscribe to the Pro plan', req: 'Subscribe to Pro' },
];

export const TIER_COLORS = {
  beginner: { border: 'border-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600' },
  consistency: { border: 'border-sage', bg: 'bg-sage-light', text: 'text-sage-dark' },
  improvement: { border: 'border-sage', bg: 'bg-sage-light', text: 'text-sage-dark' },
  competitive: { border: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600' },
  prestige: { border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700' },
};

export function getBadgeDef(id) {
  return ALL_BADGES.find(b => b.id === id);
}