import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unwrap, getCurrentUser } from '@/lib/db';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProBadge from '@/components/badges/ProBadge';

function ReportCard({ report, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);

  return (
    <div className="card-base overflow-hidden">
      <button
        className="w-full p-4 flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="text-left">
          <p className="text-xs text-muted-foreground">Week of</p>
          <p className="font-bold text-foreground text-sm">
            {report.week_of ? format(new Date(report.week_of + 'T12:00:00'), 'MMM d, yyyy') : 'This Week'}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-4">
              <ReportSection label="This Week in Numbers" text={report.this_week_numbers} />
              <ReportSection label="What Improved" text={report.what_improved} positive />
              <ReportSection label="What Needs Attention" text={report.what_needs_attention} warning />
              <div className="card-base p-3 space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Drill of the Week</p>
                <p className="text-sm font-bold text-foreground">{report.drill_of_the_week}</p>
              </div>
              <div className="rounded-2xl p-4 space-y-1.5" style={{ backgroundColor: '#1a2e1a' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#a8d5a2' }}>Coach's Take</p>
                <p className="text-white/90 text-sm leading-relaxed select-text">{report.coachs_take}</p>
              </div>
              <ReportSection label="Looking Ahead" text={report.looking_ahead} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportSection({ label, text, positive, warning }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm leading-relaxed select-text ${positive ? 'text-green-700 dark:text-green-400' : warning ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>
        {text}
      </p>
    </div>
  );
}

export default function WeeklyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    const user = await getCurrentUser();
    const all = await unwrap(supabase.from('weekly_report').select('*').eq('user_email', user.email).order('week_of', { ascending: false }).limit(20));
    setReports(all);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await supabase.functions.invoke('generateWeeklyReport', { body: {} }).catch(() => {});
    await loadReports();
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-foreground">Weekly Performance Reports</h3>
          <ProBadge />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 bg-muted px-3 py-2 rounded-xl text-xs font-semibold text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="card-base p-6 text-center space-y-3">
          <p className="text-2xl">📊</p>
          <p className="text-sm text-foreground font-semibold">No reports yet</p>
          <p className="text-xs text-muted-foreground">Reports are generated every Monday morning. Tap Generate to get yours now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r, i) => (
            <ReportCard key={r.id} report={r} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}