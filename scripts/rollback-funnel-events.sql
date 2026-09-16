-- ROLLBACK for the funnel-events migration (CONVERSION_FIXES #8).
--
-- The migration was additive and isolated, so this fully reverses it and
-- touches nothing else. Run in the Supabase SQL editor (or via the MCP) as a
-- privileged role. Order matters: the RPC lives in `public`, the data in
-- `analytics`.
--
-- After running this:
--   1. Delete the `trackFunnelEvent` edge function (Dashboard → Edge Functions,
--      or `supabase functions delete trackFunnelEvent`).
--   2. Revert the client/server emit calls in git (src/lib/funnel.js and its
--      call sites; the RPC calls in syncSubscription / generateInitialPlan) and
--      redeploy those two functions. Emit calls are fire-and-forget and never
--      block a purchase or plan, so a stale client build only logs warnings.
--
-- NOTE: this file is deliberately NOT under supabase/migrations/ — anything
-- there is applied by `db push`.

drop function if exists public.track_funnel_event(
  uuid, text, timestamptz, text, uuid, integer, text, text, text, text,
  text, text, text, text, text, text, text, jsonb, text, text
);

-- Increment 2 (revenueCatWebhook billing ledger). Also revert the
-- recordBillingEvent calls in revenueCatWebhook and redeploy it with
-- --no-verify-jwt; like the others it is fire-and-forget, so a stale deploy
-- only logs a warning per event.
drop function if exists public.record_billing_event(
  text, text, text, text, uuid, timestamptz, jsonb
);

drop schema if exists analytics cascade;  -- drops funnel_events, billing_events, indexes, sequence
