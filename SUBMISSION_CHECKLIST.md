# iOS App Store submission checklist

Single source-of-truth for taking Caddie AI from "running in Simulator" to
"approved on the App Store." Pairs with `CUTOVER.md` (which covers the
dev-Supabase → client-Supabase migration that happens at production launch).

This doc covers everything from blocking prereqs through Apple review to
post-approval release. Tick items as they land; don't skip the smoke test
section before submitting.

Bundle ID: **`com.caddieaiapp.app`**
Target Apple Developer Team: **Parker James Sundell** (currently Individual
enrollment — see _Manual signing workaround_ below)

---

## 0. Pre-submission blockers

Everything in this section must be done before we can even upload a build
to TestFlight. Items are grouped by owner.

### Client-owned (Parker)

- [ ] **App Store Connect record** at bundle ID `com.caddieaiapp.app`
      (separate from the older rejected `com.base69e5121277e4e0398b59c054.app`
      record — that one should be archived after we ship)
- [ ] **silexdev added as App Manager (or Admin)** on the new App Store
      Connect record
- [ ] **In-App Purchase products** configured in App Store Connect:
      - Caddie AI Basic — auto-renewable monthly, ~$14.99
      - Caddie AI Pro — auto-renewable monthly, ~$28.99
      - Both in a single Subscription Group
- [ ] **RevenueCat dashboard** connected to App Store Connect via API key;
      offering "default" created with both packages
- [ ] **iOS public API key** from RevenueCat (`appl_...`) → us
- [ ] **APNs Authentication Key** (`.p8` + Key ID + Team ID) generated in
      Apple Developer → Keys → us
- [ ] **Sign in with Apple Service ID + Key** (`.p8` + Services ID + Key ID)
      generated in Apple Developer → us
- [ ] **Apple Distribution Certificate + App Store Provisioning Profile** for
      `com.caddieaiapp.app` (closer to build time; see _Manual signing
      workaround_) → exported as `.p12` + `.mobileprovision` → us
- [ ] **Apple Developer Program conversion** from Individual → Organization
      started (D-U-N-S number + Apple paperwork; ~2-3 week processing)

### Us-owned (silexdev)

- [x] All core features ported from Base44 to Supabase
- [x] Capacitor iOS shell scaffolded
- [x] `caddieai://` custom URL scheme registered
- [x] Native plugins wired: Browser, App, Camera, Push Notifications,
      RevenueCat, Status Bar, Keyboard, Network
- [x] Native auth (custom-scheme magic link callback + Apple OAuth via
      Browser plugin)
- [x] Camera plugin in profile photo upload flow
- [x] RevenueCat IAP code wired (inert without `VITE_REVENUECAT_IOS_KEY`)
- [x] Push notification stack: client wrapper + tap router + device_token
      schema + sendPushNotification edge fn + notification trigger
- [x] Trial-experience UX: Day-6 banner, Day-7 modal, post-trial banner,
      PRO badges, trial-users-get-full-Pro-access
- [x] Cancel Subscription UX (in-app)
- [x] Status bar / keyboard / offline polish bundle
- [x] `deleteAccount` edge function deployed (Apple 5.1.1(v) requirement)
- [x] `sendPushNotification` edge function deployed
- [x] `createStripeCheckoutSession` edge function deployed
- [x] `device_token` migration + push trigger migration applied to Supabase
- [x] Vault secrets seeded (`supabase_url`, `service_role_key`) for trigger
- [x] Resend SMTP wired to Supabase (Path A — verified `caddieaiapp.com` domain)
- [ ] **Cancel Subscription source-aware branching** — currently always shows
      in-app cancel. Need: branch on `subscription_source` field — if
      Apple IAP (`app_store`), show "Manage in iOS Settings" link
      (Apple 5.1.1 requirement). If Stripe, in-app cancel as-is. Blocked on:
      RevenueCat setting that field once IAP is live.
- [ ] **`VITE_REVENUECAT_IOS_KEY`** in `.env.local` — once Parker sends the
      `appl_...` key, paste in and rebuild. SubscribeNow flow will then
      route through Apple IAP instead of Stripe.
- [ ] **APNs secrets** on Supabase — once Parker sends the `.p8` key:

      ```bash
      npx supabase secrets set APNS_AUTH_KEY="$(cat AuthKey_XXXXXX.p8)"
      npx supabase secrets set APNS_KEY_ID=XXXXXXXXXX
      npx supabase secrets set APNS_TEAM_ID=YYYYYYYYYY
      npx supabase secrets set APNS_BUNDLE_ID=com.caddieaiapp.app
      npx supabase secrets set APNS_USE_SANDBOX=true   # for TestFlight
      ```
