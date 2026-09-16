import { supabase } from '@/lib/supabase';
import { getPlatform } from '@/lib/platform';

// First-party funnel events (CONVERSION_FIXES #8). Fire-and-forget: a
// telemetry failure must never block plan rendering or a purchase. Every event
// gets a stable event_id at creation, so a retry is idempotent server-side
// (trackFunnelEvent → public.track_funnel_event, ON CONFLICT DO NOTHING).
//
// IDs, per FUNNEL_EVENT_STORAGE_DESIGN.md:
//   session_id  — one per app load
//   flow_id     — one per onboarding → paywall → purchase journey
//   view_id     — an ACTUAL new screen presentation (focus rechecks don't count)
//   attempt_id  — one deliberate purchase tap
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Older WebViews without randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const SESSION_ID = newId();
const STORAGE_KEY = 'caddie_funnel_queue';
let flowId = null;
let currentUser = null;
const queue = [];
const MAX_QUEUE = 50;
let draining = false;
let restored = false;

export function startFlow() { flowId = newId(); return flowId; }
export function getFlowId() { return flowId; }
export function newViewId() { return newId(); }
export function newAttemptId() { return newId(); }

// Never attach one user's queued events to the next: an account switch drops
// anything not yet delivered (in memory and persisted).
export function setFunnelUser(userId) {
  if (currentUser && userId && userId !== currentUser) {
    queue.length = 0;
    persist();
  }
  currentUser = userId || null;
}

// Wired to the auth state so the switch guard above is live even though no
// page calls setFunnelUser directly.
try {
  supabase.auth.onAuthStateChange((_evt, session) => setFunnelUser(session?.user?.id ?? null));
} catch { /* not in a browser / no auth */ }

function platform() {
  const p = getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

// The queue survives a full-page navigation (Stripe redirect, reload, the
// app being backgrounded and killed) and an offline stretch. It is stored
// with the user it belongs to and only restored for that same user, so a
// persisted event can never be attributed to whoever signs in next (the
// server stamps user_id from the JWT of the delivering session).
function persist() {
  try {
    if (!queue.length) { localStorage.removeItem(STORAGE_KEY); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: currentUser, items: queue.map((i) => i.event) }));
  } catch { /* storage unavailable — in-memory only */ }
}
async function restoreOnce() {
  if (restored) return;
  restored = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!currentUser) {
      const { data: { session } = {} } = await supabase.auth.getSession();
      currentUser = session?.user?.id ?? null;
    }
    if (saved?.user && saved.user === currentUser && Array.isArray(saved.items)) {
      for (const event of saved.items.slice(-MAX_QUEUE)) queue.push({ event, tries: 0 });
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* corrupt or unavailable — start empty */ }
}

// Queue an event and start draining. Returns the event_id. Never throws.
export function track(eventName, {
  properties = {}, viewId = null, attemptId = null, planId = null, offeringId = null, productId = null,
} = {}) {
  const event = {
    event_id: newId(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    schema_version: 1,
    session_id: SESSION_ID,
    flow_id: flowId,
    view_id: viewId,
    attempt_id: attemptId,
    platform: platform(),
    app_version: import.meta.env.VITE_APP_VERSION ?? null,
    build_number: import.meta.env.VITE_BUILD_NUMBER ?? null,
    plan_id: planId,
    offering_id: offeringId,
    product_id: productId,
    properties,
  };
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ event, tries: 0 });
  persist();
  void drain();
  return event.event_id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Delivery policy:
//   4xx  — the server rejected the event (not allowed / malformed); retrying
//          can't fix it, so it's dropped at once.
//   5xx  — bounded retry with backoff, then dropped.
//   no HTTP status (offline, DNS, aborted) — NOT a verdict on the event. Stop
//          draining and keep everything; resume when the browser comes back
//          online or the next event is tracked. Walkthrough 2026-09-16: an
//          offline purchase attempt used to be dropped after ~3s of retries.
// functions.invoke does NOT throw on non-2xx; the error envelope is checked.
async function drain() {
  if (draining) return;
  draining = true;
  try {
    await restoreOnce();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    while (queue.length) {
      const item = queue[0];
      try {
        const { error } = await supabase.functions.invoke('trackFunnelEvent', { body: item.event });
        if (error) throw error;
        queue.shift();
        persist();
      } catch (e) {
        const status = e?.context?.status;
        if (!status) return; // transport failure: keep the queue, retry later
        item.tries += 1;
        if ((status >= 400 && status < 500) || item.tries >= 3) {
          queue.shift();
          persist();
          console.warn('[funnel] dropped', item.event.event_name, status);
        } else {
          await sleep(500 * 2 ** item.tries);
        }
      }
    }
  } finally {
    draining = false;
  }
}

try {
  window.addEventListener('online', () => { void drain(); });
  // First load: deliver anything a previous page left behind.
  void drain();
} catch { /* not in a browser */ }
