-- Columns written/read by the updateLeaderboard & getLeaderboard edge functions
-- but absent from Base44's LeaderboardEntry entity definition. Base44 allowed
-- additive fields not declared in the schema; Postgres requires them declared.
alter table public.leaderboard_entry
  add column if not exists week_activity_score    numeric default 0,
  add column if not exists week_start             text,
  add column if not exists lowest_rank_this_month numeric;
