-- ============================================================================
-- Caddie AI — Row Level Security policies
-- ============================================================================
--
-- Base44 only declared explicit RLS on 2 of 21 entities (user_profile,
-- waitlist_email). The other 19 relied on Base44's implicit default, which
-- behaves as "an authenticated user may CRUD rows they own (user_email ==
-- their email)". We reproduce that faithfully so no app flow breaks.
--
-- Admin = JWT app_metadata.role == 'admin' (the frontend reads user.role and
-- gates 7 admin pages on === 'admin'). Set this via Supabase Auth admin API:
--   supabase.auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })
--
-- The 43 edge functions use the SERVICE ROLE key, which BYPASSES RLS entirely.
-- All cross-user writes (leaderboard, badges, flagging, handicap recalcs) run
-- there, so frontend-facing policies can stay scoped to the owner.
--
-- Write-path audit (grep of src/ vs base44/functions/) settled the ambiguous tables:
--   * badge            — no frontend writes -> owner READ only, service-role writes.
--   * handicap_entry   — frontend DOES create (Onboarding, EditProfile) -> owner write kept.
--   * leaderboard_entry/hall_of_fame — no frontend writes -> admin/service writes only.
--   * pending_user     — one frontend READ (TrialStarted, keyed by own email) -> owner self-read.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Standard owner tables: authenticated owner full CRUD; admin override.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'chat_message','drill_rating','handicap_entry','monthly_game_plan',
    'notification','practice_plan','round','session_log','weekly_insight','weekly_report'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_select on public.%I for select
         using (user_email = auth.email() or public.is_admin())', t);
    execute format(
      'create policy owner_insert on public.%I for insert
         with check (user_email = auth.email() or public.is_admin())', t);
    execute format(
      'create policy owner_update on public.%I for update
         using (user_email = auth.email() or public.is_admin())
         with check (user_email = auth.email() or public.is_admin())', t);
    execute format(
      'create policy owner_delete on public.%I for delete
         using (user_email = auth.email() or public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- badge — owner reads own badges; written only by service-role functions
-- (checkBadges). No frontend write path, so no owner insert/update/delete.
-- ---------------------------------------------------------------------------
alter table public.badge enable row level security;
create policy badge_select on public.badge for select
  using (user_email = auth.email() or public.is_admin());
create policy badge_admin_write on public.badge for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- user_profile — Base44 explicit rule: owner-only READ; owner|admin write.
-- (Admins read other profiles via service-role functions, e.g. fixUserProfile.)
-- ---------------------------------------------------------------------------
alter table public.user_profile enable row level security;
create policy owner_select on public.user_profile for select
  using (user_email = auth.email());
create policy owner_insert on public.user_profile for insert
  with check (user_email = auth.email() or public.is_admin());
create policy owner_update on public.user_profile for update
  using (user_email = auth.email() or public.is_admin())
  with check (user_email = auth.email() or public.is_admin());
create policy owner_delete on public.user_profile for delete
  using (user_email = auth.email() or public.is_admin());

-- ---------------------------------------------------------------------------
-- referral — owner is the referrer; the referred user may also read their row.
-- ---------------------------------------------------------------------------
alter table public.referral enable row level security;
create policy referral_select on public.referral for select
  using (referrer_email = auth.email() or referred_email = auth.email() or public.is_admin());
create policy referral_insert on public.referral for insert
  with check (referrer_email = auth.email() or public.is_admin());
create policy referral_update on public.referral for update
  using (referrer_email = auth.email() or public.is_admin())
  with check (referrer_email = auth.email() or public.is_admin());
create policy referral_delete on public.referral for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- waitlist_credit — owner may read own credits; only admin/service writes.
-- ---------------------------------------------------------------------------
alter table public.waitlist_credit enable row level security;
create policy wlc_select on public.waitlist_credit for select
  using (user_email = auth.email() or public.is_admin());
create policy wlc_write on public.waitlist_credit for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- feedback — owner submits & reads own; admin reads all & updates status.
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;
create policy feedback_select on public.feedback for select
  using (user_email = auth.email() or public.is_admin());
create policy feedback_insert on public.feedback for insert
  with check (user_email = auth.email());
create policy feedback_update on public.feedback for update
  using (public.is_admin()) with check (public.is_admin());
create policy feedback_delete on public.feedback for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- flagged_round / flagged_account — admin-only surface (created by service role).
-- ---------------------------------------------------------------------------
alter table public.flagged_round enable row level security;
create policy flagged_round_admin on public.flagged_round for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.flagged_account enable row level security;
create policy flagged_account_admin on public.flagged_account for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- leaderboard_entry / hall_of_fame — any authenticated user reads all rows;
-- writes only via admin/service role (functions recompute standings).
-- ---------------------------------------------------------------------------
alter table public.leaderboard_entry enable row level security;
create policy leaderboard_read on public.leaderboard_entry for select
  using (auth.uid() is not null);
create policy leaderboard_write on public.leaderboard_entry for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.hall_of_fame enable row level security;
create policy hof_read on public.hall_of_fame for select
  using (auth.uid() is not null);
create policy hof_write on public.hall_of_fame for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- waitlist_email — Base44 explicit: public INSERT (pre-auth signup form);
-- admin-only read/update/delete. RLS denies select to non-admins.
-- ---------------------------------------------------------------------------
alter table public.waitlist_email enable row level security;
create policy waitlist_public_insert on public.waitlist_email for insert
  to anon, authenticated with check (true);
create policy waitlist_admin_select on public.waitlist_email for select
  using (public.is_admin());
create policy waitlist_admin_update on public.waitlist_email for update
  using (public.is_admin()) with check (public.is_admin());
create policy waitlist_admin_delete on public.waitlist_email for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- pending_user — pre-auth signup/checkout state, owned by no authed user.
-- RLS enabled; the create/checkout flow runs through service-role functions
-- (createPendingUserAndGetPaymentLink, processCheckoutSuccess, ...). The one
-- frontend read (TrialStarted.jsx, by own email) is allowed via self-read.
-- ---------------------------------------------------------------------------
alter table public.pending_user enable row level security;
create policy pending_user_self_select on public.pending_user for select
  using (email = auth.email() or public.is_admin());
create policy pending_user_admin_write on public.pending_user for all
  using (public.is_admin()) with check (public.is_admin());
