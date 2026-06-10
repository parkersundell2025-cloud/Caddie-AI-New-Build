#!/usr/bin/env bash
#
# Archive, export, and upload the Caddie AI iOS app to TestFlight without
# going through Xcode's UI distribution flow.
#
# Why this script exists: Xcode's "Distribute App" UI rejects the build
# because Parker is on Individual Apple Developer enrollment, so silexdev's
# Apple ID cannot be on the team — Xcode shows "No Account for Team
# AHYLLM9RY8" and refuses to proceed. xcodebuild + altool use the locally-
# installed Distribution Cert (in Keychain) + Provisioning Profile (in
# ~/Library/MobileDevice/) + ASC API Key directly. No team Apple ID needed.
#
# Prerequisites (all done as of 2026-06-09):
#   - Parker's Distribution .p12 imported into login.keychain
#   - "Caddie AI App Store" provisioning profile installed under
#     ~/Library/MobileDevice/Provisioning Profiles/
#   - ASC API Key (LA3847KQHG) and its .p8 saved at
#     ~/.appstoreconnect/private_keys/AuthKey_LA3847KQHG.p8
#   - npm + Xcode CLI tools installed
#
# Usage:
#   ./scripts/build-ios-testflight.sh
#
# The script will:
#   1. Build the web app (Vite)
#   2. Sync to iOS (npx cap sync ios)
#   3. Archive via xcodebuild
#   4. Export .ipa with manual signing
#   5. Upload to App Store Connect via altool
#
# Output ends up in ./build/ios/. After upload, the build appears in ASC →
# TestFlight tab after Apple processes (~10-30 min).

set -euo pipefail

# --- PATH setup -----------------------------------------------------------
# Subshells (including background scripts and CI runners) often start with a
# minimal PATH that doesn't include the NVM-managed node binary. Source NVM
# if it's installed; otherwise scan common locations for a node binary.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi
if ! command -v node >/dev/null 2>&1; then
  for d in \
    "$HOME/.nvm/versions/node"/*/bin \
    /opt/homebrew/bin \
    /usr/local/bin
  do
    [ -d "$d" ] && [ -x "$d/node" ] && PATH="$d:$PATH"
  done
  export PATH
fi
command -v npm >/dev/null 2>&1 || {
  echo "✗ npm not on PATH after PATH fallback search. Install Node.js / NVM first."
  echo "  PATH was: $PATH"
  exit 1
}

# --- config ---------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios/App"
BUILD_DIR="$PROJECT_ROOT/build/ios"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_PATH="$BUILD_DIR/Export"
EXPORT_OPTIONS="$PROJECT_ROOT/scripts/exportOptions.plist"

ASC_KEY_ID="LA3847KQHG"
ASC_ISSUER_ID="9622e5f4-54c4-417d-aa1c-8379c4d55a85"
ASC_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"

# Build number policy. Apple requires each TestFlight upload to use a build
# number strictly greater than any previous upload for the same Marketing
# Version. We default to the total commit count of the repo, which is
# monotonically increasing across normal day-to-day development and easy to
# reason about ("this build is from commit N"). If you need to re-upload
# from the same commit (e.g., a metadata-only fix), bump it manually:
#   BUILD_NUMBER_OVERRIDE=12345 ./scripts/build-ios-testflight.sh
BUILD_NUMBER="${BUILD_NUMBER_OVERRIDE:-$(git -C "$PROJECT_ROOT" rev-list --count HEAD 2>/dev/null || echo 1)}"

# --- preflight ------------------------------------------------------------
echo "→ Preflight checks"
[ -f "$ASC_KEY_PATH" ] || {
  echo "  ✗ ASC API key not found at $ASC_KEY_PATH"
  echo "    Copy from ~/Downloads/CaddieAI/ first:"
  echo "      mkdir -p ~/.appstoreconnect/private_keys/"
  echo "      cp ~/Downloads/CaddieAI/AuthKey_${ASC_KEY_ID}.p8 ~/.appstoreconnect/private_keys/"
  exit 1
}
[ -f "$EXPORT_OPTIONS" ] || { echo "  ✗ $EXPORT_OPTIONS not found"; exit 1; }
echo "  ✓ ASC API key present"
echo "  ✓ exportOptions.plist present"
echo "  → Build number for this upload: $BUILD_NUMBER"

# --- 1. Web build ---------------------------------------------------------
echo
echo "→ Step 1/5: Build web app (Vite)"
cd "$PROJECT_ROOT"
npm run build

# --- 2. Capacitor sync ----------------------------------------------------
echo
echo "→ Step 2/5: Sync to iOS (npx cap sync ios)"
npx cap sync ios

# --- 3. Archive -----------------------------------------------------------
echo
echo "→ Step 3/5: xcodebuild archive"
mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH"
# CURRENT_PROJECT_VERSION is the build number Apple checks for uniqueness.
# Passed inline so we don't have to mutate the .xcodeproj on disk every
# release. MARKETING_VERSION is left to whatever is configured in the
# project (bump that manually when you ship a real "1.1" feature release).
xcodebuild \
  -project "$IOS_DIR/App.xcodeproj" \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  archive | xcbeautify || {
    # Fallback if xcbeautify not installed
    echo "(install xcbeautify for cleaner logs: brew install xcbeautify)"
    xcodebuild \
      -project "$IOS_DIR/App.xcodeproj" \
      -scheme App \
      -configuration Release \
      -destination "generic/platform=iOS" \
      -archivePath "$ARCHIVE_PATH" \
      CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
      archive
  }

# --- 4. Export .ipa -------------------------------------------------------
echo
echo "→ Step 4/5: xcodebuild -exportArchive"
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH"

IPA_PATH="$EXPORT_PATH/App.ipa"
[ -f "$IPA_PATH" ] || { echo "  ✗ Expected .ipa at $IPA_PATH but it doesn't exist"; ls -la "$EXPORT_PATH"; exit 1; }
echo "  ✓ .ipa exported: $IPA_PATH"

# --- 5. Upload ------------------------------------------------------------
echo
echo "→ Step 5/5: Upload to App Store Connect via altool"
xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID"

echo
echo "✅ Upload complete."
echo "   Build will appear in App Store Connect → TestFlight tab after Apple"
echo "   processes it (~10–30 min). You'll get an email when it's ready."
