import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Public giveaway page (no auth). Renders the official rules + the free /
// no-purchase-necessary entry form. Subscriber and bonus entries are computed
// off app data + social lists at draw time; this page only handles free entry.
// Full build notes: GIVEAWAY.md. Rules text: Parker's blessed draft (2026-08).

const C = {
  bg: '#0B0F0C', card: '#0F1714', cardBorder: 'rgba(95,190,126,0.18)',
  ink: '#F4EFE3', inkMute: 'rgba(244,239,227,0.55)', green: '#5FBE7E', gold: '#C8A96A',
};
const SERIF = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const currentPeriod = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

export default function Giveaway() {
  const [form, setForm] = useState({ name: '', email: '', social_handle: '' });
  const [state, setState] = useState('idle'); // idle | loading | done | already | error
  const [showRules, setShowRules] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!form.name.trim() || !emailOk) { setState('error'); return; }
    setState('loading');
    // No .select() — anon has INSERT but not SELECT (admin-only read). A
    // duplicate (email, period) trips the unique index → 23505 → "already in".
    const { error } = await supabase.from('giveaway_entry').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      social_handle: form.social_handle.trim() || null,
      entry_period: currentPeriod(),
      source: 'free_form',
    });
    if (!error) { setState('done'); if (window.fbq) window.fbq('track', 'Lead', { content_name: 'giveaway_free_entry' }); }
    else if (error.code === '23505') setState('already');
    else setState('error');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, padding: '0 20px 64px',
      paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: C.gold, textTransform: 'uppercase', marginBottom: 12 }}>
          Caddie AI · Monthly Giveaway
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 500, lineHeight: 1.05, margin: '0 0 14px' }}>
          Win a custom <span style={{ color: C.green, fontStyle: 'italic' }}>Lab Golf</span> putter.
        </h1>
        <p style={{ color: C.inkMute, fontSize: 15, lineHeight: 1.5, margin: '0 0 8px' }}>
          One winner every month gets a custom-built Lab Golf putter, built to their
          specs (approx. $550 value). Enter free below, or as a subscriber just by
          playing.
        </p>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkMute, letterSpacing: '0.08em', margin: '0 0 28px' }}>
          NO PURCHASE NECESSARY. VOID WHERE PROHIBITED.
        </div>

        {/* How to enter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: C.green, textTransform: 'uppercase', marginBottom: 8 }}>Subscribers</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.ink }}>
              Log a round or practice session in the app during the month and you're
              automatically entered. Basic gets 1 entry, Pro gets 3. No form needed.
            </p>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: C.green, textTransform: 'uppercase', marginBottom: 8 }}>Free entry — no purchase</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.ink }}>
              Anyone can enter once per month, free, at the same odds. Just fill this out.
            </p>
          </div>
        </div>

        {/* Form / result */}
        {state === 'done' ? (
          <Result title="You're entered." body="Good luck. Winners are drawn after the month ends and notified by email." />
        ) : state === 'already' ? (
          <Result title="You're already in." body="You've got your free entry for this month. Come back next month for another." />
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="Your name" />
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} placeholder="you@email.com" type="email" />
            <Field label="Social handle (optional)" value={form.social_handle} onChange={(v) => set('social_handle', v)}
              placeholder="@yourhandle — for bonus entries" />
            {state === 'error' && <p style={{ color: '#e88', fontSize: 13, margin: 0 }}>Please enter your name and a valid email.</p>}
            <button type="submit" disabled={state === 'loading'}
              style={{ height: 54, borderRadius: 14, background: C.green, color: C.bg, fontWeight: 700,
                fontSize: 15, border: 'none', cursor: 'pointer', opacity: state === 'loading' ? 0.6 : 1, marginTop: 4 }}>
              {state === 'loading' ? 'Entering…' : 'Enter the giveaway'}
            </button>
          </form>
        )}

        {/* Rules */}
        <button onClick={() => setShowRules((s) => !s)}
          style={{ marginTop: 32, background: 'none', border: 'none', color: C.inkMute, fontFamily: MONO,
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
          {showRules ? '− Hide official rules' : '+ Official rules'}
        </button>
        {showRules && (
          <div style={{ marginTop: 14, color: C.inkMute, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {RULES}
          </div>
        )}
        <p style={{ marginTop: 28, color: C.inkMute, fontSize: 11, lineHeight: 1.5 }}>
          Sponsored by Caddie AI LLC. This giveaway is in no way sponsored, endorsed,
          administered by, or associated with Apple Inc. Questions: support@caddieaiapp.com
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(244,239,227,0.5)', textTransform: 'uppercase' }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ height: 48, borderRadius: 12, background: '#0F1714', border: '1px solid rgba(255,255,255,0.1)',
          color: '#F4EFE3', padding: '0 16px', fontSize: 15, outline: 'none' }} />
    </label>
  );
}

