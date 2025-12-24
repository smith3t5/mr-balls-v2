// Automatic Score Checking and Outcome Detection
import type { Database } from './db';

export interface GameScore {
  id: string;
  sport: string;
  commence_time: number;
  home_team: string;
  away_team: string;
  scores: {
    home_score: number;
    away_score: number;
  } | null;
  completed: boolean;
  last_update: number;
}

export class ScoreChecker {
  constructor(
    private apiKey: string,
    private db: Database
  ) {}

  /**
   * Fetch scores for completed games
   */
  async fetchScores(
    sport: string,
    daysFrom: number = 3
  ): Promise<GameScore[]> {
    try {
      const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/scores/`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('daysFrom', daysFrom.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`Scores API error for ${sport}:`, response.status);
        return [];
      }

      const data = await response.json();

      return data.map((game: any) => ({
        id: game.id,
        sport,
        commence_time: new Date(game.commence_time).getTime(),
        home_team: game.home_team,
        away_team: game.away_team,
        scores: game.completed && game.scores
          ? {
              home_score: game.scores.find((s: any) => s.name === game.home_team)?.score || 0,
              away_score: game.scores.find((s: any) => s.name === game.away_team)?.score || 0,
            }
          : null,
        completed: game.completed || false,
        last_update: Date.now(),
      }));
    } catch (error) {
      console.error(`Error fetching scores for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Check a specific bet leg outcome against game score
   */
  determineLegOutcome(
    leg: {
      market: string;
      pick: string;
      odds: number;
      point: number | null;
      participant: string | null;
      event_id: string;
    },
    gameScore: GameScore
  ): 'won' | 'lost' | 'push' | 'pending' {
    if (!gameScore.completed || !gameScore.scores) {
      return 'pending';
    }

    const { home_score, away_score } = gameScore.scores;
    const margin = home_score - away_score; // Positive = home won, negative = away won
    const total = home_score + away_score;

    // Determine which team the pick is for
    const pickingHome = leg.pick.includes(gameScore.home_team);
    const pickingAway = leg.pick.includes(gameScore.away_team);

    switch (leg.market) {
      case 'h2h': // Moneyline
        if (pickingHome) {
          return margin > 0 ? 'won' : margin < 0 ? 'lost' : 'push';
        } else if (pickingAway) {
          return margin < 0 ? 'won' : margin > 0 ? 'lost' : 'push';
        }
        return 'pending';

      case 'spreads': // Point Spread
        if (!leg.point) return 'pending';

        if (pickingHome) {
          const coverMargin = margin + leg.point; // Home team perspective
          return coverMargin > 0 ? 'won' : coverMargin < 0 ? 'lost' : 'push';
        } else if (pickingAway) {
          const coverMargin = -margin + leg.point; // Away team perspective
          return coverMargin > 0 ? 'won' : coverMargin < 0 ? 'lost' : 'push';
        }
        return 'pending';

      case 'totals': // Over/Under
        if (!leg.point) return 'pending';

        const isOver = leg.pick.toLowerCase().includes('over');
        const isUnder = leg.pick.toLowerCase().includes('under');

        if (isOver) {
          return total > leg.point ? 'won' : total < leg.point ? 'lost' : 'push';
        } else if (isUnder) {
          return total < leg.point ? 'won' : total > leg.point ? 'lost' : 'push';
        }
        return 'pending';

      default:
        // For player props and other markets, we can't auto-detect yet
        return 'pending';
    }
  }

  /**
   * Auto-update all pending legs for a user
   * Returns number of legs updated
   */
  async autoUpdatePendingLegs(userId: string): Promise<{
    updated: number;
    settled_bets: string[];
  }> {
    // Get all pending bets for this user
    const pendingBets = await this.db.getUserBets(userId, { status: 'pending' });

    if (pendingBets.length === 0) {
      return { updated: 0, settled_bets: [] };
    }

    // Collect all unique sports and event IDs
    const sportEventMap = new Map<string, Set<string>>();

    for (const bet of pendingBets) {
      for (const leg of bet.legs) {
        if (leg.status === 'pending') {
          if (!sportEventMap.has(leg.sport)) {
            sportEventMap.set(leg.sport, new Set());
          }
          sportEventMap.get(leg.sport)!.add(leg.event_id);
        }
      }
    }

    // Fetch scores for all relevant sports
    const allScores = new Map<string, GameScore>();

    for (const [sport, eventIds] of sportEventMap.entries()) {
      const scores = await this.fetchScores(sport);
      for (const score of scores) {
        if (eventIds.has(score.id)) {
          allScores.set(score.id, score);
        }
      }
    }

    let updatedLegs = 0;
    const settledBets: string[] = [];

    // Check each pending bet
    for (const bet of pendingBets) {
      let betChanged = false;

      for (const leg of bet.legs) {
        if (leg.status !== 'pending') continue;

        const gameScore = allScores.get(leg.event_id);
        if (!gameScore || !gameScore.completed) continue;

        // Determine outcome
        const outcome = this.determineLegOutcome(
          {
            market: leg.market,
            pick: leg.pick,
            odds: leg.odds,
            point: leg.point,
            participant: leg.participant,
            event_id: leg.event_id,
          },
          gameScore
        );

        if (outcome !== 'pending') {
          // Update leg status
          await this.db.updateBetLegStatus(leg.id, outcome);
          updatedLegs++;
          betChanged = true;
        }
      }

      // If bet changed, check if all legs are settled
      if (betChanged) {
        const updatedBet = await this.db.getBetById(bet.id);
        if (!updatedBet) continue;

        const allLegsSettled = updatedBet.legs.every(
          (l) => l.status !== 'pending'
        );

        if (allLegsSettled) {
          // Calculate parlay result
          const legStatuses = updatedBet.legs.map((l) => l.status);

          let parlayStatus: 'won' | 'lost' | 'push' = 'push';

          if (legStatuses.some((s) => s === 'lost')) {
            parlayStatus = 'lost';
          } else if (legStatuses.every((s) => s === 'won')) {
            parlayStatus = 'won';
          }

          // Update bet status
          const actualReturn = parlayStatus === 'won' ? updatedBet.potential_return : 0;
          await this.db.updateBetStatus(bet.id, parlayStatus, actualReturn);

          settledBets.push(bet.id);

          // Update user stats
          const user = await this.db.getUserById(userId);
          if (user) {
            const updates: any = {};

            if (parlayStatus === 'won') {
              updates.wins = user.stats.wins + 1;
              updates.units_profit =
                user.stats.units_profit +
                (actualReturn - updatedBet.stake) / user.preferences.default_unit_size;
              updates.current_streak =
                user.stats.current_streak >= 0
                  ? user.stats.current_streak + 1
                  : 1;
              updates.best_win_streak = Math.max(
                updates.current_streak,
                user.stats.best_win_streak
              );
            } else if (parlayStatus === 'lost') {
              updates.losses = user.stats.losses + 1;
              updates.units_profit =
                user.stats.units_profit -
                updatedBet.stake / user.preferences.default_unit_size;
              updates.current_streak =
                user.stats.current_streak <= 0
                  ? user.stats.current_streak - 1
                  : -1;
            } else if (parlayStatus === 'push') {
              updates.pushes = user.stats.pushes + 1;
            }

            if (Object.keys(updates).length > 0) {
              await this.db.updateUserStats(userId, updates);
            }
          }
        }
      }
    }

    return {
      updated: updatedLegs,
      settled_bets: settledBets,
    };
  }
}
