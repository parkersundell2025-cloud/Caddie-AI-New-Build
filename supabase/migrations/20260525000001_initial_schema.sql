-- ============================================================================
-- Caddie AI — Initial schema (Base44 -> Supabase migration)
-- Generated from base44/entities/*.jsonc (21 entities).
-- ============================================================================
--
-- CONVENTIONS
--   * Table names: singular snake_case, 1:1 with Base44 entities
--     (UserProfile -> user_profile, HallOfFame -> hall_of_fame).
--   * Every table carries Base44's implicit fields so existing data imports
--     verbatim and frontend code that reads them keeps working:
--       id           text primary key  -- preserves Base44's opaque ids
--       created_date timestamptz        -- frontend sorts by '-created_date'
--       updated_date timestamptz
--       created_by   text               -- referenced by some edge functions
--   * Base44 'string' fields that always hold ISO timestamps (set via
--     toISOString()) are typed timestamptz. Ambiguous strings like
--     month_year ('2026-05') stay text.
--   * Base44 'object'/'array' -> jsonb. enums -> CHECK constraints.
--   * No cross-table FKs: Base44 never enforced referential integrity and keys
--     ownership by user_email (text), not a user id. RLS keys off user_email.
--   * NOT NULL only where Base44 marked a field required (just waitlist_email.email).
--
-- RLS lives in the next migration (20260525000002_rls_policies.sql).
-- ============================================================================

-- gen_random_uuid() is in Postgres core (>=13); pgcrypto kept for safety.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- user_profile  (explicit RLS in Base44: owner read; owner|admin write)
-- ---------------------------------------------------------------------------
create table public.user_profile (
  id                              text primary key default gen_random_uuid()::text,
  created_date                    timestamptz not null default now(),
  updated_date                    timestamptz not null default now(),
  created_by                      text,
  user_email                      text,
  first_name                      text,
  profile_picture                 text,
  current_handicap                numeric,
  goal_handicap                   numeric,
  target_timeline                 text check (target_timeline in ('3 months','6 months','1 year')),
  rounds_per_month                numeric,
  days_per_week                   numeric,
  preferred_days                  jsonb,
  skill_driving                   numeric,
  skill_iron_play                 numeric,
  skill_short_game                numeric,
  skill_putting                   numeric,
  skill_course_management         numeric,
  onboarding_complete             boolean default false,
  tour_completed                  boolean default false,
  trial_start_date                date,
  trial_end_date                  date,
  subscription_status             text check (subscription_status in ('trial','basic','pro','expired')) default 'trial',
  subscription_plan               text check (subscription_plan in ('basic','pro')) default 'basic',
  subscription_annual             boolean default false,
  streak_days                     numeric default 0,
  last_session_date               date,
  session_type_preferences        jsonb,
  session_distribution            jsonb,
  intensity_preference            text check (intensity_preference in ('short','medium','long')) default 'medium',
  stripe_customer_id              text,
  stripe_subscription_id          text,
  revenuecat_app_user_id          text,
  referral_code                   text,
  referred_by_code                text,
  popup_referral_shown            boolean default false,
  popup_review_shown              boolean default false,
  referral_page_visited           boolean default false,
  popup_leaderboard_join_shown    boolean default false,
  popup_leaderboard_howto_shown   boolean default false,
  leaderboard_month_handicap_start numeric,
  leaderboard_month_start         text,
  og_user_number                  numeric,
  driver_distance                 integer,
  three_wood_distance             integer,
  five_wood_distance              integer,
  four_iron_distance              integer,
  five_iron_distance              integer,
  six_iron_distance               integer,
  seven_iron_distance             integer,
  eight_iron_distance             integer,
  nine_iron_distance              integer,
  pitching_wedge_distance         integer,
  gap_wedge_distance              integer,
  sand_wedge_distance             integer,
  lob_wedge_distance              integer,
  -- vestigial under Supabase Auth (magic links handled by GoTrue); kept for import fidelity
  magic_link_token                text,
  magic_link_expiry               text
);

-- ---------------------------------------------------------------------------
-- badge
-- ---------------------------------------------------------------------------
create table public.badge (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  badge_id     text,
  badge_name   text,
  badge_tier   text check (badge_tier in ('beginner','consistency','improvement','competitive','prestige')),
  earned_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- chat_message
-- ---------------------------------------------------------------------------
create table public.chat_message (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  role         text check (role in ('user','assistant')),
  content      text,
  "timestamp"  timestamptz
);

-- ---------------------------------------------------------------------------
-- drill_rating
-- ---------------------------------------------------------------------------
create table public.drill_rating (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  session_date date,
  session_type text,
  drill_name   text,
  rating       text check (rating in ('Struggled','Okay','Good','Clicked')),
  session_note text
);

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create table public.feedback (
  id               text primary key default gen_random_uuid()::text,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text,
  feedback_type    text check (feedback_type in ('Bug Report','Feature Suggestion','General Feedback')),
  subject          text,
  description      text,
  user_email       text,
  user_name        text,
  include_followup boolean default false,
  submitted_at     timestamptz,
  app_version      text,
  status           text check (status in ('new','in review','resolved')) default 'new'
);

-- ---------------------------------------------------------------------------
-- flagged_account
-- ---------------------------------------------------------------------------
create table public.flagged_account (
  id               text primary key default gen_random_uuid()::text,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text,
  user_email       text,
  reason           text,
  fingerprint_hash text,
  matched_email    text,
  status           text check (status in ('pending','approved','ignored')) default 'pending',
  flagged_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- flagged_round
-- ---------------------------------------------------------------------------
create table public.flagged_round (
  id               text primary key default gen_random_uuid()::text,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text,
  user_email       text,
  round_id         text,
  round_date       date,
  logged_score     numeric,
  expected_score   numeric,
  handicap_at_time numeric,
  status           text check (status in ('pending','approved','ignored')) default 'pending'
);

-- ---------------------------------------------------------------------------
-- hall_of_fame
-- ---------------------------------------------------------------------------
create table public.hall_of_fame (
  id              text primary key default gen_random_uuid()::text,
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now(),
  created_by      text,
  user_email      text,
  display_name    text,
  month_year      text,
  winning_score   numeric,
  rounds_logged   numeric,
  sessions_logged numeric,
  final_handicap  numeric
);

-- ---------------------------------------------------------------------------
-- handicap_entry
-- ---------------------------------------------------------------------------
create table public.handicap_entry (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  handicap     numeric,
  entry_date   date,
  note         text
);

-- ---------------------------------------------------------------------------
-- leaderboard_entry  (read by all authed users; written by service-role functions)
-- ---------------------------------------------------------------------------
create table public.leaderboard_entry (
  id                 text primary key default gen_random_uuid()::text,
  created_date       timestamptz not null default now(),
  updated_date       timestamptz not null default now(),
  created_by         text,
  user_email         text,
  display_name       text,
  month_year         text,
  activity_score     numeric default 0,
  improvement_score  numeric default 0,
  total_score        numeric default 0,
  rounds_logged      numeric default 0,
  sessions_logged    numeric default 0,
  handicap_start     numeric,
  handicap_current   numeric,
  improvement_pct    numeric default 0,
  streak_days        numeric default 0,
  rank               numeric,
  meets_age_criteria boolean default true,
  is_account_flagged boolean default false,
  days_until_eligible numeric default 0
);

-- ---------------------------------------------------------------------------
-- monthly_game_plan
-- ---------------------------------------------------------------------------
create table public.monthly_game_plan (
  id                text primary key default gen_random_uuid()::text,
  created_date      timestamptz not null default now(),
  updated_date      timestamptz not null default now(),
  created_by        text,
  user_email        text,
  month_year        text,
  generated_at      timestamptz,
  monthly_focus     text,
  why_this_month    text,
  success_looks_like text,
  practice_emphasis text,
  key_drill         text,
  coachs_note       text
);

-- ---------------------------------------------------------------------------
-- notification
-- ---------------------------------------------------------------------------
create table public.notification (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  type         text,
  message      text,
  read         boolean default false,
  created_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- pending_user  (pre-auth signup flow; primarily service-role functions)
-- ---------------------------------------------------------------------------
create table public.pending_user (
  id                     text primary key default gen_random_uuid()::text,
  created_date           timestamptz not null default now(),
  updated_date           timestamptz not null default now(),
  created_by             text,
  first_name             text,
  last_name              text,
  email                  text,
  selected_plan          text check (selected_plan in ('basic','pro')),
  status                 text check (status in ('pending','active')) default 'pending',
  waitlist_eligible      boolean default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz
);

-- ---------------------------------------------------------------------------
-- practice_plan
-- ---------------------------------------------------------------------------
create table public.practice_plan (
  id              text primary key default gen_random_uuid()::text,
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now(),
  created_by      text,
  user_email      text,
  week_start_date date,
  generated_at    timestamptz,
  plan_data       jsonb,
  is_active       boolean default true
);

-- ---------------------------------------------------------------------------
-- referral
-- ---------------------------------------------------------------------------
create table public.referral (
  id             text primary key default gen_random_uuid()::text,
  created_date   timestamptz not null default now(),
  updated_date   timestamptz not null default now(),
  created_by     text,
  referrer_email text,
  referred_email text,
  referral_code  text,
  status         text check (status in ('pending','rewarded')) default 'pending',
  rewarded_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- round
-- ---------------------------------------------------------------------------
create table public.round (
  id                   text primary key default gen_random_uuid()::text,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now(),
  created_by           text,
  user_email           text,
  course_name          text,
  round_date           date,
  total_score          numeric,
  fairways_hit         numeric,
  fairways_available   numeric,
  greens_in_regulation numeric,
  total_putts          numeric,
  scrambling_saves     numeric,
  scrambling_attempts  numeric,
  notes                text
);

-- ---------------------------------------------------------------------------
-- session_log
-- ---------------------------------------------------------------------------
create table public.session_log (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  session_date date,
  session_type text,
  session_day  text,
  completed    boolean default false,
  notes        text
);

-- ---------------------------------------------------------------------------
-- waitlist_credit
-- ---------------------------------------------------------------------------
create table public.waitlist_credit (
  id                   text primary key default gen_random_uuid()::text,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now(),
  created_by           text,
  user_email           text,
  credit_amount        numeric,
  date_applied         timestamptz,
  waitlist_signup_date timestamptz,
  status               text check (status in ('Applied','Failed'))
);

-- ---------------------------------------------------------------------------
-- waitlist_email  (explicit RLS in Base44: public insert; admin update/delete)
-- ---------------------------------------------------------------------------
create table public.waitlist_email (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  email        text not null,
  submitted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- weekly_insight
-- ---------------------------------------------------------------------------
create table public.weekly_insight (
  id           text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text,
  user_email   text,
  week_of      date,
  insight_text text,
  generated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- weekly_report
-- ---------------------------------------------------------------------------
create table public.weekly_report (
  id                   text primary key default gen_random_uuid()::text,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now(),
  created_by           text,
  user_email           text,
  week_of              date,
  generated_at         timestamptz,
  this_week_numbers    text,
  what_improved        text,
  what_needs_attention text,
  drill_of_the_week    text,
  coachs_take          text,
  looking_ahead        text
);

-- ============================================================================
-- Indexes — ownership lookups (user_email) + common filter/sort columns
-- ============================================================================
create index on public.user_profile (user_email);
create index on public.user_profile (referral_code);
create index on public.user_profile (stripe_customer_id);
create index on public.user_profile (revenuecat_app_user_id);
create index on public.badge (user_email);
create index on public.chat_message (user_email);
create index on public.drill_rating (user_email);
create index on public.feedback (user_email);
create index on public.flagged_account (user_email);
create index on public.flagged_round (user_email);
create index on public.hall_of_fame (month_year);
create index on public.handicap_entry (user_email);
create index on public.leaderboard_entry (month_year);
create index on public.leaderboard_entry (user_email);
create index on public.monthly_game_plan (user_email);
create index on public.notification (user_email);
create index on public.pending_user (email);
create index on public.practice_plan (user_email, is_active);
create index on public.referral (referrer_email);
create index on public.referral (referred_email);
create index on public.round (user_email, round_date);
create index on public.session_log (user_email, session_date);
create index on public.waitlist_credit (user_email);
create index on public.weekly_insight (user_email);
create index on public.weekly_report (user_email);

-- ============================================================================
-- updated_date auto-touch trigger
-- ============================================================================
create or replace function public.touch_updated_date()
returns trigger language plpgsql as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'user_profile','badge','chat_message','drill_rating','feedback','flagged_account',
    'flagged_round','hall_of_fame','handicap_entry','leaderboard_entry','monthly_game_plan',
    'notification','pending_user','practice_plan','referral','round','session_log',
    'waitlist_credit','waitlist_email','weekly_insight','weekly_report'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated before update on public.%I
         for each row execute function public.touch_updated_date()',
      t, t
    );
  end loop;
end $$;
