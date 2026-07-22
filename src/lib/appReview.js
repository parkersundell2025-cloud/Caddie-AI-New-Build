import { InAppReview } from '@capacitor-community/in-app-review';
import { isNative } from '@/lib/platform';
import { APP_STORE_URL } from '@/lib/shareConfig';

// Native in-app review (scope item 3a). On iOS this is SKStoreReviewController
// and on Android the Play In-App Review sheet — both are quota-limited by the
// OS and may silently show nothing, which is why the soft ReviewPopup asks
// first. On web there's no native sheet; fall through to the App Store
// write-review page.
export async function requestAppReview() {
  if (isNative()) {
    try {
      await InAppReview.requestReview();
      return;
    } catch {
      // fall through to the store page
    }
  }
  window.open(`${APP_STORE_URL}?action=write-review`, '_blank', 'noopener');
}

// Success-moment auto-prompt per the client spec: session completed, badge
// earned, personal best. Self-throttled so we don't burn the OS quota
// (Apple: ~3 shown prompts/365d; both OSes may silently show nothing):
// at most one request per 30 days, at most 3 per 365 days, native only —
// the web popup handles web separately.
const PROMPT_LOG_KEY = 'caddie_review_prompts';

export function maybeRequestReview() {
  if (!isNative()) return;
  try {
    const now = Date.now();
    const log = (JSON.parse(localStorage.getItem(PROMPT_LOG_KEY) || '[]'))
      .filter(t => now - t < 365 * 24 * 3600 * 1000);
    const last = log[log.length - 1] || 0;
    if (log.length >= 3 || now - last < 30 * 24 * 3600 * 1000) return;
    log.push(now);
    localStorage.setItem(PROMPT_LOG_KEY, JSON.stringify(log));
    InAppReview.requestReview().catch(() => {});
  } catch { /* never break a celebration over a review prompt */ }
}
