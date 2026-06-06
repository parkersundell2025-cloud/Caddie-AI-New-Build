# App Store Compliance — Implementation Notes

This document describes the current implementation of the iOS App Store
subscription, trial, and Pro-feature flow. It was originally written for the
Base44-backed version of the app; **most of that prior implementation has not
yet been re-built on the Supabase port**. See the *Migration drift* section
below for a feature-by-feature comparison.

The intended compliance posture is unchanged: Apple Guideline 3.1.1
(no in-app payment collection for purely-digital subscriptions when sold
via the website) and Guideline 5.1.1 (Cancel Subscription must be reachable
in-app for iOS users).

---

## What the codebase actually does today

### 1. Sign-in (`src/pages/SignIn.jsx`)

Two paths:

- **Magic-link email** — user types their email, `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '<origin>/gateway' } })` sends a sign-in link. Clicking the link verifies and routes to `/gateway`.
- **Sign in with Apple** — `supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: '<origin>/gateway' } })`. **Currently errors** with a Supabase 400 JSON page because the Apple provider isn't yet configured in *Supabase dashboard → Authentication → Providers → Apple*. Re-enable when the Apple developer config is wired up.

**No credit card is ever collected in the app.**

### 2. Post-sign-in routing (`src/pages/Gateway.jsx`)

Gateway is the funnel that runs after auth completes. It loads the user's `user_profile` row and routes to one of:

- `/onboarding` — authenticated but `onboarding_complete=false`
- `/subscribe-now` — no profile, or no active subscription (`hasActiveSubscription` returns false; see `src/components/SubscriptionGate.jsx`)
- `/home` — authenticated, onboarded, active sub

### 3. Onboarding (`src/pages/Onboarding.jsx`)

Six required steps; cannot be skipped:

1. Game (current + goal handicap, target timeline)
2. Schedule (days per week, preferred days)
3. Club distances (13 clubs)
4. Skill ratings (5 categories)
5. Plan ready (confirmation)

On finish:

```js
await unwrap(supabase.from('user_profile').update({
  onboarding_complete: true,
  // ... plus trial dates, handicap, etc.
}).eq('id', existingProfile.id).select().single());
```

Trial dates are written server-side via the seed/insert path (today + 7 days).
The `generateInitialPlan` edge function then generates the first
`practice_plan` row.

> **`generateInitialPlan` failure handling** — there's an explicit
> *EMERGENCY UNBLOCK* try/catch around it (`Onboarding.jsx:188-202`): if the
> function 404s or errors, onboarding is still marked complete so the user
> isn't stuck. The downside is an empty `/plan` until the function is
> re-invoked.

### 4. Trial date utilities (`src/lib/trialUtils.js`)

```js
getTrialDaysRemaining(profile)  // → integer ≥ 0
isTrialExpired(profile)         // → true if subscription_status === 'trial' AND days remaining ≤ 0
```

### 5. Subscription utilities (`src/lib/subscription.js`)

```js
hasProAccess(profile)        // → only when subscription_status === 'pro'
isTrialUser(profile)         // → subscription_status === 'trial'
hasBasicOrBetter(profile)    // → subscription_status in {'basic','pro','trial'}
hasExpiredTrial(profile)     // → subscription_status === 'expired'
```

> **Note** — `hasProAccess` does **not** treat trial users as having Pro
> access. See *Migration drift* below.

### 6. Active-subscription gate (`src/components/SubscriptionGate.jsx`)

`hasActiveSubscription(profile)` is the single source of truth for "this user
can use the app". Accepts either a Stripe linkage (`stripe_customer_id`) or a
RevenueCat linkage (`revenuecat_app_user_id`). Trial state additionally
requires `trial_end_date >= today`. `'cancelling'` users keep access until
their period ends.

The component wraps protected routes and bounces to `/subscribe-now` when
the gate fails. Includes a resilient retry-with-backoff path so transient
errors (429, timeouts) don't lock paying users out — important learning
preserved from the Base44 days when their API throttled.

