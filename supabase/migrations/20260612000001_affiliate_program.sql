-- ============================================================================
-- Affiliate program — influencer tracking + commission ledger.
-- ============================================================================
--
-- Four new tables make up the affiliate system. They are deliberately kept
-- separate from the existing user-to-user `referral` table (which awards
-- Stripe credit between app users). Affiliates are influencers earning real
-- money commissions; mixing the two creates accounting bugs.
--
--   affiliate              — the influencer (commission terms + payout details)
--   affiliate_payout       — admin-batched payouts (one row per actual payment)
--   affiliate_attribution  — frozen at signup; one row per attributed user, ever
--   affiliate_commission   — append-only ledger; one row per RC event that pays
--
-- Money is stored in cents (integer) to avoid float drift. Negative values on
-- refund reversal rows.
--
-- Idempotency: affiliate_commission.event_id is UNIQUE so the same RC webhook
-- event cannot produce two commission rows. Critical because RC retries.
--
-- Commission terms are SNAPSHOTTED onto each commission row at write time so
-- retroactive rate edits on the affiliate row do not restate history.
--
-- Convention notes:
--   * Uses created_at / updated_at (matches newer device_token migration,
--     not the legacy Base44 created_date / updated_date — these are
--     greenfield tables with no Base44 data to import).
--   * FKs within the affiliate subsystem are enforced. No FK to user_profile
--     because the rest of the schema keys on user_email (text) per the
--     Base44 import convention.
--   * Admin role check reuses public.is_admin() from the RLS migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. affiliate
-- ---------------------------------------------------------------------------
create table public.affiliate (
  id              text primary key default gen_random_uuid()::text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  display_name    text not null,
  code            text not null unique
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  contact_email   text not null,
  commission_type text not null check (commission_type in ('percentage', 'flat')),
  -- percentage: 0.20 = 20% of gross. flat: cents per first-paying-event (e.g. 500 = $5).
  commission_rate numeric not null check (commission_rate >= 0),
  payout_method   text check (payout_method in ('paypal', 'wise', 'bank', 'other')),
  payout_details  jsonb not null default '{}'::jsonb,
  status          text not null check (status in ('active', 'paused', 'terminated')) default 'active',
  terminated_at   timestamptz,
  notes           text
);
create index affiliate_code_idx          on public.affiliate (code);
create index affiliate_contact_email_idx on public.affiliate (lower(contact_email));
create index affiliate_status_idx        on public.affiliate (status);

-- Normalize code (upper) + email (lower) + touch updated_at on every write.
create or replace function public.affiliate_before_write() returns trigger
language plpgsql as $$
begin
  if new.contact_email is not null then
    new.contact_email := lower(trim(new.contact_email));
  end if;
  if new.code is not null then
    new.code := upper(trim(new.code));
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_affiliate_before_write
  before insert or update on public.affiliate
  for each row execute function public.affiliate_before_write();

-- ---------------------------------------------------------------------------
-- 2. affiliate_payout — admin-batched payouts.
-- Created BEFORE commission so commission.payout_id FK resolves cleanly.
-- ---------------------------------------------------------------------------
create table public.affiliate_payout (
  id                  text primary key default gen_random_uuid()::text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  affiliate_id        text not null references public.affiliate(id) on delete restrict,
  -- Sum of attached commission_cents at creation time. Recomputed on edit.
  total_cents         integer not null,
  currency            text not null default 'USD',
  -- draft: created, commissions attached, money not yet sent.
  -- sent: admin sent money externally (PayPal/Wise/bank) and pasted the ref.
  -- reconciled: bank statement reconciled (manual flag, future use).
  -- void: cancelled before sending; commissions go back to pending.
  status              text not null check (status in ('draft','sent','reconciled','void')) default 'draft',
  paid_at             timestamptz,
  paid_via            text check (paid_via in ('paypal','wise','bank','other')),
  external_reference  text,
  created_by          text,
  notes               text
);
create index affiliate_payout_affiliate_id_idx on public.affiliate_payout (affiliate_id);
create index affiliate_payout_status_idx       on public.affiliate_payout (status);

create or replace function public.affiliate_payout_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_affiliate_payout_touch_updated_at
  before update on public.affiliate_payout
  for each row execute function public.affiliate_payout_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. affiliate_attribution — frozen at signup. One row per user, ever.
-- ---------------------------------------------------------------------------
create table public.affiliate_attribution (
  id                  text primary key default gen_random_uuid()::text,
  created_at          timestamptz not null default now(),
  affiliate_id        text not null references public.affiliate(id) on delete restrict,
  -- UNIQUE so re-running bindAffiliateAttribution for the same user is a no-op.
  user_email          text not null unique,
  -- Best-effort client-reported timestamp of when the ref was first stashed
  -- on this device. Useful for last-touch attribution audit; not load-bearing.
  first_seen_at       timestamptz,
  signed_up_at        timestamptz not null default now(),
  attribution_source  text not null check (attribution_source in ('web','ios','android')),
  -- Snapshot of the code at bind time; affiliate.code may rename later.
  code_at_bind        text not null
);
create index affiliate_attribution_affiliate_id_idx on public.affiliate_attribution (affiliate_id);
create index affiliate_attribution_user_email_idx   on public.affiliate_attribution (lower(user_email));