- [ ] **Apple OAuth provider** configured in Supabase Auth → Providers → Apple
      (needs the Service ID + key from Parker)
- [ ] **Xcode → Signing & Capabilities** — once we have Apple Developer
      Program team access (post-conversion or via manual signing):
      - +Capability → Push Notifications
      - +Capability → Background Modes → Remote notifications
      - +Capability → Sign in with Apple
      - Set team to "Parker James Sundell" or successor Organization

### External / assets

- [ ] **Privacy Policy** live at `https://caddieaiapp.com/privacy` (verify
      content disclosed matches what we actually collect: email, name,
      handicap stats, practice history, profile photos; storage = Supabase;
      third parties = Anthropic, RevenueCat, Stripe; right-to-delete via
      in-app Delete Account)
- [ ] **EULA / Terms of Use** live at `https://caddieaiapp.com/terms`
- [ ] **App icon source image** (1024×1024 PNG, no transparency) → designer
- [ ] **Splash screen source image** (2732×2732 PNG, brand background) → designer
- [ ] **App icons + splash variants generated** via `@capacitor/assets` once
      sources arrive (auto-fills `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
      and the LaunchStoryboard image set)
- [ ] **App Store screenshots** — 6× iPhone 6.7" (1290×2796 PNG) minimum;
      can be live captures from the running app once UI is final, or
      designed mockups
- [ ] **App description** (up to 4,000 chars) — can adapt from previous
      Base44 submission if available
- [ ] **Promotional text** (170 chars) — can adapt
- [ ] **Keywords** (100 chars total, comma-separated) — can adapt

---

## 1. Manual signing workaround

Until the Apple Developer Program converts to Organization (~2-3 weeks),
silexdev cannot get added to the developer.apple.com team. We use **Manual
signing** — Parker generates the signing assets and exports them to us.

### One-time setup

1. **Parker generates** (in developer.apple.com):
   - Apple Distribution Certificate
   - App Store Provisioning Profile for `com.caddieaiapp.app`

2. **Parker exports**:
   - Distribution Cert → Keychain Access → right-click → Export → `.p12`
     with a password set on export
   - Provisioning Profile → download from developer.apple.com as
     `.mobileprovision`

3. **Parker sends** both files (and the `.p12` password) over a secure channel

4. **We import locally**:
   - Double-click the `.p12` → enter password → cert lands in Keychain
   - Double-click the `.mobileprovision` → profile registered for Xcode

5. **In Xcode** (project → App target → Signing & Capabilities):
   - **Uncheck** "Automatically manage signing"
   - **Provisioning Profile** dropdown → select Parker's profile
   - **Signing Certificate** dropdown → select the imported Distribution cert

After this, we can build, archive, and upload App Store builds locally
without being on the Apple Developer Program team.

### Annual rotation

Both the Distribution Certificate and Provisioning Profile expire in 1 year.
Plan ~2 months before expiry: Parker regenerates both, re-exports, sends
fresh files. After Organization conversion completes this becomes a non-issue
(we manage rotation ourselves).

---

## 2. Version bumping

Before every TestFlight upload, bump both:

- **MARKETING_VERSION** (CFBundleShortVersionString) — user-facing semver
  like `1.0.0`. Bump per release.
- **CURRENT_PROJECT_VERSION** (CFBundleVersion) — internal monotonic build
  number like `1`, `2`, `3`. Bump for every TestFlight upload, even
  patch-level rebuilds.

Set in Xcode → App target → General, or via `agvtool`:

```bash
cd ios/App
agvtool new-marketing-version 1.0.0
agvtool new-version -all 1
```

Apple rejects re-uploads with the same build number.

---

## 3. Archive + upload

```bash
cd /Users/tonyt/Projects/caddie-ai-golf-coach
npm run build
npx cap sync ios
npx cap open ios
```

Then in Xcode:

1. Select **Any iOS Device (arm64)** in the device dropdown (not a Simulator)
2. **Product → Archive**
3. Wait ~5-10 min for the archive to finish
4. **Distribute App** → **App Store Connect** → **Upload**
5. Wait ~10-30 min for App Store Connect to process the upload

After processing, the build appears under TestFlight in App Store Connect.

---

## 4. App Store Connect metadata

Most of these fields are filled per release; some only once.

### App Information (once, then edits for major versions)

- [ ] **Name** (30 chars max) — "Caddie AI" or "Caddie AI: Golf Coach"
- [ ] **Subtitle** (30 chars max)
- [ ] **Primary Category** — Sports? Health & Fitness?
- [ ] **Secondary Category** — optional
- [ ] **Content Rights Information** — Caddie AI doesn't use third-party
      content, just declare it

### Pricing & Availability

- [ ] **Free** (subscriptions are the monetization, not the app price)
- [ ] **Availability** — all territories where iOS App Store operates,
      unless client wants regional restrictions

### App Privacy

- [ ] **Privacy Policy URL** — `https://caddieaiapp.com/privacy`
- [ ] **Privacy nutrition labels** — declare collected data, the most
      load-bearing answer here is the App Store's question "Data Used to
      Track You" vs "Data Linked to You" vs "Data Not Linked to You."
      Caddie AI's data is **Linked to You** (we use email as the join key
      across all stored data) but **does not track across other apps/sites**.
      Categories to declare:
      - Contact Info → Email Address (linked, for account)
      - Identifiers → User ID (linked, account creation)
      - Usage Data → Product Interaction (linked, analytics)
      - User Content → Photos or Videos (linked, profile photo only —
        optional and uploaded only if user taps the camera)
      - Health & Fitness → no — we're golf practice, not health-grade

