import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { AnimatePresence, motion } from 'framer-motion';
import { initializeAppSession } from '@/lib/appSessionState';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNative, NATIVE_URL_SCHEME } from '@/lib/platform';
import { configureRevenueCat } from '@/lib/revenuecat';
import { initMetaPixelWithATT } from '@/lib/meta-pixel';
import { addPushTappedListener } from '@/lib/push-notifications';
import { captureRefFromUrl } from '@/lib/affiliate-attribution';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { WifiOff } from 'lucide-react';


// Page imports
import Welcome from './pages/Welcome';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Onboarding from './pages/Onboarding';
import SignIn from './pages/SignIn';
import Home from './pages/Home';
import MyPlan from './pages/MyPlan.jsx';
import Progress from './pages/Progress';
import Coach from './pages/Coach';
import Profile from './pages/Profile';
import AppLayout from './components/layout/AppLayout';
import Settings from './pages/Settings';
import ManageSubscription from './pages/ManageSubscription';
import CancelSubscription from './pages/CancelSubscription';
import Logo from './components/layout/Logo';
import NotificationPreferences from './pages/NotificationPreferences';
import EditProfile from './pages/EditProfile';
import Referral from './pages/Referral';

import SubscriptionGate from './components/SubscriptionGate';
import SmartPopupController from './components/popups/SmartPopupController';
import Leaderboard from './pages/Leaderboard';
import LeaderboardInfo from './pages/LeaderboardInfo';
import AdminFlagged from './pages/AdminFlagged';
import SendFeedback from './pages/SendFeedback';
import AdminFeedback from './pages/AdminFeedback';
import AdminWaitlistCredits from './pages/AdminWaitlistCredits';
import AdminFixUser from './pages/AdminFixUser';
import AdminAffiliates from './pages/AdminAffiliates';
import AdminAffiliateNew from './pages/AdminAffiliateNew';
import AdminAffiliateDetail from './pages/AdminAffiliateDetail';
import AdminAffiliatePayouts from './pages/AdminAffiliatePayouts';
import AffiliateLogin from './pages/AffiliateLogin';
import AffiliateDashboard from './pages/AffiliateDashboard';
import ClubDistances from './pages/ClubDistances';
import SubscriptionCheckout from './pages/SubscriptionCheckout';
import CreateAccount from './pages/CreateAccount';
import Checkout from './pages/SubscriptionCheckout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CustomerPortal from './pages/CustomerPortal';
import SubscribeNow from './pages/SubscribeNow';
import Gateway from './pages/Gateway';
import AutoLogin from './pages/AutoLogin';

