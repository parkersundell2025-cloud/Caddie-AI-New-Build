import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';

const FEEDBACK_TYPES = [
  { id: 'bug', emoji: '🐛', label: 'Bug Report', value: 'Bug Report' },
  { id: 'feature', emoji: '💡', label: 'Feature Suggestion', value: 'Feature Suggestion' },
  { id: 'general', emoji: '💬', label: 'General Feedback', value: 'General Feedback' },
];

const PLACEHOLDERS = {
  'Bug Report': 'Describe what happened, what you expected to happen, and the steps to reproduce it if possible.',
  'Feature Suggestion': "Describe the feature you'd like to see and how it would help your game.",
  'General Feedback': 'Share your thoughts, ideas or anything else on your mind.',
};

export default function SendFeedback() {
  const navigate = useNavigate();
  const [feedbackType, setFeedbackType] = useState('General Feedback');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [includeFollowup, setIncludeFollowup] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState('form'); // 'form', 'success', 'error'
  const [error, setError] = useState('');

  // Load user email on mount
  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      setUserEmail(user.email);
    };
    loadUser();
  }, []);

  const descriptionCharsRemaining = 1000 - description.length;
  const canSubmit = feedbackType && subject.trim() && description.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke('submitFeedback', {
        body: {
          feedback_type: feedbackType,
          subject: subject.trim(),
          description: description.trim(),
          include_followup: includeFollowup,
        },
      });

      if (res.data?.success) {
        setState('success');
      } else {
        setError('Something went wrong — please try again.');
        setState('error');
      }
    } catch (err) {
      setError('Something went wrong — please try again.');
      setState('error');
    }
    setSubmitting(false);
  };

  const handleRetry = () => {
    setState('form');
    setError('');
  };

  const handleBackToSettings = () => {
    navigate('/settings');
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-black text-foreground">Send Feedback</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4 pb-8 px-5 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {state === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Feedback Type */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">Feedback Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {FEEDBACK_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setFeedbackType(type.value)}
                      className={`py-3 px-2 rounded-xl border-2 transition-all text-center space-y-1 ${
                        feedbackType === type.value
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border bg-transparent hover:border-foreground/30'
                      }`}
                    >
                      <div className="text-lg">{type.emoji}</div>
                      <div className="text-xs font-semibold text-foreground">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value.slice(0, 100))}
                  placeholder="Brief summary of your feedback"
                  maxLength={100}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border"
                />
                <p className="text-xs text-muted-foreground text-right">{subject.length}/100</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 1000))}
                  placeholder={PLACEHOLDERS[feedbackType]}
                  maxLength={1000}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:ring-2 focus:ring-sage border border-border resize-none h-32"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{descriptionCharsRemaining} characters remaining</p>
                  <p className="text-xs text-muted-foreground">{description.length}/1000</p>
                </div>
              </div>

              {/* Follow-up Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">Can we follow up with you?</label>
                <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-xl border border-border">
                  <span className="text-sm text-foreground">Include my email so you can follow up</span>
                  <button
                    onClick={() => setIncludeFollowup(!includeFollowup)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      includeFollowup ? 'bg-foreground' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${
                        includeFollowup ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {includeFollowup && (
                  <div className="text-xs text-muted-foreground px-4 py-2 bg-muted/50 rounded-xl border border-border">
                    {userEmail}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${
                  canSubmit && !submitting
                    ? 'btn-primary active:scale-95'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center text-center space-y-6 py-12"
            >
              <div className="w-20 h-20 bg-sage/20 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-foreground" strokeWidth={2.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>Feedback Received</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Thanks — we read every submission. Your feedback helps make Caddie AI better for every golfer.
                </p>
                {includeFollowup && (
                  <p className="text-muted-foreground text-sm">
                    We'll follow up at <span className="font-semibold text-foreground">{userEmail}</span> if we have questions.
                  </p>
                )}
              </div>
              <button
                onClick={handleBackToSettings}
                className="w-full btn-primary py-4"
              >
                Back to Settings
              </button>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center text-center space-y-6 py-12"
            >
              <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" strokeWidth={2.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>Oops</h2>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
              <div className="w-full space-y-2">
                <button
                  onClick={handleRetry}
                  className="w-full btn-primary py-4"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full py-4 rounded-xl font-bold text-sm border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Back to Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}