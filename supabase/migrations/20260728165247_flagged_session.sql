-- Phase 3 anti-cheat: FlaggedSession entity (mirrors flagged_round) +
-- per-drill elapsed time captured by the guided session mode.
create table public.flagged_session (
  id               text primary key default gen_random_uuid()::text,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text,
  user_email       text,
  session_log_id   text,
  session_date     date,
  session_type     text,
  drill_count      integer,
  measured_minutes numeric,
  expected_minutes numeric,
  reason           text,
  status           text check (status in ('pending','approved','ignored')) default 'pending'
);

alter table public.flagged_session enable row level security;
create policy flagged_session_admin on public.flagged_session for all
  using (public.is_admin()) with check (public.is_admin());

create trigger flagged_session_touch_updated before update on public.flagged_session
  for each row execute function public.touch_updated_date();

alter table public.drill_rating
  add column if not exists elapsed_seconds integer;