function Result({ title, body }) {
  return (
    <div style={{ background: '#0F1714', border: '1px solid rgba(95,190,126,0.3)', borderRadius: 16, padding: 22, textAlign: 'center' }}>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: '#5FBE7E', marginBottom: 6 }}>{title}</div>
      <p style={{ margin: 0, color: 'rgba(244,239,227,0.7)', fontSize: 14, lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

const RULES = `OFFICIAL RULES — CADDIE AI MONTHLY LAB PUTTER GIVEAWAY

NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT INCREASE YOUR CHANCES OF WINNING. VOID WHERE PROHIBITED BY LAW.

1. SPONSOR. This giveaway is sponsored by Caddie AI LLC ("Sponsor").

2. ELIGIBILITY. Open to legal residents of the United States who are 18 years of age or older at the time of entry. Void where prohibited. Employees of Sponsor and their immediate family members are not eligible. If the winner cannot legally accept the prize in their jurisdiction, an alternate winner will be selected.

3. GIVEAWAY PERIOD. Recurring monthly. Each entry period begins on the 1st calendar day of each month and ends on the last calendar day of that month at 11:59 PM local Sponsor time. Sponsor may modify, suspend, or discontinue the giveaway with reasonable notice posted here.

4. HOW TO ENTER. Two free ways per period:
(a) Subscriber Entry: An active, paid Caddie AI subscriber (Basic or Pro; free trials do not qualify) who logs qualifying activity in the app during the period is automatically entered — Basic 1 entry, Pro 3 entries.
(b) Free Entry (No Purchase Necessary): Any eligible person may receive one free entry per period, at the same odds, by completing the entry form on this page. Limit one free entry per person per period.
(c) Bonus Entries: Up to 10 additional entries per period for commenting on the designated promotional post and following Sponsor's official social account.
All entry methods carry equal odds per entry.

5. WINNER SELECTION. One winner selected by random drawing from all eligible entries within 7 days after the period ends, notified by email and/or social within 7 days of selection. Winner must still hold an active, paid subscription at the time of the drawing; otherwise an alternate is drawn. Winner may be required to sign an affidavit of eligibility and liability/publicity release. Unclaimed within 7 days of notification, the prize may be forfeited and an alternate selected.

6. PRIZE. One custom-built Lab Golf putter, built to winner's specifications, approx. retail value $550 USD. No cash alternative or substitution except at Sponsor's discretion. Non-transferable. Winner is responsible for any applicable taxes.

7. GENERAL. By entering, entrants agree to these rules and Sponsor's decisions, which are final. Sponsor may disqualify anyone tampering with entry. This giveaway is in no way sponsored, endorsed, administered by, or associated with Apple Inc.; Apple is not a sponsor and bears no responsibility for it.

8. PRIVACY. Entry information is subject to Sponsor's Privacy Policy.

9. QUESTIONS. Contact support@caddieaiapp.com.`;
