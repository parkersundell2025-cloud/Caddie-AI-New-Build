import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { alignRevenueCatAppUserId } from '@/lib/db';
import { identifyRevenueCatUser } from '@/lib/revenuecat';

const AuthContext = createContext();

// Shape the Supabase auth user like the old base44.auth.me() result.
const shapeUser = (u) => (u ? { ...u, role: u.app_metadata?.role ?? 'user' } : null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Reflect a Supabase session into context state. When there's no session we
  // expose authError.type === 'auth_required' so existing gate components
  // (RootRoute, ProtectedRoute) keep working unchanged.
  const applySession = (session) => {
    const u = shapeUser(session?.user ?? null);
    setUser(u);
    setIsAuthenticated(!!u);
    setAuthError(u ? null : { type: 'auth_required', message: 'Authentication required' });
    setIsLoadingAuth(false);
    setAuthChecked(true);
    // Fire-and-forget: cache the Supabase UUID on user_profile.revenuecat_app_user_id
    // so the RC webhook's fast lookup path matches future purchase/renewal/
    // cancellation events directly (instead of falling back to auth.admin.getUserById).
    // Idempotent + per-session cached internally; safe to call on every session tick.
    if (u) {
      alignRevenueCatAppUserId(u);
      // Native (iOS/Android): tell the RC SDK that the anonymous device
      // session now belongs to this Supabase UUID. RC merges any pre-login
      // purchases into the identified user — important when an iOS user
      // taps Subscribe from the SubscribeNow page before completing sign-in
      // (rare, but the SDK supports it). No-op on web.
      identifyRevenueCatUser(u.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) applySession(session);
    });

    // Fires on sign-in (incl. magic-link / OAuth redirect callbacks handled by
    // detectSessionInUrl), token refresh, and sign-out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    if (shouldRedirect) window.location.assign('/signin');
  };

  // AuthProvider sits above the Router, so use a hard navigation.
  const navigateToLogin = () => window.location.assign('/signin');

  // Kept for API compatibility with existing consumers; sessions are now
  // observed live via onAuthStateChange, so this just re-reads the session.
  const checkUserAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    applySession(session);
  };
  const checkAppState = checkUserAuth;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false, // legacy Base44 field, retained as no-op
      authError,
      appPublicSettings: null,        // legacy Base44 field, retained as no-op
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
