import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  { id: 1, src: '/images/welcome/testimonial-1.jpg' },
  { id: 2, src: '/images/welcome/testimonial-2.jpg' },
  { id: 3, src: '/images/welcome/testimonial-3.jpg' },
  { id: 4, src: '/images/welcome/testimonial-4.jpg' },
];

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const prev = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) next();
    else if (diff < -40) prev();
    touchStartX.current = null;
  };

  return (
    <section
      style={{ backgroundColor: '#1a2e1a', padding: '80px 24px' }}
      className="flex flex-col items-center text-center"
    >
      {/* Label */}
      <p
        className="text-xs font-bold uppercase tracking-widest mb-3"
        style={{ color: '#a8d5a2', letterSpacing: '0.1em' }}
      >
        Real Feedback
      </p>

      {/* Headline */}
      <h2
        className="text-4xl sm:text-5xl font-black mb-3"
        style={{ fontFamily: 'Fraunces, serif', color: '#f9f9f7' }}
      >
        What golfers are saying
      </h2>

      {/* Subheadline */}
      <p
        className="text-base mb-10"
        style={{ color: 'rgba(249,249,247,0.6)' }}
      >
        Real Instagram DMs from real users
      </p>

      {/* Slider */}
      <div className="relative w-full" style={{ maxWidth: '420px' }}>
        {/* Left arrow */}
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-10 flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#f9f9f7' }} />
        </button>

        {/* Slide */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ width: '420px', height: '720px', maxWidth: '100%' }}
          className="mx-auto overflow-hidden"
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              style={{
                display: i === current ? 'flex' : 'none',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(168,213,162,0.2)',
                borderRadius: '20px',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={slide.src}
                alt={`DM screenshot ${slide.id}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '20px' }}
              />
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-10 flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <ChevronRight className="w-5 h-5" style={{ color: '#f9f9f7' }} />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-2 mt-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              height: '8px',
              width: i === current ? '24px' : '8px',
              borderRadius: '9999px',
              backgroundColor: i === current ? '#a8d5a2' : 'rgba(249,249,247,0.25)',
              transition: 'all 0.25s ease',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}