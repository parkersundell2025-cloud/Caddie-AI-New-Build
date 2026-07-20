import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { Medal, BarChart3, Trophy, Sparkles } from 'lucide-react';

// Notification inbox — the mock's "Notifications" screen over the existing
// notification table (rows already written by checkBadges / updateLeaderboard
// / weekly report functions; the push trigger fires on the same inserts).
const TYPE_META = {
  badge: { icon: Medal, tone: 'gold', title: 'Badge earned' },
  weekly_report: { icon: BarChart3, tone: 'green', title: 'Weekly report ready' },
  rank_change: { icon: Trophy, tone: 'gold', title: 'Leaderboard update' },
};
const DEFAULT_META = { icon: Sparkles, tone: 'mute', title: 'Update' };

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const toneStyles = {
  gold: { background: 'rgba(217,177,74,.18)', color: '#D9B14A' },
  green: { background: 'rgba(95,190,126,.15)', color: '#5FBE7E' },
  mute: { background: '#141A17', color: 'rgba(244,239,227,.45)' },
};

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        setUserEmail(user.email);
        const rows = await unwrap(
          supabase.from('notification').select('*')
            .eq('user_email', user.email)
            .order('created_at', { ascending: false })
            .limit(50)
        );
        setItems(rows);
      } catch (e) {
        console.warn('[Inbox] load failed:', e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markRead = async (id) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    try {
      await unwrap(supabase.from('notification').update({ read: true }).eq('id', id).select());
    } catch (e) {
      console.warn('[Inbox] markRead failed:', e?.message);
    }
  };

  const markAllRead = async () => {
    if (!userEmail) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await unwrap(
        supabase.from('notification').update({ read: true })
          .eq('user_email', userEmail).eq('read', false).select()
      );
    } catch (e) {
      console.warn('[Inbox] markAllRead failed:', e?.message);
    }
  };

  const hasUnread = items.some(n => !n.read);

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-baseline justify-between px-1.5">
        <div>
          <p className="cut-eyebrow text-cut-ink-mute">Updates</p>
          <h1 className="cut-headline text-cut-ink text-[26px] mt-1.5">Notifications</h1>
        </div>
        {hasUnread && (
          <button onClick={markAllRead} className="text-xs font-bold text-cut-green active:opacity-70 transition-opacity">
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? null : items.length === 0 ? (
          <div className="cut-glass p-7 text-center">
            <p className="cut-headline text-cut-ink text-lg">All caught up</p>
            <p className="text-[13px] text-cut-ink-mute mt-1.5">
              Badges, leaderboard moves, and reports land here.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const meta = TYPE_META[n.type] || DEFAULT_META;
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className="cut-glass w-full p-3.5 text-left active:opacity-80 transition-opacity"
                style={{ border: n.read ? '1px solid rgba(244,239,227,.10)' : '1px solid #D9B14A' }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={toneStyles[meta.tone]}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <p className="cut-headline text-cut-ink text-[14.5px]" style={{ letterSpacing: '-0.1px' }}>
                        {meta.title}
                      </p>
                      <p className="text-[10.5px] text-cut-ink-mute whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(n.created_at || n.created_date)}
                      </p>
                    </div>
                    <p className="text-xs text-cut-ink-mute mt-1 leading-snug">{n.message}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
