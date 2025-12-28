// Team data management and Elo ratings
import { EloSystem } from './betting-algorithms';
import type { Sport } from '@/types';

export interface TeamRating {
  team: string;
  sport: Sport;
  elo: number;
  offensive_rating: number;
  defensive_rating: number;
  pace: number;
  last_updated: number;
}

export interface TeamMatchupData {
  home_team: string;
  away_team: string;
  home_elo: number;
  away_elo: number;
  elo_difference: number;
  home_win_probability: number;
  rest_advantage: number; // Days rest difference
  is_rivalry: boolean;
  is_division: boolean;
}

// Initial Elo ratings for popular teams (will be updated as games are played)
// Starting point: 1500 = average, 1600 = good, 1700+ = elite
const INITIAL_ELO_RATINGS: Record<Sport, Record<string, number>> = {
  basketball_nba: {
    // Elite teams
    'Boston Celtics': 1680,
    'Denver Nuggets': 1670,
    'Milwaukee Bucks': 1665,
    'Phoenix Suns': 1650,
    'Philadelphia 76ers': 1645,
    'Los Angeles Lakers': 1640,
    'Golden State Warriors': 1635,
    'Miami Heat': 1630,
    // Good teams
    'Dallas Mavericks': 1590,
    'Los Angeles Clippers': 1585,
    'Sacramento Kings': 1580,
    'New York Knicks': 1575,
    'Cleveland Cavaliers': 1570,
    'Minnesota Timberwolves': 1565,
    'New Orleans Pelicans': 1560,
    'Brooklyn Nets': 1555,
    // Average teams
    'Memphis Grizzlies': 1520,
    'Atlanta Hawks': 1515,
    'Oklahoma City Thunder': 1510,
    'Indiana Pacers': 1505,
    'Toronto Raptors': 1500,
    'Chicago Bulls': 1495,
    'Orlando Magic': 1490,
    'Utah Jazz': 1485,
    // Below average
    'Washington Wizards': 1450,
    'Portland Trail Blazers': 1445,
    'Charlotte Hornets': 1440,
    'San Antonio Spurs': 1435,
    'Houston Rockets': 1430,
    'Detroit Pistons': 1425,
  },
  americanfootball_nfl: {
    // Elite teams
    'Kansas City Chiefs': 1700,
    'San Francisco 49ers': 1690,
    'Philadelphia Eagles': 1680,
    'Buffalo Bills': 1670,
    'Baltimore Ravens': 1665,
    'Cincinnati Bengals': 1655,
    'Dallas Cowboys': 1650,
    'Miami Dolphins': 1645,
    // Good teams
    'Detroit Lions': 1620,
    'Jacksonville Jaguars': 1610,
    'Los Angeles Chargers': 1600,
    'Cleveland Browns': 1595,
    'Seattle Seahawks': 1590,
    'Minnesota Vikings': 1585,
    'Green Bay Packers': 1580,
    'New Orleans Saints': 1575,
    // Average teams
    'Tampa Bay Buccaneers': 1530,
    'Pittsburgh Steelers': 1525,
    'Las Vegas Raiders': 1520,
    'Atlanta Falcons': 1515,
    'Los Angeles Rams': 1510,
    'Indianapolis Colts': 1505,
    'Tennessee Titans': 1500,
    'New England Patriots': 1495,
    // Below average
    'New York Jets': 1470,
    'Washington Commanders': 1465,
    'New York Giants': 1460,
    'Denver Broncos': 1455,
    'Arizona Cardinals': 1450,
    'Chicago Bears': 1445,
    'Carolina Panthers': 1440,
    'Houston Texans': 1435,
  },
  // Add other sports as needed
  icehockey_nhl: {},
  baseball_mlb: {},
  soccer_epl: {},
  americanfootball_ncaaf: {},
  basketball_ncaab: {},
  icehockey_sweden_hockey_league: {},
};