// Root route: unauthenticated → /signin, authenticated + incomplete → /onboarding, authenticated + no subscription → /subscribe-now, authenticated + complete + subscribed → /home
function RootRoute() {
  const { isLoadingAuth, authError } = useAuth();
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    if (isLoadingAuth) return;
    const isAuthenticated = !authError || authError.type !== 'auth_required';
    if (!isAuthenticated) {
      console.log('[RootRoute] Not authenticated, redirecting to /signin');
      setDestination('/signin');
      return;
    }
    console.log('[RootRoute] GATE CHECK STARTED for authenticated user');
    getCurrentUser().then(user => {
      if (!user) { setDestination('/signin'); return; }
      console.log('[RootRoute] Current user:', user);
      unwrap(
        supabase.from('user_profile').select('*').eq('user_email', user.email)
      ).then((profiles) => {
        const profile = profiles[0];
        const today = new Date().toISOString().split('T')[0];
        
        console.log('[RootRoute] UserProfile found:', profile);
        console.log('[RootRoute] Profile subscription_status:', profile?.subscription_status);
        console.log('[RootRoute] Profile stripe_subscription_id:', profile?.stripe_subscription_id);
        
        // Step 1: No UserProfile exists. Before bouncing to /subscribe-now,
        // check if this signed-in email belongs to an affiliate. If it does,
        // they're an influencer signing in to their dashboard (typical magic-
        // link redirect overrides routed them through /). Otherwise it's a
        // would-be app user without a subscription yet.
        if (!profile) {
          unwrap(supabase.from('affiliate').select('id').limit(1)).then(affs => {
            if (affs && affs.length > 0) {
              console.log('[RootRoute] NO PROFILE + affiliate row exists -> /affiliate/dashboard');
              setDestination('/affiliate/dashboard');
            } else {
              console.log('[RootRoute] NO PROFILE - redirecting to /subscribe-now');
              setDestination('/subscribe-now');
            }
          }).catch(() => {
            setDestination('/subscribe-now');
          });
          return;
        }
        
        // Onboarding not complete → /onboarding
        if (!profile.onboarding_complete) {
          console.log('[RootRoute] Onboarding not complete - redirecting to /onboarding');
          setDestination('/onboarding');
          return;
        }
        
        // Step 2: Check subscription status on UserProfile.
        // Payment linkage = either a Stripe customer (web flow) OR a RevenueCat
        // app user id (native iOS/Android via Apple IAP / Google Play Billing).
        // Has to mirror SubscriptionGate.hasActiveSubscription — otherwise a
        // RevenueCat-linked paid user lands on / and gets bounced to
        // /subscribe-now (visible after Apple IAP launches).
        const hasPaymentLinkage = !!profile.stripe_customer_id || !!profile.revenuecat_app_user_id;
        const isPaidSub = hasPaymentLinkage
          && (profile.subscription_status === 'basic' || profile.subscription_status === 'pro');
        const isValidTrial = profile.subscription_status === 'trial' &&
          profile.trial_start_date &&
          profile.trial_end_date &&
          profile.trial_end_date >= today;
        // 'cancelling' = scheduled cancel-at-period-end. Still has paid access
        // until the period end date. Grant access.
        const isCancellingButActive = profile.subscription_status === 'cancelling'
          && (!profile.trial_end_date || profile.trial_end_date >= today);
        // Grace period: fresh-signup trial users who haven't yet been linked to
        // a Stripe subscription. trial_start_date / trial_end_date / today are
        // all 'YYYY-MM-DD' strings — string comparison is correct here and
        // avoids the UTC-midnight footgun that bit getTrialDaysRemaining.
        const isGracePeriod = profile.subscription_status === 'trial' &&
          profile.trial_start_date &&
          profile.trial_end_date &&
          profile.trial_end_date >= today &&
          !profile.stripe_subscription_id &&
          profile.trial_start_date >= today;
        
        console.log('[RootRoute] isPaidSub:', isPaidSub);
        console.log('[RootRoute] isValidTrial:', isValidTrial);
        console.log('[RootRoute] isGracePeriod:', isGracePeriod);
        console.log('[RootRoute] isCancellingButActive:', isCancellingButActive);

        if (isPaidSub || isValidTrial || isGracePeriod || isCancellingButActive) {
          console.log('[RootRoute] Active subscription/trial - redirecting to /home');
          setDestination('/home');
          return;
        }
        
        // Everything else → /subscribe-now
        console.log('[RootRoute] No active subscription - redirecting to /subscribe-now');
        setDestination('/subscribe-now');
      })
    }).catch(err => {
      console.log('[RootRoute] Error during gate check:', err);
      setDestination('/signin');
    });
  }, [isLoadingAuth, authError]);

  if (!destination) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
        <Logo size="lg" />
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  return <Navigate to={destination} replace />;
}

// Gate that protects app routes: if onboarding not complete, send back to /onboarding
function OnboardingGate({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) { window.location.assign('/signin'); return; }
        const profiles = await unwrap(
          supabase.from('user_profile').select('*').eq('user_email', user.email)
        );
        if (profiles.length === 0 || !profiles[0].onboarding_complete) {
          setStatus('onboarding');
        } else {
          setStatus('ready');
        }
      } catch (e) {
        window.location.assign('/signin');
      }
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
        <Logo size="lg" />
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

