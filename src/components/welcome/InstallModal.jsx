import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const steps = {
  iphone: [
    'Open this page in Safari',
    'Tap the Share button (box with arrow) at the bottom',
    'Scroll down and tap "Add to Home Screen"',
    'Tap "Add" in the top right',
  ],
  android: [
    'Open this page in Chrome',
    'Tap the three dots menu in the top right',
    'Tap "Add to Home Screen"',
    'Tap "Add"',
  ],
};

export default function InstallModal({ onClose, onProceed }) {
  const [tab, setTab] = useState('iphone');

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      >
        {/* Modal card */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#1a2e1a',
            border: '1px solid rgba(168,213,162,0.2)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Headline */}
          <h2
            className="text-2xl font-black mb-2"
            style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}
          >
            Get the Full App Experience
          </h2>

          {/* Subtext */}
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(249,249,247,0.65)' }}>
            Add Caddie AI to your home screen in seconds, then sign up inside the app.
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            {['iphone', 'android'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: tab === t ? '#a8d5a2' : 'rgba(255,255,255,0.07)',
                  color: tab === t ? '#1a2e1a' : 'rgba(255,255,255,0.6)',
                  border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {t === 'iphone' ? '📱 iPhone' : '🤖 Android'}
              </button>
            ))}
          </div>

          {/* Steps */}
          <ol className="space-y-3 mb-7">
            {steps[tab].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(249,249,247,0.8)' }}>
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'rgba(168,213,162,0.18)', color: '#a8d5a2' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Primary button */}
          <button
            onClick={onProceed}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 mb-3"
            style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
          >
            Done — Take Me to Sign Up →
          </button>

          {/* Skip link */}
          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <button
              onClick={onProceed}
              className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Skip, sign up in browser
            </button>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}