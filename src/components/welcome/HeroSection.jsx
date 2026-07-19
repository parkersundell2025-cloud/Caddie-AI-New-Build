import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import CountdownTimer from './CountdownTimer';
import WaitlistCounter from './WaitlistCounter';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAppStoreUrl, trackAppStoreClick } from '@/lib/campaign';

const screenshots = [
{ id: 1, src: '/images/welcome/hero-5971.jpg' },
{ id: 2, src: '/images/welcome/hero-5972.jpg' },
{ id: 3, src: '/images/welcome/hero-5973.jpg' }];


function PhoneMockup() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const prev = () => setCurrent((c) => c === 0 ? screenshots.length - 1 : c - 1);
  const next = () => setCurrent((c) => c === screenshots.length - 1 ? 0 : c + 1);

  const handleTouchStart = (e) => {touchStartX.current = e.touches[0].clientX;};
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) next();else
    if (diff < -40) prev();
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div
        style={{
          width: '280px',
          background: '#111',
          borderRadius: '44px',
          padding: '12px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
          position: 'relative'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90px',
            height: '28px',
            background: '#111',
            borderRadius: '0 0 18px 18px',
            zIndex: 10
          }} />
        

        {/* Screen area */}
        <div
          style={{
            borderRadius: '34px',
            overflow: 'hidden',
            background: '#f5f5f0',
            height: '540px',
            position: 'relative'
          }}>
          
          {screenshots.map((s, i) =>
          <img
            key={s.id}
            src={s.src}
            alt={`App screenshot ${s.id}`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: i === current ? 1 : 0,
              transition: 'opacity 0.3s ease'
            }} />

          )}
        </div>
      </div>

      {/* Arrows */}
      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={prev}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
          
          <ChevronLeft className="w-5 h-5" style={{ color: '#f9f9f7' }} />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {screenshots.map((_, i) =>
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              height: '8px',
              width: i === current ? '24px' : '8px',
              borderRadius: '9999px',
              backgroundColor: i === current ? '#a8d5a2' : 'rgba(249,249,247,0.3)',
              transition: 'all 0.25s ease',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }} />

          )}
        </div>

        <button
          onClick={next}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
          
          <ChevronRight className="w-5 h-5" style={{ color: '#f9f9f7' }} />
        </button>
      </div>
    </div>);

}

export default function HeroSection() {
  return (
    <div
      className="relative min-h-screen pt-[calc(6rem+var(--sat))] md:pt-[calc(5rem+var(--sat))] px-6 md:px-12 flex flex-col items-center justify-center"
      style={{
        backgroundImage: 'url(/images/welcome/hero-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
      
      {/* Overlay gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(26,46,26,0.6) 0%, rgba(26,46,26,0.95) 70%, #1a2e1a 100%)'
        }} />
      

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        {/* Two-column on desktop, stacked on mobile */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* LEFT: Text content */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5">

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xs md:text-sm font-bold uppercase tracking-widest"
              style={{ color: '#a8d5a2' }}>
              
              For Golfers Who Are Serious About Getting Better
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="font-serif font-bold text-4xl sm:text-5xl md:text-6xl text-white leading-tight">
              
              A Golf Coach That Knows Your Game.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
              
              Personalized practice plans. Real coaching based on your actual rounds and sessions. A live leaderboard competing for real prizes. Less than one lesson a month.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.58 }}
              className="text-sm italic max-w-xl leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              
              Built by a golfer. For golfers who are serious about improving.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.68 }}
              className="w-full">
              
              <CountdownTimer />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="flex flex-col items-center lg:items-start gap-3 w-full max-w-md">

              <a
                href={getAppStoreUrl()}
                onClick={() => trackAppStoreClick('hero')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block transition-transform active:scale-95 hover:scale-105"
                aria-label="Download Caddie AI on the App Store">

                <img
                  src="/images/welcome/app-store-badge.svg"
                  alt="Download on the App Store"
                  style={{ height: '56px', width: 'auto' }} />

              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.95 }}
              className="w-full">

              <WaitlistCounter />
            </motion.div>
          </div>

          {/* RIGHT: Phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex-shrink-0">
            
            <PhoneMockup />
          </motion.div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2">
        
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ChevronDown className="w-6 h-6 text-white/50" />
        </motion.div>
      </motion.div>
    </div>);

}