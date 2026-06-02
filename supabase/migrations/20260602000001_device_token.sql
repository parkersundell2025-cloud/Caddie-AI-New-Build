-- ---------------------------------------------------------------------------
-- device_token — one row per (user, device). Backend push-sender (TBD) reads
-- this table to find delivery targets when inserting a notification row.
--
-- Tokens are issued by APNs / FCM and rotated by the OS (app uninstall, OS
-- reset, etc.), so the same physical device can show up under different
-- tokens over time. `token` is the natural key.
--
-- platform = 'ios' | 'android'. Web push is out of scope here; if we add it
-- later we'd extend the CHECK and add a webpush_endpoint column.
--
-- user_email is the join key (matches user_profile.user_email — lowercased
-- per email-case-rls-trap migration 20260530120000).
-- ---------------------------------------------------------------------------

create table if not exists public.device_token (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null,
  platform    text not null check (platform in ('ios', 'android')),
  token       text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_device_token_user_email
  on public.device_token ((lower(user_email)));

alter table public.device_token enable row level security;

-- Owners can manage their own rows. Service role bypasses RLS (default
-- Supabase behaviour) and is the only thing that should ever cross-read
-- user tokens — e.g. the future sendPushNotification edge function.
create policy device_token_select on public.device_token for select
  using (lower(user_email) = auth.email());

create policy device_token_insert on public.device_token for insert
  with check (lower(user_email) = auth.email());

create policy device_token_update on public.device_token for update
  using (lower(user_email) = auth.email())
  with check (lower(user_email) = auth.email());

create policy device_token_delete on public.device_token for delete
  using (lower(user_email) = auth.email());

-- Touch updated_at on any UPDATE so the backend sender can prioritise
-- recently-seen devices when a user has multiple tokens (e.g. iPhone +
-- iPad). Trigger function is local to this migration — no other table
-- needs it yet.
create or replace function public.device_token_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_device_token_touch_updated_at
  before update on public.device_token
  for each row execute function public.device_token_touch_updated_at();
