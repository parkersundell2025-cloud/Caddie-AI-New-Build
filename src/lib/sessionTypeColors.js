// Centralized session type color system
// Applied consistently across My Plan, Home, and all session displays

export const SESSION_TYPE_COLORS = {
  'Range Day': {
    hex: '#1a4d2e', // Primary app green
    bg: 'bg-emerald-900',
    badge: 'bg-emerald-700 text-white',
    dot: '#1a4d2e',
  },
  'Putting & Short Game': {
    hex: '#1a6b5a', // Teal
    bg: 'bg-teal-900',
    badge: 'bg-teal-700 text-white',
    dot: '#1a6b5a',
  },
  'Golf Fitness': {
    hex: '#b07d2a', // Warm amber
    bg: 'bg-amber-900',
    badge: 'bg-amber-700 text-white',
    dot: '#b07d2a',
  },
  'Rest & Recovery': {
    hex: '#3a3f4a', // Muted slate grey
    bg: 'bg-slate-700',
    badge: 'bg-slate-600 text-white',
    dot: '#3a3f4a',
  },
};

export const getSessionTypeColor = (sessionType) => {
  return SESSION_TYPE_COLORS[sessionType] || SESSION_TYPE_COLORS['Rest & Recovery'];
};

export const getCompletedSessionOpacity = (hex) => {
  // Returns a color at 60% opacity for completed sessions
  // Converts hex to rgba with 0.6 alpha
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
};