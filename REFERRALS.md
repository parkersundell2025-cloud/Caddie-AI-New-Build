# Referral program — manual grant runbook (v1)

How the give-a-month / get-a-month referral works, and how to grant the
reward. **Fulfillment is manual by design** (Referral v1, SOW 3b) — the app
records who is owed; a human grants the free month.

## How it flows automatically

1. A user shares their link: `caddieaiapp.com/subscribe-now?ref=THEIRCODE`
   (their code is on their in-app Referral page).
2. A friend signs up through it. During onboarding the code is saved and a
   `referral` row is created with status **`pending`** (referrer → referred).
   - Self-referral is blocked. Codes that aren't a real user's referral code
     (e.g. influencer affiliate codes) are ignored here — those are the
     separate affiliate system.
3. When that friend makes their **first paid Pro purchase** (not a trial, not
   Basic, not a free signup), the RevenueCat webhook flips the row to
   **`earned`** — the referrer is now owed one free month.

## Your job: grant the earned rewards

Go to **/admin/referrals**. The top section, "Owed — grant these," lists every
referrer owed a free month. For each one:

### If the referrer pays via Stripe (web) — `subscription_source = 'stripe'`
Apply a one-month credit to their Stripe customer:
1. Stripe Dashboard → Customers → find them by email.
2. Add a **negative balance** of one month's price (e.g. -$15.00 for Basic,
   -$29.00 for Pro) — "Actions → Adjust balance," enter a credit. Stripe
   applies it to their next invoice automatically.
3. Back in /admin/referrals, click **Mark granted** on that row.

### If the referrer pays via Apple — `subscription_source = 'app_store'`
Apple credits can't be applied from Stripe. Grant a **RevenueCat promotional
entitlement**:
1. RevenueCat dashboard → Customers → search their app user id (their
   Supabase UUID; visible on their profile via /admin/accounts).
2. Grant a promotional "caddiePro" (or "caddieBasic") entitlement for **1
   month**.
3. Back in /admin/referrals, click **Mark granted**.

### If the referrer pays via Play — `subscription_source = 'play_store'`
Same idea via RevenueCat promotional entitlement (Play credits aren't
grantable from our side either).

## Notes

- **Mark granted** flips the row `earned → rewarded` and stamps `rewarded_at`.
  Only do it after you've actually applied the credit/entitlement.
- The referrer's own in-app **Referral page** shows their signups and months
  earned (reads the same `referral` table + their Stripe balance).
- **Not automated in v1** (would be a v2, ~+$150): auto-applying the Stripe
  credit / RC entitlement, in-app share sheets, and a self-serve referrer
  dashboard.
- Affiliate (influencer) commissions are a **separate** system —
  /admin/affiliates. Don't confuse the two.
