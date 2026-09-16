-- CONVERSION_FIXES #8, increment 2: server-only writer for the billing truth
-- ledger (analytics.billing_events, created by 20260916175322).
--
-- Same posture as track_funnel_event: SECURITY DEFINER into the non-exposed
-- `analytics` schema, EXECUTE only for service_role, and the unique key
-- (provider, environment, provider_event_id) turns a provider retry into a
-- no-op (returns false) instead of a second trial/payment fact.
--
-- Rollback: scripts/rollback-funnel-events.sql (drops this function and the
-- schema).

create or replace function public.record_billing_event(
  p_provider          text,
  p_environment       text,
  p_provider_event_id text,
  p_event_type        text,
  p_user_id           uuid        default null,
  p_occurred_at       timestamptz default null,
  p_properties        jsonb       default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = analytics, pg_temp
as $$
declare n integer;
begin
  if p_provider is null or p_environment is null or p_provider_event_id is null or p_event_type is null then
    raise exception 'provider, environment, provider_event_id and event_type are required';
  end if;
  insert into analytics.billing_events (
    provider, environment, provider_event_id, event_type, user_id, occurred_at, properties
  ) values (
    p_provider, p_environment, p_provider_event_id, p_event_type, p_user_id,
    coalesce(p_occurred_at, now()), coalesce(p_properties, '{}'::jsonb)
  )
  on conflict (provider, environment, provider_event_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default — take it back.
revoke all on function public.record_billing_event(text,text,text,text,uuid,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_billing_event(text,text,text,text,uuid,timestamptz,jsonb)
  to service_role;
