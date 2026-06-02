/**
 * Handicap formatting and calculation utilities for WHS (World Handicap System)
 */

/**
 * Format a handicap value for display
 * Plus handicaps (< 0) display with + prefix: "+1.4"
 * Scratch (0) displays as "0.0"
 * Regular handicaps display normally: "12.0"
 * Caps at 54.0 maximum
 */
export function formatHandicap(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  
  // Cap at maximum of 54.0
  const capped = Math.min(value, 54.0);
  
  if (capped < 0) {
    return `+${Math.abs(capped).toFixed(1)}`;
  }
  return capped.toFixed(1);
}

/**
 * Get the numeric value from a handicap (handles display format)
 * "+1.4" → -1.4
 * "0.0" → 0
 * "12.0" → 12.0
 */
export function parseHandicap(displayValue) {
  if (typeof displayValue === 'number') return displayValue;
  if (typeof displayValue !== 'string') return NaN;
  
  if (displayValue.startsWith('+')) {
    return -parseFloat(displayValue.slice(1));
  }
  return parseFloat(displayValue);
}

/**
 * Check if a handicap is improving
 * For regular handicaps: lower is better (12.0 → 11.4 is improving)
 * For plus handicaps: higher is better (+1.4 → +2.0 is improving)
 * Returns: 'improving' | 'declining' | 'equal'
 */
export function getHandicapTrend(previous, current) {
  if (previous === null || current === null || isNaN(previous) || isNaN(current)) {
    return 'equal';
  }
  
  const diff = current - previous;
  
  if (Math.abs(diff) < 0.01) return 'equal';
  
  // Plus handicaps (negative numbers): getting more negative is better (improving)
  // Regular handicaps (positive numbers): getting more positive is worse (declining)
  // So for both cases, if diff < 0 then improving, if diff > 0 then declining
  return diff < 0 ? 'improving' : 'declining';
}

/**
 * Get arrow direction and color for handicap display
 * Returns: { direction: 'up' | 'down', color: 'green' | 'red', isImproving: boolean }
 */
export function getHandicapArrow(previous, current) {
  const trend = getHandicapTrend(previous, current);
  
  if (trend === 'equal') {
    return { direction: null, color: null, isImproving: false };
  }
  
  const isImproving = trend === 'improving';
  return {
    direction: isImproving ? 'down' : 'up',
    color: isImproving ? 'green' : 'red',
    isImproving,
  };
}

/**
 * Calculate expected score for a round given handicap, course rating, and slope
 * Handles both plus and regular handicaps correctly
 */
export function calculateExpectedScore(courseRating, handicapIndex, slope = 113) {
  if (!courseRating || isNaN(handicapIndex)) return null;
  
  // Course handicap = (handicap index × slope / 113) + (course rating - par)
  // But for simplicity, expected score = course rating - handicap adjustment
  
  // For plus handicaps (negative): subtract handicap from course rating
  // For regular handicaps: subtract handicap from course rating
  // In both cases: expected = courseRating - handicapIndex
  
  return courseRating - handicapIndex;
}

/**
 * Cap handicap at maximum of 54.0 per WHS rules
 */
export function capHandicap(value) {
  if (value === null || isNaN(value)) return value;
  return Math.min(value, 54.0);
}

/**
 * Check if a handicap is a plus handicap (below 0)
 */
export function isPlusHandicap(value) {
  return typeof value === 'number' && value < 0;
}

/**
 * Check if a handicap is scratch (0)
 */
export function isScratch(value) {
  return typeof value === 'number' && Math.abs(value) < 0.01;
}