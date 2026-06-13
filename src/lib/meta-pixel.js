import { AppTrackingTransparency } from '@capgo/capacitor-app-tracking-transparency';
import { isNative } from '@/lib/platform';

// Meta Pixel initialization. On web, Pixel loads immediately (web cookies +
// pixel-side opt-out are governed by the user's browser settings). On iOS,
// Apple Guideline 5.1.2(i) requires us to obtain explicit consent via the
// App Tracking Transparency prompt before any cross-app/site tracking can
// happen — Meta Pixel qualifies. We:
//   1. Check the current ATT status without prompting
//   2. If notDetermined, request permission (shows iOS dialog)
//   3. Only load the actual Pixel script when status is 'authorized'
//
// Any fbq() calls fired before init (e.g., CheckoutSuccess's
// CompleteRegistration event) are queued by the stub installed in
// index.html, and replayed once the real Pixel script has loaded.

const PIXEL_ID = '3479477215550657';
let initialized = false;

function loadPixelScript() {
  // Avoid double-load — the stub in index.html only catches early calls; if
  // this function gets invoked twice (Strict Mode double-fire in dev), we
  // don't want two pixel scripts.
  if (initialized || window._fbq) return;
  initialized = true;

  // Standard Meta Pixel loader (extracted from the inline snippet that used
  // to live in index.html). Replaces the queue stub with the real fbq once
  // fbevents.js loads.
  const queue = window.fbq.queue || [];
  const stubFbq = window.fbq;
  // eslint-disable-next-line no-inner-declarations
  function realFbq() {
    realFbq.callMethod
      ? realFbq.callMethod.apply(realFbq, arguments)
      : realFbq.queue.push(arguments);
  }
  realFbq.push = realFbq;
  realFbq.loaded = true;
  realFbq.version = '2.0';
  realFbq.queue = queue.slice(); // preserve queued events from the stub
  window.fbq = realFbq;
  window._fbq = realFbq;
  void stubFbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

export async function initMetaPixelWithATT() {
  // Web — Pixel loads immediately; web users' tracking is governed by
  // browser cookies/storage rules and our /privacy disclosure.
  if (!isNative()) {
    loadPixelScript();
    return;
  }

  // iOS — check ATT status, request if not yet decided, only load Pixel if
  // the user grants permission. If anything fails (plugin missing, native
  // bridge error), default to NOT loading Pixel — Apple is stricter about
  // accidental tracking than about missing data.
  try {
    let { status } = await AppTrackingTransparency.getStatus();
    if (status === 'notDetermined') {
      const result = await AppTrackingTransparency.requestPermission();
      status = result.status;
    }
    if (status === 'authorized') {
      loadPixelScript();
    } else {
      // denied / restricted — don't track. Any queued fbq() events stay
      // queued and never fire, which is the correct behavior.
      console.log('[meta-pixel] iOS ATT status =', status, '— skipping pixel');
    }
  } catch (e) {
    console.warn('[meta-pixel] ATT check failed on iOS — skipping pixel:', e?.message);
  }
}
