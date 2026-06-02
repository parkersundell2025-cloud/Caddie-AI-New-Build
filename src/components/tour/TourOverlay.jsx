import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TOUR_STOPS = [
  {
    id: 'home',
    selector: '[data-nav-tab="home"]',
    title: 'Your Daily Hub',
    description: 'Your practice session and personalized Coach insight are always here. Open the app and know exactly what to do today.',
  },
  {
    id: 'plan',
    selector: '[data-nav-tab="plan"]',
    title: 'Your Practice Plan',
    description: 'A personalized weekly practice schedule built around your game. Every drill is chosen specifically for your skill level and goals.',
  },
  {
    id: 'progress',
    selector: '[data-nav-tab="progress"]',
    title: 'Track Your Improvement',
    description: 'Watch your handicap drop and your skills develop over time. Every session and round updates your progress automatically.',
  },
  {
    id: 'coach',
    selector: '[data-nav-tab="coach"]',
    title: 'Your Personal Coach',
    description: 'An AI coach that knows your game, remembers everything and is available 24/7. Ask anything, get specific advice based on your actual performance.',
  },
  {
    id: 'leaderboard',
    selector: '[data-nav-tab="leaderboard"]',
    title: 'Compete and Win',
    description: 'Compete with golfers at your level every month. Log rounds and practice sessions to climb the rankings. The top player wins a free month.',
  },
];

export default function TourOverlay({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPos, setSpotlightPos] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [currentStep]);

  const updatePositions = () => {
    const stop = TOUR_STOPS[currentStep];
    const element = document.querySelector(stop.selector);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const padding = 12;

    // Spotlight position (center of element)
    setSpotlightPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      radius: Math.max(rect.width, rect.height) / 2 + padding,
    });

    // Tooltip position — smart positioning to avoid covering spotlight
    const tooltipWidth = 280;
    const tooltipHeight = 160;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.top - tooltipHeight - 20;

    // Adjust for edges
    if (x < 10) x = 10;
    if (x + tooltipWidth > viewportWidth - 10) x = viewportWidth - tooltipWidth - 10;
    
    // If top position covers spotlight, move to bottom
    if (y < rect.top) {
      y = rect.bottom + 20;
    }
    
    // If bottom goes off screen, reposition
    if (y + tooltipHeight > viewportHeight - 80) {
      y = Math.max(10, viewportHeight - tooltipHeight - 90);
    }

    setTooltipPos({ x, y });
  };

  const handleNext = () => {
    if (currentStep < TOUR_STOPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => onComplete?.(), 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => onSkip?.(), 300);
  };

  const stop = TOUR_STOPS[currentStep];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Dark overlay with spotlight cutout */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            {/* Dark background rect */}
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                {spotlightPos && (
                  <circle
                    cx={spotlightPos.x}
                    cy={spotlightPos.y}
                    r={spotlightPos.radius}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="black"
              opacity="0.7"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Skip button — prominent, always visible, works on every step */}
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all active:scale-95"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: '#1a1a1a' }}
          >
            <X className="w-3.5 h-3.5" />
            Skip Tour
          </button>

          {/* Tooltip card */}
          {tooltipPos && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute bg-card rounded-2xl shadow-2xl border border-border p-5 w-80 z-50"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              <div className="space-y-4">
                {/* Title */}
                <h3 className="text-lg font-black text-foreground" style={{ letterSpacing: '-0.5px' }}>
                  {stop.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {stop.description}
                </p>

                {/* Progress dots */}
                <div className="flex gap-1.5">
                  {TOUR_STOPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i <= currentStep
                          ? 'bg-foreground w-2'
                          : 'bg-border w-1.5'
                      }`}
                    />
                  ))}
                </div>

                {/* Buttons */}
                <button
                  onClick={handleNext}
                  className="w-full btn-primary py-3 text-sm font-semibold"
                >
                  {currentStep === TOUR_STOPS.length - 1 ? "Let's Go! 🏌️" : 'Next →'}
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full py-2 text-xs text-muted-foreground font-medium text-center"
                >
                  Skip tour
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}