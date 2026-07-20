import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import SmartPopupController from '@/components/popups/SmartPopupController';
import Logo from './Logo';
import { ChevronLeft, Settings, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';

// Header bell → notification inbox, with an unread dot. One cheap
// single-row query per navigation; failures just hide the dot.
function InboxBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user || cancelled) return;
        const rows = await unwrap(
          supabase.from('notification').select('id')
            .eq('user_email', user.email).eq('read', false).limit(1)
        );
        if (!cancelled) setHasUnread(rows.length > 0);
      } catch {
        if (!cancelled) setHasUnread(false);
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  return (
    <button
      onClick={() => navigate('/inbox')}
      className="relative w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-all"
      aria-label="Notifications"
    >
      <Bell className="w-4 h-4 text-muted-foreground" />
      {hasUnread && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cut-gold"
          style={{ boxShadow: '0 0 6px rgba(217,177,74,.6)' }}
        />
      )}
    </button>
  );
}

// Root tab paths — show logo, no back button
const ROOT_PATHS = ['/', '/plan', '/progress', '/coach', '/leaderboard', '/profile'];

// Sub-screen config: path → { title, backTo }
const SUB_SCREENS = {
  // Settings renders its own serif page header, so the global header shows only Back
  '/settings':             { title: '',                     backTo: '/home' },
  '/edit-profile':         { title: 'Edit Profile',         backTo: '/settings' },
  '/referral':             { title: 'Refer a Friend',       backTo: '/settings' },
  '/notifications':        { title: 'Notification Preferences', backTo: '/settings' },
  '/leaderboard-info':     { title: 'How It Works',         backTo: '/settings' },
  '/manage-subscription':  { title: 'Manage Subscription',  backTo: '/settings' },
  '/cancel-subscription':  { title: 'Cancel Subscription',  backTo: '/manage-subscription' },
  // Inbox renders its own serif page header, like /settings
  '/inbox':                { title: '',                     backTo: '/home' },

};

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Theme lives on <html> so Radix portals (dialogs, toasts) inherit it.
  // Public pages (/welcome, legal) never mount AppLayout and keep the old
  // theme until Parker's release call.
  useEffect(() => {
    document.documentElement.classList.add('theme-cut');
    return () => document.documentElement.classList.remove('theme-cut');
  }, []);

  const isRoot = ROOT_PATHS.includes(location.pathname);
  const subScreen = SUB_SCREENS[location.pathname];
  const isSubScreen = !!subScreen;

  // Show settings gear only on root tabs (except /profile which has its own edit button)
  const showSettingsGear = isRoot && location.pathname !== '/profile';
  const showLogoHeader = isRoot;

  const handleBack = () => {
    if (subScreen?.backTo) {
      navigate(subScreen.backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className="h-[100dvh] bg-background cut-ground max-w-lg mx-auto relative flex flex-col"
      style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}
    >
      {/* Global Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 h-14 flex-shrink-0"
        style={{ top: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}
      >
        {isSubScreen ? (
          <>
            <button
              onClick={handleBack}
              className="flex items-center gap-1 -ml-1 active:scale-95 transition-all min-w-[44px]"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
              <span className="text-sm font-semibold text-foreground">Back</span>
            </button>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-black text-foreground truncate max-w-[55%] text-center" style={{ letterSpacing: '-0.3px' }}>
              {subScreen.title}
            </h1>
            <div className="min-w-[44px]" />
          </>
        ) : (
          <>
            <Logo size="sm" />
            <div className="flex items-center gap-2">
              <InboxBell />
              {showSettingsGear && (
                <button
                  onClick={() => navigate('/settings')}
                  className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-all"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 6rem)' }}>
        <Outlet />
      </main>

      <BottomNav />
      <SmartPopupController />
    </div>
  );
}