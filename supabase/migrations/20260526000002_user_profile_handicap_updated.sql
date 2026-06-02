-- updateHandicap writes handicap_last_updated; absent from the Base44
-- UserProfile entity definition (additive field Base44 allowed implicitly).
alter table public.user_profile
  add column if not exists handicap_last_updated timestamptz;
