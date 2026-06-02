import { PushNotifications } from '@capacitor/push-notifications';
import { isNative, getPlatform } from '@/lib/platform';

// Native push notifications wrapper. All exports are safe to call on web —
// they return 'unsupported' or no-op without crashing the bundle. The actual
// APNs / FCM token flow only fires inside the Capacitor app.
//
// Architecture:
//   - This module owns the Capacitor PushNotifications API surface and the
//     registration → token promise pattern.
//   - DB writes (device_token row, user_profile.notification_preferences) live
//     in the calling page (NotificationPreferences.jsx) — same separation as
//     revenuecat.js / Supabase Storage uploads.
//   - A user opt-out *does not* delete the device_token row, only flips
//     user_profile.notification_preferences.push_enabled to false. The backend
//     push-sender (future) checks the preference flag, so the token can stay
//     in the DB even if push is currently disabled.
//
// Setup that must happen in Xcode before push works on a real device:
//   1. Signing & Capabilities → +Capability → Push Notifications
//      (writes aps-environment to App.entitlements)
//   2. Signing & Capabilities → +Capability → Background Modes →
//      Remote notifications (for silent / background pushes)
//   3. Apple Developer portal → an APNs Authentication Key (.p8)
//      configured against the App ID; the .p8 key id + team id go into the
//      backend push-sender's secrets.

export const PUSH_PERMISSION_UNSUPPORTED = 'unsupported';

// Returns 'granted' | 'denied' | 'prompt' | 'unsupported'.
// 'prompt' = iOS hasn't asked yet.
export async function checkPushPermission() {
  if (!isNative()) return PUSH_PERMISSION_UNSUPPORTED;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive; // 'granted' | 'denied' | 'prompt'
  } catch (e) {
    console.warn('[push] checkPermissions failed:', e?.message);
    return PUSH_PERMISSION_UNSUPPORTED;
  }
}

// Show the iOS permission dialog. Returns the new permission state.
export async function requestPushPermission() {
  if (!isNative()) return PUSH_PERMISSION_UNSUPPORTED;
  try {
    const { receive } = await PushNotifications.requestPermissions();
    return receive;
  } catch (e) {
    console.warn('[push] requestPermissions failed:', e?.message);
    return PUSH_PERMISSION_UNSUPPORTED;
  }
}

// Calls register() and awaits the 'registration' event to get the APNs token.
// Resolves with the device token string; rejects on registrationError or after
// REGISTRATION_TIMEOUT_MS with no event. The timeout exists because without
// the aps-environment entitlement in App.entitlements (Xcode → Signing &
// Capabilities → +Push Notifications) iOS silently drops register() with no
// callback at all — leaving the promise hanging forever. The caller is
// expected to have already confirmed permission === 'granted'.
const REGISTRATION_TIMEOUT_MS = 10_000;

export async function registerForPush() {
  if (!isNative()) throw new Error('Push notifications are native-only');

  return new Promise((resolve, reject) => {
    let regHandle, errHandle, timer;
    const cleanup = () => {
      regHandle?.remove?.();
      errHandle?.remove?.();
      if (timer) clearTimeout(timer);
    };

    timer = setTimeout(() => {
      cleanup();
      const err = new Error(
        'Push registration timed out — the Push Notifications capability is likely not enabled in Xcode (Signing & Capabilities → +Capability → Push Notifications). iOS notification permission may still be granted; simulated pushes via xcrun simctl push will work.',
      );
      err.code = 'registration_timeout';
      reject(err);
    }, REGISTRATION_TIMEOUT_MS);

    PushNotifications.addListener('registration', ({ value }) => {
      cleanup();
      resolve(value);
    }).then((h) => { regHandle = h; });

    PushNotifications.addListener('registrationError', ({ error }) => {
      cleanup();
      reject(new Error(error || 'Push registration failed'));
    }).then((h) => { errHandle = h; });

    PushNotifications.register().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

// Fired when a notification arrives while the app is in foreground. iOS does
// NOT show its own banner in this case — the app is responsible for rendering
// (toast, badge, route to detail screen, etc.).
export async function addPushReceivedListener(callback) {
  if (!isNative()) return { remove: () => {} };
  return PushNotifications.addListener('pushNotificationReceived', callback);
}

// Fired when the user taps a notification (from lock screen / notification
// center / banner). Use this to deep-link into the relevant route.
export async function addPushTappedListener(callback) {
  if (!isNative()) return { remove: () => {} };
  return PushNotifications.addListener('pushNotificationActionPerformed', callback);
}

// Sugar: most callers want "permission → register → token" in one go.
// Returns { token, platform } on success. Throws if permission denied or
// registration fails.
export async function enablePushAndGetToken() {
  if (!isNative()) {
    throw new Error('Push notifications are not supported on this platform');
  }
  let state = await checkPushPermission();
  if (state === 'prompt' || state === 'denied') {
    // iOS only shows the system dialog the first time; after a 'denied' the
    // user has to enable manually in Settings — requestPermissions resolves
    // immediately with 'denied' in that case.
    state = await requestPushPermission();
  }
  if (state !== 'granted') {
    const err = new Error('Push permission denied');
    err.code = 'permission_denied';
    throw err;
  }
  const token = await registerForPush();
  return { token, platform: getPlatform() };
}
