-- NotificationPreferences.jsx reads and writes user_profile.notification_preferences
-- (a JSONB blob: { practice_reminders, weekly_insights, ... }), but the column
-- was never declared in Base44's UserProfile entity definition. Same pattern as
-- round.course_rating / leaderboard_extra_columns / user_profile.handicap_last_updated —
-- frontend silently tolerates `undefined` on read, but `.update({notification_preferences:...})`
-- fails with "column does not exist", so the toggle UI updates locally but never persists.
alter table public.user_profile
  add column if not exists notification_preferences jsonb default '{}'::jsonb;
