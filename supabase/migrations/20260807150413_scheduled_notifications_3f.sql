-- SOW 3f: the scheduling layer for proactive notifications.
-- (a) give the 'nudge' type a proper push title + home deep link,
-- (b) enable pg_cron and schedule the daily re-engagement job.

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
  select decrypted_secret into v_supabase_url
    from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_supabase_url is null or v_service_role_key is null then return new; end if;
  if new.user_email is null or new.user_email = '' then return new; end if;

  select coalesce((notification_preferences->>'push_enabled')::boolean, false)
    into v_push_enabled
  from public.user_profile where lower(user_email) = lower(new.user_email) limit 1;
  if not coalesce(v_push_enabled, false) then return new; end if;

  v_title := case new.type
    when 'badge'           then 'You earned a badge'
    when 'weekly_report'   then 'Your Weekly Report is ready'
    when 'winner'          then '🏆 Monthly winner!'
    when 'leaderboard'     then 'Leaderboard update'
    when 'flagged_session' then '⚠️ Session flagged for review'
    when 'nudge'           then 'Your plan is waiting'
    else 'Caddie AI'
  end;
  v_body := coalesce(new.message, 'Open Caddie AI to see the latest.');

  v_data := jsonb_build_object(
    'url', case new.type
      when 'badge'           then 'caddieai://profile'
      when 'weekly_report'   then 'caddieai://progress'
      when 'winner'          then 'caddieai://leaderboard'
      when 'leaderboard'     then 'caddieai://leaderboard'
      when 'flagged_session' then 'caddieai://admin/flagged'
      when 'nudge'           then 'caddieai://home'
      else                        'caddieai://home'
    end,
    'notification_id', new.id,
    'type', new.type
  );

  perform net.http_post(
    url     := v_supabase_url || '/functions/v1/sendPushNotification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('user_email', new.user_email, 'title', v_title, 'body', v_body, 'data', v_data)
  );
  return new;
exception when others then
  raise warning '[notification push trigger] % for notification.id=%', sqlerrm, new.id;
  return new;
end;
$$;

create extension if not exists pg_cron;

select cron.unschedule('daily-scheduled-notifications')
  where exists (select 1 from cron.job where jobname = 'daily-scheduled-notifications');

select cron.schedule(
  'daily-scheduled-notifications',
  '0 16 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url')
           || '/functions/v1/runScheduledNotifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $job$
);
