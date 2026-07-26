-- 3e: account hygiene. Distinguishes non-commercial accounts so metrics,
-- leaderboard, and prize selection can treat them correctly:
--   test          — internal/dev accounts, hidden from the leaderboard
--   beta_lifetime — Parker's beta group (free forever via the TEST coupon);
--                   visible on the leaderboard, ineligible for prizes
--   promotional   — comped accounts; same treatment as beta
-- null = normal customer.
alter table public.user_profile add column if not exists account_flag text
  check (account_flag in ('test', 'beta_lifetime', 'promotional'));
