# Cutover checklist — Base44 dev → client Supabase production

Source-of-truth for the migration from this repo's dev Supabase project
(`dbvsnzppevytanoxzgwj.supabase.co`) and the existing Base44 production
deployment onto the client's Supabase organization.

## Cutover approach: TRANSFER the existing dev project (decided 2026-06-04)

Rather than creating an empty client project and migrating schema +
secrets + dashboard config to it, the plan is to **transfer ownership of
the existing dev project** (`dbvsnzppevytanoxzgwj`) from silexdev's
Supabase org to the client's Supabase org. This skips ~80% of the items
that would otherwise be on this page — every vault secret, edge function
secret, RLS policy, migration, auth provider config, URL configuration,
and webhook subscription stays exactly where it is. Project ref, anon
key, and service role key do not change.

What still has to happen at cutover regardless of approach:
- Base44 → Supabase user data migration
- Stripe TEST → LIVE mode (single secret swap + webhook re-pointing)
- DNS cutover from Base44 to Vercel for `caddieaiapp.com`
- Optional: wipe test data from public tables for a clean launch

After transfer, silexdev should spin up a fresh free-tier dev Supabase
project for ongoing development so changes aren't tested directly
against production.

Sections below preserve the original migrate-to-empty-project plan as a
fallback in case the transfer approach hits a snag (e.g., billing
issues, client doesn't want to take over the project ref). Most items
become no-ops under the transfer path; **read each item with that lens
before doing it.**

---

## 0. Pre-cutover prerequisites

Don't start the cutover until all of these are in place. Half of them are
client-owned; the other half are silexdev (us) -owned.

### Client-owned

- [ ] **Apple Developer Program** enrollment active ($99/yr)
- [ ] **App Store Connect** app record created at bundle ID
      `com.caddieaiapp.app` (or whatever final bundle ID; update this doc
      if it changes)
- [ ] **Apple IAP products** configured in App Store Connect:
      - Basic monthly @ $15
      - Pro monthly @ $29
      - Both in the same subscription group
- [ ] **RevenueCat dashboard** configured:
      - **Update bundle_id on the "Caddie AI : Golf Coach (App Store)"
        app from `com.base69e5121277e4e0398b59c054.app` (legacy Base44)
        to `com.caddieaiapp.app`.** Verified via MCP 2026-06-04 — the
        existing RC App Store app entry still points at the synthetic
        Base44 bundle ID and won't validate purchases from our app.
      - App connected to App Store Connect via API key (the current key
        may have been issued for the legacy Base44 app — re-issue a
        fresh ASC API key for the new app and re-upload to RC)
      - Offering `caddiePro` already exists with both packages
        (`month1_caddiePro` Pro, `$rc_monthly` → `month1_caddie` Basic);
        no offering changes needed
      - Webhook URL pointing somewhere temporary (we'll re-point at cutover)
      - Product → entitlement mappings (`month1_caddie` → basic,
        `month1_caddiePro` → pro) already match `revenueCatWebhook`'s
        PRODUCT_TO_PLAN constants — no code changes needed once bundle
        ID and ASC products land
- [ ] **Apple Developer → Keys → APNs Authentication Key (.p8)** generated,
      file downloaded, **Key ID + Team ID noted**
- [ ] **caddieaiapp.com domain** registered and DNS access available
      (Cloudflare / Route53 / etc.)
- [ ] **Privacy Policy + EULA** content live at `caddieaiapp.com/privacy`
      and `/terms` (Apple requires both)
- [ ] **Stripe** account configured with Basic + Pro prices, webhook URL
      pointing somewhere temporary
- [ ] **Resend** account ready (or chosen SMTP provider) with domain
      verified and an API key issued
- [ ] **Anthropic** API key issued and budget alerts configured
- [ ] **Client's empty Supabase project** created, silexdev added as
      admin collaborator

### silexdev-owned

- [ ] All committed code on `main` reflects the production target
      (no half-finished feature branches)
- [ ] `npx supabase db push` runs clean against the dev Supabase (smoke
      test that the migrations apply cleanly to a fresh DB)
- [ ] Edge functions deployed and smoke-tested on the dev Supabase
- [ ] Capacitor iOS build succeeds locally
- [ ] Capacitor iOS build signed with a real development team in Xcode
      (no Personal Team dev certs)
- [ ] Base44 prod data export tested end-to-end against a *scratch*
      Supabase first, so the import script is debugged before touching
      the client's production project
- [ ] Service-role key from the *dev* Supabase rotated if it was ever
      shared in chat (this was flagged earlier; check `TESTING.md` §17)

---

## 1. Freeze Base44

- [ ] Put Base44 in maintenance / read-only mode (or coordinate a window
      where nobody is writing new data — depends on what Base44 supports)
- [ ] Verify by checking the live Base44 deployment — no new
      `practice_plan` rows, no new `session_log` rows in the last 15 min

---

## 2. Push schema to the client's Supabase

```bash
cd /Users/tonyt/Projects/caddie-ai-golf-coach
npx supabase link --project-ref <CLIENT_PROJECT_REF>
npx supabase db push
```

`<CLIENT_PROJECT_REF>` is the part before `.supabase.co` in the client's
Supabase project URL.

Verify with the audit query (paste in client's Dashboard → SQL editor):

```sql
WITH checks AS (
  SELECT 'pg_net extension' AS what,
         (EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'))::text AS ok
  UNION ALL SELECT 'device_token table',
         (EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'device_token'))::text
  UNION ALL SELECT 'notification table',
         (EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'notification'))::text
  UNION ALL SELECT 'user_profile table',
         (EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'user_profile'))::text
  UNION ALL SELECT 'trigger function',
         (EXISTS (SELECT 1 FROM pg_proc
                  WHERE proname = 'notify_user_push_on_notification_insert'))::text
  UNION ALL SELECT 'trigger on notification',
         (EXISTS (SELECT 1 FROM pg_trigger t
                  JOIN pg_class c ON c.oid = t.tgrelid
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'notification'
                    AND t.tgname = 'trg_notification_push'))::text
)
SELECT what, CASE ok WHEN 'true' THEN '✅' ELSE '❌' END AS status FROM checks;
```

All six rows must be ✅ before continuing.

---

## 3. Create the `profile-photos` storage bucket

Storage buckets aren't part of migrations. Create it via SQL or via the
Dashboard → Storage UI:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT DO NOTHING;
```

The RLS policies for the bucket are in migration
`20260526000003_profile_photos_storage.sql` and applied via `db push`.

---

## 4. Seed Vault secrets (notification → push trigger)

In the client's Dashboard → SQL editor:

```sql
SELECT vault.create_secret(
  'https://<CLIENT_PROJECT_REF>.supabase.co',
  'supabase_url',
  'Used by the notification → push trigger'
);

SELECT vault.create_secret(
  '<paste client service_role key from Project Settings → API>',
  'service_role_key',
  'Used by the notification → push trigger to call sendPushNotification'
);

-- Verify both EXIST and have plausible lengths. Critical: check `len`, not
-- just existence — the placeholder text strings above are 32-64 chars, so
-- if the paste didn't take, the audit query below will still pass on
-- existence but the trigger will silently no-op or auth-fail. Expected:
--   supabase_url     → ~40 chars (full https URL)
--   service_role_key → ~219 chars (a full JWT, starts with 'eyJ')
SELECT name, length(decrypted_secret) AS len
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'service_role_key');
```

Both rows must exist with the expected lengths before push notifications will fire. If `service_role_key` is shorter than ~200 chars, the paste didn't take — re-run with `vault.update_secret(...)` instead of `create_secret`.

---

## 5. Configure Auth

### URL Configuration

Dashboard → Authentication → URL Configuration → **Redirect URLs**:

- [ ] Add `caddieai://*` (covers `caddieai://gateway`, `caddieai://checkout/success`, etc.)
- [ ] Add `https://caddieaiapp.com/**` (covers all web callbacks)
- [ ] Update **Site URL** to `https://caddieaiapp.com`

### Apple OAuth provider

Dashboard → Authentication → Providers → **Apple**:

- [ ] Enable provider
- [ ] Paste **Services ID** (from Apple Developer → Identifiers)
- [ ] Paste **Team ID**
- [ ] Paste **Key ID** (from Apple Developer → Keys → Sign in with Apple key)
- [ ] Paste **Private Key** (.p8 contents)

(This is separate from the APNs key — Apple OAuth uses a different signing key.)

**Also update Apple Developer → Service ID → Return URLs.** The Service ID
created during initial setup pointed at the dev Supabase callback URL.
At cutover, edit the Service ID and add the client's production Supabase
callback URL alongside the dev one. **Keep both during the cutover window**
so dev still works during testing; remove the dev URL after production is
verified.

- [ ] Apple Developer → Identifiers → Services IDs → Caddie AI Sign In →
      Configure → Return URLs
- [ ] Edit value to:
      `https://dbvsnzppevytanoxzgwj.supabase.co/auth/v1/callback,https://<CLIENT_PROJECT_REF>.supabase.co/auth/v1/callback`
- [ ] After production is verified, remove the dev URL

### Google OAuth provider

Dashboard → Authentication → Providers → **Google**:

- [ ] Enable provider
- [ ] Paste **Client ID** (from Google Cloud Console → APIs & Services →
      Credentials → OAuth 2.0 Client ID — **needs to be a NEW one for the
      client's production project**, since the existing dev one is tied
      to the dev Supabase project URL)
- [ ] Paste **Client Secret**

To create the new client:

- Google Cloud Console → APIs & Services → Credentials → "+ Create
  Credentials" → OAuth client ID → **Web application**
- Authorized redirect URI: `https://<CLIENT_PROJECT_REF>.supabase.co/auth/v1/callback`
- Copy the Client ID + Secret into Supabase

### SMTP (Resend)

Dashboard → Authentication → SMTP Settings → **Enable Custom SMTP**:

- [ ] Host: `smtp.resend.com`
- [ ] Port: `465`
- [ ] Username: `resend`
- [ ] Password: Resend API key
- [ ] Sender Email: `noreply@caddieaiapp.com` (or whatever verified sender)
- [ ] Sender Name: `Caddie AI`

Test by signing in once — magic link should arrive within seconds.

---

## 6. Deploy edge functions

```bash
# Still linked to the client project from Step 2
npx supabase functions deploy applyClubDistanceDefaults
npx supabase functions deploy applyWaitlistCredit
npx supabase functions deploy calculateHandicap
npx supabase functions deploy cancelSubscription
npx supabase functions deploy checkBadges
npx supabase functions deploy cleanupExpiredPendingUsers
npx supabase functions deploy createManualUserProfile
npx supabase functions deploy createStripeCheckoutSession
npx supabase functions deploy deleteAccount
npx supabase functions deploy findProfileByStripeCustomer
npx supabase functions deploy fixUserProfile
npx supabase functions deploy generateInitialPlan
npx supabase functions deploy generateMonthlyGamePlan
npx supabase functions deploy generatePreRoundGamePlan
npx supabase functions deploy generateWeeklyReport
npx supabase functions deploy getCompetitorIntel
npx supabase functions deploy getLeaderboard
npx supabase functions deploy getPlayerProfile
npx supabase functions deploy getReferralStats
npx supabase functions deploy getUsageReport
npx supabase functions deploy logRound
npx supabase functions deploy logSession
npx supabase functions deploy markExistingUsersTourComplete
npx supabase functions deploy proWeeklyCoachMessage
npx supabase functions deploy processMonthlyWinner
npx supabase functions deploy revenueCatWebhook
npx supabase functions deploy sendPushNotification
npx supabase functions deploy submitFeedback
npx supabase functions deploy updateHandicap
npx supabase functions deploy updateLeaderboard
```

> Confirm the actual function list at cutover time — run
> `ls supabase/functions/` to catch any added since this doc was written.

Verify each deployed by checking the Dashboard → Edge Functions list.

---

## 7. Set edge function secrets

```bash
# Stripe (live mode keys)
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
npx supabase secrets set STRIPE_BASIC_PRICE_ID=price_...
npx supabase secrets set STRIPE_PRO_PRICE_ID=price_...

# RevenueCat
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=...

# Anthropic
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# APNs (from the .p8 key in Step 0)
npx supabase secrets set APNS_AUTH_KEY="$(cat ~/Downloads/AuthKey_XXXXXXXXXX.p8)"
npx supabase secrets set APNS_KEY_ID=XXXXXXXXXX
npx supabase secrets set APNS_TEAM_ID=YYYYYYYYYY
npx supabase secrets set APNS_BUNDLE_ID=com.caddieaiapp.app
npx supabase secrets set APNS_USE_SANDBOX=false   # PROD — TestFlight uses sandbox

# Resend (if used by any function directly — Supabase auth SMTP is separate)
npx supabase secrets set RESEND_API_KEY=...
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are
> auto-injected by Supabase — never set them as secrets.

Verify with: `npx supabase secrets list`

---

## 8. Migrate data from Base44

The risky step. Do not run this against the client project until the import
script has been tested end-to-end against a scratch Supabase first.

Per the [project-base44-prod-data-migration](.claude/projects/-Users-tonyt-Projects-caddie-ai-golf-coach/memory/project-base44-prod-data-migration.md)
memory note, three things to watch:

### 8a. Email lowercasing (critical)

Supabase auth lowercases emails. Any Base44 row with a mixed-case email needs
to be `.toLowerCase().trim()` on import or the user will be orphaned from
their own profile via RLS. See migration `20260530120000_user_profile_lowercase_rls.sql`
for the policy that enforces this.

### 8b. Payment linkage preservation

`user_profile.stripe_customer_id` and `user_profile.revenuecat_app_user_id`
are the join keys for the payment webhook chain. Preserve them verbatim.

### 8c. FK insert order

Insert in dependency order — `user_profile` first, then anything with an FK
to `user_email`. The notification, badge, weekly_insight, and handicap_entry
tables all FK into user_profile.

### Order of operations

1. [ ] Create auth.users rows first (via `auth.admin.createUser` with
       `email_confirm: true`). One row per Base44 user. Capture the new UUIDs.
2. [ ] Insert user_profile rows. Map Base44 user email → new auth UUID for
       `revenuecat_app_user_id` field (see Capacitor era helper
       `alignRevenueCatAppUserId` for why).
3. [ ] Insert dependent tables in any order: badge, handicap_entry, leaderboard_entry,
       monthly_game_plan, notification, practice_plan, referral, round, session_log,
       waitlist_credit, weekly_insight, weekly_report.
4. [ ] Run a spot-check query: pick 3 Base44 users at random, verify their
       data is fully present in the client Supabase, including subscription
       state.

---

## 9. Re-point webhooks

- [ ] **Stripe Dashboard → Webhooks** → change endpoint from old Base44 URL
      to `https://<CLIENT_PROJECT_REF>.supabase.co/functions/v1/[stripe-webhook-fn-name]`
- [ ] **RevenueCat Dashboard → Integrations → Webhooks** → change endpoint
      from old Base44 URL to
      `https://<CLIENT_PROJECT_REF>.supabase.co/functions/v1/revenueCatWebhook`
- [ ] Send a test event from each dashboard, verify it arrives at the new
      endpoint (Dashboard → Edge Functions → Logs)

---

## 10. Frontend deployment

### Vercel

- [ ] Update environment variables in Vercel project settings:
      - `VITE_SUPABASE_URL` → client project URL
      - `VITE_SUPABASE_ANON_KEY` → client anon key
      - `VITE_REVENUECAT_IOS_KEY` → client RC iOS public key (if not already)
- [ ] Deploy from `main`
- [ ] Verify the deployed app loads and connects to the client Supabase

### DNS

- [ ] Point `caddieaiapp.com` (root + www) to Vercel
- [ ] Wait for DNS propagation (~5-30 min)
- [ ] Verify `https://caddieaiapp.com` resolves to the new deployment

### Universal Links (if/when configured)

- [ ] Host `apple-app-site-association` at
      `https://caddieaiapp.com/.well-known/apple-app-site-association`
      (no extension, served as `application/json`)
- [ ] Apple Developer team ID + bundle ID baked into the JSON
- [ ] iOS app's `Associated Domains` entitlement set to
      `applinks:caddieaiapp.com`

### Sign in with Apple — web domain verification

Apple requires domain ownership verification for the Sign in with Apple
Services ID's "Domains and Subdomains" field. If we left this pending
during initial Services ID setup (because DNS still pointed at Base44),
it has to be completed here.

- [ ] Apple Developer → Identifiers → Services IDs → Caddie AI Sign In →
      Edit "Configure" → check "Sign in with Apple" → Configure
- [ ] In the Web Authentication Configuration dialog, click **Download**
      next to the Domains and Subdomains field. Apple gives you a file:
      `apple-developer-domain-association.txt`
- [ ] Host that file (as-is, no extension change, no transform) at
      `https://caddieaiapp.com/.well-known/apple-developer-domain-association.txt`
      via the Vercel deployment
- [ ] Back in Apple Developer → click **Verify** next to the domain
- [ ] Once verified, the iOS Sign in with Apple flow is fully wired
      through Supabase Auth → Apple provider

---

## 11. Native app updates

- [ ] Update local `.env.local` to point at client Supabase
- [ ] Rebuild bundle: `npm run build && npx cap sync ios`
- [ ] Update Xcode signing to client's Apple Developer Team ID
- [ ] Submit new TestFlight build with the production Supabase config
- [ ] Internal testers verify sign-in, subscribe, push notifications
- [ ] Submit to App Store review

---

## 12. Decommission Base44

Only after Step 11 verification clears.

- [ ] Verify no traffic hitting Base44 endpoints (check Base44 dashboard)
- [ ] Archive Base44 project (don't delete immediately — keep ~30 days
      as rollback safety)
- [ ] Update DNS for any subdomain still pointing at Base44

---

## Post-cutover smoke tests

Run these in this order against the production deployment:

1. [ ] Sign-up flow: new email → magic link arrives → first-time onboarding
2. [ ] Sign-in flow: existing user (one of the Base44-migrated accounts) →
       magic link arrives → lands on `/home` with their plan + history intact
3. [ ] Sign in with Apple: → lands on `/home`
4. [ ] Web subscribe: trial → Stripe Checkout → webhook → `subscription_status='trial'`
5. [ ] iOS subscribe: RevenueCat IAP → webhook → `subscription_status='trial'`
6. [ ] Cancel subscription (web): in-app → `subscription_status='cancelling'`
7. [ ] Cancel subscription (iOS): iOS Settings → `subscription_status='cancelling'`
8. [ ] Push notification: insert a row into `public.notification` for a
       test user with `push_enabled=true` → push arrives on device
9. [ ] Profile photo upload (iOS Camera plugin) → photo appears
10. [ ] LLM call: open Coach, send a message → response comes back

If any of these fail, **do not promote**. Investigate, fix, re-run.

---

## Rollback plan

If Step 11 verification reveals a blocker that can't be fixed quickly:

1. Restore Base44 to writeable mode
2. Re-point Stripe + RevenueCat webhooks back to Base44 endpoints
3. Update DNS to point `caddieaiapp.com` back to the Base44 deployment
4. (No data loss — Base44 was frozen, not deleted)

The cost: ~2 hours of customer downtime during the window. Plan a quieter
window (Tuesday 2-4am local?) to minimize impact if this fires.

---

## Notes for the day-of operator

- Block **4 hours** on the calendar; expect to use 2-3
- Have access to: Apple Developer portal, App Store Connect, Stripe Dashboard,
  RevenueCat Dashboard, both Supabase projects (dev + client), Vercel,
  domain registrar / DNS, Base44 admin
- Keep the audit query (Step 2) handy — re-run after each step to catch drift
- Don't skip Step 8a (email lowercasing) — it's silent and permanent