const ProtectedRoute = ({ children }) => {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
        <Logo size="lg" />
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return children;
};

const AuthenticatedApp = () => {
  const location = useLocation();
  const publicPages = ['/welcome', '/signin', '/create-account', '/signup', '/signup/success', '/billing', '/privacy', '/terms', '/checkout', '/checkout/success', '/customerportal', '/gateway', '/subscribe-now'];
  const isPublicPage = publicPages.includes(location.pathname);

  useEffect(() => {
    if (!isPublicPage) {
      initializeAppSession();
    }
  }, [isPublicPage]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          style={{ position: 'relative' }}
        >
          <Routes location={location}>
            {/* Root → always /onboarding */}
            <Route path="/" element={<RootRoute />} />

            {/* Public pages — no auth required */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/create-account" element={<CreateAccount />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/customerportal" element={<CustomerPortal />} />
            <Route path="/subscribe-now" element={<SubscribeNow />} />
            <Route path="/gateway" element={<Gateway />} />
            <Route path="/autologin" element={<AutoLogin />} />
            {/* Affiliate self-serve. Public routes — own gate logic in the components. */}
            <Route path="/affiliate/login" element={<AffiliateLogin />} />
            <Route path="/affiliate/dashboard" element={<AffiliateDashboard />} />

            {/* Onboarding — handles sign-in, new user questions, and redirect to /home when done */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Protected app routes */}
            <Route path="/notifications" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
            <Route path="/send-feedback" element={<ProtectedRoute><SendFeedback /></ProtectedRoute>} />
            <Route path="/admin/flagged" element={<ProtectedRoute><AdminFlagged /></ProtectedRoute>} />
            <Route path="/admin/feedback" element={<ProtectedRoute><AdminFeedback /></ProtectedRoute>} />
            <Route path="/admin/waitlist-credits" element={<ProtectedRoute><AdminWaitlistCredits /></ProtectedRoute>} />
            <Route path="/admin/fix-user" element={<ProtectedRoute><AdminFixUser /></ProtectedRoute>} />
            <Route path="/admin/affiliates" element={<ProtectedRoute><AdminAffiliates /></ProtectedRoute>} />
            <Route path="/admin/affiliates/new" element={<ProtectedRoute><AdminAffiliateNew /></ProtectedRoute>} />
            <Route path="/admin/affiliates/payouts" element={<ProtectedRoute><AdminAffiliatePayouts /></ProtectedRoute>} />
            <Route path="/admin/affiliates/:id" element={<ProtectedRoute><AdminAffiliateDetail /></ProtectedRoute>} />
            <Route path="/club-distances" element={<ProtectedRoute><ClubDistances /></ProtectedRoute>} />
            <Route
              element={
                <ProtectedRoute>
                  <SubscriptionGate>
                    <OnboardingGate>
                      <AppLayout />
                    </OnboardingGate>
                  </SubscriptionGate>
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<MyPlan />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/leaderboard-info" element={<LeaderboardInfo />} />
              <Route path="/manage-subscription" element={<ManageSubscription />} />
              <Route path="/cancel-subscription" element={<CancelSubscription />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

    </>
  );
};

// On Capacitor, the iOS in-app browser closes when Stripe / Supabase redirects
// back to the app — either via our caddieai:// custom scheme OR via Universal
// Links from https://caddieaiapp.com/. iOS hands the URL to the App plugin,
// which fires appUrlOpen with the same shape regardless of how it arrived.
// We dismiss the SafariViewController, complete any pending Supabase auth
// session exchange (PKCE code or implicit-hash tokens), then navigate the
// SPA. No-op on web.
//
// Universal Links are the preferred production path (no "Open in Caddie AI?"
// prompt, domain-verified), but they require:
//   1. apple-app-site-association file served at caddieaiapp.com/.well-known/
//   2. Associated Domains entitlement on the iOS app
//   3. DNS pointing at our Vercel deploy
// Until all three converge, the caddieai:// scheme is the working path.
// Both work in parallel — this router handles whichever URL arrives.
const URL_PREFIXES = [
  `${NATIVE_URL_SCHEME}://`,
  'https://caddieaiapp.com/',
];

function DeepLinkRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    let handle;
    const register = async () => {
      handle = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url) return;
        const prefix = URL_PREFIXES.find((p) => url.startsWith(p));
        if (!prefix) return;
        try { await Browser.close(); } catch { /* may already be closed */ }

        // Manual parse instead of new URL() — URL constructor splits custom
        // schemes inconsistently across engines (some put authority in host,
        // some in pathname). caddieai://gateway?code=x#hash →
        //   pathPart='gateway', searchStr='code=x', hashStr='hash'
        // For Universal Links the same parse works:
        //   https://caddieaiapp.com/gateway?code=x → pathPart='gateway', ...
        const afterScheme = url.slice(prefix.length).replace(/^\/+/, '');
        const [pathAndQuery, hashStr = ''] = afterScheme.split('#');
        const [pathPart = '', searchStr = ''] = pathAndQuery.split('?');
        const search = new URLSearchParams(searchStr);
        const hash = new URLSearchParams(hashStr);

        // PKCE: ?code=xxx — exchange for a real session. supabase-js stored
        // the code_verifier in localStorage from the original signInWithOtp /
        // signInWithOAuth call, so the same client instance can complete it.
        if (search.has('code')) {
          try {
            await supabase.auth.exchangeCodeForSession(search.get('code'));
          } catch (e) {
            console.warn('[DeepLinkRouter] exchangeCodeForSession failed:', e?.message);
          }
        } else {
          // Implicit: tokens in URL hash. Manually setSession.
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          if (access_token && refresh_token) {
            try {
              await supabase.auth.setSession({ access_token, refresh_token });
            } catch (e) {
              console.warn('[DeepLinkRouter] setSession failed:', e?.message);
            }
          }
        }

        // Affiliate ref capture — if the inbound URL carries ?ref=CODE,
        // stash it (fire-and-forget). Validation happens server-side; bad
        // codes silently no-op. Done before stripping the param so we don't
        // miss it, but the param is dropped from the SPA navigate below.
        if (search.has('ref')) {
          captureRefFromUrl('?' + searchStr).catch(() => { /* logged inside */ });
        }

        // Strip auth + ref params before SPA navigate — they've been consumed
        // and shouldn't leak into Gateway's view. Keep any other query params.
        ['code', 'error', 'error_description', 'ref'].forEach((k) => search.delete(k));
        const cleanSearch = search.toString();
        const path = '/' + pathPart + (cleanSearch ? `?${cleanSearch}` : '');
        navigate(path, { replace: true });
      });
    };
    register();
    return () => { handle?.remove?.(); };
  }, [navigate]);
  return null;
}

