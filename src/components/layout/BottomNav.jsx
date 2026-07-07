import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, TrendingUp, MessageCircle, Trophy } from 'lucide-react';

/**
 * BOTTOM NAV SPECIFICATIONS — DO NOT MODIFY WITHOUT CARE
 * - 5 tabs: Home, My Plan, Progress, Coach, Leaderboard
 * - Icons: exactly 24x24px (use w-6 h-6)
 * - Labels: max 10px font (use text-[10px])
 * - Labels on single line — "My Plan" must not wrap
 * - Tab spacing: equal/flex across full width
 * - Height: 60px fixed (h-15 in Tailwind, plus safe-area padding)
 * - Active tab: primary green (text-foreground) icon + label
 * - Inactive tabs: muted grey (text-muted-foreground)
 * - No borders, dividers, or gaps between tabs
 * - Dark background matching app (bg-background)
 */

const TABS = [
  { label: 'Home', icon: Home, path: '/home', dataAttr: 'home' },
  { label: 'My Plan', icon: ClipboardList, path: '/plan', dataAttr: 'plan' },
  { label: 'Progress', icon: TrendingUp, path: '/progress', dataAttr: 'progress' },
  { label: 'Coach', icon: MessageCircle, path: '/coach', dataAttr: 'coach' },
  { label: 'Leaderboard', icon: Trophy, path: '/leaderboard', dataAttr: 'leaderboard' },
];

export default function BottomNav() {
  const location = useLocation();

  const getScrollElement = () => {
    return document.querySelector('[role="main"]') || window;
  };

  const saveScrollPosition = () => {
    const element = getScrollElement();
    const scrollTop = element === window ? window.scrollY : element.scrollTop;
    sessionStorage.setItem(`scroll-${location.pathname}`, scrollTop.toString());
  };

  const restoreScrollPosition = () => {
    const element = getScrollElement();
    const scrollTop = parseInt(sessionStorage.getItem(`scroll-${location.pathname}`) || '0', 10);
    if (element === window) {
      window.scrollTo(0, scrollTop);
    } else {
      element.scrollTop = scrollTop;
    }
  };

  useEffect(() => {
    restoreScrollPosition();
  }, [location.pathname]);

  const handleTabClick = (newPath) => {
    if (newPath === location.pathname) {
      // Same tab — scroll to top
      const element = getScrollElement();
      if (element === window) {
        window.scrollTo(0, 0);
      } else {
        element.scrollTop = 0;
      }
    } else {
      // Different tab — save scroll and navigate
      saveScrollPosition();
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-15 bg-background flex justify-between items-center" style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)))' }}>
      {TABS.map(({ label, icon: Icon, path, dataAttr }) => {
        const active = isActive(path);
        return (
          <Link
            key={path}
            to={path}
            onClick={() => handleTabClick(path)}
            data-nav-tab={dataAttr}
            className={`flex-1 flex flex-col items-center justify-center h-full py-2.5 transition-all active:scale-95 ${
              active
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}