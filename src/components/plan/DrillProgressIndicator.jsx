import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function DrillProgressIndicator({ status }) {
  if (status === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-600">
        <TrendingUp className="w-3 h-3" />
        Level Up
      </span>
    );
  }
  if (status === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
        <TrendingDown className="w-3 h-3" />
        Scaled Back
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Minus className="w-3 h-3" />
      On Track
    </span>
  );
}