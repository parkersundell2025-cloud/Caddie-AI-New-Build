-- ---------------------------------------------------------------------------
-- Normalize user_profile.user_email on every insert/update.
--
-- Companion to the lowercase-RLS migration. Without this, mixed-case rows
-- that bypass the application normalization (e.g. service-role writes from
-- a future Stripe/RevenueCat webhook, a SQL fix-up done in the dashboard)
-- still wouldn't be findable via `.eq('user_email', auth.email())` from the
-- client — PostgREST passes the bound parameter into a case-sensitive `=`
-- operator, so even though RLS would allow the row to be read (it uses
-- lower(user_email) = auth.email()), the WHERE clause never matches it.
--
-- The trigger forces user_email to its lowercased form at write time so
-- there's a single canonical representation in the table going forward.
-- Existing rows are normalized once in the same migration.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_user_profile_email() returns trigger as $$
begin
  if new.user_email is not null then
    new.user_email := lower(new.user_email);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists normalize_user_email_trigger on public.user_profile;
create trigger normalize_user_email_trigger
  before insert or update on public.user_profile
  for each row execute function public.normalize_user_profile_email();

-- One-shot data fix: lowercase any existing mixed-case rows.
update public.user_profile
  set user_email = lower(user_email)
  where user_email is not null
    and user_email <> lower(user_email);