### Version-specific (for each TestFlight/App Store release)

- [ ] **Promotional Text** (170 chars max, editable post-release)
- [ ] **Description** (4,000 chars max) — what the app does
- [ ] **Keywords** (100 chars total, comma-separated, no spaces wasted)
- [ ] **Support URL** — `https://caddieaiapp.com/support` (or contact form)
- [ ] **Marketing URL** — `https://caddieaiapp.com`
- [ ] **Build** — select the uploaded TestFlight build for this version
- [ ] **App Review Information**:
      - Sign-in info for review — provide demo credentials so Apple can
        access gated content (subscription-gated practice plans, AI coach).
        Either real credentials for a test account or a Promo Code system
        if RC supports it.
      - Notes — explain anything non-obvious to a first-time reviewer.
        E.g., "Sign-in is via magic link — please tap 'Email me a magic
        link' and check the inbox we've shared in the demo credentials."
- [ ] **Version Release** — pick "Manually release this version" for the
      first submission so we can coordinate launch timing with the
      cutover. Auto-release is fine for later patch versions.

### Screenshots (6.7" required, others recommended)

- [ ] **iPhone 6.7"** (1290×2796 PNG) — required, minimum 1, recommend 6
- [ ] iPhone 6.5" (1242×2688) — recommended, falls back from 6.7" if absent
- [ ] iPad 12.9" (2048×2732) — only if supporting iPad (we orient for iPad
      but render as scaled-up iPhone; can submit "iPhone-only" for v1)

---

## 5. Pre-submission TestFlight smoke test

Apple tests via TestFlight. These flows all need to work end-to-end on a
real device (not just Simulator) before we submit.

Use TestFlight's internal testers to get the build onto a real device for
this stage.

### Auth

- [ ] **Magic link sign-up** — new email → link arrives via Resend → tap
      link → app opens → lands on `/gateway` → routes to `/onboarding`
- [ ] **Magic link sign-in** — existing user → link arrives → tap → app
      opens to `/home`
- [ ] **Sign in with Apple** — works without 400 error (gated on Apple
      OAuth provider config in Supabase)
- [ ] **Sign out** — clears session, lands on `/signin`

### Onboarding

- [ ] All 6 onboarding steps complete without errors
- [ ] `generateInitialPlan` edge function returns a practice plan
- [ ] User reaches `/home` after final step
- [ ] Trial state is set (`subscription_status='trial'`, `trial_end_date`
      = today + 7)

### Subscribe / IAP

- [ ] **`/subscribe-now` shows the iOS layout** (not the web fallback)
- [ ] **Basic + Pro buttons** invoke Apple IAP via RevenueCat
- [ ] **Apple's IAP sheet appears** with the correct prices
- [ ] **Completed purchase** lands user on `/home` with active sub
- [ ] **subscription_status** updates correctly in user_profile after RC
      webhook fires
- [ ] **Restore Purchases button** correctly restores from Apple ID
- [ ] **iOS Settings → Subscriptions** shows the sub correctly

### Cancel + Delete

- [ ] **Cancel Subscription** routes to **iOS Settings → Subscriptions**
      for Apple IAP subs (5.1.1 requirement)
- [ ] **Delete Account** invokes `deleteAccount` edge fn, cancels Stripe
      sub if any, wipes user data across all tables, signs user out

### Core flows

