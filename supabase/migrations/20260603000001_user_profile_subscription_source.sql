-- ---------------------------------------------------------------------------
-- subscription_source — tracks which store the user's active subscription
-- came from. Apple's Guideline 5.1.1 requires that Cancel UI for in-app
-- purchases links to iOS Settings → Subscriptions, not an in-app cancel
-- button. We can't tell which UI to show without knowing the source.
--
-- Populated by revenueCatWebhook from RC's `store` field on the event
-- payload (lowercased). Null for users predating this column or for
-- subscriptions that came in via the legacy Base44 Stripe flow before the
-- RC webhook was wired — the cancel UI treats null as "show in-app cancel"
-- (the safer default, matches the current web-only flow).
--
-- Values:
--   'app_store'      Apple IAP — Cancel UI must link to iOS Settings
--   'play_store'     Google Play Billing — Cancel UI must link to Play Store subscriptions
--   'mac_app_store'  macOS App Store IAP — same as app_store
--   'stripe'         Web purchase via Stripe — in-app cancel is fine
--   'promotional'    RC-granted promo / lifetime — in-app cancel hidden / treated as no-op
--   'amazon'         Amazon Appstore — currently unused (no Amazon Fire support)
-- ---------------------------------------------------------------------------

alter table public.user_profile
  add column if not exists subscription_source text
    check (subscription_source in ('app_store','play_store','mac_app_store','stripe','promotional','amazon'));
