import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    // Rolling deadline: 7 days from when the page first loads (stored in sessionStorage so it stays stable per session)
    const getDeadline = () => {
      // Fixed deadline: May 3, 2026 at midnight UTC
      return new Date('2026-05-03T23:59:59Z').getTime();
    };

    const updateCountdown = () => {
      const deadline = getDeadline();
      const now = new Date().getTime();
      const distance = deadline - now;

      if (distance <= 0) {
        setTime({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      setTime({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((distance / 1000 / 60) % 60),
        seconds: Math.floor((distance / 1000) % 60),
        expired: false,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  if (time.expired) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-semibold" style={{ color: 'rgba(168,213,162,0.85)' }}>
        Founding member pricing ends in
      </p>
    <div className="flex justify-center gap-3 md:gap-4">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 213, 162, 0.15)', border: '1px solid rgba(168, 213, 162, 0.3)' }}>
          <span className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white">{String(time.days).padStart(2, '0')}</span>
        </div>
        <span className="text-xs md:text-sm text-white/60 mt-2">Days</span>
      </div>

      <div className="flex items-center text-white/40 text-xl md:text-2xl">:</div>

      <div className="flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 213, 162, 0.15)', border: '1px solid rgba(168, 213, 162, 0.3)' }}>
          <span className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white">{String(time.hours).padStart(2, '0')}</span>
        </div>
        <span className="text-xs md:text-sm text-white/60 mt-2">Hours</span>
      </div>

      <div className="flex items-center text-white/40 text-xl md:text-2xl">:</div>

      <div className="flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 213, 162, 0.15)', border: '1px solid rgba(168, 213, 162, 0.3)' }}>
          <span className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white">{String(time.minutes).padStart(2, '0')}</span>
        </div>
        <span className="text-xs md:text-sm text-white/60 mt-2">Minutes</span>
      </div>

      <div className="flex items-center text-white/40 text-xl md:text-2xl">:</div>

      <div className="flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168, 213, 162, 0.15)', border: '1px solid rgba(168, 213, 162, 0.3)' }}>
          <span className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white">{String(time.seconds).padStart(2, '0')}</span>
        </div>
        <span className="text-xs md:text-sm text-white/60 mt-2">Seconds</span>
      </div>
    </div>
    </div>
  );
}