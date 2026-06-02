import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { tab } = await req.json().catch(() => ({}));

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Week start (Monday)
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - daysToMonday);
    const weekStart = weekStartDate.toISOString().split('T')[0];

    let entries: unknown[] = [];
    let myEntry = null;

    if (tab === 'month' || !tab) {
      const { data } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
      const allEntries = data || [];
      const publicEntries = allEntries.filter((e) => e.meets_age_criteria !== false && !e.is_account_flagged);
      myEntry = allEntries.find((e) => e.user_email === user.email);
      publicEntries.sort((a, b) => {
        if (b.total_score !== a.total_score) return b.total_score - a.total_score;
        return (b.streak_days || 0) - (a.streak_days || 0);
      });
      entries = publicEntries;
    } else if (tab === 'week') {
      const { data } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
      const allEntries = data || [];
      const publicEntries = allEntries.filter((e) =>
        e.meets_age_criteria !== false && !e.is_account_flagged && e.week_start === weekStart);
      myEntry = allEntries.find((e) => e.user_email === user.email);
      publicEntries.sort((a, b) => (b.week_activity_score || 0) - (a.week_activity_score || 0));
      entries = publicEntries;
    } else if (tab === 'streaks') {
      const { data } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
      const allEntries = data || [];
      const publicEntries = allEntries.filter((e) => e.meets_age_criteria !== false && !e.is_account_flagged);
      myEntry = allEntries.find((e) => e.user_email === user.email);
      publicEntries.sort((a, b) => (b.streak_days || 0) - (a.streak_days || 0));
      entries = publicEntries;
    } else if (tab === 'alltime') {
      const { data } = await db.from('leaderboard_entry').select('*');
      const eligible = (data || []).filter((e) => !e.is_account_flagged);
      const byUser: Record<string, { user_email: string; display_name: string; total_activity: number }> = {};
      for (const e of eligible) {
        if (!byUser[e.user_email]) {
          byUser[e.user_email] = { user_email: e.user_email, display_name: e.display_name, total_activity: 0 };
        }
        byUser[e.user_email].total_activity += (e.rounds_logged || 0) + (e.sessions_logged || 0);
      }
      entries = Object.values(byUser).sort((a, b) => b.total_activity - a.total_activity);
    }

    // Prev month champion
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthYear = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const { data: hofEntries } = await db.from('hall_of_fame').select('*').eq('month_year', prevMonthYear);
    const prevChampion = hofEntries?.[0] || null;

    // Hall of Fame (all, newest month first)
    const { data: hof } = await db.from('hall_of_fame').select('*');
    const hallOfFame = (hof || []).sort((a, b) => b.month_year.localeCompare(a.month_year));

    return json({ entries, prevChampion, hallOfFame, myEntry });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