### 7. Pro feature gating (`src/components/pro/ProGate.jsx`)

```jsx
<ProGate profile={profile}>
  <MonthlyGamePlanCard />
</ProGate>
```

When `hasProAccess(profile)` is false, renders an informational card:

> "This feature requires an active subscription."

### 8. Subscribe page (`src/pages/SubscribeNow.jsx`)

Pro and Basic plan buttons link directly to live `buy.stripe.com` checkout URLs:

```js
const BASIC_URL = 'https://buy.stripe.com/4gM8wI4u9gWk3wA3jU7ok00';
const PRO_URL   = 'https://buy.stripe.com/fZuaEQf8NeOcc361bM7ok01';
```

Anonymous visitors are bounced to `/signin` (with `?email=` preserved). Authenticated users with an active sub are bounced to `/home`. The plan picker is only rendered for authenticated users without a sub.

> **Webhook → profile pipeline NOT yet ported.** A real purchase will redirect to `/checkout/success` but will not create or update the `user_profile` row on the server side. See [Pending work](#pending-work).

### 9. Cancel subscription (`src/pages/ManageSubscription.jsx` + `src/pages/CancelSubscription.jsx`)

Two call sites for the Cancel flow, both required by Guideline 5.1.1:

- The footer Cancel-Subscription link on **`/manage-subscription`** (Apple guideline pattern: a deemphasized link, not a primary button) — opens a confirm dialog inline on the same page
- The dedicated **`/cancel-subscription`** page (legacy direct-link target; kept for back-compat with any out-of-app links)

Both invoke the `cancelSubscription` edge function and (since 2026-05-29) handle the not-yet-deployed-function 404 gracefully with a "We couldn't cancel right now. Please email support@caddieaiapp.com…" message.

The Cancel button on `/manage-subscription` branches on `user_profile.subscription_source`:
- `app_store` / `mac_app_store` → link to `itms-apps://apps.apple.com/account/subscriptions` (Apple 5.1.1 — IAP subs must be cancelled in iOS Settings)
- `play_store` → link to Google Play subscriptions
- `stripe` / `promotional` / unknown → in-app cancel button + confirm dialog

(The previous `/account` page that duplicated this flow was removed on 2026-06-06 — its responsibilities are now consolidated into `/manage-subscription`.)

### 10. Delete account (`src/pages/ManageSubscription.jsx`)

Invokes the `deleteAccount` edge function. Originally meant to cancel the Stripe sub, wipe user data across the 17 owned tables, and delete the auth user. **Not yet wired up to a deployed function.** As of 2026-05-29 the call checks `error` before signing out, so a 404 produces a retry message rather than silently signing the user out of an account that still exists.

---

## Migration drift — known gaps vs. the prior implementation

The previous (Base44-era) version of this document described several
trial-experience features that are **not present in the current Supabase
port.** Each item below needs product-side review: was this descoped
intentionally, or does it need to be restored before the next App Store
submission?

### Trial-experience features

| Feature | Previously | Now |
|---|---|---|
| **Day-6 trial-ending banner** | `components/trial/TrialEndingBanner.jsx` shown on Home when `daysRemaining === 1` | Component file does not exist. `getTrialDaysRemaining` is imported in `Home.jsx:8` but never used (dead import). |
| **Day-7 trial-expired modal** | `components/trial/TrialExpiredModal.jsx` shown when `isTrialExpired(profile)` | Component file does not exist. `isTrialExpired` is imported in `Home.jsx:8` but never used. |
| **Persistent post-trial banner** | `components/trial/SubscriptionBanner.jsx` rendered when `subscription_status === 'expired'` | The file exists but is a stub: `export default function() { return null; }` |
| **PRO badges on Pro feature cards** | `components/badges/ProBadge.jsx` shown in trial + paid states | Component does not exist. No PRO badges in the current UI. |
| **Trial users have full Pro access** | `hasProAccess` returned true for trial AND pro | `hasProAccess` returns true **only** for `subscription_status === 'pro'`. Trial users see the "requires subscription" card via `ProGate` when they try a Pro feature. |

### Routing / checkout

| Feature | Previously | Now |
|---|---|---|
| **`/checkout` routes** | Removed for Apple compliance | `/checkout` and `/checkout/success` exist as routes. `/checkout/success` is a static "Welcome / Sign in" landing — no programmatic checkout completion. `/checkout` redirects unauthenticated users to `/signin`. |
| **Stripe webhook → profile pipeline** | Existed; created profile + set subscription state after successful purchase | Not yet ported. A real purchase via buy.stripe.com will not create or update the `user_profile` row. |
| **`signInAfterCheckout` + `getStripeSessionDetails` post-checkout race** | Existed (with race conditions) | The dedicated `/trial-started` page was removed; the lighter `/checkout/success` does not invoke these. |

### Hard-removed components

- `components/trial/TrialEndingBanner.jsx`
- `components/trial/TrialExpiredModal.jsx`
- `components/badges/ProBadge.jsx`
- `components/gates/ProFeatureGate.jsx` (replaced by `components/pro/ProGate.jsx`, simpler card without blur or lock icon)
- `pages/TrialStarted.jsx` (deleted 2026-05-30 — was imported as `TrialStartedOld` but never routed)

---

## Pending work (App Store readiness)

Before the next submission, the team needs to decide on each of these:

1. **Trial-ending notifications** — restore day-6 banner + day-7 modal (or replace with email-based notifications). Apple expects clear pre-expiration messaging when an in-app trial converts to paid (even for web-purchased subs).
2. **Trial users' access level** — confirm whether trial = full Pro access (typical pattern) or trial = Basic only (current code). The former is the more App-Store-friendly story ("try before you buy").
3. **Stripe webhook → profile creation pipeline** — without this, no purchase on the website translates into actual app access. Required for the Sign-in → Subscribe → Use Pro flow to work end-to-end.
4. **`cancelSubscription` edge function deployment** — the three Cancel UI surfaces all 404 today. They handle it gracefully, but Apple expects the action to actually work.
5. **`deleteAccount` edge function deployment** — required by App Store 5.1.1(v) since iOS 14.5.
6. **Apple OAuth provider configuration** — currently produces a Supabase 400 page. *Supabase dashboard → Authentication → Providers → Apple* with the Apple developer team / key / Service ID.
7. **Resend (or equivalent) transactional SMTP** — currently using Supabase's rate-limited built-in sender. Production volume will hit limits quickly.

---

## Reference: file paths

```
src/
├── pages/
│   ├── Onboarding.jsx                 # 6-step required flow
│   ├── SignIn.jsx                     # magic link + Apple OAuth (Apple disabled)
│   ├── Gateway.jsx                    # post-auth funnel
│   ├── SubscribeNow.jsx               # plan picker → buy.stripe.com
│   ├── ManageSubscription.jsx         # source-aware cancel link (5.1.1) + delete account
│   ├── CancelSubscription.jsx         # standalone cancel page (legacy direct-link target)
│   └── …
├── components/
│   ├── SubscriptionGate.jsx           # hasActiveSubscription gate
│   ├── pro/ProGate.jsx                # Pro feature lock
│   └── trial/SubscriptionBanner.jsx   # stub (returns null)
└── lib/
    ├── trialUtils.js                  # getTrialDaysRemaining, isTrialExpired
    └── subscription.js                # hasProAccess, isTrialUser, etc.

supabase/functions/
├── generateInitialPlan/               # post-onboarding LLM plan
├── cancelSubscription/                # NOT YET DEPLOYED
├── deleteAccount/                     # NOT YET DEPLOYED
└── …
```
