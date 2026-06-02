import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/db';
import InstallModal from './InstallModal';

export default function EmailCapture({ id: formId = 'email-form', variant = 'hero' }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      // No .select() after insert: waitlist_email has admin-only SELECT RLS
      // (`waitlist_admin_select`), so requesting the inserted row back via
      // `return=representation` 42501s for anon visitors and silently fails the
      // form. We don't use the returned row anyway — just navigate after.
      const { error: insErr } = await supabase.from('waitlist_email').insert({
        email,
        submitted_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
      if (window.fbq) window.fbq('track', 'Lead');
      const url = `/subscribe-now?email=${encodeURIComponent(email)}`;
      setPendingUrl(url);
      setShowModal(true);
      setLoading(false);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleProceed = () => {
    setShowModal(false);
    navigate(pendingUrl);
  };

  return (
    <>
      {showModal && (
        <InstallModal
          onClose={() => setShowModal(false)}
          onProceed={handleProceed}
        />
      )}
      <form onSubmit={handleSubmit} className="w-full" id={formId}>
        <div className={`flex flex-col ${variant === 'hero' ? 'sm:flex-row' : 'flex-col'} gap-3 mb-3`}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 outline-none focus:border-green-400 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : 'Try for Free →'
            }
          </button>
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </form>
    </>
  );
}