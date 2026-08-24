# Paywall move — implementation plan

**What Parker approved:** move the paywall from *before* onboarding to *after*
it, for $400. Approved 2026-08-23 ("fix the funnel for $400").

**One-sentence summary of the change:** move profile creation from
**payment-time** to **onboarding-time**, so a new user onboards first (free,
no card), sees their generated plan, and only then hits the paywall. Nothing
else about the trial or billing model changes.

This is deliberately the "foundational third of freemium" — after this, a
`user_profile` exists for *everyone* who onboards, and subscription fields
gate premium. That's exactly the structure freemium is built on, which is why
it's re-usable later and priced as a down payment on it.

---

## Why this is real work (not a screen reorder)

Today the app has one hard rule baked into three places: **no profile exists
until money changes hands.**

- `Gateway.jsx` — no profile → `/subscribe-now`.
- `Onboarding.jsx:150-155` — *explicitly refuses to create a profile*; if none
  exists it bounces the user back to `/subscribe-now`. It only ever `UPDATE`s.
- Profile is created **only** by the payment layer:
  - Web: `completeStripeCheckout` (has both create + update paths).
  - Native: `revenueCatWebhook` INITIAL_PURCHASE/TRIAL_STARTED (create path at
    ~line 471; update path at ~line 544).

The move decouples "profile exists" from "has paid." That's the substance.

---

## Current flow vs. new flow

**Today (paywall first):**
```
sign in → Gateway → (no profile) → /subscribe-now → PAY → profile created (trial)
       → /onboarding → fills answers, plan generated, onboarding_complete=true → /home
```

**After (paywall last):**
```
sign in → Gateway → (no profile) → /onboarding → answers saved + profile CREATED
       (onboarding_complete=true, NO subscription) → plan generated → "plan ready"
       → /subscribe-now → PAY (7-day trial starts) → /home
```

The trial is unchanged — it still begins at payment (Stripe/RC 7-day trial).
The paywall still says "Start your 7-day free trial."

---

## Files to change

### 1. `src/pages/Onboarding.jsx` — create the profile (the core change)
`handleFinish` currently bails if no profile exists (lines 150-155). Reverse it:

- **Look up existing profile by email. If none, INSERT one** with the fields
  onboarding owns + `onboarding_complete: true`, and **do not touch
  subscription fields** (leave `subscription_status` null / unset — the
  payment webhooks own those). If one exists (returning/mid-flight user),
  keep the current UPDATE path. Make it idempotent (insert-or-update) so a
  re-run never duplicates the row.
- `user_email` must be lowercased to satisfy the `owner_insert` RLS
  `with_check (lower(user_email) = auth.email())` and the normalize trigger.
  (RLS confirmed present — no policy change needed; see "RLS" below.)
- Keep everything else it already does: `referral_code` generation,
  `referred_by_code`, `recordReferral` fire-and-forget, `handicap_entry`
  insert, `generateInitialPlan`.
- **Step 5 CTA:** the "Plan ready" screen's button (currently "Enter Caddie →"
  → `/plan`) becomes **"Unlock My Plan →" / "Start Free Trial →"** →
  `/subscribe-now`. This screen (Week-1 focus card, session preview) is now the
  value-demonstration moment right before the ask — leave it in, it's the
  strongest possible paywall lead-in.

### 2. `src/pages/Gateway.jsx` — routing rewrite
New precedence (replaces lines 116-136):

| State | Route |
|---|---|
| no session | `/signin` |
| session, **no profile** | **`/onboarding`** (was `/subscribe-now`) |
| profile, `onboarding_complete = false` | `/onboarding` |
| profile, onboarding done, **no access** | `/subscribe-now` |
| profile, onboarding done, has access | `/home` |

The native profile-poll retry (lines 85-100) can stay but loses its original
purpose (it existed to wait for the RC webhook to *create* the profile at
sign-in). Harmless; leave it, note it.

Move the `CompleteRegistration` pixel event (line 130) — it currently fires
when routing a paid user into onboarding. Refire it when onboarding actually
completes, and it becomes a truthful funnel signal.

### 3. `src/pages/SubscribeNow.jsx` — post-payment routing
The "already subscribed?" branch (lines 261-268) currently routes paid +
`!onboarding_complete` → `/onboarding`. In the new order onboarding is always
done before the paywall, so:
- paid/trial/cancelling → **`/home`** (drop the onboarding detour; keep a
  defensive `!onboarding_complete → /onboarding` only as a safety net for
  legacy users who paid under the old flow).
- `InitiateCheckout` pixel (line 271) now fires for users who *completed
  onboarding* — a far more meaningful funnel event (relevant to the ad-tracking
  conversation).

### 4. Payment webhooks — verify only, likely no change
By payment time the profile already exists, so the **update** paths run:
- `completeStripeCheckout` — update path (lines 178-191) patches Stripe IDs +
  flips status/plan/trial. Must **not** clobber onboarding fields — it only
  writes subscription columns, so confirm and leave.
- `revenueCatWebhook` — INITIAL_PURCHASE update path (~line 544+). Confirm it
  updates the existing row rather than trying to insert a duplicate. Its create
  path (~471) stays as a safety net for any user who reaches native purchase
  without a profile.

