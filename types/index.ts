// Core Types for M.R. B.A.L.L.S. 2.0

export interface User {
  id: string;
  username: string;
  nfc_tag_id: string;
  state_code: string | null;
  avatar_url: string | null;
  created_at: number;
  tier: 'founding_member' | 'member';
  stats: UserStats;
  preferences: UserPreferences;
}

export interface UserStats {
  total_bets: number;
  wins: number;
  losses: number;
  pushes: number;
  units_wagered: number;
  units_profit: number;
  roi: number; // calculated
  best_win_streak: number;
  current_streak: number;
  sharp_score: number; // 0-100
}

export interface UserPreferences {
  default_unit_size: number;
  notifications_enabled: boolean;
}

export interface Bet {
  id: string;
  user_id: string;
  created_at: number;
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled';
  legs: BetLeg[];
  stake: number;
  odds: number;
  potential_return: number;
  actual_return: number | null;
  confidence: number | null;
  notes: string | null;
  settled_at: number | null;
  analytics: {
    avg_edge: number | null;
    contrarian_score: number | null;
  };
}

export interface BetLeg {
  id: string;
  bet_id: string;
  sport: Sport;
  event_id: string;
  event_name: string;
  commence_time: number;
  market: Market;
  pick: string;
  odds: number;
  status: 'pending' | 'won' | 'lost' | 'push';
  participant: string | null;
  point: number | null;
  bet_kind: 'side' | 'total' | 'prop';
  bet_tag: string | null;
  dk_link: string | null;
  analytics: LegAnalytics;
  locked_by_user: boolean;
}

export interface LegAnalytics {
  edge: number | null;
  sharp_money_pct: number | null;
  public_money_pct: number | null;
  line_movement: number | null;
  factors: AnalyticsFactor[];
  // Advanced betting metrics
  expected_value?: number; // EV as percentage
  kelly_fraction?: number; // Recommended fraction of bankroll
  kelly_units?: number; // Recommended units (1 unit = 1% of bankroll)
  true_probability?: number; // Model's estimated win probability
  implied_probability?: number; // Market's implied probability
  bet_grade?: 'S' | 'A' | 'B' | 'C' | 'D'; // Bet quality grade
}

export interface AnalyticsFactor {
  type: 'positive' | 'negative' | 'neutral';
  category: 'value' | 'sharp' | 'weather' | 'trend' | 'situation' | 'matchup' | 'timing';
  description: string;
  impact: number; // -10 to +10
}

export interface SharpPlay {
  id: string;
  sport: Sport;
  event_id: string;
  event_name: string;
  commence_time: number;
  market: Market;
  pick: string;
  odds: number;
  edge: number;
  confidence: number;
  sharp_money_pct: number | null;
  line_value: number | null;
  situational_score: number | null;
  weather_impact: number | null;
  trend_score: number | null;
  analysis_summary: string;
  found_at: number;
  expires_at: number;
}

export interface LineHistory {
  event_id: string;
  market: Market;
  book: string;
  odds: number;
  point: number | null;
  recorded_at: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'bet_starting' | 'bet_won' | 'bet_lost' | 'line_moved' | 'friend_activity' | 'sharp_play';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  roi: number;
  units_profit: number;
  total_bets: number;
  win_rate: number;
  current_streak: number;
  sharp_score: number;
}

export type Sport =
  | 'americanfootball_nfl'
  | 'basketball_nba'
  | 'icehockey_nhl'
  | 'americanfootball_ncaaf'
  | 'basketball_ncaab';

export type Market =
  | 'h2h'
  | 'spreads'
  | 'totals'
  | 'player_points'
  | 'player_rebounds'
  | 'player_assists'
  | 'player_anytime_td'
  | 'player_pass_yds'
  | 'player_rush_yds'
  | 'player_reception_yds'
  | string; // Allow for dynamic markets

export interface GeneratorCriteria {
  sports: Sport[];
  legs: number;
  odds_min: number;
  odds_max: number;
  bet_types: ('moneyline' | 'spread' | 'over_under')[];
  extra_markets: string[];
  sgp_mode: 'none' | 'allow' | 'only';
  locked: BetLeg[];
  min_edge: number;
  mode: 'max_value' | 'balanced' | 'chaos';
}

export interface WeatherData {
  wind_speed: number;
  precipitation: number;
  temperature: number;
  conditions: string;
}

export interface GameData {
  id: string;
  sport: Sport;
  commence_time: number;
  home_team: string;
  away_team: string;
  weather: WeatherData | null;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: BookmakerMarket[];
}

export interface BookmakerMarket {
  key: Market;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
  participant?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
