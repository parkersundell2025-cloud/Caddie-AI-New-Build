import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { targetEmail } = await req.json().catch(() => ({}));
    const email = targetEmail || user.email;

    const [profilesRes, roundsRes, sessionsRes, badgesRes, hcpRes] = await Promise.all([
      db.from('user_profile').select('*').eq('user_email', email),
      db.from('round').select('*').eq('user_email', email),
      db.from('session_log').select('*').eq('user_email', email),
      db.from('badge').select('*').eq('user_email', email),
      db.from('handicap_entry').select('*').eq('user_email', email),
    ]);

    const profile = profilesRes.data?.[0];
    if (!profile) return json({ error: 'Not found' }, 404);

    const rounds = roundsRes.data || [];
    const sessions = sessionsRes.data || [];
    const badges = badgesRes.data || [];
    const handicapEntries = hcpRes.data || [];
    const completedSessions = sessions.filter((s) => s.completed);

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: monthEntriesData } = await db.from('leaderboard_entry').select('*').eq('month_year', monthYear);
    const monthEntries = (monthEntriesData || []).sort((a, b) => b.total_score - a.total_score);
    const myRank = monthEntries.findIndex((e) => e.user_email === email) + 1;
    const myEntry = monthEntries.find((e) => e.user_email === email);

    const hcpHistory = handicapEntries
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((e) => ({ date: e.entry_date, handicap: e.handicap }));

    return json({
      displayName: profile.first_name || 'Golfer',
      currentHandicap: profile.current_handicap,
      totalRounds: rounds.length,
      totalSessions: completedSessions.length,
      streakDays: profile.streak_days || 0,
      monthRank: myRank || null,
      monthScore: myEntry?.total_score || 0,
      badges: badges.sort((a, b) => (b.earned_at || '').localeCompare(a.earned_at || '')),
      handicapHistory: hcpHistory,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