### 5. `generateInitialPlan` — verify it isn't subscription-gated
It now runs *before* payment. Confirm it only needs `profile_id` + `user_email`
and doesn't require an active subscription. (Expected fine — it's a plan
builder — but verify.)

---

## RLS — already handled, no migration needed
`user_profile` has `owner_insert` with
`with_check ((lower(user_email) = auth.email()) OR is_admin())`, plus the
email-normalization trigger. So a signed-in user can insert their own row
directly from `Onboarding.jsx`. This sidesteps the `email-case-rls-trap` and
means **no new edge function and no RLS change** are required. Lowercase
`user_email` on the client insert anyway, to match `completeStripeCheckout`.

---

## Edge cases & gotchas

- **Abandoned onboarding (didn't pay):** leaves a profile with
  `onboarding_complete = true` and no subscription. On return: Gateway →
  no-access → `/subscribe-now` (lands straight on paywall, does *not*
  re-onboard). This is correct and desirable.
- **Idempotent create:** guard against a double `handleFinish` / back-nav
  creating two rows — insert-or-update by email.
- **Legacy users mid-flight:** anyone who paid under the old flow but hasn't
  onboarded still routes to `/onboarding` (has profile, `!onboarding_complete`)
  and the existing UPDATE path runs. No migration needed.
- **`generateInitialPlan` cost:** every onboarder now triggers one plan
  generation (Anthropic call) even if they never pay. Cheap, acceptable, and
  it's the value demo. Note it.
- **Native poll semantics:** see Gateway note above — harmless leftover.

---

## What this unlocks (worth telling Parker)
- **Abandoned-cart visibility:** we finally capture *who onboarded but didn't
  pay* — today those people leave no trace at all (no profile). This is the
  first time the top of the funnel is measurable. Directly relevant to the
  "why aren't ads converting" question.
- **Truthful funnel pixels:** `CompleteRegistration` and `InitiateCheckout`
  now fire at real funnel stages, which makes any future ad tracking actually
  meaningful.
- **Freemium groundwork:** profile-for-everyone + subscription-gates-premium is
  the freemium spine. Ship this and freemium later is cheaper by roughly this
  amount.

---

## Testing plan
Web (Playwright + a flagged test account), then native smoke on device:
1. Fresh email → sign in → lands on **`/onboarding`** (not paywall).
2. Complete 6 steps → profile row created with onboarding answers,
   `onboarding_complete = true`, `subscription_status` null, plan generated.
3. "Plan ready" screen → CTA → `/subscribe-now`.
4. Complete Stripe checkout (web) → `/home`, access granted; verify
   `completeStripeCheckout` patched the *existing* row (no dup).
5. Native: same, via RC IAP sandbox → verify RC webhook updated the existing
   row (no dup insert).
6. Abandon at paywall → sign out → sign back in → lands on `/subscribe-now`,
   NOT re-onboarding; profile intact.
7. Legacy check: a user with a paid profile + `onboarding_complete=false` →
   routes to `/onboarding`, finishes via UPDATE path.
8. Confirm flagged test account so it never pollutes conversion metrics.

---

## Sequencing
All frontend files ride one native build (iOS + Android — this is `src/`,
so it needs both per the native-push rule). Webhook verification is backend-only.
Order: Onboarding create path → Gateway routing → SubscribeNow routing →
webhook verify → test on web → cut iOS + Android builds. No commits/pushes
without Tony's explicit approval.

---

## BUILD NOTES — what implementation surfaced (2026-08-23)

Two things the plan didn't anticipate, both handled:

1. **A second gatekeeper duplicated the routing.** `App.jsx` `RootRoute`
   (the `/` handler) had its own copy of the paywall-first logic
   (no profile → `/subscribe-now`), separate from `Gateway.jsx`. Flipped its
   two no-profile fallbacks to `/onboarding` as well. The affiliate branch
   above it is RLS-scoped to the caller's own row, so it was preserved.
   `SubscriptionGate` and `OnboardingGate` needed no change (they check
   payment linkage / onboarding_complete and already deny correctly).

2. **`user_profile.subscription_status` DEFAULTs to `'trial'`.** Before this
   change, every profile was created by a payment webhook that set the status
   explicitly, so the default never mattered. Onboarding creating a profile
   without setting it would have produced `subscription_status='trial'` with
   null trial dates — a *fake trialist*. All gates still denied it (they check
   payment linkage first, and RootRoute's trial path requires non-null
   trial dates), so it wasn't an access hole — but it was fragile and would
   mislabel abandoned users in metrics. **Fix:** onboarding inserts
   `subscription_status: null` explicitly. Now "onboarded, never paid" is
   unambiguous everywhere and is a clean `subscription_status IS NULL`
   conversion query. The real 7-day trial still starts at payment.

**Files changed:** `src/pages/Onboarding.jsx`, `src/pages/Gateway.jsx`,
`src/pages/SubscribeNow.jsx`, `src/App.jsx`. Webhooks unchanged (verified).

**Verification done:** `vite build` clean; a scripted RLS test (throwaway auth
user, real user JWT, anon key) confirmed the onboarding INSERT passes the
`owner_insert` policy, lands with `subscription_status=null` + no payment
linkage, and routes to the paywall. **Still to do before it reaches users:**
in-browser walk-through of the full visual flow (magic-link a fresh account →
onboarding → plan-ready → paywall → pay → home), then cut iOS + Android builds.
