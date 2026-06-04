-- ---------------------------------------------------------------------------
-- Auto-dispatch a push notification when an insert lands in public.notification.
--
-- Architecture:
--   1. notification row INSERT (from checkBadges / updateLeaderboard /
--      generateWeeklyReport / processMonthlyWinner edge functions, today).
--   2. AFTER INSERT trigger fires this function.
--   3. Function checks the recipient's notification_preferences.push_enabled.
--      If false (or unset), skip — token is preserved in device_token but
--      this delivery is suppressed.
--   4. Builds the APNs payload (title + body + deep-link URL by type) and
--      POSTs to the sendPushNotification edge function via pg_net.
--   5. Failures are swallowed (RAISE WARNING) so a broken push pipeline
--      never blocks the underlying notification insert.
--
-- Required out-of-band setup (run from Supabase Dashboard → SQL editor —
-- the secrets live in Supabase Vault because Supabase's managed Postgres
-- doesn't grant the superuser privileges that ALTER DATABASE SET would need):
--
--   SELECT vault.create_secret(
--     'https://dbvsnzppevytanoxzgwj.supabase.co',
--     'supabase_url',
--     'Used by the notification → push trigger'
--   );
--
--   SELECT vault.create_secret(
--     '<paste service_role key from Project Settings → API>',
--     'service_role_key',
--     'Used by the notification → push trigger to call sendPushNotification'
--   );
--
-- If you ever need to update them:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'service_role_key'),
--     '<new value>'
--   );
--
-- Without these secrets the trigger silently no-ops.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_user_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  v_supabase_url      text;
  v_service_role_key  text;
  v_push_enabled      boolean;
  v_title             text;
  v_body              text;
  v_data              jsonb;
begin
  -- Secrets are read from Supabase Vault each fire — the view decrypts
  -- per-call so the plain values never leak into query logs / pg_stat.
  -- Both reads tolerate the rows being missing (returns null), so the
  -- trigger silently no-ops on a freshly migrated DB where the secrets
  -- haven't been seeded yet.
  select decrypted_secret into v_supabase_url
    from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_supabase_url is null or v_service_role_key is null then
    return new; -- not configured; silently skip
  end if;
  if new.user_email is null or new.user_email = '' then
    return new; -- malformed row; skip
  end if;

  -- Master push opt-in lives on user_profile.notification_preferences (set
  -- from the NotificationPreferences page). If absent or false, the user
  -- has not consented to push and we don't deliver — even though their
  -- device_token row may still be present from a previous opt-in.
  select coalesce((notification_preferences->>'push_enabled')::boolean, false)
    into v_push_enabled
  from public.user_profile
  where lower(user_email) = lower(new.user_email)
  limit 1;

  if not coalesce(v_push_enabled, false) then
    return new;
  end if;

  -- Push title is a short hook; APNs payload also carries the original
  -- message verbatim as the body so tapping the notification gives users
  -- the same content they'd see on /notifications.
  v_title := case new.type
    when 'badge'          then 'You earned a badge'
    when 'weekly_report'  then 'Your Weekly Report is ready'
    when 'winner'         then '🏆 Monthly winner!'
    when 'leaderboard'    then 'Leaderboard update'
    else 'Caddie AI'
  end;
  v_body := coalesce(new.message, 'Open Caddie AI to see the latest.');

  -- Deep-link URL routes the tap into the right SPA screen via the
  -- PushTapRouter we set up in App.jsx (parses caddieai:// URLs and
  -- navigates the SPA).
  v_data := jsonb_build_object(
    'url', case new.type
      when 'badge'          then 'caddieai://profile'
      when 'weekly_report'  then 'caddieai://progress'
      when 'winner'         then 'caddieai://leaderboard'
      when 'leaderboard'    then 'caddieai://leaderboard'
      else                       'caddieai://home'
    end,
    'notification_id', new.id,
    'type', new.type
  );

  -- Fire the sendPushNotification edge function asynchronously. pg_net
  -- queues the request and returns a request_id; we don't await it because
  -- delivery latency shouldn't block the row insert.
  perform net.http_post(
    url     := v_supabase_url || '/functions/v1/sendPushNotification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'user_email', new.user_email,
      'title',      v_title,
      'body',       v_body,
      'data',       v_data
    )
  );

  return new;

exception when others then
  -- A broken push pipeline must never break the original insert. Log to
  -- postgres logs (visible in Supabase Dashboard → Logs → Postgres) and
  -- let the row land normally.
  raise warning '[notification push trigger] % for notification.id=%', sqlerrm, new.id;
  return new;
end;
$$;

drop trigger if exists trg_notification_push on public.notification;
create trigger trg_notification_push
  after insert on public.notification
  for each row
  execute function public.notify_user_push_on_notification_insert();
