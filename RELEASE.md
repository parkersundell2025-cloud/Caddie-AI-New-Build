# Releasing Caddie AI

How to ship updates — both the web app (Vercel) and the iOS app
(TestFlight + App Store).

This is the operational doc. For "what's pending before App Store
submission", see [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md).
For the production cutover from Base44, see [CUTOVER.md](./CUTOVER.md).

---

## Web (Vercel)

Vercel auto-deploys from the `main` branch on GitHub. Standard flow:

1. Work on a branch (default: `silexdev-branch`)
2. Commit + push
3. Open a PR to `main`, merge it
4. Vercel rebuilds + deploys in ~2 minutes
5. Production URL updates automatically

The Vercel project is `caddie-ai-new-build`, hosted under Parker's Vercel
team `caddie-ai2`. Environment variables (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, etc.) are set in the Vercel project settings.

To trigger a redeploy without a code change (e.g., after env var
update), use the Vercel dashboard → Deployments → "..." menu →
**Redeploy**.

---

## iOS (TestFlight + App Store)

### One command to build + upload

```bash
./scripts/build-ios-testflight.sh
```

That single command runs the full pipeline:

1. **Builds the web app** (`npm run build`) → produces `dist/`
2. **Syncs to iOS** (`npx cap sync ios`) → copies `dist/` into the iOS bundle and updates plugin links
3. **Archives via `xcodebuild`** → compiles + signs with our Distribution Cert + Provisioning Profile
4. **Exports `.ipa`** → produces a signed `App.ipa` ready for upload
5. **Uploads via `altool`** → pushes to App Store Connect using the team ASC API Key

After upload completes, Apple processes the build for ~10–30 minutes.
You'll get an email when it's ready. It then appears in App Store
Connect → TestFlight tab.

### Why this script instead of Xcode's "Distribute App" button

Parker is on Individual Apple Developer enrollment, which means his
Apple ID is the only one allowed on the team. silexdev's Apple ID
cannot be added — Xcode's UI then refuses to validate or distribute the
build because it can't find an account for team `AHYLLM9RY8`.

The CLI tools (`xcodebuild`, `altool`) work differently: they use the
locally-installed Distribution Certificate (in Keychain) + Provisioning
Profile (in `~/Library/MobileDevice/`) + an App Store Connect Team API
Key. None of those require a team-member Apple ID in Xcode.

The script wires all three together so you never have to think about
the Xcode UI flow.

### Build numbers (auto-incremented)

Apple requires every TestFlight upload to use a higher build number than
the previous one (for the same Marketing Version). The script handles
this automatically by deriving `CURRENT_PROJECT_VERSION` from the total
commit count of the repo (`git rev-list --count HEAD`). It's
monotonically increasing across normal development, easy to trace back
to a specific commit, and you never have to touch Xcode to bump it.

If you ever need to override (e.g., re-upload from the same commit
with a metadata-only change), pass `BUILD_NUMBER_OVERRIDE`:

```bash
BUILD_NUMBER_OVERRIDE=12345 ./scripts/build-ios-testflight.sh
```

Marketing Version (e.g., "1.0" → "1.1") is left at whatever is set in
the Xcode project. Bump it manually when you ship a real feature
release. To do so:

1. Open `ios/App/App.xcodeproj` in Xcode
2. App target → General → Identity → **Marketing Version**
3. Change e.g., `1.0` → `1.1`
4. Save → commit → next build picks it up

### Configure in TestFlight after upload

When the build appears in ASC → TestFlight (after Apple processing):

1. Click into the build
2. **Export Compliance** → "No, this app does not use cryptography" (Caddie AI only uses standard HTTPS — the Apple-recognized exemption)
3. (Optional) Add **build notes** describing what's in this build
4. Internal Testing group → add internal testers (any Apple ID with ASC team access)
5. Internal testers get an email; they install the **TestFlight app** on their iPhone, then install Caddie AI from there

### Submitting to the App Store

Once you're happy with TestFlight testing:

1. ASC → your app → **App Store** tab (top, not TestFlight)
2. Click the version (e.g., "1.0 Prepare for Submission")
3. Fill in any remaining metadata (description, keywords, screenshots — see [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) for the full list)
4. Under **Build** section → "+" → select the TestFlight build you want to submit
5. Top-right → **Add for Review** → **Submit for Review**
6. Apple's manual review takes 1–3 business days

