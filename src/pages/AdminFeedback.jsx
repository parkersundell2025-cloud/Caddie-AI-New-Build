import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = ['new', 'in review', 'resolved'];
const TYPE_OPTIONS = ['all', 'Bug Report', 'Feature Suggestion', 'General Feedback'];

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const u = await getCurrentUser();
      setUser(u);

      // Non-admins are bounced to /; RootRoute then sends them to the correct landing.
      if (u?.role !== 'admin') {
        navigate('/', { replace: true });
        return;
      }

      const allFeedbacks = await unwrap(supabase.from('feedback').select('*').order('submitted_at', { ascending: false }).limit(500));
      setFeedbacks(allFeedbacks);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleStatusChange = async (feedbackId, newStatus) => {
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (!feedback) return;

    await unwrap(supabase.from('feedback').update({ status: newStatus }).eq('id', feedbackId).select().single());
    setFeedbacks(prev =>
      prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f)
    );
  };

  const filteredFeedbacks = filterType === 'all'
    ? feedbacks
    : feedbacks.filter(f => f.feedback_type === filterType);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sage/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Render nothing while the navigate('/') redirect is in flight (prevents flash).
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-40">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>Feedback</h1>
        </div>
      </div>

      {/* Filter */}
      <div className="sticky top-14 bg-background border-b border-border z-30 px-5 py-3">
        <div className="max-w-4xl mx-auto flex gap-2 overflow-x-auto scrollbar-none pb-2">
          {TYPE_OPTIONS.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === type
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-border'
              }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback List */}
      <div className="max-w-4xl mx-auto px-5 py-4 space-y-2">
        {filteredFeedbacks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No feedback submissions yet</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => (
            <FeedbackRow
              key={feedback.id}
              feedback={feedback}
              expanded={expandedId === feedback.id}
              onToggle={() => setExpandedId(expandedId === feedback.id ? null : feedback.id)}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FeedbackRow({ feedback, expanded, onToggle, onStatusChange }) {
  const typeEmoji = {
    'Bug Report': '🐛',
    'Feature Suggestion': '💡',
    'General Feedback': '💬',
  }[feedback.feedback_type] || '💬';

  const statusColor = {
    'new': 'bg-blue-100 text-blue-800 border-blue-300',
    'in review': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'resolved': 'bg-green-100 text-green-800 border-green-300',
  }[feedback.status] || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{typeEmoji}</span>
            <h3 className="text-sm font-bold text-foreground line-clamp-1">{feedback.subject}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{feedback.user_name}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(feedback.submitted_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusColor}`}>
            {feedback.status}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border overflow-hidden"
        >
          <div className="px-4 py-4 space-y-4">
            {/* Full Details */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                <p className="text-sm text-foreground">{feedback.feedback_type}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{feedback.description}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">User</p>
                <p className="text-sm text-foreground">{feedback.user_name}</p>
                {feedback.include_followup && (
                  <p className="text-sm text-foreground">{feedback.user_email}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Submitted</p>
                <p className="text-sm text-foreground">{new Date(feedback.submitted_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Status Change */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Change Status</p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(feedback.id, status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      feedback.status === status
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-foreground hover:bg-border'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}