/**
 * State-specific sports betting regulations
 * Different states have different restrictions on bet types
 */

export type BettingRestrictions = {
  allowCollegePlayerProps: boolean;
  allowCollegeSpreads: boolean;
  allowInStateCollegeTeams: boolean;
  restrictedSports: string[];
  restrictedBetTypes: string[];
};

export const STATE_REGULATIONS: Record<string, BettingRestrictions> = {
  // States that allow college player props
  KY: {
    allowCollegePlayerProps: true,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: true,
    restrictedSports: [],
    restrictedBetTypes: [],
  },
  CO: {
    allowCollegePlayerProps: true,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false, // Can't bet on Colorado schools
    restrictedSports: [],
    restrictedBetTypes: [],
  },

  // States that restrict college props
  OH: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false, // Can't bet on Ohio schools
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },
  NY: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },
  IL: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },

  // More restrictive states
  NJ: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },
  PA: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },
  MI: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },

  // Default for other states
  DEFAULT: {
    allowCollegePlayerProps: false,
    allowCollegeSpreads: true,
    allowInStateCollegeTeams: false,
    restrictedSports: [],
    restrictedBetTypes: ['player_points', 'player_rebounds', 'player_assists', 'player_pass_tds'],
  },
};

export function getStateRestrictions(stateCode?: string): BettingRestrictions {
  if (!stateCode) return STATE_REGULATIONS.DEFAULT;
  return STATE_REGULATIONS[stateCode.toUpperCase()] || STATE_REGULATIONS.DEFAULT;
}

export function isMarketAllowedInState(
  market: string,
  sport: string,
  stateCode?: string
): boolean {
  const restrictions = getStateRestrictions(stateCode);

  // Check if sport is restricted
  if (restrictions.restrictedSports.includes(sport)) {
    return false;
  }

  // Check if this is a college sport
  const isCollegeSport = sport.includes('ncaa');

  // If it's a player prop on a college sport, check state rules
  if (isCollegeSport && market.includes('player_')) {
    return restrictions.allowCollegePlayerProps;
  }

  // Check if bet type is explicitly restricted
  if (restrictions.restrictedBetTypes.includes(market)) {
    return false;
  }

  return true;
}

export const US_STATES = [
  { code: 'KY', name: 'Kentucky' },
  { code: 'OH', name: 'Ohio' },
  { code: 'NY', name: 'New York' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'MI', name: 'Michigan' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'CO', name: 'Colorado' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'KS', name: 'Kansas' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'VT', name: 'Vermont' },
];
