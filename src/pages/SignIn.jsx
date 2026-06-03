import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isNative, openExternal, NATIVE_URL_SCHEME } from '@/lib/platform';

const BG = '#1a2e1a';      // forest green (matches Welcome)
const CREAM = '#f9f9f7';   // off-white text
const SAGE = '#a8d5a2';    // sage button

// Where the magic-link click / OAuth provider redirects back to. On native
// (Capacitor iOS), the caddieai:// custom scheme is registered in Info.plist;
// iOS hands the inbound URL to the App plugin's appUrlOpen event, which
// DeepLinkRouter in App.jsx forwards into the SPA after running the Supabase
// session exchange. On web, a regular https origin redirect — supabase-js
// auto-detects the session in the URL via detectSessionInUrl.
const redirectTo = () =>
  isNative() ? `${NATIVE_URL_SCHEME}://gateway` : `${window.location.origin}/gateway`;

const inputClass =
  'w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white ' +
  'placeholder-white/50 outline-none focus:border-green-400 transition-colors disabled:opacity-50';

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  // Pre-fill email when arriving from a link like /signin?email=foo@bar.com
  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  const sendMagicLink = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  };

  const signInWithApple = async () => {
    // On native, signInWithOAuth would navigate the WebView itself to Apple's
    // auth page — which (a) breaks the app shell, and (b) Apple's auth page
    // refuses to render in many embedded WebViews. Use skipBrowserRedirect to
    // get the URL back and hand it to the Browser plugin (SafariViewController).
    // After auth, Apple redirects to our caddieai://gateway custom scheme,
    // appUrlOpen fires, DeepLinkRouter completes the session exchange.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectTo(),
        skipBrowserRedirect: isNative(),
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }
    if (isNative() && data?.url) {
      await openExternal(data.url);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: BG, color: CREAM }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Wordmark */}
        <div className="flex items-baseline gap-1">
          <span className="font-fraunces text-3xl font-bold tracking-tight" style={{ color: CREAM }}>
            Caddie
          </span>
          <span className="font-fraunces text-lg font-light tracking-wide text-white/60">
            AI
          </span>
        </div>

        {status === 'sent' ? (
          <div className="text-center space-y-3">
            <h1 className="font-fraunces text-2xl font-semibold">Check your email</h1>
            <p className="text-sm text-white/70">
              We sent a sign-in link to <span className="font-medium text-white">{email}</span>.
              Open it on this device to continue.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-sm text-white/60 underline underline-offset-4"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="w-full space-y-5">
            <div className="text-center space-y-1.5">
              <h1 className="font-fraunces text-2xl font-semibold">Welcome to Caddie AI</h1>
              <p className="text-sm text-white/60">Enter your email — we'll send you a magic link to sign in or get started.</p>
            </div>

            <form onSubmit={sendMagicLink} className="space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'sending'}
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full px-6 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: SAGE, color: BG }}
              >
                {status === 'sending'
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : 'Email me a magic link'}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-white/40">or</span>
              <span className="h-px flex-1 bg-white/15" />
            </div>

            <button
              onClick={signInWithApple}
              className="w-full px-6 py-3.5 rounded-xl font-semibold text-sm border border-white/20 text-white bg-transparent hover:bg-white/5 transition-colors active:scale-95"
            >
              Continue with Apple
            </button>

            {status === 'error' && (
              <p className="text-red-400 text-sm text-center">{message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
