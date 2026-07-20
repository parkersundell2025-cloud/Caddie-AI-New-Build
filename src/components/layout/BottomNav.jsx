import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, TrendingUp, Sparkles, Trophy } from 'lucide-react';

/**
 * BOTTOM NAV — "The Cut" (Phase 0 locked design)
 * - Floating glass pill bar, 14px inset from edges, above the home indicator
 * - Active tab: green pill, icon + label inline, soft glow
 * - Inactive tabs: icon only, muted cream
 * - Tab names per the locked design: Today / Plan / Progress / Caddie / Club
 * - Routes and data-nav-tab attrs are unchanged (tour + popups target them)
 */

const TABS = [
  { label: 'Today', icon: Home, path: '/home', dataAttr: 'home' },
  { label: 'Plan', icon: CalendarDays, path: '/plan', dataAttr: 'plan' },
  { label: 'Progress', icon: TrendingUp, path: '/progress', dataAttr: 'progress' },
  { label: 'Caddie', icon: Sparkles, path: '/coach', dataAttr: 'coach' },
  { label: 'Club', icon: Trophy, path: '/leaderboard', dataAttr: 'leaderboard' },
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
    <nav
      className="fixed left-0 right-0 mx-auto h-[62px] rounded-3xl flex items-center justify-around px-1 z-40"
      style={{
        bottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 14px)',
        width: 'calc(min(100%, 32rem) - 28px)',
        background: 'rgba(20,26,23,.78)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(244,239,227,.10)',
        boxShadow: '0 16px 32px rgba(0,0,0,.45)',
      }}
    >
      {TABS.map(({ label, icon: Icon, path, dataAttr }) => {
        const active = isActive(path);
        return (
          <Link
            key={path}
            to={path}
            onClick={() => handleTabClick(path)}
            data-nav-tab={dataAttr}
            className={`flex items-center justify-center gap-1.5 rounded-[18px] transition-all active:scale-95 ${
              active
                ? 'flex-none px-3.5 py-[7px] bg-cut-green text-cut-bg'
                : 'flex-1 py-[7px] text-cut-ink-mute'
            }`}
            style={active ? { boxShadow: '0 0 18px rgba(95,190,126,.30)' } : undefined}
          >
            <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.2 : 1.8} />
            {active && (
              <span className="text-xs font-bold whitespace-nowrap" style={{ letterSpacing: '-0.1px' }}>
                {label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}