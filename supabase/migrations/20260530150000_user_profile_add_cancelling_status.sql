-- ---------------------------------------------------------------------------
-- Add 'cancelling' to the subscription_status CHECK constraint.
--
-- Background: the app code in `src/pages/Gateway.jsx`, `src/App.jsx`
-- (RootRoute.isCancellingButActive), and `src/components/SubscriptionGate.jsx`
-- already treat `subscription_status = 'cancelling'` as a valid state — it
-- means "the user has opted to cancel at period end, but their paid access is
-- still active until trial_end_date / current_period_end". The Base44
-- revenueCatWebhook writes this value on CANCELLATION events. The initial
-- Supabase schema only listed ('trial','basic','pro','expired'), so the
-- ported webhook would 23514 on the first CANCELLATION event.
--
-- This is purely additive — existing rows remain valid, no data migration.
-- ---------------------------------------------------------------------------

alter table public.user_profile
  drop constraint if exists user_profile_subscription_status_check;

alter table public.user_profile
  add constraint user_profile_subscription_status_check
  check (subscription_status in ('trial','basic','pro','expired','cancelling'));