- [ ] **Coach** — chat sends message → Anthropic LLM response → renders
- [ ] **Profile photo upload** — Camera plugin action sheet → take or
      choose photo → uploads to Supabase Storage → avatar updates
- [ ] **Edit Profile** — all fields save correctly
- [ ] **Log session** — completes today's practice, increments streak
- [ ] **Log round** — round form opens from `/progress`, saves
- [ ] **Pull to refresh** — works on `/home`
- [ ] **Trial UX banners** — verify each renders correctly (use SQL to
      flip subscription_status / trial_end_date for one test user):
      - Day-6 banner appears when 1 day left
      - Day-7 modal appears when trial expired
      - Persistent expired banner appears when status='expired'

### Push notifications

- [ ] **Permission prompt** appears on first toggle in /notifications
- [ ] **Permission grant** registers device — token row appears in
      `device_token` table
- [ ] **Inserting a row in `notification` table** triggers a push delivery
      to the device (test by manually inserting via SQL)
- [ ] **Push tap** opens the app and routes to the right screen via
      `PushTapRouter`

### Offline

- [ ] **Offline banner** appears when network drops (turn off WiFi on the
      test device, banner should slide in)
- [ ] **Offline banner** dismisses when network restored

---

## 6. Submit for review

After all smoke tests pass and metadata is complete:

1. App Store Connect → app → Version (the one with the new build attached)
2. Click **Submit for Review** at top right
3. Answer the export compliance questions:
   - **Uses encryption**: Yes (we use HTTPS, which counts)
   - **Exempt**: most likely yes — standard HTTPS over the network counts
     as exempt under ECCN 5D002. Read the latest Apple guidance before
     answering — gets stricter over time.
4. **Advertising Identifier (IDFA)**: No (we don't use IDFA)
5. Submit

Apple's queue then runs through:
- **Waiting for Review** → typically <24 hours
- **In Review** → 1-3 days typical for first submission; faster on resubmits
- **Approved** → release per the manual/auto-release setting
- **Rejected** → review notes in Resolution Center; address; resubmit

---

## 7. Common rejection reasons to preempt

Don't let these be surprises:

- **5.1.1(v) Account Deletion** — must work from inside the app. We have
  this (`deleteAccount` deployed). Make sure it's reachable from /account
  without too many taps.
- **5.1.1 Subscription Cancellation** — must be reachable. iOS Settings
  link for Apple IAP subs.
- **3.1.1 Payments for digital goods** — must use Apple IAP. Until
  RevenueCat is configured we fall back to Stripe via Browser plugin —
  REJECTION RISK if we ship before RC is wired.
- **2.1 App Completeness** — every feature mentioned in the description
  must work. Don't list features that aren't done.
- **4.0 Design** — look + feel polish. Hard to fail if we ship clean.
- **2.3.1 Accurate Metadata** — screenshots must show the actual current
  UI, not mockups of features that don't exist.
- **5.1.5 Location Services** — we don't request location currently, so
  skipped. If we ever do, must have NSLocationWhenInUseUsageDescription
  and a clear in-app prompt.

---

## 8. Post-approval — release coordination

For v1.0:

- [ ] **Manual release** selected (so we can sync with the cutover from
      dev Supabase to client Supabase — see `CUTOVER.md`)
- [ ] Cutover executed per `CUTOVER.md`
- [ ] **Release the build** in App Store Connect once cutover smoke tests
      pass
- [ ] Monitor App Store Connect → Reviews + crashes for the first 48 hours
- [ ] Have Sentry / equivalent crash reporting dashboard open
- [ ] Have Stripe + RevenueCat dashboards open for purchase monitoring

For v1.0.1+ (patches):

- [ ] **Auto-release on approval** fine (cutover is behind us)
- [ ] Version bumps per section 2

---

## 9. If rejected

Apple posts the rejection reason in App Store Connect → Resolution Center.

1. Read the rejection note carefully — often points to a specific
   guideline number (e.g., 5.1.1(v))
2. Fix the issue in code or metadata
3. Bump the build number (per section 2) and re-archive
4. Re-upload via Xcode
5. In Resolution Center: respond to Apple explaining the fix
6. Re-submit for review

Resubmits usually clear the queue faster than the first submission.

---

## Cross-references

- `CUTOVER.md` — dev → prod Supabase + Base44 → Supabase data migration
- `TESTING.md` §17 — chronological session log of what was built
- `src/APP_STORE_COMPLIANCE.md` — implementation-level notes on
  Apple-specific code paths (cancel, restore, delete, etc.)
- `CLAUDE.md` — project context entrypoint