// Configure RevenueCat once at app boot. Idempotent + safe on web; the wrapper
// no-ops when isNative() is false or the API key is missing. Doing this once
// up front means the SDK's internal customerInfo cache warms up before the
// user reaches /subscribe-now, so the first plan-button tap doesn't pay the
// cold-start latency.
function RevenueCatBoot() {
  useEffect(() => {
    configureRevenueCat();
  }, []);
  return null;
}

// Initialize Meta Pixel once at app boot, gated on iOS App Tracking
// Transparency permission. On web the Pixel loads immediately; on iOS the
// ATT dialog is shown the first time and Pixel only loads if the user
// authorizes tracking. The init is one-time per app launch — subsequent
// calls (e.g., from Strict Mode double-fire in dev) are no-ops.
function MetaPixelBoot() {
  useEffect(() => {
    initMetaPixelWithATT();
  }, []);
  return null;
}

// Read ?ref=CODE from the boot URL (when an influencer link drops the user
// onto the marketing site) and stash it in localStorage. The DeepLinkRouter
// handles the native deep-link case; this covers the web path only. Fires
// once per page load; subsequent navigations don't re-capture because the
// URL doesn't carry ?ref anymore. localStorage persists across reloads, so
// signup attribution still works after a page reload or several days of
// browsing.
function AffiliateRefBoot() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { search } = window.location;
    if (!search || !search.includes('ref=')) return;
    captureRefFromUrl(search).catch(() => { /* logged inside */ });
  }, []);
  return null;
}

