import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

const BADGE_DEFINITIONS = [
  { id: 'first_tee', name: 'First Tee', tier: 'beginner', desc: 'Log your first round' },
  { id: 'range_day', name: 'Range Day', tier: 'beginner', desc: 'Complete your first practice session' },
  { id: 'showing_up', name: 'Showing Up', tier: 'beginner', desc: 'Log 3 rounds' },
  { id: 'on_the_bag', name: 'On The Bag', tier: 'beginner', desc: 'Use Caddie AI for 7 consecutive days' },
  { id: 'the_grind', name: 'The Grind', tier: 'consistency', desc: 'Complete 10 practice sessions' },
  { id: 'regular', name: 'Regular', tier: 'consistency', desc: 'Log 10 rounds' },
  { id: 'iron_man', name: 'Iron Man', tier: 'consistency', desc: '30 day streak of activity' },
  { id: 'hot_streak', name: 'Hot Streak', tier: 'consistency', desc: 'Log sessions 5 days in a row' },
  { id: 'moving_the_needle', name: 'Moving the Needle', tier: 'improvement', desc: 'Improve your handicap for the first time' },
  { id: 'scratch_chaser', name: 'Scratch Chaser', tier: 'improvement', desc: 'Drop handicap by 5 strokes total' },
  { id: 'comeback_kid', name: 'Comeback Kid', tier: 'improvement', desc: 'Drop in rank mid-month then come back stronger' },
  { id: 'weekly_grinder', name: 'Weekly Grinder', tier: 'competitive', desc: 'Top the weekly mini-leaderboard' },
  { id: 'on_the_board', name: 'On The Board', tier: 'competitive', desc: 'Appear in the top 50 on the leaderboard' },
  { id: 'contender', name: 'Contender', tier: 'competitive', desc: 'Finish top 10 in a monthly leaderboard' },
  { id: 'podium', name: 'Podium', tier: 'competitive', desc: 'Finish top 3 in a monthly leaderboard' },
  { id: 'champion', name: 'Champion', tier: 'competitive', desc: 'Win the monthly leaderboard' },
  { id: 'hall_of_famer', name: 'Hall of Famer', tier: 'prestige', desc: 'Win the monthly leaderboard — permanent' },
  { id: 'century_club', name: 'Century Club', tier: 'prestige', desc: 'Log 100 total rounds and practice sessions combined' },
  { id: 'caddie_ai_og', name: 'Caddie AI OG', tier: 'prestige', desc: 'One of the first 100 users on Caddie AI' },
  { id: 'all_in', name: 'All In', tier: 'prestige', desc: 'Subscribe to the Pro plan' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const [profilesRes, roundsRes, sessionsRes, badgesRes] = await Promise.all([
      db.from('user_profile').select('*').eq('user_email', user.email),
      db.from('round').select('*').eq('user_email', user.email),
      db.from('session_log').select('*').eq('user_email', user.email),
      db.from('badge').select('*').eq('user_email', user.email),
    ]);

    const profile = profilesRes.data?.[0];
    if (!profile) return json({ newBadges: [] });

    const allRounds = roundsRes.data || [];
    const allSessions = sessionsRes.data || [];
    const existingBadges = badgesRes.data || [];

    const earned = new Set(existingBadges.map((b) => b.badge_id));
    const newBadges: typeof BADGE_DEFINITIONS = [];
    const now = new Date().toISOString();

    const completedSessions = allSessions.filter((s) => s.completed);
    const totalActivity = allRounds.length + completedSessions.length;

    const awardBadge = async (def?: typeof BADGE_DEFINITIONS[number]) => {
      if (!def || earned.has(def.id)) return;
      earned.add(def.id);
      newBadges.push(def);
      await db.from('badge').insert({
        user_email: user.email, badge_id: def.id, badge_name: def.name, badge_tier: def.tier, earned_at: now,
      });
      await db.from('notification').insert({
        user_email: user.email, type: 'badge',
        message: `🏅 You earned the "${def.name}" badge! ${def.desc}`, read: false, created_at: now,
      });
    };

    const byId = (id: string) => BADGE_DEFINITIONS.find((b) => b.id === id);

    if (allRounds.length >= 1) await awardBadge(byId('first_tee'));
    if (completedSessions.length >= 1) await awardBadge(byId('range_day'));
    if (allRounds.length >= 3) await awardBadge(byId('showing_up'));
    if ((profile.streak_days || 0) >= 5) await awardBadge(byId('hot_streak'));
    if ((profile.streak_days || 0) >= 7) await awardBadge(byId('on_the_bag'));
    if (completedSessions.length >= 10) await awardBadge(byId('the_grind'));
    if (allRounds.length >= 10) await awardBadge(byId('regular'));
    if ((profile.streak_days || 0) >= 30) await awardBadge(byId('iron_man'));
    if (totalActivity >= 100) await awardBadge(byId('century_club'));

    // Moving the Needle — handicap improved from initial onboarding value
    const { data: handicapEntries } = await db.from('handicap_entry')
      .select('*').eq('user_email', user.email).order('entry_date', { ascending: true }).limit(50);
    const hcps = handicapEntries || [];
    if (hcps.length >= 2) {
      const first = hcps[0];
      const latest = hcps[hcps.length - 1];
      if (latest.handicap < first.handicap) {
        await awardBadge(byId('moving_the_needle'));
        if (first.handicap - latest.handicap >= 5) await awardBadge(byId('scratch_chaser'));
      }
    }

    if (profile.subscription_plan === 'pro' && profile.subscription_status === 'pro') {
      await awardBadge(byId('all_in'));
    }

    if (!earned.has('caddie_ai_og') && profile.og_user_number && profile.og_user_number <= 100) {
      await awardBadge(byId('caddie_ai_og'));
    }

    return json({ newBadges });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
