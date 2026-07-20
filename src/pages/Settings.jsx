import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Shield, User, Target, Gift, Trophy, MessageSquare,
  Bell, CreditCard, FileText, HelpCircle, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const GROUPS = [
  {
    title: 'Profile',
    rows: [
      { label: 'My Profile', id: 'profile', href: '/profile', icon: User },
      { label: 'Edit Profile', id: 'edit_profile', href: '/edit-profile', icon: Pencil },
      { label: 'My Club Distances', id: 'club_distances', href: '/club-distances', icon: Target },
    ],
  },
  {
    title: 'Community',
    rows: [
      { label: 'Refer a Friend — Earn Free Months', id: 'referral', href: '/referral', icon: Gift },
      { label: 'How the Leaderboard Works', id: 'leaderboard_info', href: '/leaderboard-info', icon: Trophy },
      { label: 'Send Feedback', id: 'feedback', href: '/send-feedback', icon: MessageSquare },
    ],
  },
  {
    title: 'Account',
    rows: [
      { label: 'Manage Subscription', id: 'subscription', href: '/manage-subscription', icon: CreditCard },
      { label: 'Notification Preferences', id: 'notifications', href: '/notifications', icon: Bell },
      { label: 'Privacy Policy', id: 'privacy', href: 'https://caddieaiapp.com/privacy', external: true, icon: Shield },
      { label: 'Terms of Service', id: 'terms', href: 'https://caddieaiapp.com/terms', external: true, icon: FileText },
      { label: 'Help and Support', id: 'support', href: 'mailto:retroplateco@gmail.com', icon: HelpCircle },
    ],
  },
];

function SettingsRow({ label, icon: Icon, onClick, divider, labelColor }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-[13px] active:opacity-80 transition-all min-h-[44px]"
      style={{ borderBottom: divider ? '1px solid rgba(244,239,227,.08)' : 'none' }}
    >
      <div
        className="w-[30px] h-[30px] rounded-[9px] bg-cut-card-solid text-cut-ink-soft flex items-center justify-center flex-shrink-0"
        style={{ border: '1px solid rgba(244,239,227,.08)' }}
      >
        <Icon className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </div>
      <span className={`flex-1 text-left text-sm font-medium ${labelColor || 'text-cut-ink'}`} style={{ letterSpacing: '-0.1px' }}>
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-cut-ink-mute" />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showConfirm, setShowConfirm] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        const rows = await unwrap(supabase.from('user_profile').select('first_name, user_email, created_date').eq('user_email', u.email));
        setProfile(rows[0] || null);
      } catch { /* card simply doesn't render */ }
    })();
  }, []);

  const memberSince = profile?.created_date ? `Member since '${String(new Date(profile.created_date).getFullYear()).slice(2)}` : null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const openItem = (item) => {
    if (item.external || item.href?.startsWith('mailto:')) {
      window.open(item.href, '_blank');
    } else if (item.href) {
      navigate(item.href);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4">
        <p className="cut-eyebrow text-cut-ink-mute">Caddie AI</p>
        <h1 className="cut-headline text-[30px] mt-1">
          <span className="italic text-cut-green">Settings</span><span className="text-cut-ink">.</span>
        </h1>
      </div>

      {/* Groups */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Profile hero card — mock's Settings header row */}
        {profile && (
          <div className="cut-glass p-4 flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-cut-cream cut-headline italic text-2xl"
              style={{ background: 'linear-gradient(135deg, #0E4D2B, #5FBE7E)', boxShadow: '0 0 14px rgba(95,190,126,.30)' }}
            >
              {(profile.first_name || 'G')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="cut-headline text-cut-ink text-[19px] truncate" style={{ letterSpacing: '-0.3px' }}>{profile.first_name || 'Golfer'}</p>
              <p className="text-xs text-cut-ink-soft mt-0.5 truncate">{profile.user_email}</p>
              {memberSince && <p className="text-[11px] text-cut-ink-mute mt-0.5">{memberSince}</p>}
            </div>
            <button
              onClick={() => navigate('/edit-profile')}
              className="px-3 py-1.5 rounded-xl bg-cut-card-solid text-cut-green text-[11px] font-bold flex-shrink-0 active:scale-95 transition-all"
              style={{ border: '1px solid rgba(244,239,227,.08)' }}
            >
              Edit
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="cut-glass overflow-hidden">
            <SettingsRow label="Admin Tools" icon={Shield} onClick={() => navigate('/admin')} labelColor="text-cut-green" />
          </div>
        )}

        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="cut-eyebrow text-cut-ink-mute mb-2 pl-1.5">{group.title}</p>
            <div className="cut-glass overflow-hidden">
              {group.rows.map((item, i) => (
                <SettingsRow
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  onClick={() => openItem(item)}
                  divider={i < group.rows.length - 1}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-95 min-h-[44px] cut-glass"
          style={{ color: '#E5695E' }}
        >
          Sign Out
        </button>

        {/* Footer wordmark */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-4 text-[11px] text-cut-ink-mute" style={{ letterSpacing: '0.3px' }}>
          <span className="font-fraunces font-medium text-cut-ink-soft text-[13px]" style={{ letterSpacing: '-0.02em' }}>
            Caddie <span className="text-[9px] uppercase">AI</span>
          </span>
        </div>
      </div>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={e => e.target === e.currentTarget && setShowConfirm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26 }}
              className="w-full max-w-lg mx-auto bg-background rounded-t-3xl px-6 pt-6 pb-10 space-y-5"
              style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 2rem)' }}
            >
              <div className="text-center space-y-2">
                <h3 className="cut-headline text-cut-ink text-xl">Sign Out?</h3>
                <p className="text-sm text-cut-ink-mute">Are you sure you want to sign out of your account?</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-95"
                style={{ backgroundColor: '#E5695E', color: '#0B0F0C' }}
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 rounded-2xl text-sm font-semibold bg-muted text-foreground transition-all active:scale-95"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
