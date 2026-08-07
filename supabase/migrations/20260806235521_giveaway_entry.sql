-- Free-entry (no purchase necessary) submissions for the monthly putter
-- giveaway. Public INSERT (anon form), admin-only read — same posture as
-- waitlist_email. Unique per (email, period) enforces "one free entry per
-- person per Entry Period" (rules §4b) at the DB level, so the anon form
-- never needs SELECT to dedupe (avoids the anon-insert-select RLS trap).
create table public.giveaway_entry (
  id            text primary key default gen_random_uuid()::text,
  created_date  timestamptz not null default now(),
  name          text,
  email         text not null,
  social_handle text,
  entry_period  text not null,       -- 'YYYY-MM'
  source        text default 'free_form'
);
create unique index giveaway_entry_email_period_uq
  on public.giveaway_entry (lower(email), entry_period);

alter table public.giveaway_entry enable row level security;
create policy giveaway_entry_public_insert on public.giveaway_entry for insert
  to anon, authenticated with check (true);
create policy giveaway_entry_admin_select on public.giveaway_entry for select
  using (public.is_admin());
create policy giveaway_entry_admin_update on public.giveaway_entry for update
  using (public.is_admin()) with check (public.is_admin());
create policy giveaway_entry_admin_delete on public.giveaway_entry for delete
  using (public.is_admin());
