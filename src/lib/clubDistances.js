/**
 * Club distance utilities for Caddie AI
 */

export const CLUBS = [
  { key: 'driver_distance', label: 'Driver' },
  { key: 'three_wood_distance', label: '3 Wood' },
  { key: 'five_wood_distance', label: '5 Wood' },
  { key: 'four_iron_distance', label: '4 Iron / 4 Hybrid' },
  { key: 'five_iron_distance', label: '5 Iron / 5 Hybrid' },
  { key: 'six_iron_distance', label: '6 Iron' },
  { key: 'seven_iron_distance', label: '7 Iron' },
  { key: 'eight_iron_distance', label: '8 Iron' },
  { key: 'nine_iron_distance', label: '9 Iron' },
  { key: 'pitching_wedge_distance', label: 'Pitching Wedge' },
  { key: 'gap_wedge_distance', label: 'Gap Wedge' },
  { key: 'sand_wedge_distance', label: 'Sand Wedge' },
  { key: 'lob_wedge_distance', label: 'Lob Wedge' },
];

const DEFAULTS_BY_HANDICAP = {
  scratch: {
    driver_distance: 270, three_wood_distance: 245, five_wood_distance: 225,
    four_iron_distance: 205, five_iron_distance: 195, six_iron_distance: 183,
    seven_iron_distance: 170, eight_iron_distance: 158, nine_iron_distance: 145,
    pitching_wedge_distance: 132, gap_wedge_distance: 118, sand_wedge_distance: 100, lob_wedge_distance: 80,
  },
  mid: {
    driver_distance: 240, three_wood_distance: 220, five_wood_distance: 200,
    four_iron_distance: 185, five_iron_distance: 175, six_iron_distance: 163,
    seven_iron_distance: 150, eight_iron_distance: 138, nine_iron_distance: 125,
    pitching_wedge_distance: 112, gap_wedge_distance: 98, sand_wedge_distance: 82, lob_wedge_distance: 65,
  },
  midHigh: {
    driver_distance: 215, three_wood_distance: 195, five_wood_distance: 178,
    four_iron_distance: 165, five_iron_distance: 155, six_iron_distance: 143,
    seven_iron_distance: 130, eight_iron_distance: 118, nine_iron_distance: 107,
    pitching_wedge_distance: 95, gap_wedge_distance: 82, sand_wedge_distance: 68, lob_wedge_distance: 54,
  },
  high: {
    driver_distance: 185, three_wood_distance: 168, five_wood_distance: 153,
    four_iron_distance: 142, five_iron_distance: 133, six_iron_distance: 122,
    seven_iron_distance: 110, eight_iron_distance: 100, nine_iron_distance: 90,
    pitching_wedge_distance: 80, gap_wedge_distance: 68, sand_wedge_distance: 56, lob_wedge_distance: 44,
  },
};

/**
 * Returns the default club distances for a given handicap
 */
export function getDefaultDistances(handicap) {
  const hcp = handicap ?? 18;
  if (hcp <= 5) return DEFAULTS_BY_HANDICAP.scratch;
  if (hcp <= 12) return DEFAULTS_BY_HANDICAP.mid;
  if (hcp <= 20) return DEFAULTS_BY_HANDICAP.midHigh;
  return DEFAULTS_BY_HANDICAP.high;
}

/**
 * Returns a placeholder (default) for a single club key given a handicap
 */
export function getDefaultForClub(key, handicap) {
  return getDefaultDistances(handicap)[key] ?? '';
}

/**
 * Returns true if the profile has at least one club distance saved
 */
export function hasClubDistances(profile) {
  if (!profile) return false;
  return CLUBS.some(c => profile[c.key] != null && profile[c.key] > 0);
}

/**
 * Returns the effective club distances for a profile,
 * falling back to handicap-based defaults for any missing values.
 */
export function getEffectiveDistances(profile) {
  const defaults = getDefaultDistances(profile?.current_handicap);
  const result = {};
  CLUBS.forEach(({ key }) => {
    result[key] = (profile?.[key] != null && profile[key] > 0) ? profile[key] : defaults[key];
  });
  return result;
}

/**
 * Builds a Coach context string for club distances
 */
export function buildClubDistanceContext(profile) {
  const d = getEffectiveDistances(profile);
  return `User club distances (carry yards): Driver: ${d.driver_distance}, 3W: ${d.three_wood_distance}, 5W: ${d.five_wood_distance}, 4i: ${d.four_iron_distance}, 5i: ${d.five_iron_distance}, 6i: ${d.six_iron_distance}, 7i: ${d.seven_iron_distance}, 8i: ${d.eight_iron_distance}, 9i: ${d.nine_iron_distance}, PW: ${d.pitching_wedge_distance}, GW: ${d.gap_wedge_distance}, SW: ${d.sand_wedge_distance}, LW: ${d.lob_wedge_distance}`;
}