-- ---------------------------------------------------------------------------
-- 4. affiliate_commission — append-only ledger.
-- ---------------------------------------------------------------------------
create table public.affiliate_commission (
  id                       text primary key default gen_random_uuid()::text,
  created_at               timestamptz not null default now(),
  affiliate_id             text not null references public.affiliate(id) on delete restrict,
  user_email               text not null,
  -- RC event id. UNIQUE = the same RC retry never double-credits.
  event_id                 text not null unique,
  event_type               text not null check (event_type in (
    'initial_purchase',     -- first paid event (not trial)
    'renewal',              -- recurring renewal
    'trial_converted',      -- trial → paid
    'product_change',       -- mid-cycle plan change (commission only on upgrades)
    'refund',               -- store-issued refund → negative commission row
    'refund_reversal',      -- refund clawed back by store → positive row
    'manual_adjustment'     -- admin-issued correction
  )),
  store                    text not null check (store in (
    'app_store','play_store','mac_app_store','stripe','promotional','other'
  )),
  -- Money. Positive on earnings, negative on reversal.
  -- gross_revenue_cents = net-to-developer (RC's price_in_purchased_currency,
  -- which is already net of Apple/Google's cut).
  gross_revenue_cents      integer not null,
  commission_cents         integer not null,
  currency                 text not null default 'USD',
  -- Snapshot so retroactive rate edits don't restate history.
  commission_type_snapshot text not null,
  commission_rate_snapshot numeric not null,
  status                   text not null check (status in (
    'pending',    -- newly written; not yet approved
    'approved',   -- admin reviewed; eligible for next payout batch
    'paid',       -- attached to a sent payout
    'reversed',   -- offset by a refund_reversal row (kept for audit)
    'void'        -- manually cancelled, e.g. spam signup
  )) default 'pending',
  payout_id                text references public.affiliate_payout(id) on delete set null,
  occurred_at              timestamptz not null,
  notes                    text
);
create index affiliate_commission_affiliate_id_idx on public.affiliate_commission (affiliate_id);
create index affiliate_commission_user_email_idx   on public.affiliate_commission (lower(user_email));
create index affiliate_commission_status_idx       on public.affiliate_commission (status);
create index affiliate_commission_payout_id_idx    on public.affiliate_commission (payout_id);

-- ============================================================================
-- RLS
-- ============================================================================
-- public.is_admin() defined in 20260525000002_rls_policies.sql.
-- Service-role edge functions bypass RLS, so all webhook-driven writes (the
-- common case) work without any INSERT policy. The policies below describe
-- what FRONTEND clients are allowed to do.
-- ============================================================================

alter table public.affiliate              enable row level security;
alter table public.affiliate_payout       enable row level security;
alter table public.affiliate_attribution  enable row level security;
alter table public.affiliate_commission   enable row level security;

-- --- affiliate ---------------------------------------------------------------
-- Self: affiliate user (auth.email() == contact_email) can read their own row.
-- Admin: full.
-- No frontend INSERT/UPDATE: created via admin page using service role.
create policy affiliate_self_select on public.affiliate for select
  using (lower(contact_email) = auth.email() or public.is_admin());
create policy affiliate_admin_write on public.affiliate for all
  using (public.is_admin()) with check (public.is_admin());

-- --- affiliate_payout --------------------------------------------------------
-- Self: affiliate can read their own payouts.
-- Admin: full.
create policy affiliate_payout_self_select on public.affiliate_payout for select
  using (
    affiliate_id in (select id from public.affiliate where lower(contact_email) = auth.email())
    or public.is_admin()
  );
create policy affiliate_payout_admin_write on public.affiliate_payout for all
  using (public.is_admin()) with check (public.is_admin());

-- --- affiliate_attribution ---------------------------------------------------
-- Self (user): can see the row attributing themselves to an affiliate.
-- Self (affiliate): can see all attributions earned under their code.
-- Admin: full.
-- No frontend writes: bindAffiliateAttribution edge fn uses service role.
create policy affiliate_attribution_user_select on public.affiliate_attribution for select
  using (
    lower(user_email) = auth.email()
    or affiliate_id in (select id from public.affiliate where lower(contact_email) = auth.email())
    or public.is_admin()
  );
create policy affiliate_attribution_admin_write on public.affiliate_attribution for all
  using (public.is_admin()) with check (public.is_admin());

-- --- affiliate_commission ----------------------------------------------------
-- Self (affiliate): can read their own commission ledger.
-- Admin: full.
-- The attributed user does NOT see commissions — that's between affiliate and admin.
create policy affiliate_commission_self_select on public.affiliate_commission for select
  using (
    affiliate_id in (select id from public.affiliate where lower(contact_email) = auth.email())
    or public.is_admin()
  );
create policy affiliate_commission_admin_write on public.affiliate_commission for all
  using (public.is_admin()) with check (public.is_admin());
