import React, { useState, useEffect } from 'react';
import { isNative } from '@/lib/platform';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import ReferralPopup from './ReferralPopup';
import ReviewPopup from './ReviewPopup';
import LeaderboardJoinPopup from './LeaderboardJoinPopup';
import { parseDateLocal } from '@/lib/dateUtils';

export default function SmartPopupController() {
  const [activePopup, setActivePopup] = useState(null); // 'referral' | 'review' | null
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkPopups();
  }, []);

  const checkPopups = async () => {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return;

    const profiles = await unwrap(supabase.from('user_profile').select('*').eq('user_email', user.email));
    const p = profiles[0];
    if (!p) return;
    setProfile(p);

    // Never show both in same session — check review first (higher priority event-driven)
    // Review popup: after 3rd round, show once only. Web only — native users
    // get the OS review sheet at success moments (lib/appReview) instead.
    if (!p.popup_review_shown && !isNative()) {
      const rounds = await unwrap(supabase.from('round').select('*').eq('user_email', user.email));
      if (rounds.length >= 3) {
        await unwrap(supabase.from('user_profile').update({ popup_review_shown: true }).eq('id', p.id).select().single());
        setActivePopup('review');
        return; // Don't show referral in same session
      }
    }

    // Leaderboard join popup: once on first subscription
    if (!p.popup_leaderboard_join_shown) {
      const isPaid = p.subscription_status === 'basic' || p.subscription_status === 'pro';
      if (isPaid) {
        await unwrap(supabase.from('user_profile').update({ popup_leaderboard_join_shown: true }).eq('id', p.id).select().single());
        setActivePopup('leaderboard_join');
        return;
      }
    }

    // Referral popup: day 6 of trial, once only, not if subscribed, not if referral page already visited
    if (!p.popup_referral_shown && !p.referral_page_visited) {
      const isPaid = p.subscription_status === 'basic' || p.subscription_status === 'pro';
      if (!isPaid && p.trial_start_date) {
        const trialStart = parseDateLocal(p.trial_start_date);
        const daysSinceStart = trialStart
          ? Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        if (daysSinceStart >= 5) { // day 6 = index 5
          await unwrap(supabase.from('user_profile').update({ popup_referral_shown: true }).eq('id', p.id).select().single());
          setActivePopup('referral');
        }
      }
    }
  };

  const dismiss = () => setActivePopup(null);

  return (
    <AnimatePresence>
      {activePopup === 'referral' && <ReferralPopup key="referral" onDismiss={dismiss} />}
      {activePopup === 'review' && <ReviewPopup key="review" onDismiss={dismiss} />}
      {activePopup === 'leaderboard_join' && <LeaderboardJoinPopup key="leaderboard_join" onDismiss={dismiss} />}
    </AnimatePresence>
  );
}