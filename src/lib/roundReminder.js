import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative, NATIVE_URL_SCHEME } from '@/lib/platform';
import { computeRunningStats } from '@/lib/roundDraft';

// Lock-screen reminder for an in-progress round: when the app goes to the
// background with a round draft active, pin a local notification so the
// golfer can jump straight back to the current hole after playing it.
// Cleared whenever the app returns to the foreground — the draft itself
// (lib/roundDraft) is the source of truth, this is just a shortcut to it.
const REMINDER_ID = 74901;

// Ask at round start — the one moment the value is obvious to the golfer.
// iOS only shows the system dialog once; after a denial this resolves
// 'denied' immediately and the round simply proceeds without reminders.
export async function ensureReminderPermission() {
  if (!isNative()) return false;
  try {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      ({ display } = await LocalNotifications.requestPermissions());
    }
    return display === 'granted';
  } catch (e) {
    console.warn('[round-reminder] permission check failed:', e?.message);
    return false;
  }
}

export async function showRoundReminder(draft) {
  if (!isNative() || !draft) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    const { loggedCount } = computeRunningStats(draft);
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: `Round in progress at ${draft.course_name}`,
        body: `Tap to log hole ${draft.current_hole} — ${loggedCount} of ${draft.holes_planned} holes done.`,
        extra: { url: `${NATIVE_URL_SCHEME}://round-tracker` },
        // Small delay so it fires after the app has fully backgrounded —
        // an immediate notification while still foreground shows nothing
        schedule: { at: new Date(Date.now() + 1200), allowWhileIdle: true },
      }],
    });
  } catch (e) {
    console.warn('[round-reminder] schedule failed:', e?.message);
  }
}

export async function clearRoundReminder() {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    const { notifications } = await LocalNotifications.getDeliveredNotifications();
    if (notifications?.some((n) => n.id === REMINDER_ID)) {
      await LocalNotifications.removeDeliveredNotifications({
        notifications: notifications.filter((n) => n.id === REMINDER_ID),
      });
    }
  } catch (e) {
    console.warn('[round-reminder] clear failed:', e?.message);
  }
}

// Same contract as addPushTappedListener: fires the callback with an object
// exposing the notification's extra payload so the caller can deep-link.
export async function addReminderTappedListener(callback) {
  if (!isNative()) return { remove: () => {} };
  return LocalNotifications.addListener('localNotificationActionPerformed', callback);
}
