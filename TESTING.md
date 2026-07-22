# Caddie AI — Manual Testing Plan (post-migration)

Covers the migrated app: 21-table Supabase schema with RLS, 27 deployed edge
functions, full native-Supabase frontend, server-side LLM via the `invokeLLM`
proxy, and Supabase Storage for profile photos.

**Not covered (still blocked — see §14):** Stripe/RevenueCat payment flow,
Capacitor native apps, push notifications, affiliate system, Resend SMTP, Apple
OAuth provider.

---

## 0. Pre-flight (one-time setup)

### 0a. Apply pending migrations
```bash
cd /Users/tonyt/Projects/caddie-ai-golf-coach
npx supabase db push
```
Should apply three: `20260526000001_leaderboard_extra_columns`, `20260526000002_user_profile_handicap_updated`, `20260526000003_profile_photos_storage`.

### 0b. Supabase dashboard settings (one-time, if not already)
- **Authentication → URL Configuration**
  - Site URL: `http://localhost:5173`
  - Redirect URLs: `http://localhost:5173/**`

### 0c. Cheap-mode LLM (recommended for testing)
```bash
npx supabase secrets set CADDIE_LLM_MODEL=claude-haiku-4-5
```
Unset later (or set `claude-opus-4-7`) for production.

### 0d. Seed/upgrade your test profile to Pro
You already have a trial profile from the earlier seed. Flip it to `'pro'` AND ensure it has a `stripe_subscription_id` — `RootRoute` (the `/` gate) requires that specific field; the original seed only set `stripe_customer_id`, which `Gateway.hasAccess` checks but `RootRoute` does not. Without `stripe_subscription_id`, sign-in lands on `/subscribe-now` instead of `/home`.
```sql
-- Supabase dashboard → SQL Editor
update public.user_profile
set subscription_status = 'pro',
    subscription_plan = 'pro',
    stripe_subscription_id = coalesce(stripe_subscription_id, 'sub_dev_seed')
where user_email = 'tony.tamer21@gmail.com';
```
*(Change email if needed.)*
> ⚠️ **Known divergence (preserved from Base44):** `RootRoute` checks `profile.stripe_subscription_id`, while `Gateway.hasAccess` checks `profile.stripe_customer_id || profile.revenuecat_app_user_id`. For a seeded test profile to satisfy both routes, set **both** fields. This inconsistency is worth normalizing later (probably standardizing on the RevenueCat-as-source-of-truth model from the scope).

### 0e. (Optional) Grant yourself admin for §11
```sql
-- Supabase dashboard → SQL Editor
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role','admin')
where email = 'tony.tamer21@gmail.com';
```
Sign out and back in to pick up the new role in the JWT.

### 0f. Run the app
```bash
npm run dev
# open http://localhost:5173
```

---

## 1. Auth & gateway routing

- [ ] **Signed-out root** → `/` redirects to `/signin`.
- [ ] **Magic-link sign-in (returning user):** enter your email → "Check your email" UI → click link in inbox → land on `/gateway` → routed to `/home`.
- [ ] **Magic-link (new email):** enter a never-used email → link arrives → click → creates auth user, lands on `/gateway` → no profile → redirects to `/subscribe-now` (subscribe page renders branded).
- [ ] **Pre-filled email:** visit `/signin?email=foo@bar.com` → email field is pre-filled.
- [ ] **"Continue with Apple":** clicking navigates to Supabase's authorize endpoint and shows a raw 400 JSON page `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`. **Expected** until the Apple provider is configured in Supabase dashboard → Authentication → Providers → Apple. *(`signInWithOAuth` does `window.location.href = ...` to that endpoint, so the JSON renders as the page — the React handler can't intercept it since the original document is gone. Once Apple is configured, this will 302-redirect to Apple's sign-in instead.)*
- [ ] **Session persistence:** sign in, hard-refresh the page → still signed in (no bounce to `/signin`).
- [ ] **Open in new tab:** session is shared (Supabase persists in localStorage).
- [ ] **Sign-out (Profile page or Settings):** clicking Log Out clears the session; visiting `/home` after redirects to `/signin`.

---

## 2. Onboarding (new user path)

> Skip if your existing profile already has `onboarding_complete=true`. To re-test, set it to `false` via SQL and reload.

- [ ] All steps render (Game → Schedule → Club Distances → Skill Ratings → Plan Ready).
- [ ] Cannot skip past required steps.
- [ ] On finish: profile is created/updated with `onboarding_complete=true`, trial dates set, `subscription_status='trial'`.
- [ ] **`generateInitialPlan` LLM call** fires and a row appears in `practice_plan` with `is_active=true`. (Check Supabase Studio → `practice_plan`.)
- [ ] User lands on `/home`.

---

## 3. Home screen (`/home`)

- [ ] Greeting + first name shown ("Good morning, Tony 👋"). If name is missing it falls back to "Golfer".
- [ ] **Today's session card:** if no plan yet, shows "Generate your first practice plan" with CTA; with a plan, shows today's session + drills.
- [ ] **This Week strip** — 7 day dots, today ring-highlighted; activity days fill in after logging sessions/rounds.
- [ ] **LeaderboardWidget** — null until there's a `leaderboard_entry` row for you; appears once `updateLeaderboard` has run (after logging activity).
- [ ] **Weekly Goal Rings** — appear once you have a practice plan; complete-state animation fires when a ring hits 100%.
- [ ] **CoachDailyInsight** — short coaching blurb (rule-based, not LLM here).
- [ ] **QuickStatsRow** — Handicap / This Month rank / Sessions tiles. First two will show `—` until `calculateHandicap` and `getLeaderboard` have data; sessions count updates immediately.
- [ ] Quick actions navigate (Coach → `/coach`; Log Round → `/progress` with the round form open).

---

## 4. My Plan (`/plan`)

- [ ] **View** — week range header, 7 day dots, expandable day cards with drills.
- [ ] **Generate New Plan** → calls `invokeLLM` proxy (Anthropic call); new `practice_plan` row appears with `is_active=true`, old plans flipped to `is_active=false`.
- [ ] **Start Session (today)** → CoachBriefing modal opens with a short LLM-generated briefing.
- [ ] **Briefing → Let's Go** → ActiveSessionMode opens.
- [ ] **Complete session** → calls `logSession` (writes `session_log` + `drill_rating` rows; fires `checkBadges` + `updateLeaderboard` in background) → SessionCelebration screen with confetti, points, optional badge popup, LLM-generated coach note.
- [ ] **After a session:** the corresponding day dot is green/✓ on the strip and the card shows "✓ Session Complete".
- [ ] **Rate limits (silent, expected):** logging more than 3 sessions in a day, or two of the same session type, silently returns `{saved:false}` — no error toast.

---

## 5. Coach chat (`/coach`)

- [ ] **First open of the session:** opening LLM message appears, referencing real data (your handicap, recent activity, etc.). New `chat_message` row with `role='assistant'`.
- [ ] **Send a message** → user bubble appears, loading dot, then assistant reply. Two rows in `chat_message` (`user` then `assistant`).
- [ ] **Within-session navigation** (Home → Coach → Home → Coach): on re-entry shows full session history (not a new opening).
- [ ] **Cross-day re-open** triggers a fresh opening message.

---

## 6. Progress (`/progress`)

- [ ] **Rounds list** renders (empty state if none).
- [ ] **Log a round** form: course, score, FW, GIR, putts → submit calls `logRound`:
  - New `round` row.
  - Background: `updateHandicap` (recomputes handicap from rounds; updates `user_profile.current_handicap` + `handicap_last_updated`), `checkBadges`, `updateLeaderboard`.
  - If you log a score >10 better than expected for your handicap, a `flagged_round` row should appear (admin will see it in §11).
- [ ] **Rate limits:** > 2 rounds for the same day silently no-ops.
- [ ] **HandicapHero / HandicapTracker** — show the calculated handicap once you have ≥3 rounds (`calculateHandicap` edge function).
- [ ] **HandicapChart** — line chart from `handicap_entry` rows.
- [ ] **CoachTake** — LLM-generated paragraph if you have rounds; rule-based fallback otherwise.

