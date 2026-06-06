import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AnimatePresence, motion } from 'framer-motion';

const MENU_ITEMS = [
  { label: 'My Profile', id: 'profile', href: '/profile' },
  { label: 'My Club Distances', id: 'club_distances', href: '/club-distances' },
  { label: 'Refer a Friend — Earn Free Months', id: 'referral', href: '/referral' },
  { label: 'How the Leaderboard Works', id: 'leaderboard_info', href: '/leaderboard-info' },
  { label: 'Send Feedback', id: 'feedback', href: '/send-feedback' },
  { label: 'Notification Preferences', id: 'notifications', href: '/notifications' },
  { label: 'Privacy Policy', id: 'privacy', href: 'https://caddieaiapp.com/privacy', external: true },
  { label: 'Terms of Service', id: 'terms', href: 'https://caddieaiapp.com/terms', external: true },
  { label: 'Help and Support', id: 'support', href: 'mailto:retroplateco@gmail.com' },
];

export default function Settings() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header spacer — title shown in AppLayout global header */}
      <div className="pt-2" />

      {/* Menu Items */}
      <div className="flex-1 px-5 py-4 space-y-0">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.external || item.href?.startsWith('mailto:')) {
                window.open(item.href, '_blank');
              } else if (item.href) {
                navigate(item.href);
              }
            }}
            className="w-full flex items-center justify-between py-4 px-3 text-foreground border-b border-border hover:bg-muted/30 transition-all active:scale-95 min-h-[44px]"
          >
            <span className="font-medium text-sm">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Account Section */}
      <div className="border-t border-border">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account</p>
          <button
            onClick={() => navigate('/edit-profile')}
            className="w-full flex items-center justify-between py-4 px-3 text-foreground border-b border-border hover:bg-muted/30 transition-all active:scale-95 min-h-[44px]"
          >
            <span className="font-medium text-sm">Edit Profile</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/manage-subscription')}
            className="w-full flex items-center justify-between py-4 px-3 text-foreground border-b border-border hover:bg-muted/30 transition-all active:scale-95 min-h-[44px]"
          >
            <span className="font-medium text-sm">Manage Subscription</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="px-5 pb-10 pt-2">
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-95 min-h-[44px]"
          style={{ backgroundColor: 'hsl(var(--muted))', color: '#ef4444' }}
        >
          Sign Out
        </button>
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
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
            >
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-foreground">Sign Out?</h3>
                <p className="text-sm text-muted-foreground">Are you sure you want to sign out of your account?</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-95"
                style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
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