export class TeamDataManager {
  private elo: EloSystem;

  constructor() {
    this.elo = new EloSystem(32, 65); // K-factor 32, home advantage 65 Elo points
  }

  /**
   * Get Elo rating for a team
   */
  getTeamElo(team: string, sport: Sport): number {
    const sportRatings = INITIAL_ELO_RATINGS[sport] || {};
    return sportRatings[team] || 1500; // Default to 1500 if not found
  }

  /**
   * Calculate matchup data including Elo predictions
   */
  getMatchupData(
    homeTeam: string,
    awayTeam: string,
    sport: Sport,
    homeRestDays: number = 1,
    awayRestDays: number = 1
  ): TeamMatchupData {
    const homeElo = this.getTeamElo(homeTeam, sport);
    const awayElo = this.getTeamElo(awayTeam, sport);
    const eloDifference = homeElo - awayElo;

    // Calculate win probability using Elo
    const homeWinProb = this.elo.expectedResult(homeElo, awayElo, true);

    // Rest advantage
    const restAdvantage = homeRestDays - awayRestDays;

    // Check if rivalry or division game (simplified logic)
    const isRivalry = this.isRivalryGame(homeTeam, awayTeam, sport);
    const isDivision = this.isDivisionGame(homeTeam, awayTeam, sport);

    return {
      home_team: homeTeam,
      away_team: awayTeam,
      home_elo: homeElo,
      away_elo: awayElo,
      elo_difference: eloDifference,
      home_win_probability: homeWinProb,
      rest_advantage: restAdvantage,
      is_rivalry: isRivalry,
      is_division: isDivision,
    };
  }

  /**
   * Check if game is a rivalry
   */
  private isRivalryGame(team1: string, team2: string, sport: Sport): boolean {
    const rivalries: Record<Sport, string[][]> = {
      basketball_nba: [
        ['Los Angeles Lakers', 'Boston Celtics'],
        ['Los Angeles Lakers', 'Los Angeles Clippers'],
        ['Golden State Warriors', 'Los Angeles Lakers'],
        ['Miami Heat', 'New York Knicks'],
        ['Chicago Bulls', 'Detroit Pistons'],
      ],
      americanfootball_nfl: [
        ['Green Bay Packers', 'Chicago Bears'],
        ['Dallas Cowboys', 'Philadelphia Eagles'],
        ['Kansas City Chiefs', 'Las Vegas Raiders'],
        ['San Francisco 49ers', 'Seattle Seahawks'],
        ['New England Patriots', 'New York Jets'],
      ],
      icehockey_nhl: [],
      baseball_mlb: [],
      soccer_epl: [],
      americanfootball_ncaaf: [],
      basketball_ncaab: [],
      icehockey_sweden_hockey_league: [],
    };

    const sportRivalries = rivalries[sport] || [];
    return sportRivalries.some(
      ([t1, t2]) =>
        (t1 === team1 && t2 === team2) || (t1 === team2 && t2 === team1)
    );
  }

