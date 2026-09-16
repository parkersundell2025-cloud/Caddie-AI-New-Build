import { supabase } from '@/lib/supabase';
import { getPlatform } from '@/lib/platform';

// First-party funnel events (CONVERSION_FIXES #8). Fire-and-forget: a
// telemetry failure must never block plan rendering or a purchase. Every event
// gets a stable event_id at creation, so a retry is idempotent server-side
// (trackFunnelEvent → public.track_funnel_event, ON CONFLICT DO NOTHING).
//
// IDs, per FUNNEL_EVENT_STORAGE_DESIGN.md:
//   session_id  — one per app load
//   flow_id     — one per onboarding → paywall → purchase journey; reset at
//                 every account boundary
//   view_id     — an ACTUAL new screen presentation (focus rechecks don't count)
//   attempt_id  — one deliberate purchase tap
//
// Identity: every queued item is bound to the user it was recorded for, and
// ownership is checked again immediately before delivery. The server stamps
// user_id from the JWT of the delivering session, so an item that outlived
// its user (sign-out, or A → null → B) would otherwise be stored as the next
// user's — review finding 3, 2026-09-16.
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
const MAX_QUEUE = 50;
let flowId = null;
let currentUser = null;   // null = signed out (or not yet known)
let userResolved = false; // true once auth state has been observed
const queue = [];         // { event, user, tries }
let draining = false;
let restored = false;

export function startFlow() { flowId = newId(); return flowId; }
export function getFlowId() { return flowId; }
export function newViewId() { return newId(); }
export function newAttemptId() { return newId(); }

// Account boundary. Any change of identity — A → B, A → null (sign-out),
// null → B — drops everything not owned by the new identity, in memory and in
// storage, and restarts the journey id. Owned items are kept, so a token
// refresh or the initial-session callback for the same user is a no-op.
export function setFunnelUser(userId) {
  const next = userId || null;
  userResolved = true;
  if (next === currentUser) return;
  currentUser = next;
  flowId = null;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].user !== currentUser) queue.splice(i, 1);
  }
  persist();
  if (currentUser) void drain();
}

// Wired to the auth state so the boundary above is enforced without any page
// having to call setFunnelUser: INITIAL_SESSION / SIGNED_IN set the owner,
// SIGNED_OUT clears it.
try {
  supabase.auth.onAuthStateChange((_evt, session) => setFunnelUser(session?.user?.id ?? null));
} catch { /* not in a browser / no auth */ }

// Local (no network) read of the stored session, used only until the auth
// listener has reported. Never guesses: unknown stays null.
async function resolveUser() {
  if (userResolved) return currentUser;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!userResolved) {
      currentUser = session?.user?.id ?? null;
      userResolved = true;
    }
  } catch {
    userResolved = true;
  }
  return currentUser;
}

function platform() {
  const p = getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

// The queue survives a full-page navigation (Stripe redirect, reload, the app
// being backgrounded and killed) and an offline stretch. Each stored item
// carries its owner; on restore, only items owned by the current user come
// back and everything else is discarded.
function persist() {
  try {
    if (!queue.length) { localStorage.removeItem(STORAGE_KEY); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: queue.map((i) => ({ event: i.event, user: i.user })) }));
  } catch { /* storage unavailable — in-memory only */ }
}
async function restoreOnce() {
  if (restored) return;
  restored = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const owner = await resolveUser();
    const items = Array.isArray(saved?.items) ? saved.items : [];
    for (const it of items.slice(-MAX_QUEUE)) {
      if (owner && it?.user === owner && it.event) queue.push({ event: it.event, user: owner, tries: 0 });
    }
    persist(); // rewrites storage with only the owned items (or clears it)
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
  void enqueue(event);
  return event.event_id;
}

// An item is only ever queued with a known owner. Signed-out events cannot be
// accepted by the endpoint (401) and must not wait around for the next
// sign-in, so they are dropped here.
async function enqueue(event) {
  const owner = await resolveUser();
  if (!owner || owner !== currentUser) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ event, user: owner, tries: 0 });
  persist();
  void drain();
}

function remove(item) {
  const i = queue.indexOf(item);
  if (i >= 0) { queue.splice(i, 1); persist(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Delivery policy:
//   4xx  — the server rejected the event (not allowed / malformed); retrying
//          can't fix it, so it's dropped at once.
//   5xx  — bounded retry with backoff, then dropped.
//   no HTTP status (offline, DNS, aborted) — NOT a verdict on the event. Stop
//          draining and keep everything; resume when the browser comes back
//          online or the next event is tracked.
// Ownership is re-checked per item right before sending, and completion of a
// request only removes THAT item (never "the head of the queue"), so a user
// switch while a request is in flight can't remove the new user's event.
// functions.invoke does NOT throw on non-2xx; the error envelope is checked.
async function drain() {
  if (draining) return;
  draining = true;
  try {
    await restoreOnce();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    while (queue.length) {
      const item = queue[0];
      if (!currentUser || item.user !== currentUser) { remove(item); continue; }
      try {
        const { error } = await supabase.functions.invoke('trackFunnelEvent', { body: item.event });
        if (error) throw error;
        remove(item);
      } catch (e) {
        const status = e?.context?.status;
        if (!status) return; // transport failure: keep the queue, retry later
        item.tries += 1;
        if ((status >= 400 && status < 500) || item.tries >= 3) {
          remove(item);
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
  // First load: deliver anything a previous page left behind (owned items only).
  void drain();
} catch { /* not in a browser */ }
