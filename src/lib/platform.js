import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// Platform detection + external-URL routing for the Caddie AI web/native split.
//
// Code paths that open URLs (Stripe Checkout, Customer Portal, magic-link
// support pages) should go through openExternal() instead of
// window.location.assign() — on Capacitor iOS/Android, navigating the WebView
// itself to an external https URL either:
//   - gets blocked by the destination's CSP (Stripe Checkout does this), or
//   - traps the user in that external page with no way back to the app.
//
// openExternal() picks the right transport per platform:
//   - native (ios/android) → Browser plugin (SafariViewController / Chrome
//     Custom Tabs). User taps "Done" or our caddieai:// success URL fires
//     and brings them back into the app.
//   - web → standard window.location.assign().
export function isNative() {
  return Capacitor.isNativePlatform();
}

export function getPlatform() {
  return Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
}

export async function openExternal(url) {
  if (isNative()) {
    await Browser.open({ url, presentationStyle: 'fullscreen' });
    return;
  }
  window.location.assign(url);
}

// Custom URL scheme that Stripe's success_url / cancel_url should target on
// native, so the iOS in-app browser closes and the App plugin fires
// appUrlOpen back into the SPA. Registered in ios/App/App/Info.plist under
// CFBundleURLTypes.
export const NATIVE_URL_SCHEME = 'caddieai';
