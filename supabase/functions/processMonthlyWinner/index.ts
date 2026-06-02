import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

// Scheduled task (runs as service role): finalize previous month's leaderboard,
// award the winner a Stripe credit + Hall of Fame entry + badges, notify everyone.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = serviceClient();

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthYear = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthName = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const { data: entriesData } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
    const entries = entriesData || [];
    if (entries.length === 0) return json({ message: 'No entries for month' });

    const rankSort = (a: Record<string, number>, b: Record<string, number>) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return (b.streak_days || 0) - (a.streak_days || 0);
    };

    entries.sort(rankSort);
    for (let i = 0; i < entries.length; i++) {
      await db.from('leaderboard_entry').update({ rank: i + 1 }).eq('id', entries[i].id);
    }

    const eligibleEntries = entries.filter((e) => e.meets_age_criteria !== false && !e.is_account_flagged);
    if (eligibleEntries.length === 0) return json({ message: 'No eligible entries for month' });
    eligibleEntries.sort(rankSort);

    const winners = [eligibleEntries[0]];
    if (eligibleEntries.length > 1 &&
      eligibleEntries[1].total_score === eligibleEntries[0].total_score &&
      eligibleEntries[1].streak_days === eligibleEntries[0].streak_days) {
      winners.push(eligibleEntries[1]);
    }

    const PLAN_CREDITS: Record<string, number> = { basic: 1500, pro: 3000 };
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    // deno-lint-ignore no-explicit-any
    let stripe: any = null;
    if (stripeKey) {
      const Stripe = (await import('npm:stripe@14.21.0')).default;
      stripe = new Stripe(stripeKey);
    }

    for (const winner of winners) {
      const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', winner.user_email);
      const profile = profiles?.[0];
      if (!profile) continue;

      if (stripe && profile.stripe_customer_id) {
        const plan = profile.subscription_plan || 'basic';
        const creditAmount = PLAN_CREDITS[plan] || 1500;
        try {
          await stripe.customers.createBalanceTransaction(profile.stripe_customer_id, {
            amount: -creditAmount, currency: 'usd', description: `Monthly leaderboard winner - ${monthName}`,
          });
        } catch (e) { console.error('Stripe credit failed:', (e as Error).message); }
      }

      await db.from('hall_of_fame').insert({
        user_email: winner.user_email,
        display_name: winner.display_name,
        month_year: monthYear,
        winning_score: winner.total_score,
        rounds_logged: winner.rounds_logged,
        sessions_logged: winner.sessions_logged,
        final_handicap: winner.handicap_current,
      });

      const now2 = new Date().toISOString();
      const { data: existingBadges } = await db.from('badge').select('badge_id').eq('user_email', winner.user_email);
      const earnedIds = new Set((existingBadges || []).map((b) => b.badge_id));

      for (const badge of [
        { id: 'champion', name: 'Champion', tier: 'competitive' },
        { id: 'hall_of_famer', name: 'Hall of Famer', tier: 'prestige' },
      ]) {
        if (!earnedIds.has(badge.id)) {
          await db.from('badge').insert({ user_email: winner.user_email, badge_id: badge.id, badge_name: badge.name, badge_tier: badge.tier, earned_at: now2 });
        }
      }

      const { data: hofEntries } = await db.from('hall_of_fame').select('id').eq('user_email', winner.user_email);
      const hofCount = hofEntries?.length ?? 0;
      if (hofCount >= 2 && !earnedIds.has('back_to_back')) {
        await db.from('badge').insert({ user_email: winner.user_email, badge_id: 'back_to_back', badge_name: 'Back to Back', badge_tier: 'competitive', earned_at: now2 });
      }
      if (hofCount >= 3 && !earnedIds.has('dynasty')) {
        await db.from('badge').insert({ user_email: winner.user_email, badge_id: 'dynasty', badge_name: 'Dynasty', badge_tier: 'competitive', earned_at: now2 });
      }

      await db.from('notification').insert({
        user_email: winner.user_email, type: 'leaderboard_win',
        message: `🏆 You won the Caddie AI leaderboard this month — you've earned a free month! It will be applied to your next billing cycle automatically. Your achievement has been added to the Hall of Fame.`,
        read: false, created_at: now2,
      });
    }

    // Notify all other subscribers
    const { data: allProfilesData } = await db.from('user_profile').select('*');
    const allProfiles = allProfilesData || [];
    const subscribers = allProfiles.filter((p) => p.subscription_status === 'basic' || p.subscription_status === 'pro');
    const winnerName = winners[0]?.display_name || 'a fellow golfer';
    const now3 = new Date().toISOString();
    for (const p of subscribers) {
      if (winners.find((w) => w.user_email === p.user_email)) continue;
      await db.from('notification').insert({
        user_email: p.user_email, type: 'leaderboard_monthly',
        message: `🏆 Congratulations to ${winnerName} for winning the Caddie AI leaderboard in ${monthName}! Keep logging rounds and practice sessions to take the top spot next month.`,
        read: false, created_at: now3,
      });
    }

    // Weekly Grinder badge — top weekly activity
    const topWeeklyEntry = entries.reduce((best, e) => ((e.week_activity_score || 0) > (best?.week_activity_score || 0) ? e : best), null as Record<string, number> | null);
    if (topWeeklyEntry && (topWeeklyEntry.week_activity_score || 0) > 0) {
      const weeklyEmail = topWeeklyEntry.user_email as unknown as string;
      const { data: weeklyBadges } = await db.from('badge').select('badge_id').eq('user_email', weeklyEmail);
      if (!(weeklyBadges || []).some((b) => b.badge_id === 'weekly_grinder')) {
        const ts = new Date().toISOString();
        await db.from('badge').insert({ user_email: weeklyEmail, badge_id: 'weekly_grinder', badge_name: 'Weekly Grinder', badge_tier: 'competitive', earned_at: ts });
        await db.from('notification').insert({ user_email: weeklyEmail, type: 'badge', message: '💪 You earned the "Weekly Grinder" badge! You topped the weekly activity leaderboard.', read: false, created_at: ts });
      }
    }

    // Top 50 / top 10 / podium badges
    for (let i = 0; i < entries.length; i++) {
      const rank = i + 1;
      const email = entries[i].user_email;
      const { data: existingBadges } = await db.from('badge').select('badge_id').eq('user_email', email);
      const earnedIds = new Set((existingBadges || []).map((b) => b.badge_id));
      const ts = new Date().toISOString();
      const award = async (id: string, name: string, msg: string) => {
        await db.from('badge').insert({ user_email: email, badge_id: id, badge_name: name, badge_tier: 'competitive', earned_at: ts });
        await db.from('notification').insert({ user_email: email, type: 'badge', message: msg, read: false, created_at: ts });
      };
      if (rank <= 50 && !earnedIds.has('on_the_board')) await award('on_the_board', 'On The Board', '🏅 You earned the "On The Board" badge! Appeared in the top 50 on the leaderboard.');
      if (rank <= 10 && !earnedIds.has('contender')) await award('contender', 'Contender', '🏅 You earned the "Contender" badge! Finished top 10 in the monthly leaderboard.');
      if (rank <= 3 && !earnedIds.has('podium')) await award('podium', 'Podium', '🏅 You earned the "Podium" badge! Finished top 3 in the monthly leaderboard.');
    }

    return json({ success: true, monthYear, winners: winners.map((w) => w.display_name) });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