Apple may reject for various reasons (missing metadata, code paths
they can't reach, privacy disclosures, etc.). Fix and resubmit.

---

## Prerequisites (one-time setup)

These are already done as of 2026-06-09. Documented here in case the
project is set up on a fresh machine.

### Apple credentials installed locally

- **Distribution Cert** (`.p12`) imported into login Keychain. Origin:
  `~/Downloads/CaddieAI/Certificates.p12`, password `parker@james`.
  Imported with `security import` + authorization for codesign and
  Xcode. Then in Keychain Access → "Apple Distribution" cert → expand
  → double-click private key → Access Control tab → "Allow all
  applications to access this item" (otherwise xcodebuild hangs silently
  on a keychain prompt during archive).
- **Provisioning profile** installed at
  `~/Library/MobileDevice/Provisioning Profiles/<UUID>.mobileprovision`.
  Origin: `~/Downloads/CaddieAI/Caddie_AI_App_Store (1).mobileprovision`.
  Current UUID: `d6456dfa-d03e-49b1-bc14-7a7a1747290b`.
- **ASC API key (.p8)** copied to
  `~/.appstoreconnect/private_keys/AuthKey_LA3847KQHG.p8` where altool
  auto-discovers it. Origin: `~/Downloads/CaddieAI/AuthKey_LA3847KQHG.p8`.

### `exportOptions.plist`

Lives at `scripts/exportOptions.plist`. Tells xcodebuild's
`-exportArchive` step to use manual signing and identifies which
Distribution Cert and Provisioning Profile to use for which bundle ID.
Committed to repo. Bundle ID + Provisioning Profile Name are hardcoded.

### Node + Xcode CLI tools

- Node 18+ (project tested on Node 24.16.0 via NVM)
- Xcode + Command Line Tools (Apple silicon or Intel Mac, macOS 13+)
- Standard Capacitor 8 setup (no Pods — Swift Package Manager)
- Optional: `xcbeautify` for nicer build logs (`brew install xcbeautify`)

---

## When something goes wrong

### Upload fails with "Build number must be higher"

Means the build number from `git rev-list --count HEAD` matches a build
already on App Store Connect (you uploaded twice from the same commit).
Either commit something new, or override:

```bash
BUILD_NUMBER_OVERRIDE=<higher_number> ./scripts/build-ios-testflight.sh
```

### Upload fails with `ITMS-*` error

That's Apple's automated content validation. Common ones:

- `ITMS-90683` — missing usage description for a permission. Add it to
  `ios/App/App/Info.plist` (e.g., `NSCameraUsageDescription`).
- `ITMS-90713` — missing privacy manifest. Apple requires
  `PrivacyInfo.xcprivacy` files for certain SDKs. Most Capacitor
  plugins now ship these; if a custom plugin is the culprit, ask the
  plugin maintainer.
- `ITMS-90060` — missing `CFBundleVersion`. Shouldn't happen since we
  always pass `CURRENT_PROJECT_VERSION`, but if it does, check the
  script's `BUILD_NUMBER` env var.

Paste the exact error message and ask for a targeted fix.

### xcodebuild hangs with no output

Almost always a hidden Keychain Access dialog (`Allow xcodebuild to use
the Apple Distribution key?`). Make sure Keychain Access → Distribution
private key → Access Control → "Allow all applications" is set per the
prereq above.

### TestFlight build "stuck in processing" for hours

Apple's processing usually takes 10–30 min. If it's been 2+ hours, the
build is probably in "Invalid Binary" state — check App Store Connect →
TestFlight → click the build → look for the rejection reason. Often
points at a missing manifest, prohibited API usage, or Apple's automated
checks finding something. Fix and re-upload.

### App Store Connect API key revoked

If the team key Parker generated is revoked:

1. Parker (or any ASC Admin) → ASC → Users and Access → Integrations →
   App Store Connect API → Team Keys → "+" → generate a new App
   Manager-scoped key
2. Download the new `.p8`
3. Replace `~/.appstoreconnect/private_keys/AuthKey_<OLD_KEY_ID>.p8`
4. Update `ASC_KEY_ID` and `ASC_ISSUER_ID` in `scripts/build-ios-testflight.sh`
5. Re-run the script

---

## Quick reference

```bash
# Web — automatic via Vercel
git push origin silexdev-branch
# Open PR, merge to main → Vercel deploys

# iOS — single command
./scripts/build-ios-testflight.sh

# iOS with manual build number (rare)
BUILD_NUMBER_OVERRIDE=12345 ./scripts/build-ios-testflight.sh
```
