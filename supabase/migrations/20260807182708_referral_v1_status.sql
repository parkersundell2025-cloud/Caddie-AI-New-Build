-- Referral v1 (SOW 3b): the table existed but had no writers. Extend the
-- status lifecycle to distinguish "owed" from "granted" (fulfillment is
-- manual), and stop the same person being referred twice.
--   pending  : friend signed up under a referral code, not yet converted
--   earned   : friend made their first paid PRO purchase → reward owed (admin grants manually)
--   rewarded : admin granted the free month
alter table public.referral drop constraint if exists referral_status_check;
alter table public.referral
  add constraint referral_status_check check (status in ('pending','earned','rewarded'));

create unique index if not exists referral_referred_email_uq
  on public.referral (lower(referred_email));
