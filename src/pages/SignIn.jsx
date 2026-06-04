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

  // Shared OAuth handler — Apple and Google flow through the same plumbing.
  // On native, signInWithOAuth would otherwise navigate the WebView itself to
  // the provider's auth page, which (a) breaks the app shell, and (b) is
  // refused by most providers' anti-embedded-browser checks. Use
  // skipBrowserRedirect to get the URL back and hand it to the Browser plugin
  // (SafariViewController). After auth, the provider redirects to our
  // caddieai://gateway custom scheme, appUrlOpen fires, DeepLinkRouter
  // completes the session exchange.
  const signInWithProvider = async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
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
  const signInWithApple = () => signInWithProvider('apple');
  const signInWithGoogle = () => signInWithProvider('google');

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
              className="w-full px-6 py-3.5 rounded-xl font-semibold text-sm border border-white/20 text-white bg-transparent hover:bg-white/5 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.86-3.08.43-1.09-.45-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.43C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={signInWithGoogle}
              className="w-full px-6 py-3.5 rounded-xl font-semibold text-sm border border-white/20 text-white bg-transparent hover:bg-white/5 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 18 18">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
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
