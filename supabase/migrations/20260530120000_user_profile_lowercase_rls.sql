-- ---------------------------------------------------------------------------
-- Belt-and-suspenders: rewrite user_profile RLS to use lower(user_email).
--
-- Supabase auth lowercases auth.users.email on user creation. The previous
-- policy compared user_email = auth.email() with case-sensitive Postgres
-- text equality, so any code path that inserted user_profile.user_email
-- without normalizing (admin form, Stripe webhook, RevenueCat webhook, bulk
-- import) would orphan the user from their own row — the JWT carries the
-- lowercased email and would never match a mixed-case stored value.
--
-- Discovered 2026-05-30 in a test that used `verifyB-…` as the email; the
-- in-app paths (createManualUserProfile, fixUserProfile, AdminFixUser) were
-- patched the same day to `.toLowerCase().trim()`. This migration is the
-- DB-side guard so the same bug can't reappear when new ingest paths land.
-- ---------------------------------------------------------------------------

drop policy if exists owner_select on public.user_profile;
drop policy if exists owner_insert on public.user_profile;
drop policy if exists owner_update on public.user_profile;
drop policy if exists owner_delete on public.user_profile;

create policy owner_select on public.user_profile for select
  using (lower(user_email) = auth.email());

create policy owner_insert on public.user_profile for insert
  with check (lower(user_email) = auth.email() or public.is_admin());

create policy owner_update on public.user_profile for update
  using (lower(user_email) = auth.email() or public.is_admin())
  with check (lower(user_email) = auth.email() or public.is_admin());

create policy owner_delete on public.user_profile for delete
  using (lower(user_email) = auth.email() or public.is_admin());

-- Functional index so PostgREST queries (`from('user_profile').eq('user_email', …)`)
-- and RLS predicates stay fast even when reads target the lowered form.
create index if not exists idx_user_profile_user_email_lower
  on public.user_profile ((lower(user_email)));
