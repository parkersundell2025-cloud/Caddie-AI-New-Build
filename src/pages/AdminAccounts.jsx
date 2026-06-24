import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/db';

const STATUS_FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'trial',      label: 'Trial' },
  { id: 'basic',      label: 'Basic' },
  { id: 'pro',        label: 'Pro' },
  { id: 'cancelling', label: 'Cancelling' },
  { id: 'expired',    label: 'Expired' },
];

const STATUS_STYLES = {
  trial:      { bg: 'rgba(168,213,162,0.15)', color: '#a8d5a2' },
  basic:      { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  pro:        { bg: 'rgba(251,191,36,0.18)',  color: '#fbbf24' },
  cancelling: { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
  expired:    { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
};

function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status || '—'}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

// Column definitions — order matters for the table render.
const COLUMNS = [
  { id: 'user_email',          label: 'Email',     sortable: true,  align: 'left',  width: 'w-[220px]' },
  { id: 'first_name',          label: 'Name',      sortable: true,  align: 'left',  width: 'w-[120px]' },
  { id: 'subscription_status', label: 'Status',    sortable: true,  align: 'left',  width: 'w-[110px]' },
  { id: 'subscription_plan',   label: 'Plan',      sortable: true,  align: 'left',  width: 'w-[80px]' },
  { id: 'subscription_source', label: 'Source',    sortable: true,  align: 'left',  width: 'w-[90px]' },
  { id: 'auth_created_at',     label: 'Signed up', sortable: true,  align: 'right', width: 'w-[90px]' },
  { id: 'last_sign_in_at',     label: 'Last seen', sortable: true,  align: 'right', width: 'w-[90px]' },
  { id: 'trial_end_date',      label: 'Trial end', sortable: true,  align: 'right', width: 'w-[110px]' },
  { id: 'current_handicap',    label: 'HCP',       sortable: true,  align: 'right', width: 'w-[60px]' },
];

export default function AdminAccounts() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Default sort: most recent signups first
  const [sort, setSort] = useState({ key: 'auth_created_at', dir: 'desc' });

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u?.role !== 'admin') {
        navigate('/', { replace: true });
        return;
      }
      await load();
    })();
  }, [navigate]);

  const load = async () => {
    setRefreshing(true);
    setError('');
    const { data, error: invErr } = await supabase.functions.invoke('listUsersForAdmin', { body: {} });
    if (invErr) setError(invErr.message || 'Failed to load users.');
    else if (data?.error) setError(data.error);
    else setUsers(data?.users || []);
    setLoading(false);
    setRefreshing(false);
  };

  const counts = useMemo(() => {
    const c = { all: users.length, trial: 0, basic: 0, pro: 0, cancelling: 0, expired: 0 };
    for (const u of users) {
      const s = u.subscription_status;
      if (s && c[s] !== undefined) c[s] += 1;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter !== 'all') list = list.filter((u) => u.subscription_status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.user_email || '').toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q),
      );
    }
    // Sort. Nulls sort to the bottom regardless of direction.
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [users, filter, search, sort]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: 'auth_created_at', dir: 'desc' }; // reset to default
    });
  };

  if (!loading && user?.role !== 'admin') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="pt-2" />

      {/* Stats / filter pills */}
      <div className="px-5 pt-2 pb-3 overflow-x-auto">
        <div className="flex gap-2 min-w-min">
          {STATUS_FILTERS.map((s) => {
            const active = filter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className="flex-shrink-0 rounded-xl px-3 py-2 text-left transition-all active:scale-95"
                style={{
                  backgroundColor: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  minWidth: 72,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  {s.label}
                </p>
                <p className="font-bold text-lg leading-tight">{counts[s.id] ?? 0}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + refresh */}
      <div className="px-5 pb-3 flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: 'hsl(var(--muted))' }}
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name"
            className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground flex-1 min-w-0"
          />
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="rounded-xl p-2 transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: 'hsl(var(--muted))' }}
          aria-label="Refresh"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {error && (
        <div className="px-5 mb-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="px-5 mb-2">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {users.length}
        </p>
      </div>

      {/* Table — horizontal scroll on narrow viewports */}
      <div className="px-5">
        <div
          className="rounded-2xl border border-border overflow-x-auto"
          style={{ backgroundColor: 'hsl(var(--card, var(--background)))' }}
        >
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'hsl(var(--muted))' }}>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.id;
                  const arrow = isSorted ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;
                  return (
                    <th
                      key={col.id}
                      className={`${col.width} px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.id)}
                          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                        >
                          {col.label}
                          {arrow}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No users match.
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => (
                  <tr
                    key={u.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                    style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.15)' }}
                  >
                    <td className="px-3 py-2 text-foreground truncate select-text" title={u.user_email}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{u.user_email}</span>
                        {u.role === 'admin' && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: 'rgba(168,213,162,0.2)', color: '#a8d5a2' }}
                          >
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground truncate" title={u.first_name || ''}>
                      {u.first_name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={u.subscription_status} />
                    </td>
                    <td className="px-3 py-2 text-foreground capitalize">{u.subscription_plan || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.subscription_source || '—'}</td>
                    <td
                      className="px-3 py-2 text-foreground text-right whitespace-nowrap"
                      title={fmtDate(u.auth_created_at || u.profile_created_date)}
                    >
                      {daysAgo(u.auth_created_at || u.profile_created_date) || '—'}
                    </td>
                    <td
                      className="px-3 py-2 text-foreground text-right whitespace-nowrap"
                      title={fmtDate(u.last_sign_in_at)}
                    >
                      {daysAgo(u.last_sign_in_at) || 'never'}
                    </td>
                    <td
                      className="px-3 py-2 text-muted-foreground text-right whitespace-nowrap"
                      title={fmtDate(u.trial_end_date)}
                    >
                      {u.subscription_status === 'trial' && u.trial_end_date
                        ? fmtDate(u.trial_end_date)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-foreground text-right">
                      {u.current_handicap != null ? u.current_handicap : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
