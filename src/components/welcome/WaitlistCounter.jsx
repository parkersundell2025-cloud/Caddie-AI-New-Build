import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WaitlistCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await supabase.functions.invoke('getWaitlistCount', { body: {} });
        setCount(res.data?.count ?? 0);
      } catch {
        setCount(0);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === null) return null;

  const isFull = count >= 200;

  return (
    <p className="text-white/80 text-left text-sm md:text-base w-full">
      🟢 {isFull ? 'Join golfers already using Caddie AI' : `${count.toLocaleString()} golfers already joined`}
    </p>
  );
}