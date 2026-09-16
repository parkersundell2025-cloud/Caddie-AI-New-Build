-- Funnel events — CONVERSION_FIXES #8 (FUNNEL_EVENT_STORAGE_DESIGN.md).
--
-- Applied to prod via the Supabase MCP on 2026-09-16; this file is named to
-- match the version the remote recorded (20260916175322) so `db push` sees
-- local and remote history as aligned.
--
-- ADDITIVE AND ISOLATED: a new schema, two new tables and one RPC. No existing
-- table, function, policy or trigger is touched. Full rollback is one file:
--   scripts/rollback-funnel-events.sql   (drops the RPC and the schema)
-- plus deleting the trackFunnelEvent edge function.
--
-- Access model:
--   * `analytics` is NOT added to the Data API's exposed schemas, so PostgREST
--     never serves it — to anyone, including service_role.
--   * RLS is enabled with NO policies and all grants are revoked from
--     anon/authenticated: clients cannot read or write the tables at all.
--   * The only write path is public.track_funnel_event(), SECURITY DEFINER,
--     executable by service_role ONLY. The trackFunnelEvent edge function
--     (client allowlist + user_id from the verified JWT) and the server-side
--     billing/activation handlers are the only callers.
--   * Idempotent: a retried event_id is a no-op (ON CONFLICT DO NOTHING).

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;
grant usage on schema analytics to service_role;

create table if not exists analytics.funnel_events (
  event_id          uuid primary key,
  event_name        text not null,
  schema_version    integer not null default 1 check (schema_version > 0),
  occurred_at       timestamptz not null,
  received_at       timestamptz not null default now(),
  user_id           uuid,
  flow_id           text,
  session_id        text,
  view_id           text,
  attempt_id        text,
  producer          text not null check (producer in ('client','server')),
  environment       text check (environment in ('production','sandbox')),
  platform          text check (platform in ('web','ios','android')),
  app_version       text,
  build_number      text,
  plan_id           text,
  offering_id       text,
  product_id        text,
  properties        jsonb not null default '{}'::jsonb,
  request_id        text,
  provider_event_id text,
  constraint funnel_events_properties_small check (length(properties::text) <= 4096)
);
create index if not exists funnel_events_user_time_idx on analytics.funnel_events (user_id, occurred_at);
create index if not exists funnel_events_name_time_idx on analytics.funnel_events (event_name, occurred_at);
create index if not exists funnel_events_attempt_idx   on analytics.funnel_events (attempt_id) where attempt_id is not null;

-- Billing truth ledger: one row per provider delivery, so provider retries and
-- a Stripe invoice mirrored by RevenueCat are counted once.
create table if not exists analytics.billing_events (
  id                bigserial primary key,
  provider          text not null check (provider in ('revenuecat','stripe')),
  environment       text not null check (environment in ('production','sandbox')),
  provider_event_id text not null,
  event_type        text not null,
  user_id           uuid,
  occurred_at       timestamptz,
  received_at       timestamptz not null default now(),
  properties        jsonb not null default '{}'::jsonb,
  unique (provider, environment, provider_event_id)
);

alter table analytics.funnel_events  enable row level security;
alter table analytics.billing_events enable row level security;
revoke all on analytics.funnel_events  from public, anon, authenticated;
revoke all on analytics.billing_events from public, anon, authenticated;
grant select, insert on analytics.funnel_events  to service_role;
grant select, insert on analytics.billing_events to service_role;
grant usage, select on sequence analytics.billing_events_id_seq to service_role;

create or replace function public.track_funnel_event(
  p_event_id          uuid,
  p_event_name        text,
  p_occurred_at       timestamptz,
  p_producer          text,
  p_user_id           uuid    default null,
  p_schema_version    integer default 1,
  p_flow_id           text    default null,
  p_session_id        text    default null,
  p_view_id           text    default null,
  p_attempt_id        text    default null,
  p_environment       text    default null,
  p_platform          text    default null,
  p_app_version       text    default null,
  p_build_number      text    default null,
  p_plan_id           text    default null,
  p_offering_id       text    default null,
  p_product_id        text    default null,
  p_properties        jsonb   default '{}'::jsonb,
  p_request_id        text    default null,
  p_provider_event_id text    default null
) returns boolean
language plpgsql
security definer
set search_path = analytics, pg_temp
as $$
declare n integer;
begin
  if p_event_id is null or p_event_name is null or p_occurred_at is null or p_producer is null then
    raise exception 'event_id, event_name, occurred_at and producer are required';
  end if;
  insert into analytics.funnel_events (
    event_id, event_name, schema_version, occurred_at, user_id, flow_id, session_id,
    view_id, attempt_id, producer, environment, platform, app_version, build_number,
    plan_id, offering_id, product_id, properties, request_id, provider_event_id
  ) values (
    p_event_id, p_event_name, coalesce(p_schema_version, 1), p_occurred_at, p_user_id,
    p_flow_id, p_session_id, p_view_id, p_attempt_id, p_producer, p_environment,
    p_platform, p_app_version, p_build_number, p_plan_id, p_offering_id, p_product_id,
    coalesce(p_properties, '{}'::jsonb), p_request_id, p_provider_event_id
  )
  on conflict (event_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default — take it back.
revoke all on function public.track_funnel_event(uuid,text,timestamptz,text,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.track_funnel_event(uuid,text,timestamptz,text,uuid,integer,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text)
  to service_role;
