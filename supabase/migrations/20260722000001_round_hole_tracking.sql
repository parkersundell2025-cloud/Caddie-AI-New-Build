-- Phase 2.1: hole-by-hole stat tracking.
-- round.holes_played: null = legacy round (assume 18). 9-hole rounds are
-- excluded from handicap/leaderboard differential math, which is 18-hole.
alter table public.round add column if not exists holes_played integer;

create table public.round_hole (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text not null,
  round_id     text not null references public.round(id) on delete cascade,
  hole_number  integer not null check (hole_number between 1 and 18),
  par          integer not null default 4 check (par in (3, 4, 5)),
  score        integer not null check (score between 1 and 15),
  fairway      text check (fairway in ('hit', 'miss_left', 'miss_right', 'na')),
  gir          boolean,
  -- 4 means "4+" (capped in the entry UI)
  putts        integer check (putts between 1 and 4),
  -- client tap time for each hole; input for Phase 3 time-plausibility checks
  logged_at    timestamptz,
  unique (round_id, hole_number)
);

create index round_hole_round_idx on public.round_hole (round_id);
create index round_hole_user_idx on public.round_hole (user_email);

alter table public.round_hole enable row level security;

create policy owner_select on public.round_hole for select
  using (user_email = auth.email() or public.is_admin());
create policy owner_insert on public.round_hole for insert
  with check (user_email = auth.email() or public.is_admin());
create policy owner_update on public.round_hole for update
  using (user_email = auth.email() or public.is_admin())
  with check (user_email = auth.email() or public.is_admin());
create policy owner_delete on public.round_hole for delete
  using (user_email = auth.email() or public.is_admin());
