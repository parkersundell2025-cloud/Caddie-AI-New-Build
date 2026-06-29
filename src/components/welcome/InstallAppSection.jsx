import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_STORE_URL } from '@/lib/shareConfig';

const iphoneSteps = [
  'Open caddieaiapp.com in Safari',
  'Tap the Share button (box with arrow) at the bottom',
  'Scroll down and tap "Add to Home Screen"',
  'Tap "Add" in the top right',
];

const androidSteps = [
  'Open caddieaiapp.com in Chrome',
  'Tap the three dots menu in the top right',
  'Tap "Add to Home Screen"',
  'Tap "Add"',
];

function InstallModal({ type, onClose }) {
  const navigate = useNavigate();
  const isIphone = type === 'iphone';
  const headline = isIphone ? 'Add to iPhone' : 'Add to Android';
  const steps = isIphone ? iphoneSteps : androidSteps;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full text-left"
        style={{
          maxWidth: '420px',
          backgroundColor: '#1a2e1a',
          border: '1px solid rgba(168,213,162,0.2)',
          borderRadius: '16px',
          padding: '32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <X className="w-4 h-4" style={{ color: '#f9f9f7' }} />
        </button>

        {/* Headline */}
        <h3
          className="text-2xl font-bold mb-6"
          style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}
        >
          {headline}
        </h3>

        {/* Steps */}
        <ol className="space-y-2 mb-8">
          {steps.map((step, i) => (
            <li
              key={i}
              style={{
                color: 'rgba(249,249,247,0.85)',
                fontSize: '15px',
                lineHeight: '1.8',
              }}
            >
              <span className="font-bold mr-2" style={{ color: '#a8d5a2' }}>{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>

        {/* CTA */}
        <button
          onClick={() => { onClose(); navigate('/subscribe-now'); }}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
          style={{ backgroundColor: '#a8d5a2', color: '#1a2e1a' }}
        >
          Go to Sign Up →
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(168,213,162,0.3)',
  color: '#f9f9f7',
  borderRadius: '12px',
  padding: '14px 28px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export default function InstallAppSection() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [modal, setModal] = useState(null); // 'iphone' | 'android' | null

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);
  }, []);

  if (isStandalone) return null;

  return (
    <section className="py-20 px-6" style={{ backgroundColor: '#1a2e1a' }}>
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <h2
          className="text-3xl sm:text-4xl font-black"
          style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}
        >
          Get the Caddie AI app
        </h2>
        <p className="text-base text-white/70 max-w-xl mx-auto leading-relaxed">
          Download from the App Store for the best experience — full-screen, native, with push notifications.
        </p>

        <div className="flex flex-col items-center gap-3 pt-2">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block transition-transform active:scale-95 hover:scale-105"
            aria-label="Download Caddie AI on the App Store"
          >
            <img
              src="/images/welcome/app-store-badge.svg"
              alt="Download on the App Store"
              style={{ height: '56px', width: 'auto' }}
            />
          </a>
          <p className="text-xs" style={{ color: 'rgba(249,249,247,0.5)' }}>
            Android coming soon
          </p>
        </div>

        <div className="flex items-center gap-4 max-w-md mx-auto pt-6">
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(249,249,247,0.15)' }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: 'rgba(249,249,247,0.5)' }}>
            or install as a web app
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(249,249,247,0.15)' }} />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button style={btnStyle} onClick={() => setModal('iphone')}>
            📱 iPhone Instructions
          </button>
          <button style={btnStyle} onClick={() => setModal('android')}>
            🤖 Android Instructions
          </button>
        </div>
      </div>

      {modal && <InstallModal type={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
