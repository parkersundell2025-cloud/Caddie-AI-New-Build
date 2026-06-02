import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Share2, Gift, Users, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { getReferralLink, generateReferralCode } from '@/lib/referralConfig';

export default function Referral() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const user = await getCurrentUser();
    const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
    let p = profiles[0];

    // Generate a referral code if missing (e.g. older accounts)
    if (p && !p.referral_code) {
      const newCode = generateReferralCode(user.full_name?.split(' ')[0] || 'USER');
      await unwrap(supabase.from('user_profile').update({ referral_code: newCode }).eq('id', p.id).select().single());
      p = { ...p, referral_code: newCode };
    }

    setProfile(p);

    // Mark referral page as visited (suppresses day-6 popup)
    if (p && !p.referral_page_visited) {
      await unwrap(supabase.from('user_profile').update({ referral_page_visited: true }).eq('id', p.id).select().single());
    }

    const res = await supabase.functions.invoke('getReferralStats', { body: {} });
    setStats(res.data);
    setLoading(false);
  };

  const referralLink = stats?.referralCode ? getReferralLink(stats.referralCode) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const message = `I've been using Caddie AI to track my game and it's been a game changer. Use my referral link to sign up: ${referralLink}`;
    if (navigator.share) {
      navigator.share({ text: message, url: referralLink }).catch(() => {
        navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Refer a Friend</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6 flex-1">
        {/* Hero */}
        <div className="rounded-3xl p-6 text-center space-y-3" style={{ backgroundColor: '#1a2e1a' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: '#a8d5a2' }}>
            <Gift className="w-7 h-7" style={{ color: '#1a2e1a' }} />
          </div>
          <h2 className="text-white text-2xl font-black leading-tight">Earn free months</h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Refer a friend to Caddie AI. When they subscribe, you get a free month — automatically applied to your next bill.
            <span className="text-white font-semibold"> No limit on how many you can earn.</span>
          </p>
        </div>

        {/* Referral Code & Link */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="card-base p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Referral Code</p>
                <p className="text-3xl font-black text-foreground tracking-wider">{stats?.referralCode || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Referral Link</p>
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                  <p className="text-xs text-foreground flex-1 truncate">{referralLink}</p>
                  <button onClick={handleCopy} className="flex-shrink-0 p-1">
                    {copied ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
              >
                <Share2 className="w-4 h-4" />
                Share My Referral Link
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card-base p-4 text-center space-y-1">
                <p className="text-2xl font-black text-foreground">{stats?.totalSignups || 0}</p>
                <p className="text-xs text-muted-foreground leading-tight">Friends Signed Up</p>
              </div>
              <div className="card-base p-4 text-center space-y-1">
                <p className="text-2xl font-black text-foreground">{stats?.freeMonthsEarned || 0}</p>
                <p className="text-xs text-muted-foreground leading-tight">Free Months Earned</p>
              </div>
              <div className="card-base p-4 text-center space-y-1">
                <p className="text-2xl font-black text-foreground">{stats?.freeMonthsRemaining || 0}</p>
                <p className="text-xs text-muted-foreground leading-tight">Months Banked</p>
              </div>
            </div>

            {/* How it works */}
            <div className="card-base p-5 space-y-4">
              <h3 className="font-bold text-foreground text-sm">How it works</h3>
              {[
                { n: '1', text: 'Share your unique link with a friend' },
                { n: '2', text: 'They sign up for Caddie AI using your link' },
                { n: '3', text: 'When they make their first payment, you earn a free month' },
                { n: '4', text: 'Your credit is applied automatically at your next billing date' },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.n}
                  </div>
                  <p className="text-sm text-foreground leading-snug">{step.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}