// When the user taps a push notification, iOS opens our app and fires
// pushNotificationActionPerformed with the notification's payload. If the
// payload carries a `url` field shaped like the caddieai:// scheme, route it
// through the same path-parsing pipeline DeepLinkRouter uses for inbound
// browser deep-links — gives push payloads a single canonical way to deep-link
// (`data: { url: "caddieai://plan" }` from the sendPushNotification body).
function PushTapRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    const prefix = `${NATIVE_URL_SCHEME}://`;
    let handle;
    const register = async () => {
      handle = await addPushTappedListener((event) => {
        const url = event?.notification?.data?.url;
        if (typeof url !== 'string' || !url.startsWith(prefix)) return;
        const afterScheme = url.slice(prefix.length).replace(/^\/+/, '');
        const [pathAndQuery] = afterScheme.split('#');
        const [pathPart = '', searchStr = ''] = pathAndQuery.split('?');
        const path = '/' + pathPart + (searchStr ? `?${searchStr}` : '');
        navigate(path);
      });
    };
    register();
    return () => { handle?.remove?.(); };
  }, [navigate]);
  return null;
}

// Routes that render on the brand dark-green background — need light status
// bar text (white) to stay legible. Everything else is light-bg → dark text.
// Keep the gateway / auth funnel routes here even though they redirect quickly:
// the status bar style applies during the brief render before navigation.
const DARK_BG_ROUTES = new Set([
  '/', '/welcome', '/signin', '/create-account', '/onboarding',
  '/subscribe-now', '/checkout', '/checkout/success', '/gateway', '/autologin',
  '/customerportal',
]);

function StatusBarController() {
  const location = useLocation();
  useEffect(() => {
    if (!isNative()) return;
    const isDarkBg = DARK_BG_ROUTES.has(location.pathname);
    StatusBar.setStyle({ style: isDarkBg ? Style.Light : Style.Dark }).catch(() => {});
  }, [location.pathname]);
  return null;
}

// One-time keyboard configuration. Native resize mode is the safer default
// vs. ionic/body — iOS adjusts the WebView viewport when the keyboard slides
// in, so fixed-position elements (sticky save buttons, bottom nav) reflow
// instead of being covered. Accessory bar (the Done/Next toolbar) hidden for
// a cleaner look — most inputs don't benefit from it.
function KeyboardConfigurer() {
  useEffect(() => {
    if (!isNative()) return;
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
    Keyboard.setStyle({ style: KeyboardStyle.Default }).catch(() => {});
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }, []);
  return null;
}

// Thin banner that appears at the top when the device loses connectivity.
// Critical for golf-course UX — users on cellular dead zones need clear
// signal that requests will fail. Works on both native (Network plugin) and
// web (navigator.onLine + window online/offline events).
function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (!isNative()) {
      const update = () => setOnline(navigator.onLine);
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }
    Network.getStatus().then((s) => setOnline(s.connected)).catch(() => {});
    let handle;
    Network.addListener('networkStatusChange', (s) => setOnline(s.connected))
      .then((h) => { handle = h; })
      .catch(() => {});
    return () => { handle?.remove?.(); };
  }, []);

  if (online) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-xs font-semibold"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <WifiOff className="w-3.5 h-3.5" />
      You're offline
    </div>
  );
}

function ColorSchemeWatcher() {
  useEffect(() => {
    const apply = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ColorSchemeWatcher />
          <RevenueCatBoot />
          <MetaPixelBoot />
          <AffiliateRefBoot />
          <KeyboardConfigurer />
          <StatusBarController />
          <DeepLinkRouter />
          <PushTapRouter />
          <OfflineBanner />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;