---

## 7. Profile & EditProfile

### `/profile`
- [ ] User card, handicap, skill ratings, practice preferences all render.
- [ ] **Edit Profile button** navigates to `/edit-profile`.
- [ ] **Save practice preferences** (PracticePreferences component) → regenerates the practice plan via `invokeLLM`; toast confirms.
- [ ] **Log Out** → signs out, lands on `/signin`.

### `/edit-profile`
- [ ] Form pre-fills from current profile.
- [ ] **Photo upload** (Camera button) — this exercises **Supabase Storage**:
  - Choose an image → uploads to bucket `profile-photos` under `<your-auth-uid>/<timestamp>.<ext>`.
  - Profile picture updates in the UI immediately.
  - Verify in Supabase Studio → Storage → `profile-photos` that the file exists.
- [ ] **Save Changes** — updates `user_profile`. If `current_handicap` changed, a new `handicap_entry` row is created with note "Manual update".

---

## 8. Account / Settings pages

- [ ] **`/settings`** loads; Log Out works.
- [ ] **`/account`** (AccountScreen) loads. *(Delete-account flow calls the `deleteAccount` edge function — it cancels Stripe sub if `STRIPE_SECRET_KEY` is set (it isn't), wipes user data across 17 tables, deletes the auth user. Test cautiously — it's destructive.)*
- [ ] **`/notifications`** (NotificationPreferences) — toggle prefs → saves to `user_profile`.
- [ ] **`/referral`** — shows `referral_code`, signups count (will be 0), free-months earned, credits remaining (will be 0 until Stripe is wired — `getReferralStats` returns 0 when no `STRIPE_SECRET_KEY`).
- [ ] **`/send-feedback`** (SendFeedback) — submit form → `submitFeedback` writes a `feedback` row.
- [ ] **`/club-distances`** — edit yardages → save updates `user_profile`.

---

## 9. Leaderboard (`/leaderboard`)

- [ ] Loads month/week/streaks/alltime tabs (`getLeaderboard` edge fn).
- [ ] Your entry appears (if you've logged any rounds/sessions this month AND your account is ≥14 days old AND `subscription_status` is paid).
- [ ] Previous-month champion banner shows null if no prior data (expected).
- [ ] Tapping another player card → opens `PlayerProfileCard` (calls `getPlayerProfile`) — shows their handicap, totals, badges.
- [ ] **`/leaderboard-info`** loads.

---

## 10. Pro features (require `subscription_status='pro'`)

> Set in §0d. Reload the page to pick up.

- [ ] **Monthly Game Plan card** (Home/MyPlan, wherever it's wired) → tap → calls `generateMonthlyGamePlan` → renders monthly_focus / why_this_month / etc. New `monthly_game_plan` row.
- [ ] **Pre-Round Game Plan button** → `generatePreRoundGamePlan` → returns 3-sentence plan referencing your actual club distances.
- [ ] **Weekly Reports** → first open generates via `generateWeeklyReport` → renders this_week_numbers, what_improved, what_needs_attention, drill_of_the_week, coachs_take, looking_ahead. Subsequent opens within the same week return cached.
- [ ] **Competitor Intel** → `getCompetitorIntel` (no LLM, pure aggregation) — shows percentile vs. full app and handicap range. Needs ≥5 paid users in your handicap range for `hasEnoughData` to be true; otherwise the "not enough data" branch should render gracefully.
- [ ] **`proWeeklyCoachMessage`** is invoked by a scheduled task in production; for manual testing, you can invoke it via:
  ```bash
  URL=$(grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2-)
  ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)
  # Need a real user JWT — easiest is to grab the access_token from
  # browser DevTools → localStorage → sb-<ref>-auth-token, then:
  curl -X POST "$URL/functions/v1/proWeeklyCoachMessage" \
    -H "Authorization: Bearer <user-access-token>" -H "Content-Type: application/json" -d '{}'
  ```
  Should write a `chat_message` row with `role='assistant'` prefixed `[Weekly check-in]`.

---

## 11. Admin pages (require JWT `app_metadata.role='admin'`)

> See §0e. Sign out/in after setting the role.

- [ ] **`/admin/flagged`** → renders both lists from `flagged_round` + `flagged_account`. If you logged a suspicious score in §6, it appears here. Approve/ignore actions update status.
- [ ] **`/admin/feedback`** → list of `feedback` rows (latest first). Change a status; row updates.
- [ ] **`/admin/waitlist-credits`** → list of `waitlist_credit` rows. "Apply" button invokes `applyWaitlistCredit` → marks as Applied.
- [ ] **`/admin/fix-user`** → enter email + a `sub_*` id + plan → invokes `createManualUserProfile` → creates/updates the profile.
- [ ] **`getUsageReport`** — no UI page in the app, but you can hit it directly with your admin JWT and inspect the buckets/leakyUsers JSON (admin-only).
- [ ] **As a non-admin user:** visiting these pages should redirect or show "forbidden" — confirm the gate works.

---

## 12. Pre-auth (Welcome flow)

> Sign out first. Visit `/welcome`.

- [ ] Hero + sections render.
- [ ] **Email capture form** → `waitlist_email.insert(...)` succeeds (RLS allows public insert). Verify a row appears in Supabase Studio → `waitlist_email`.
- [ ] **Waitlist counter** (`getWaitlistCount`) reflects total emails. Refresh → count updates.

---

## 13. Subscribe/Checkout pages (limited — Stripe not wired yet)

These pages render with full UI but downstream Stripe actions won't complete.

> **Route renames during migration:** `/subscription-checkout` → **`/checkout`**, `/trial-started` → **`/checkout/success`**. The old page files (`SubscriptionCheckout.jsx`, `TrialStarted.jsx`) still exist but only `/checkout` and `/checkout/success` are registered routes; visiting the old URLs gives a generic 404. The new `CheckoutSuccess` is a static "Welcome / Sign in to access your account" landing — it does **not** call `getStripeSessionDetails` or `signInAfterCheckout` (those edge fns aren't deployed either).

- [x] **`/subscribe-now`** renders branded plan picker (only post-auth without a subscription); clicking "Choose Basic/Pro" opens the real `buy.stripe.com` checkout — *expected to be functional only if those Stripe payment links are still live in your Stripe account*; the post-checkout webhook → profile creation pipeline is **not yet ported**, so a real purchase wouldn't update the DB. Anon visitors are bounced to `/signin` (with `?email=` preserved when supplied).
- [x] **`/checkout`** (was `/subscription-checkout`) redirects to `/signin` if not authenticated; otherwise renders.
- [x] **`/manage-subscription`** and **`/cancel-subscription`** render. The Cancel button invokes the not-yet-deployed `cancelSubscription` function — both pages now handle the 404 gracefully with a "We couldn't cancel right now. Please email support@caddieaiapp.com…" message. *(Fixed 2026-05-29 — see Verification log §17.)*
- [x] **`/checkout/success`** (was `/trial-started`) — the post-checkout landing. Static page: logo + green checkmark + "You're in. Welcome to Caddie AI. Your payment was received. Sign in to access your account." → "Sign In to Caddie AI →" CTA. No edge fns called.
- [ ] **`/autologin`** uses the obsolete magic-link verify path; do not test this — Supabase magic links go through `/gateway`.

---

## 14. Security spot-checks

- [ ] **RLS owner isolation:** create a second test user, log a session as them, then sign in as your main account — confirm you cannot see their `session_log`/`round`/etc.
- [ ] **Admin pages as non-admin:** visit `/admin/feedback` etc. without the admin role; should bounce.
- [ ] **Anon writes blocked:** signed out, in DevTools console try:
  ```js
  fetch(`${VITE_SUPABASE_URL}/rest/v1/round`, {
    method:'POST',
    headers:{'apikey':VITE_SUPABASE_ANON_KEY,'Authorization':`Bearer ${VITE_SUPABASE_ANON_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({user_email:'attacker@example.com', total_score:1})
  }).then(r => r.status)
  ```
  Should return `401` with Postgres code `42501` (RLS violation).
- [ ] **Anthropic key not in bundle:** open browser DevTools → Sources → search the bundled JS for `sk-ant-` → must return zero hits.

---

## 15. Edge function ↔ feature map (reference)

| Feature | Function | Where it fires |
|---|---|---|
| Onboarding plan | `generateInitialPlan` | Onboarding completion |
| Home stats | `applyClubDistanceDefaults`, `calculateHandicap`, `getLeaderboard` | Home mount, QuickStatsRow |
| Log session | `logSession` → `checkBadges`, `updateLeaderboard` | MyPlan → complete session |
| Log round | `logRound` → `updateHandicap`, `checkBadges`, `updateLeaderboard` | Progress → log round |
| Coach chat | `invokeLLM` (proxy) | Coach page |
| Plan regen | `invokeLLM` | MyPlan, Profile (preferences save) |
| Pro coaching | `generateWeeklyReport`, `generateMonthlyGamePlan`, `generatePreRoundGamePlan`, `proWeeklyCoachMessage`, `getCompetitorIntel` | Pro components |
| Player profile | `getPlayerProfile` | Leaderboard → player card |
| Referrals | `getReferralStats` | Referral page |
| Feedback | `submitFeedback` | SendFeedback page |
| Waitlist | `getWaitlistCount` | Welcome page counter |
| Admin | `getUsageReport`, `fixUserProfile`, `createManualUserProfile`, `markExistingUsersTourComplete`, `applyWaitlistCredit` | Admin pages |
| Account deletion | `deleteAccount` | AccountScreen |
| Scheduled | `cleanupExpiredPendingUsers`, `processMonthlyWinner` | Cron (not wired yet — invoke manually if testing) |
| Drill instructions | `invokeLLM` | ExpandedDrillInstructions |

---

## 16. Known limitations (NOT bugs — still to do)

- **Stripe / RevenueCat (15 functions)** — none deployed yet. Subscribe/cancel/manage flows will fail at the payment step. Needs your `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, RevenueCat webhook secret + the RevenueCat-as-source-of-truth redesign.
- **Magic-link functions** (`generateMagicLink`, `verifyMagicLink`) — obsolete under Supabase Auth; will be deleted.
- **Resend SMTP** — auth emails currently use Supabase's built-in (rate-limited) sender. For production, configure Resend SMTP in Supabase dashboard → Authentication → Emails.
- **Apple OAuth provider** — Continue with Apple button errors until configured in Supabase dashboard → Authentication → Providers → Apple.
- **Capacitor native apps + push notifications (FCM/APNs)** — separate scope deliverables; not started.
- **Affiliate tracking system** — separate scope deliverable; not started.
- **Minor agent-migration nuances:**
  - `Settings.handleLogout` and `AccountScreen.handleCancelConfirm` no longer pass a redirect target to signOut (was `/onboarding` on Base44). You may need to call `navigate('/signin')` after signOut in those handlers.
  - A few places read `user.full_name` — Supabase puts the name on `user.user_metadata.full_name`. Fallbacks exist so nothing crashes, but the displayed name may show the default until those reads are updated.
  - `PageNotFound.jsx`: `base44.auth.me()` used to *throw* when unauthenticated; `getCurrentUser()` returns `null` instead. The page may set `isAuthenticated:true` with a null user when signed out. Cosmetic only.
- **`AutoLogin.jsx` / `CreateAccount.jsx`** — these page paths are vestigial under Supabase Auth. They'll be removed alongside the magic-link function cleanup.

---

## Reporting findings

For each failed item: paste the URL/screen, the steps to reproduce, the
expected vs. actual behaviour, and any console/network error. Filter the
Supabase dashboard's **Edge Function Logs** for the relevant function name to
see server-side errors.

---

## 17. Verification log

Sections checked off interactively in the most recent verification pass. Per-section status, edge fns observed, and any bugs surfaced + how they were resolved.

### 2026-05-29 session

Test user: `admin@silexdev.com` (Pro profile, admin role granted during §11). Driven via puppeteer-core + headless Chrome with magic-link auth (`/auth/v1/admin/generate_link`). Verification scripts at repo root: `verify-home.mjs`, `verify-plan.mjs`, `verify-coach.mjs`, `verify-progress.mjs`, `verify-profile.mjs`, `verify-practice-prefs.mjs`, `verify-settings.mjs`, `verify-notif.mjs`, `verify-leaderboard.mjs`, `verify-pro.mjs`, `verify-monthly-regen.mjs`, `verify-admin.mjs`, `verify-waitlist-fix.mjs`, `verify-welcome.mjs`, `verify-subscribe.mjs`, `verify-subscribe-corrected.mjs`, `verify-cancel-fix.mjs`, `verify-account-cancel.mjs`.

| § | Topic | Status | Bugs fixed in this pass |
|---|---|---|---|
| 1 | Auth & gateway | ✅ PASS | — (Apple OAuth 400 JSON page is expected, see §1) |
| 2 | Onboarding | ⏸ skipped (existing profile has `onboarding_complete=true`) | — |
| 3 | Home | ✅ PASS | — |
| 4 | My Plan / session flow | ✅ PASS | XML-wrapper leak in CoachBriefing (text-mode LLM call) — fixed by simplifying `DEFAULT_SYSTEM` in `supabase/functions/_shared/anthropic.ts` |
| 5 | Coach chat | ✅ PASS | — (chat history doesn't survive hard refresh by design, confirmed) |
| 6 | Progress | ✅ PASS | Schema drift: missing `round.course_rating`/`slope_rating` and `user_profile.handicap_last_updated` — migrations added (`20260528000001_round_rating_columns.sql`) |
| 7 | Profile / EditProfile / photo upload | ✅ PASS | — (sonner toast UI on PracticePreferences flagged as pre-existing, left alone per "keep as intended") |
| 8 | Account / Settings | ✅ PASS | Schema drift: missing `user_profile.notification_preferences` — migration added (`20260528000002_notification_preferences.sql`) |
| 9 | Leaderboard | ✅ PASS | **Empty-state contradiction**: rendered "No entries yet · Log a round or session" while the countdown card simultaneously said "Your current score: 15.2 pts · appearing in 12 days". Fixed at `src/pages/Leaderboard.jsx` — branch empty-state on `myEntry` shape, not just `entries.length` |
| 10 | Pro features | ✅ PASS | — (MonthlyGamePlan regen button is icon-only, no `aria-label` — minor a11y note) |
| 11 | Admin pages | ✅ PASS (1 partial) | **`AdminWaitlistCredits` silently dropped status=null rows.** Schema check is `('Applied','Failed')` + NULL; UI bucketed only `Failed`/`Applied`. Fixed at `src/pages/AdminWaitlistCredits.jsx` — added Pending bucket for NULL status. **Non-admin gate test partial**: PUT-stripping `app_metadata.role` succeeds at the user record, but Supabase's `generate_link` mints a magic-link with stale state. Gate code itself verified by source review |
| 12 | Pre-auth Welcome flow | ✅ PASS | 🚨 **Pre-launch waitlist signups silently failing for every visitor.** `EmailCapture.jsx` used `.insert(...).select().single()` from anon context. `waitlist_email` has admin-only SELECT RLS, so the `return=representation` half 42501'd and the form showed "Something went wrong". Fixed by dropping the chained `.select().single()` |
| 13 | Subscribe/Checkout | ✅ PASS | **Two cancel-subscription bugs**: `ManageSubscription.jsx` accessed `res.data.message` without checking `error` → JS NPE shown to user when edge fn 404'd. `CancelSubscription.jsx` ignored `error` entirely → user saw "✅ Subscription Cancelled" on 404. Both fixed to destructure `{data, error}` and show a "please email support" message on failure. Same fix applied to `AccountScreen.jsx` (Cancel + Delete). The deleteAccount bug was the worst: silent fall-through to `signOut()` would lock the user out of an account that still existed on the server |
| 14 | Security spot-checks | ✅ PASS | **§14.1 RLS isolation**: seeded a fresh second user (user-B, role=user, separate auth user), confirmed user-B's queries against `session_log`, `round`, and `user_profile` return ZERO of user-A's rows. **§14.2 Admin gate**: user-B visiting `/admin/*` — `/admin/flagged` renders inline "Access denied", the other three (`/feedback`, `/waitlist-credits`, `/fix-user`) `navigate('/')` or `navigate('/settings')` and chain through to `/subscribe-now` since user-B has no active sub. All four correctly blocked. **§14.3 Anon writes blocked**: POSTing anon-key payloads to `round`, `session_log`, `user_profile` all return 401 + `42501` (RLS violation). Anon SELECT returns 200 with `[]` (filtered, not errored — correct). **§14.4 Anthropic key not in bundle**: ran `npm run build` and grepped `dist/` — zero hits for `sk-ant-`, `ANTHROPIC_API_KEY`, or even the literal string `Anthropic` (correct — LLM calls go through the `invokeLLM` edge fn proxy) |

### Cross-cutting cleanup

- **`supabase.functions.invoke` audit** (2026-05-29) — walked all 22 call sites. `{data, error}` is returned on non-2xx without throwing; bare `try/catch` doesn't trip. Buggy sites fixed; safe sites use `res.data?.X` optional chaining or have intentional `.catch` swallow. Audit + pattern guidance saved as memory `supabase-invoke-error-footgun.md`.
- **`waitlist_email.insert(...).select()` audit** — `EmailCapture` was the only public-INSERT site combined with restricted SELECT RLS. All other `.insert().select()` chains are in authenticated contexts where SELECT RLS allows the user to read their own row.
- **Schema drift sweep** — `audit-schema.mjs` script (fetches PostgREST OpenAPI + greps source for `.from(table).{update,insert,eq,order,…}` references). Final result: 0 missing column references.
- **Email case-normalization** (2026-05-30) — Supabase auth lowercases `auth.users.email`, but the `user_profile.user_email` insert paths (`createManualUserProfile`, `fixUserProfile`, `AdminFixUser`) used the raw admin-typed value. Combined with case-sensitive RLS this would orphan users from their own profile. Fixed at four layers: the three application paths + a new RLS policy (`lower(user_email) = auth.email()`, migration `20260530120000`) + a `BEFORE INSERT/UPDATE` normalization trigger on `user_profile` (migration `20260530130000`). Verified end-to-end with `verify-lowercase-rls.mjs`.
- **Admin gate UX standardization** (2026-05-30) — `/admin/flagged` used inline "Access denied" while the other three pages redirected. All four now do `navigate('/', { replace: true })` and return `null` while the redirect is in flight. Verified by `verify-security.mjs`.
- **Migrations applied (in chronological order):**
  - `20260525000001_initial_schema.sql` — initial schema
  - `20260525000002_rls_policies.sql` — initial RLS
  - `20260526000001_leaderboard_extra_columns.sql`
  - `20260526000002_user_profile_handicap_updated.sql`
  - `20260526000003_profile_photos_storage.sql`
  - `20260528000001_round_rating_columns.sql` — `round.course_rating`, `slope_rating`
  - `20260528000002_notification_preferences.sql` — `user_profile.notification_preferences`
  - `20260530120000_user_profile_lowercase_rls.sql` — case-insensitive RLS
  - `20260530130000_user_profile_email_normalize_trigger.sql` — lowercasing trigger

### Pre-handoff cleanup (2026-05-30)

- **`base44/` folder deleted** — Base44 platform source from before the migration. 66 files / 344 KB removed. Not referenced by any running code.
- **13 Base44-CDN images self-hosted** — moved from `media.base44.com` to `public/images/welcome/` (6.1 MB total). The four `welcome/*Section.jsx` components now use local paths. Removes the risk of broken assets if the Base44 CDN ever expires them.
- **`TrialStarted.jsx` deleted** — was imported as `TrialStartedOld` in App.jsx, never registered as a route. 203 lines of dead code gone.
- **`package.json` renamed** — `"base44-app"` → `"caddie-ai-golf-coach"`. Lockfile regenerated.
- **`README.md` rewritten** — fresh Caddie AI getting-started doc for the client dev team. Covers tech stack, repo tour, local dev setup, architecture, deploy, and pending work pointers.
- **`.env.local.example` added** — env template (with comments preserved) so new devs can copy it. `.gitignore` updated to allow `.env.*.example`.
- **`src/APP_STORE_COMPLIANCE.md` refreshed** — replaced Base44 code samples with current Supabase patterns. Added prominent "Migration drift" section documenting 5 trial-experience features and 3 routing/checkout claims that no longer match the codebase. Lists 7 decisions the team needs to make before next App Store submission.
- **DB cleanup** — purged 4 `fixme-*@test.com` user_profiles, 4 `waitlist_email` test rows, 5 `waitlist_credit` test rows. Dev DB now reflects only the real test user.

### Phase 2 — Payment integration migration (2026-05-31)

Closing the last big code gap in the Base44 → Supabase migration: the RevenueCat ↔ Stripe ↔ Supabase chain that handles subscription lifecycle. Took one focused session driven by user with read-only RC + Stripe (live mode) MCP access for diagnostic queries.

#### Strategic decisions (locked in early)

| Decision | Choice | Why |
|---|---|---|
| **Entitlement model** | Single `caddiePro` entitlement; webhook derives `subscription_plan` ('basic'\|'pro') from `product_id` | App already keys gates off `subscription_plan`; zero RC dashboard changes; canonical RC pattern |
| **Payment flow** | Server-side Stripe Checkout Sessions (replaces `buy.stripe.com` payment links) | Properly ties purchase to user via `client_reference_id` and `metadata.rc_app_user_id`; same hosted-checkout UX |
| **App User ID** | Supabase auth UUID (`auth.users.id`) | Stable across email changes; opaque; the canonical RC identifier choice |

#### Edge functions deployed

| Function | Purpose | Key behavior |
|---|---|---|
| **`revenueCatWebhook`** (~440 lines) | Receives RC subscription lifecycle events, updates `user_profile` | Ported from Base44 commit `b2cb0d6` preserving every hard-won prod fix (strict product→plan map, phantom EXPIRATION guard, TRIAL period detection on INITIAL_PURCHASE, iOS-only profile-creation guard). Added a 3rd profile-resolution path: when `app_user_id` is a Supabase UUID and event email is null, fall back to `auth.admin.getUserById(uuid)` → email → profile lookup. `verify_jwt=false` (function does its own shared-secret check on the Authorization header). |
| **`createStripeCheckoutSession`** (~110 lines) | Creates a server-side Stripe Checkout Session and returns its URL | Reads `STRIPE_SECRET_KEY` + `STRIPE_{BASIC,PRO}_PRICE_ID` from secrets. Sets `client_reference_id` + `subscription_data.metadata.rc_app_user_id` to Supabase UUID. 7-day trial via `trial_period_days`. `allow_promotion_codes: true` for the referral credit flow. `verify_jwt=true`. |
| **`cancelSubscription`** (~130 lines) | Cancels the authenticated user's Stripe sub at period end | Searches Stripe customers by JWT email, finds first active or trialing sub across matches, calls `subscriptions.update(id, {cancel_at_period_end: true})`. Optimistically writes `user_profile.subscription_status='cancelling'` for immediate UX. Idempotent (returns "already cancelling" if `cancel_at_period_end` was already set). Required by Apple Guideline 5.1.1. `verify_jwt=true`. |
| **`findProfileByStripeCustomer`** (~95 lines) | Gateway fallback when post-auth profile lookup by email fails | Three-step lookup: (1) Stripe customer search by JWT email, (2) for each, check `customer.metadata.rc_app_user_id` and lookup `user_profile.revenuecat_app_user_id`, (3) legacy `stripe_customer_id` column lookup. Uses JWT email exclusively (ignores body) to prevent abuse. `verify_jwt=true`. |

#### Frontend changes

| File | Change |
|---|---|
| `src/lib/db.js` | New helper `alignRevenueCatAppUserId(user)`: idempotent + per-session-cached + silent on errors. UPDATEs `user_profile.revenuecat_app_user_id = user.id` keyed on `user_email`. **Bug fixed mid-implementation:** original code had `.neq('revenuecat_app_user_id', uuid)` filter — Postgres `NULL != val` evaluates to NULL not TRUE, so the filter silently excluded null rows (exactly the case we needed to fix). Now does unconditional UPDATE relying on the cache. |
| `src/lib/AuthContext.jsx` | Calls `alignRevenueCatAppUserId(u)` after `setUser` so the cache is populated on every authenticated session (initial mount + onAuthStateChange ticks coalesced via internal cache). |
| `src/pages/SubscribeNow.jsx` | Removed hardcoded `buy.stripe.com` URLs + `buildUrl()`; new `startCheckout(plan)` invokes `createStripeCheckoutSession` and redirects via `window.location.assign(data.session_url)`. Per-plan loading state + error display. iOS native-bridge fallback also routes through Stripe Checkout now. |
| `src/pages/SubscriptionCheckout.jsx` (`/checkout` route) | Same refactor — invokes edge fn and redirects, removes the payment-link constants. |
| `src/pages/CheckoutSuccess.jsx` (`/checkout/success`) | Was a static "Sign in" page from the Base44 anonymous-purchase flow. Now auth-aware: signed-in users see "Activating your subscription…" spinner that polls `user_profile.subscription_status` every 2 seconds for the webhook to land (looking for any non-`expired` state with payment linkage), auto-redirects to `/` (→ Gateway → `/home`). 30-second timeout falls back to a manual "Continue to Caddie AI" button with session_id shown for support. Signed-out users still see the original "Sign In" CTA. |

#### Migrations applied

- `20260530150000_user_profile_add_cancelling_status.sql` — adds `'cancelling'` to the `subscription_status` CHECK constraint. The Base44 webhook always wrote this value on CANCELLATION; our initial schema only listed `('trial','basic','pro','expired')` so an unported webhook would 23514 on first cancel. Purely additive — existing rows remain valid.

#### Configuration

- `supabase/config.toml`: appended `[functions.revenueCatWebhook]` block with `verify_jwt = false`. All other functions use the default (true).
- `.mcp.json`: project-scoped MCP config with Stripe (`https://mcp.stripe.com`) and RevenueCat (`https://mcp.revenuecat.ai/mcp`) HTTP servers. Used during this session for diagnostic queries with read-only OAuth scopes.

#### Real-world events validated

The end-to-end pipeline (UI → Stripe → RC → mirror webhook → DB) was exercised four distinct ways:

1. **10 synthetic INITIAL_PURCHASE/RENEWAL/CANCELLATION/EXPIRATION payloads** against the deployed webhook — every code path returned the expected DB transition.
2. **1 real live mode test purchase** (admin@silexdev.com using a 100%-off `CADDIE_TEST_100` forever coupon) → Stripe created customer `cus_UcWqqBParnZEA3` + subscription `sub_1TdHml2ZJRGxxJxRLnKGZPQT` (trialing, $29.99/mo USD, 7-day trial, both Session and Subscription metadata correctly populated with `rc_app_user_id` = Supabase UUID). RC created subscriber `485746a6-…` with `caddiePro` entitlement. **Webhook initially returned "no profile" because the event arrived with `app_user_id=<UUID>` and `email=null`, neither matching by `user_email` nor by `revenuecat_app_user_id` (still cleared at the time).** This surfaced the gap that task #7's alignment helper addresses long-term; the immediate fix was the auth-admin fallback added to the webhook. Synthetic replay of the actual event (using the real values from logs + RC customer record) after the patch returned 200 with the profile correctly updated to `subscription_status='trial'`, plan='pro', trial dates set, `revenuecat_app_user_id` cached.
3. **1 real CANCELLATION** fired automatically when the user cancelled the test subscription via Stripe dashboard as cleanup. Webhook received it via mirror integration, resolved the profile via auth-admin fallback (since `revenuecat_app_user_id` had been briefly cleared during separate testing), updated `subscription_status='cancelling'`. Unintended but extremely satisfying validation that the system works under real traffic patterns.
4. **UI cancel flow (Test A)** — `/manage-subscription` → Cancel button → confirmation → `cancelSubscription` edge fn found a lingering test mode Stripe sub for admin@silexdev.com (orphaned from earlier in the session), called `cancel_at_period_end=true`, optimistically updated profile. UI displayed the canonical success message.
5. **CheckoutSuccess auto-redirect (Test B)** — navigated to `/checkout/success` while profile was `cancelling`, poll detected non-`expired` state with payment linkage within 2s, redirected to `/home`.

#### Bugs found and fixed during this work

| Bug | Site | Fix |
|---|---|---|
| RC INITIAL_PURCHASE for Stripe Checkout events arrives with UUID as `app_user_id` and no email anywhere on the payload — webhook couldn't resolve to a profile | `revenueCatWebhook/index.ts` | Added third lookup path: `auth.admin.getUserById(uuid)` → email → profile lookup. Defensive — works even if alignment helper hasn't run yet |
| `alignRevenueCatAppUserId` helper's `.neq('revenuecat_app_user_id', uuid)` filter silently excluded null rows (Postgres NULL semantics) — fired without effect | `src/lib/db.js` | Removed the filter; rely on the module-scope `rcIdentifiedUserIds` cache to dedupe per session |

#### Decisions / discoveries about test mode that affected the test plan

- **RevenueCat's Stripe integration is configured for live events only by default.** Test mode Stripe purchases don't reach RC, so the full pipeline can't be validated in test mode — the mirror webhook stays silent. Confirmed via empty RC audit logs after test mode purchase; live mode purchase resolved this immediately.
- **Stripe Checkout displays prices in the customer's local currency** (Adaptive Pricing). USD `$29.99` showed as `CA$43.05` on test purchase because the customer browsed from Canada. Underlying transaction stays USD; display is courtesy conversion. Settings → Payments → Adaptive Pricing controls this.
- **Stripe API key types are interchangeable for our use case** — `sk_live_…`, `rk_live_…` (Restricted), and `sk_test_…` all work for `createStripeCheckoutSession`. Restricted keys are recommended; the Restricted key just needs Checkout Sessions/Customers write + Products/Prices read.

#### What's still pending (none blocking Capacitor work)

- **Apple OAuth provider** — Supabase dashboard → Authentication → Providers → Apple. Currently the "Continue with Apple" button shows a Supabase 400 JSON page. ~10 min.
- **Resend transactional SMTP** — Supabase dashboard → Authentication → Emails. Built-in sender is rate-limited; production will hit limits. ~15 min.
- **Production cutover to client's empty Supabase** — separate ~half-day work: `supabase link` to client project, `supabase db push`, `for fn in supabase/functions/*/; do supabase functions deploy …; done`, set secrets, point frontend env vars at new project, update RC mirror webhook URL.
- **Real user data migration Base44 → client's Supabase** — one-time ETL during cutover. Pull existing customers' profiles/rounds/sessions/etc. from Base44, transform to Supabase schema, bulk insert. Riskiest piece because field-mapping mistakes corrupt history.
- **Delete Base44 webhook integration** — final cutover step. The mirror has been running successfully alongside.

### Phase 3 — Capacitor iOS native app (2026-06-01 to 2026-06-03)

Two-day push spanning the Capacitor native iOS wrap, full push notification stack, App Store compliance items, and client-coordination work to get the app to a submittable state. Most code is **code-blind** — written without the corresponding Apple Developer / RevenueCat dashboard config in place (those are gated on the client). The app boots, signs in via magic link, navigates all screens; everything that depends on per-environment keys (real APNs delivery, real Apple IAP purchases, real Apple OAuth) lights up when the keys arrive.

#### Strategic decisions

| Decision | Choice | Why |
|---|---|---|
| **Bundle ID** | `com.caddieaiapp.app` (fresh, not the legacy `com.base69e5121277e4e0398b59c054.app`) | Old ID was Base44 auto-generated hash. Bundle IDs are permanent identity — crash reports, RC dashboard, every log shows it forever. Existing rejected record had nothing to preserve. |
| **Capacitor version** | Capacitor 8 (current major) | Uses Swift Package Manager for plugin integration (not CocoaPods). One less moving part. Documented as `[[capacitor-uses-spm-not-pods]]` memory. |
| **Native auth callback** | Custom `caddieai://` URL scheme (not Universal Links yet) | Custom scheme works today without DNS/entitlement; Universal Links is polish for post-launch when DNS access settled. |
| **iOS payment provider** | RevenueCat IAP with Stripe-via-Browser-plugin fallback | RC IAP is App-Store-compliant for digital subs (Apple 3.1.1). Stripe-via-Browser is a temporary fallback so the app stays functional during the dashboard-config gap. Code path is `getOfferings() === null → startCheckout()` — flips off once RC dashboard is live. |
| **Push delivery transport** | Direct APNs HTTP/2 with ES256 JWT signing in Deno Edge Function | No third-party push service (OneSignal, FCM-as-proxy) for iOS. Cleaner secret management — only Apple's `.p8` key on Supabase secrets. Will add FCM for Android in Phase 4. |
| **Sign-in / sign-up UX** | Single magic-link screen serving both (consolidated by previous developer) | Was "Welcome back" → confusing for new users. Copy changed to "Welcome to Caddie AI" / "Enter your email — we'll send you a magic link to sign in or get started" so both audiences feel welcomed. |
| **Trial users get full Pro access** | Yes (matches original Base44 implementation) | Apple-friendlier "try before you buy" story. `hasProAccess` updated. |

#### Native plugins installed + wired

| Plugin | Code surface |
|---|---|
| `@capacitor/app` | `App.appUrlOpen` → `DeepLinkRouter` in `App.jsx`. Parses `caddieai://path?query` into SPA navigations. Also handles auth-code-exchange (`?code=` → `supabase.auth.exchangeCodeForSession`) and implicit hash tokens (`#access_token=` → `setSession`). |
| `@capacitor/browser` | `openExternal(url)` helper in `src/lib/platform.js`. Used by SubscribeNow + SubscriptionCheckout for Stripe Checkout on native (Phase-2 fallback path). Also wraps Apple OAuth: `signInWithOAuth({ provider: 'apple', skipBrowserRedirect: true })` → `Browser.open(data.url)` → redirect back via custom scheme. |
| `@capacitor/camera` | Replaces HTML file input in `EditProfile.jsx`. `Camera.getPhoto({ source: Prompt })` shows iOS native action sheet. Returned `webPath` fetched as Blob, uploaded to Supabase Storage's `profile-photos` bucket. Permissions: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` added to Info.plist. |
| `@capacitor/push-notifications` | `src/lib/push-notifications.js` wrapper exports `checkPushPermission` / `requestPushPermission` / `registerForPush` / `enablePushAndGetToken` plus listener helpers. `registerForPush` has a 10-second timeout fallback (without `aps-environment` entitlement iOS silently drops `register()` without firing either event — promise would hang forever). |
| `@revenuecat/purchases-capacitor` | `src/lib/revenuecat.js` wrapper exports `configureRevenueCat` / `identifyRevenueCatUser` / `getOfferings` / `purchasePackage` / `restorePurchases` / `getCustomerInfo` plus `hasAnyActiveEntitlement` / `planForPackage` helpers. All safe no-ops on web. Configured at app boot via `<RevenueCatBoot />` component; user identified at sign-in via `identifyRevenueCatUser` in `AuthContext.applySession`. |
| `@capacitor/status-bar` | `<StatusBarController />` component uses `useLocation` to flip Style.Light/Dark per route. Dark-bg routes (Welcome, SignIn, Onboarding, SubscribeNow, etc.) get Light style (white text); everything else gets Dark (black text). **Critical fix:** `UIViewControllerBasedStatusBarAppearance` had to be flipped from `true` to `false` in Info.plist — otherwise iOS only honored the view controller's style and silently ignored some plugin calls. |
| `@capacitor/keyboard` | `<KeyboardConfigurer />` sets `Keyboard.setResizeMode({ mode: KeyboardResize.Native })` so iOS adjusts the WebView frame when keyboard appears, plus hides the accessory bar. |
| `@capacitor/network` | `<OfflineBanner />` renders a thin "You're offline" banner at top when `networkStatusChange` fires `connected: false`. Works on web too (uses `navigator.onLine` + window events). |

#### Edge functions deployed (this phase)

| Function | Purpose | Key behavior |
|---|---|---|
| **`sendPushNotification`** (~200 lines) | Sends APNs push to a user's iOS devices | Service-role auth (string compare against `SUPABASE_SERVICE_ROLE_KEY` — must not be reachable from frontend). Looks up `device_token` rows for the target user. Builds APNs JWT (ES256 over `.p8` PKCS#8 key using Web Crypto), cached ~50min across calls within the same worker. POSTs to `api.push.apple.com/3/device/{token}` (or sandbox). On `410 Gone` → deletes the stale token row. Returns `{sent, failed, deleted}`. |
| **`deleteAccount`** (existed; deployed + fixed) | Apple 5.1.1(v) compliance — in-app account deletion | Was sitting unported. Deployed with one fix: added `device_token` to the `USER_TABLES` cleanup list so the new push-notification table is wiped too. Cancels Stripe sub if present (best-effort), deletes from 18 user-owned tables + referrals (both directions), deletes `user_profile`, then `auth.admin.deleteUser`. Verified end-to-end. |
| **`createStripeCheckoutSession`** (deployed) | Was code-complete from Phase 2 but never deployed | Now reachable. Updated in Phase 2-mid to support optional `success_url` + `cancel_url` overrides so native Capacitor can pass `caddieai://` schemes. |

#### Migrations applied

- `20260602000001_device_token.sql` — one row per (user, device). Columns: `id`, `user_email` (lowercased for RLS), `platform` (`ios`/`android` check constraint), `token` (UNIQUE), `created_at`, `updated_at`. Trigger `device_token_touch_updated_at` bumps `updated_at` on UPDATE. RLS for owners only; service-role bypasses for the backend sender.
- `20260602000002_notification_push_trigger.sql` — `pg_net` extension + `notify_user_push_on_notification_insert` function + AFTER INSERT trigger on `public.notification`. Checks recipient's `notification_preferences.push_enabled`, maps notification `type` to push title + `caddieai://` deep-link URL, fires `sendPushNotification` via `pg_net.http_post`. Failures swallowed with `RAISE WARNING` so a broken push pipeline can't block the underlying notification insert.

#### Vault secrets (Supabase-managed encrypted storage)

The trigger above reads two secrets via `vault.decrypted_secrets`. Set via SQL editor (not `ALTER DATABASE`, which Supabase managed Postgres blocks):

```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url', '...');
SELECT vault.create_secret('<service_role_key>', 'service_role_key', '...');
```

Both must be present for the trigger to fire.

#### Frontend changes

| File | Change |
|---|---|
| `src/lib/platform.js` (new) | `isNative()`, `getPlatform()`, `openExternal()`, `NATIVE_URL_SCHEME='caddieai'`. The contract for "where do we open external URLs" lives here. |
| `src/lib/revenuecat.js` (new) | RC SDK wrapper (see plugins table). |
| `src/lib/push-notifications.js` (new) | Push wrapper (see plugins table). |
| `src/App.jsx` | New components: `<RevenueCatBoot />`, `<KeyboardConfigurer />`, `<StatusBarController />`, `<DeepLinkRouter />`, `<PushTapRouter />`, `<OfflineBanner />`. Mounted inside `<Router>` so `useLocation` / `useNavigate` work. DeepLinkRouter parses `caddieai://` URLs manually (the URL constructor splits custom schemes inconsistently), runs PKCE or implicit auth exchange if relevant, strips auth params, navigates the SPA. |
| `src/lib/AuthContext.jsx` | `applySession` now also calls `identifyRevenueCatUser(u.id)` on native after `alignRevenueCatAppUserId`. |
| `src/pages/SignIn.jsx` | `emailRedirectTo: caddieai://gateway` on native; Apple OAuth uses `skipBrowserRedirect: true` + `Browser.open()` so the auth page doesn't navigate the WebView itself. Headline copy: "Welcome back" → "Welcome to Caddie AI"; subtitle now inclusive of first-time visitors. |
| `src/pages/SubscribeNow.jsx` | `handleIOSPurchase` replaced legacy `window.ReactNativeWebView` / `window.webkit.messageHandlers.caddie` bridge attempts with real `Purchases.purchasePackage`. Falls back to Stripe-via-Browser-plugin when `getOfferings()` returns null (no RC API key yet). `handleIOSRestore` calls real `Purchases.restorePurchases`. |
| `src/pages/SubscriptionCheckout.jsx` | Mirrors SubscribeNow's startCheckout logic — passes `caddieai://` success/cancel URLs on native, opens via Browser plugin. |
| `src/pages/EditProfile.jsx` | Refactored photo upload into shared `uploadPhotoBlob` helper. New `onCameraButtonClick` branches: native → `Camera.getPhoto({ source: Prompt })` → fetch webPath as Blob → upload. Web → file input click (unchanged). |
| `src/pages/NotificationPreferences.jsx` | New push toggle (native only, hidden on web). State machine: `unsupported` / `loading` / `enabled` / `disabled` / `denied`. Disable just flips `notification_preferences.push_enabled` without deleting the device_token row (so re-enabling doesn't re-prompt iOS). |
| `src/pages/AccountScreen.jsx`, `src/pages/ManageSubscription.jsx` | Removed UA-sniffed `isIOS` branch that pointed users to `itms-apps://` for Stripe-backed subs (dead-end). Always shows in-app Cancel button. Source-aware branching deferred to RevenueCat-IAP phase. |
| `src/components/badges/ProBadge.jsx` (new) | Small sage chip showing "PRO" — wired into 4 Pro feature cards. |
| `src/components/trial/TrialEndingBanner.jsx` (new) | Day-6 banner on `/home` when `getTrialDaysRemaining(profile) === 1`. |
| `src/components/trial/TrialExpiredModal.jsx` (new) | Full-screen modal when `isTrialExpired(profile)`. Race-condition fallback. |
| `src/components/trial/SubscriptionBanner.jsx` (restored from stub) | Persistent banner when `subscription_status === 'expired'`. Links to `/subscribe-now` only (avoids the 3.1.3(f) anti-steering the previous version had). |
| `src/lib/subscription.js` | `hasProAccess` now returns true for `'pro'` AND non-expired `'trial'`. Was Pro-only. |
| `src/components/pro/MonthlyGamePlanCard.jsx`, `PreRoundGamePlan.jsx`, `WeeklyReports.jsx`, `CompetitorIntel.jsx` | Added `<ProBadge />` next to each card title. |

#### iOS shell + entitlements

- `ios/App/App/Info.plist`:
  - `CFBundleURLTypes` registered the `caddieai` scheme
  - `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` + `NSPhotoLibraryAddUsageDescription`
  - `UIViewControllerBasedStatusBarAppearance` flipped from `true` to `false` so the Status Bar plugin works
- Xcode capabilities — Push Notifications + Background Modes → Remote notifications + Sign in with Apple — **pending** until silexdev is added to the Apple Developer Program team (currently blocked on Parker's Individual enrollment, see _Client coordination_ below)

#### Dev tooling additions

- `gen-magic-link.mjs` — service-role script that calls `supabase.auth.admin.generateLink({ type: 'magiclink', email, redirectTo: 'caddieai://gateway' })` to produce a magic link URL without going through SMTP. Used during the period when Resend wasn't set up yet and Supabase's built-in sender was rate-limited.
- `audit-supabase.mjs` — anon-key table-existence check via PostgREST. Used to confirm migrations applied.

#### Client coordination

The day's work hit two blockers that required emailing Parker (client):

1. **Bundle ID, IAP products, RevenueCat connection, Resend SMTP, DNS access, Anthropic key** — initial omnibus email. Parker responded: new App Store Connect record at `com.caddieaiapp.app` created, silexdev added as admin; Resend account fully set up with verified `caddieaiapp.com` domain (`re_Ubn9njY5...` API key); IONOS DNS willing to add records or grant user access.

2. **Apple Developer Program access** — silexdev added as App Store Connect Admin but does not appear on developer.apple.com (the team where signing certificates, push notification keys, Sign in with Apple keys, and provisioning profiles live). App Store Connect and Apple Developer Program are separate permission systems even though it's the same team. **Root cause confirmed:** Parker's enrollment is **Individual**, not Organization — Individual enrollments support exactly one person (the enrollee) on the Apple Developer Program team. No way to add silexdev. Two-track resolution emailed to Parker:
   - **Long-term:** convert Individual → Organization (requires D-U-N-S number for business, ~5-7 days to apply at dnb.com; Apple processing 1-2 weeks once paperwork is in)
   - **In the meantime:** Parker generates the assets we need (APNs key, Sign in with Apple Service ID + key, eventually Distribution Certificate + Provisioning Profile) and sends them; silexdev uses Manual signing in Xcode to build + sign locally. See `SUBMISSION_CHECKLIST.md` § _Manual signing workaround_.

#### Resend SMTP wired (Path A)

End of day: Supabase Auth → SMTP Settings configured against Resend with the verified `caddieaiapp.com` domain. Magic links now deliver to any address, not just the Resend-account-owner's. The Path B workaround (using `onboarding@resend.dev` sender, only delivers to admin@silexdev.com) was used during the bring-up; swapped out once Parker provided the API key.

| Setting | Value |
|---|---|
| Sender email | `noreply@caddieaiapp.com` |
| Sender name | `Caddie AI` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Parker's API key (rotated before cutover; see `CUTOVER.md`) |

Bug encountered + fixed during setup: initial config returned `535 Invalid username` — the Username field was the wrong value. Resend SMTP wants the literal string `resend` (lowercase), not the account email.

#### Verifications

- **App boots** in iPhone 17 simulator across multiple rebuilds (initial 4:18 cold build, ~5-30s incremental thereafter)
- **Native auth end-to-end** verified once via the `gen-magic-link.mjs` shortcut (before Resend was wired) — generated link → pasted into Simulator Safari → followed redirect chain → `caddieai://gateway` → iOS opened the Caddie AI app → `DeepLinkRouter` ran the PKCE code exchange → landed signed in
- **simctl push** for `PushTapRouter` — `xcrun simctl push <device-id> com.caddieaiapp.app push-test.json` with a payload containing `data.url = caddieai://plan` → notification banner appeared → tap → app navigated to `/plan`. Proves the iOS receive side end-to-end without needing real APNs.
- **Status bar style** verified visible on `/home` (black text on cream) after the `UIViewControllerBasedStatusBarAppearance` flip
- **Camera plugin** — confirmed working by the user (action sheet shows correctly, photo selection lands in Supabase Storage)
- **Cancel Subscription** UI flow + dialog confirmed working
- **deleteAccount end-to-end** verified on web (using a throwaway `tony_tamer@hotmail.com` account, signed in with Supabase's built-in SMTP temporarily) — five-table verification query returned all zeros after delete

#### What's still pending after this phase

All blocked on either client deliverables, post-cutover items, or polish:

- **Apple Developer Program access for silexdev** — gated on Parker either converting to Organization (~2-3 weeks) or generating Manual signing assets (`.p12` + `.mobileprovision`). Until either happens, can't build signed App Store builds.
- **APNs `.p8` key** — Parker generates via developer.apple.com. Once received: `npx supabase secrets set APNS_AUTH_KEY=... APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=com.caddieaiapp.app APNS_USE_SANDBOX=true`. Push delivery activates immediately.
- **Sign in with Apple Service ID + Key** — Parker generates. Apple OAuth provider config in Supabase Auth → Providers → Apple. "Continue with Apple" works.
- **RevenueCat iOS public API key** — Parker syncs IAP products in RC dashboard, sends `appl_...` key. Set `VITE_REVENUECAT_IOS_KEY` in `.env.local`, rebuild. SubscribeNow flow switches from Stripe-via-Browser-plugin fallback to real Apple IAP.
- **IONOS DNS access** — Parker either adds Tony as IONOS user (preferred) or adds records on request. Needed for Vercel deploy + Universal Links setup later.
- **Vercel account** — Parker creates Pro account ($20/mo, commercial use requires it), invites silexdev as Team member. Needed for production frontend deploy.
- **Designer assets** — app icon (1024×1024) + splash screen (2732×2732) source images. Once received, `@capacitor/assets` generates all variants.
- **App Store metadata** — most can be pulled from the previous Base44 submission (still in the rejected App Store Connect record).
- **Source-aware Cancel UX** — when `subscription_source === 'app_store'` (Apple IAP via RC), Cancel must link to iOS Settings (Apple 5.1.1). Currently always in-app. Code change is small; depends on RC populating the source field, which depends on RC dashboard being live.
- **Universal Links** — replaces custom scheme for production. Needs DNS + Associated Domains entitlement. Code-prep deferred.
- **Trial UX visual verification** — banners coded and wired; not yet eyeballed in each state. SQL state-flipping queries in `SUBMISSION_CHECKLIST.md`.

See `SUBMISSION_CHECKLIST.md` for the comprehensive list with checkboxes.

### Pending / housekeeping

- **Service-role JWT rotation** — was shared in the testing session to drive admin-API operations. Rotate via Supabase dashboard → Project Settings → API → Reset on `service_role` when testing completes.
- **Resend API key rotation** — Parker's `re_Ubn9njY5...` key was shared by email and lives in Supabase SMTP config. Worth rotating before cutover (line item in `CUTOVER.md`).
- **Capacitor Android workstream** — see scope. Phase 4. Once iOS is submitted, add Android platform: `npx cap add android`, register `caddieai://` scheme in `AndroidManifest.xml`, wire FCM for push delivery (Android side of the same trigger), submit to Play Store.

### Phase 4 — iOS App Store launch (2026-06-22)

iOS app is **live on the App Store** as of 2026-06-22. Current version 1.1.1.

- **App Store ID:** `6776209508`
- **Public URL:** https://apps.apple.com/app/id6776209508
- **Listing name:** "Caddie AI: Golf Coach"
- **Distribution path:** the Manual signing workaround (Parker's Distribution
  Cert + Provisioning Profile, imported locally) carried the build through
  TestFlight → App Review → release. Apple Developer Program Organization
  conversion was not required for launch.

Most of the pending items from §549–559 above were resolved between 2026-06-03
and the 2026-06-22 release (APNs key, Apple Service ID, RC iOS key, designer
assets, App Store metadata, etc.). `SUBMISSION_CHECKLIST.md` has a status
banner at the top reflecting this.

### Phase 4 follow-ups (2026-06-29)

- **App Store badge on the marketing site** — added to `HeroSection` and
  reworked `InstallAppSection` so the "Download on the App Store" badge is
  the primary install CTA on https://caddieaiapp.com. PWA install kept as
  the secondary path (still relevant for Android until Play Store launches).
  `APP_STORE_URL` constant in `src/lib/shareConfig.js` flipped from the
  placeholder to the real App Store URL — also picked up by `shareCard.jsx`.
- **Android workstream kicked off** — Parker asked to create the Google Play
  Console (D-U-N-S in hand) and Firebase project under his identity, invite
  silexdev as admin/editor (same arrangement as iOS — see
  `project-android-accounts-parker-owned` memory note).

### July 2026 scope sprint (2026-07-14 to 2026-07-22)

Full context: Parker approved the July Scope & Quote (see
`project-scope-approval-2026-07` memory note). Highlights of the interim
releases before this entry: **1.1.4 (41)** metadata release (subtitle, 3g
keyword string, Parker's screenshots) submitted 2026-07-17; **1.1.5 (43)**
plan-generator fix (session-type preferences fed to the LLM as hard
constraints); Play rejection root-caused (reviewer used their own Gmail
instead of the provided `caddieai.review@gmail.com` review account) and
resubmitted with sharpened App-access wording. **Phase 0 ("The Cut" design
overhaul) merged to main and live** as of 2026-07-19/20, with **1.2.1 (45)**
uploaded as the release candidate.

This week's landings (2026-07-20 → 07-22):

- **Item 3c campaign relay verified in prod** — ads land on
  `/welcome?c=<tag>`; `src/lib/campaign.js` persists the tag and appends
  Apple's `ct=` to every App Store link; `AppStoreClick` Pixel event fires
  with `{campaign, placement}`. Wrote Parker the web-campaign vs. Meta-SDK
  App-Promotion explainer (SDK path = separate quote; SKAdNetwork data is
  delayed/aggregated).
- **New OFFICIAL app icon** (Parker's halftone golf-ball sphere) generated
  from `~/Downloads/CaddieAI/V2/Phase 0 screenshots/OFFICIAL.png` across all
  surfaces: iOS asset catalog, all 24 Android mipmaps (masks mirrored from
  originals), web favicons/PWA icons, `assets/` generator sources. Play
  listing 512px copy on Desktop. Commit `33081ef`.
- **Freemium paywall design preview** — `/subscribe-now?preview=freemium`
  renders the Free/Pro-monthly/Pro-annual layout, inert for real users.
  Closes Phase 0's "design paywall once against freemium tiers" commitment.
- **iOS 1.2.1 (46) uploaded** 2026-07-21 — carries new icon + paywall
  preview; ipa verified (version/build/icon pixel-checked). Item 3a review
  prompt deliberately **excluded** from this build (stashed, then restored)
  so it could be device-tested first. ASC submission pairs build 46 with
  Parker's six 1284×2778 screenshots.
- **Item 3a in-app review prompt built and device-verified** —
  `src/lib/appReview.js` (`maybeRequestReview()`: native only, ≤3/365d,
  ≥30d spacing) fired at success moments: `SessionCelebration` back-tap and
  `CelebrationPopup` dismiss. Old `ReviewPopup` demoted to web-only in
  `SmartPopupController`. Verified on-device via Xcode dev build (sheet
  appears post-celebration; Submit greyed = expected in dev; **TestFlight
  always suppresses the sheet by design**). NOT yet committed — rides a
  future build. Xcode signing unblocked: Parker's account is now an
  Organization (Caddie AI LLC) and invited silexdev's Apple ID as Developer;
  `DEVELOPMENT_TEAM` added to the **Debug** config only (Release manual
  signing untouched — Xcode had clobbered it; reverted).
- **Welcome swap shipped on Parker's go** — `/welcome` now serves the Cut
  redesign (`WelcomeV2`), `/welcome-preview` 301s to it. Campaign relay
  re-verified post-swap. Play badge intentionally inert until Play approval.
  Commit `2d6871e`.
- **Item 3e audit (read-only) complete** — Parker's "duplicate products" in
  RevenueCat decoded: same plan sold per store (iOS/Web/Android), several
  rows had blank display names. Webhook `PLAN_FROM_PRODUCT` verified to
  cover all 8 store identifiers + all 8 RC internal IDs — no mapping
  changes needed. Display names renamed per-channel in the RC dashboard by
  Tony 2026-07-22 (identifiers untouched; legacy + Test Store rows left
  alone). **The 25 lifetime beta accounts are NOT identifiable in the DB**
  (no marker; pre-launch cohort all has Stripe/trial trails) — Parker asked
  for his list; `account_flag` migration + metric exclusions built once it
  arrives. Flagged to Parker that his beta users may have lapsed to
  `expired`.
- **Pricing pivot pending** — Parker floated holding freemium and doing
  weekly/monthly/yearly SKUs instead; awaiting his one-plan-or-two answer
  before quoting.