  /**
   * Check if game is a division matchup (simplified)
   */
  private isDivisionGame(team1: string, team2: string, sport: Sport): boolean {
    // Simplified logic - in production, would use actual division data
    // For now, just check if teams are from same conference/region
    const divisions: Record<Sport, Record<string, string[]>> = {
      americanfootball_nfl: {
        'AFC East': ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets'],
        'AFC North': ['Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers'],
        'AFC South': ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'],
        'AFC West': ['Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers'],
        'NFC East': ['Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders'],
        'NFC North': ['Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings'],
        'NFC South': ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers'],
        'NFC West': ['Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks'],
      },
      basketball_nba: {},
      icehockey_nhl: {},
      baseball_mlb: {},
      soccer_epl: {},
      americanfootball_ncaaf: {},
      basketball_ncaab: {},
      icehockey_sweden_hockey_league: {},
    };

    const sportDivisions = divisions[sport] || {};
    for (const teams of Object.values(sportDivisions)) {
      if (teams.includes(team1) && teams.includes(team2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update Elo ratings after a game
   */
  updateRatingsAfterGame(
    winner: string,
    loser: string,
    sport: Sport,
    winnerWasHome: boolean,
    marginOfVictory: number = 0
  ): void {
    const winnerElo = this.getTeamElo(winner, sport);
    const loserElo = this.getTeamElo(loser, sport);

    // Update ratings (1.0 = win, 0.0 = loss)
    const { newWinnerRating, newLoserRating } = this.elo.updateRatings(
      winnerElo,
      loserElo,
      1.0,
      winnerWasHome
    );

    // In a real system, would persist these to database
    // For now, just update in-memory
    if (!INITIAL_ELO_RATINGS[sport]) {
      INITIAL_ELO_RATINGS[sport] = {};
    }
    INITIAL_ELO_RATINGS[sport][winner] = newWinnerRating;
    INITIAL_ELO_RATINGS[sport][loser] = newLoserRating;
  }
}

/**
 * Situational analysis helpers
 */

export interface SituationalFactors {
  daysRest: number;
  isBackToBack: boolean;
  travelDistance: number; // miles
  altitudeChange: number; // feet
  isAfterLongRoadTrip: boolean;
  timeZoneChange: number; // hours
}

export function analyzeSituationalAdvantage(
  homeSituation: SituationalFactors,
  awaySituation: SituationalFactors
): {
  advantage: 'home' | 'away' | 'neutral';
  impact: number; // -5 to +5
  factors: string[];
} {
  let impact = 0;
  const factors: string[] = [];

  // Rest advantage
  const restDiff = homeSituation.daysRest - awaySituation.daysRest;
  if (Math.abs(restDiff) >= 2) {
    const restImpact = restDiff * 0.8;
    impact += restImpact;
    factors.push(
      `${Math.abs(restDiff)} day rest advantage for ${restDiff > 0 ? 'home' : 'away'} team (+${Math.abs(restImpact).toFixed(1)}%)`
    );
  }

  // Back-to-back disadvantage
  if (homeSituation.isBackToBack && !awaySituation.isBackToBack) {
    impact -= 2.5;
    factors.push('Home team on back-to-back (-2.5%)');
  } else if (!homeSituation.isBackToBack && awaySituation.isBackToBack) {
    impact += 2.5;
    factors.push('Away team on back-to-back (+2.5%)');
  }

  // Travel distance
  if (awaySituation.travelDistance > 1500) {
    impact += 1.2;
    factors.push(`Away team traveled ${awaySituation.travelDistance} miles (+1.2%)`);
  }

  // Altitude change (significant for Denver, Utah, etc.)
  if (Math.abs(awaySituation.altitudeChange) > 3000) {
    const altitudeImpact = awaySituation.altitudeChange > 0 ? -1.5 : 0.8;
    impact += altitudeImpact;
    factors.push(
      `Altitude change of ${Math.abs(awaySituation.altitudeChange)}ft (${altitudeImpact > 0 ? '+' : ''}${altitudeImpact.toFixed(1)}%)`
    );
  }

  // Time zone changes
  if (Math.abs(awaySituation.timeZoneChange) >= 3) {
    impact += 0.8;
    factors.push(`Away team crosses ${Math.abs(awaySituation.timeZoneChange)} time zones (+0.8%)`);
  }

  // Long road trip fatigue
  if (awaySituation.isAfterLongRoadTrip) {
    impact += 1.0;
    factors.push('Away team finishing long road trip (+1.0%)');
  }

  // Determine advantage
  let advantage: 'home' | 'away' | 'neutral' = 'neutral';
  if (impact > 1.5) advantage = 'home';
  else if (impact < -1.5) advantage = 'away';

  return {
    advantage,
    impact: Math.max(-5, Math.min(5, impact)),
    factors,
  };
}
