-- Columns the round-logging form sends and calculateHandicap reads
-- (course_rating / slope_rating). They never existed in Base44's Round entity
-- definition, but were submitted implicitly. Without them, supabase-js silently
-- rejects every round-insert ("column does not exist") and downstream
-- updateHandicap + checkBadges + updateLeaderboard then run against an empty
-- round set.
alter table public.round
  add column if not exists course_rating numeric,
  add column if not exists slope_rating  numeric;
