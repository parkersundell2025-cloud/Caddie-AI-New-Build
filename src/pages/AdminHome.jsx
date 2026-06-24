import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Flag,
  MessageSquare,
  Gift,
  UserCog,
  Users,
  Wallet,
  Shield,
  LineChart,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/db';

const ADMIN_ROUTES = [
  {
    section: 'Moderation',
    items: [
      {
        id: 'flagged',
        label: 'Flagged Content',
        description: 'Review reported rounds and accounts',
        icon: Flag,
        href: '/admin/flagged',
      },
      {
        id: 'feedback',
        label: 'User Feedback',
        description: 'Read submissions from the in-app feedback form',
        icon: MessageSquare,
        href: '/admin/feedback',
      },
    ],
  },
  {
    section: 'Users',
    items: [
      {
        id: 'accounts',
        label: 'Accounts',
        description: 'Browse signups, filter by subscription state, search by email',
        icon: LineChart,
        href: '/admin/accounts',
      },
      {
        id: 'fix-user',
        label: 'Fix User Profile',
        description: "Repair an orphaned or broken user_profile row",
        icon: UserCog,
        href: '/admin/fix-user',
      },
      {
        id: 'waitlist-credits',
        label: 'Waitlist Credits',
        description: 'Approve or reject pre-launch waitlist credits',
        icon: Gift,
        href: '/admin/waitlist-credits',
      },
    ],
  },
  {
    section: 'Affiliate program',
    items: [
      {
        id: 'affiliates',
        label: 'Affiliates',
        description: 'Manage affiliate accounts and commission rates',
        icon: Users,
        href: '/admin/affiliates',
      },
      {
        id: 'affiliate-payouts',
        label: 'Affiliate Payouts',
        description: 'Approve, mark paid, and export commission batches',
        icon: Wallet,
        href: '/admin/affiliates/payouts',
      },
    ],
  },
];

export default function AdminHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      // Match the per-page admin gate used by every Admin* page so the role
      // check is consistent.
      if (u?.role !== 'admin') {
        navigate('/', { replace: true });
        return;
      }
      setLoading(false);
    })();
  }, [navigate]);

  if (!loading && user?.role !== 'admin') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="pt-2" />

      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Shield className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Admin tools
        </p>
      </div>

      <div className="flex-1 px-5 pb-10 space-y-6">
        {ADMIN_ROUTES.map((group) => (
          <div key={group.section}>
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-1">
              {group.section}
            </p>
            <div className="space-y-0">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center justify-between gap-3 py-4 px-3 text-foreground border-b border-border hover:bg-muted/30 transition-all active:scale-[0.98] min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--muted))' }}
                      >
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
