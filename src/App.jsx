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
import AccountScreen from './pages/AccountScreen';
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
        
        // Step 1: No UserProfile exists → user has not subscribed yet → /subscribe-now
        if (!profile) {
          console.log('[RootRoute] NO PROFILE - redirecting to /subscribe-now');
          setDestination('/subscribe-now');
          return;
        }
        
        // Onboarding not complete → /onboarding
        if (!profile.onboarding_complete) {
          console.log('[RootRoute] Onboarding not complete - redirecting to /onboarding');
          setDestination('/onboarding');
          return;
        }
        
        // Step 2: Check subscription status on UserProfile
        const isPaidSub = (profile.subscription_status === 'basic' || profile.subscription_status === 'pro') && profile.stripe_subscription_id;
        const isValidTrial = profile.subscription_status === 'trial' &&
          profile.trial_start_date &&
          profile.trial_end_date &&
          profile.trial_end_date >= today;
        // 'cancelling' = scheduled cancel-at-period-end. Still has paid access
        // until the period end date. Grant access.
        const isCancellingButActive = profile.subscription_status === 'cancelling'
          && (!profile.trial_end_date || profile.trial_end_date >= today);
        const isGracePeriod = profile.subscription_status === 'trial' && 
          profile.trial_start_date && 
          profile.trial_end_date && 
          profile.trial_end_date >= today && 
          !profile.stripe_subscription_id && 
          new Date(profile.trial_start_date) >= new Date(today.split('-').map((x, i) => i === 0 ? parseInt(x) - 0 : x).join('-'));
        
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

            {/* Onboarding — handles sign-in, new user questions, and redirect to /home when done */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Protected app routes */}
            <Route path="/notifications" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountScreen /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
            <Route path="/send-feedback" element={<ProtectedRoute><SendFeedback /></ProtectedRoute>} />
            <Route path="/admin/flagged" element={<ProtectedRoute><AdminFlagged /></ProtectedRoute>} />
            <Route path="/admin/feedback" element={<ProtectedRoute><AdminFeedback /></ProtectedRoute>} />
            <Route path="/admin/waitlist-credits" element={<ProtectedRoute><AdminWaitlistCredits /></ProtectedRoute>} />
            <Route path="/admin/fix-user" element={<ProtectedRoute><AdminFixUser /></ProtectedRoute>} />
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

// On Capacitor, the iOS in-app browser closes when Stripe redirects to our
// caddieai:// success_url; iOS hands the URL to the App plugin, which fires
// appUrlOpen. We strip the scheme, navigate the SPA, and dismiss the
// SafariViewController if it lingered. No-op on web.
function DeepLinkRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    const prefix = `${NATIVE_URL_SCHEME}://`;
    let handle;
    const register = async () => {
      handle = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url || !url.startsWith(prefix)) return;
        const path = '/' + url.slice(prefix.length).replace(/^\/+/, '');
        try { await Browser.close(); } catch { /* may already be closed */ }
        navigate(path, { replace: true });
      });
    };
    register();
    return () => { handle?.remove?.(); };
  }, [navigate]);
  return null;
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
          <DeepLinkRouter />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;