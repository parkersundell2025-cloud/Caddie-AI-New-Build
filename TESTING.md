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

### Pending / housekeeping

- **Service-role JWT rotation** — was shared in the testing session to drive admin-API operations. Rotate via Supabase dashboard → Project Settings → API → Reset on `service_role` when testing completes.
- **Trial-experience features** — see *Migration drift* section of `src/APP_STORE_COMPLIANCE.md`. Day-6 banner, day-7 modal, PRO badges, and trial-→-Pro access were removed during migration and need product-side review before App Store resubmission.
- **Capacitor iOS + Android wrappers** — separate workstream, starts 2026-06-01. Key integration point: call `Purchases.shared.logIn(supabaseUserId)` after Supabase auth completes in the native app so iOS purchases attribute to the right App User ID (parallels what `alignRevenueCatAppUserId` does for web). iOS product IDs `month1_caddie` (Basic) and `month1_caddiePro` (Pro) are already configured in RC and mapped to the `caddiePro` entitlement. The webhook's iOS path (`event.app_id === 'app63f79b5121'`) is already wired and ready for App Store purchase events.
