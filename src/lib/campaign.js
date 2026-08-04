import { APP_STORE_URL } from '@/lib/shareConfig';

// Meta ads → landing page → App Store attribution relay (scope item 3c).
// Traffic-objective ads can't link straight to the store, so the ad lands on
// /welcome?c=<campaign> and the App Store button carries the tag through as
// Apple's ct= campaign token (App Analytics → Sources → Campaigns).
// Persisted so the tag survives browsing before the badge tap.
const STORAGE_KEY = 'caddie_campaign';

export function captureCampaignFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('c') || params.get('utm_campaign');
    if (tag && /^[\w-]{1,64}$/.test(tag)) {
      localStorage.setItem(STORAGE_KEY, tag);
    }
  } catch { /* storage unavailable — attribution degrades gracefully */ }
}

export function getCampaign() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

// Apple ignores ct= unless pt= (App Analytics provider token, constant per
// developer account) and mt=8 are also present — verified against Apple's
// campaign-link format after ASC showed no campaign data on ct-only links.
const APPLE_PROVIDER_TOKEN = '128810539';

export function getAppStoreUrl() {
  const tag = getCampaign();
  return tag
    ? `${APP_STORE_URL}?pt=${APPLE_PROVIDER_TOKEN}&ct=${encodeURIComponent(tag)}&mt=8`
    : APP_STORE_URL;
}

// Fires the Pixel event Meta conversion campaigns can optimize on.
export function trackAppStoreClick(placement) {
  try {
    if (window.fbq) {
      window.fbq('trackCustom', 'AppStoreClick', {
        campaign: getCampaign() || 'organic',
        placement,
      });
    }
  } catch { /* never block the navigation */ }
}

// Play's campaign analog: the referrer param carries UTM values through the
// install (Play Console → acquisition UTM tracking), mirroring Apple's ct=.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.caddieaiapp.app';

export function getPlayStoreUrl() {
  const tag = getCampaign();
  if (!tag) return PLAY_STORE_URL;
  const referrer = encodeURIComponent(`utm_source=caddieai_welcome&utm_medium=web&utm_campaign=${tag}`);
  return `${PLAY_STORE_URL}&referrer=${referrer}`;
}

export function trackPlayStoreClick(placement) {
  try {
    if (window.fbq) {
      window.fbq('trackCustom', 'PlayStoreClick', {
        campaign: getCampaign() || 'organic',
        placement,
      });
    }
  } catch { /* never block the navigation */ }
}
