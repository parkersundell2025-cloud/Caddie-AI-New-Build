import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/db';
import Logo from '@/components/layout/Logo';

export default function AutoLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const email = params.get('email');

      if (!token || !email) {
        setError('Missing token or email.');
        return;
      }

      // Verify the magic link token
      const res = await supabase.functions.invoke('verifyMagicLink', { body: { token, email } }).catch(() => null);

      if (!res?.data?.success) {
        setError('Invalid or expired link. Please sign in again.');
        return;
      }

      // Token is valid — check if already authenticated
      const isAuthed = await isAuthenticated();
      if (isAuthed) {
        navigate('/home', { replace: true });
        return;
      }

      // Not authenticated yet — redirect to login, then bounce to /home
      window.location.assign('/signin');
    };

    run();
  }, [navigate]);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <Logo size="lg" />
        <p className="text-sm text-destructive mt-2">{error}</p>
        <button
          onClick={() => navigate('/signin', { replace: true })}
          className="text-sm text-muted-foreground underline"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-5">
      <Logo size="lg" />
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}