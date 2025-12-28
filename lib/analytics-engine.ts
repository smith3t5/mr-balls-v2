// Smart Analytics Engine for M.R. B.A.L.L.S. 2.0
import type {
  GeneratorCriteria,
  BetLeg,
  GameData,
  WeatherData,
  AnalyticsFactor,
  Sport,
  Market,
} from '@/types';
import { generateDraftKingsLink } from './draftkings-links';
import { isMarketAllowedInState } from './state-regulations';
import {
  calculateEVPercentage,
  kellyBetSize,
  impliedProbability,
  calculateEdge,
} from './betting-algorithms';
import { TeamDataManager, analyzeSituationalAdvantage, type SituationalFactors } from './team-data';

export interface ScoredBet extends BetLeg {
  edgeScore: number;
  confidenceScore: number;
  factors: AnalyticsFactor[];
  rawData: any; // Store original odds API data
}

export class AnalyticsEngine {
  private kellyMultiplier: number;
  private bankroll: number;
  private teamData: TeamDataManager;

  constructor(kellyMultiplier: number = 0.25, bankroll: number = 1000) {
    this.kellyMultiplier = kellyMultiplier;
    this.bankroll = bankroll;
    this.teamData = new TeamDataManager();
  }

  /**
   * Generate smart parlay based on criteria
   */
  async generateSmartParlay(
    criteria: GeneratorCriteria,
    games: GameData[],
    stateCode?: string
  ): Promise<{ legs: ScoredBet[]; confidence: number; avgEdge: number }> {
    // 1. Generate all possible bet options
    const allBets = this.generateBetOptions(games, criteria, stateCode);

    // Count bet kinds for debugging
    const betKindCounts = allBets.reduce((acc: any, bet) => {
      const kind = bet.bet_kind || 'unknown';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});
    console.log(`Generated bet options by kind:`, betKindCounts);

    // 1.5. Pre-filter to reduce scoring overhead
    // Limit total bets to avoid scoring 1000+ combinations
    const preFilteredBets = allBets.slice(0, 1000); // Increased limit

    console.log(`Pre-filtered ${allBets.length} bets down to ${preFilteredBets.length} for scoring`);

    // 2. Score each bet (in parallel for speed)
    const scoredBets = await Promise.all(
      preFilteredBets.map((bet) => this.scoreBet(bet, games))
    );

    // 3. Filter by minimum edge
    let valueBets = scoredBets.filter(
      (bet) => bet.edgeScore >= criteria.min_edge
    );

    // Log grade distribution before tier filtering
    const gradeDistribution = valueBets.reduce((acc: any, bet) => {
      const grade = bet.analytics.bet_grade || 'D';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    console.log(`Grade distribution before tier filter:`, gradeDistribution);

    // 3.5. Filter by minimum tier if specified
    if (criteria.min_tier && criteria.min_tier !== 'any') {
      const tierOrder = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
      const minTierValue = tierOrder[criteria.min_tier];
      const beforeFilter = valueBets.length;
      valueBets = valueBets.filter((bet) => {
        const betTierValue = tierOrder[bet.analytics.bet_grade || 'D'];
        return betTierValue >= minTierValue;
      });
      console.log(`Tier filter (${criteria.min_tier}+): ${beforeFilter} → ${valueBets.length} bets`);
    }

    if (valueBets.length === 0) {
      throw new Error(`No ${criteria.min_tier && criteria.min_tier !== 'any' ? criteria.min_tier + '-tier or better ' : ''}value bets found with current criteria. Try lowering minimum tier or edge.`);
    }

    // 4. Add randomization for diversity (shuffle top 50% to avoid same picks)
    const topHalf = Math.ceil(valueBets.length / 2);
    const topBets = valueBets.slice(0, topHalf);
    const restBets = valueBets.slice(topHalf);

    // Shuffle top bets for variety
    for (let i = topBets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [topBets[i], topBets[j]] = [topBets[j], topBets[i]];
    }

    valueBets = [...topBets, ...restBets];

    // 5. Build optimal parlay
    const parlay = this.buildParlay(
      valueBets,
      criteria.legs,
      criteria.sgp_mode,
      criteria.locked
    );

    // Check if we got enough legs
    if (parlay.length < criteria.legs) {
      throw new Error(
        `Only found ${parlay.length} suitable bets (requested ${criteria.legs}). Try lowering min edge, expanding odds range, or enabling SGP mode.`
      );
    }

    // 6. Calculate aggregate stats
    const avgEdge =
      parlay.reduce((sum, leg) => sum + leg.edgeScore, 0) / parlay.length;
    const confidence =
      parlay.reduce((sum, leg) => sum + leg.confidenceScore, 0) /
      parlay.length;

    return {
      legs: parlay,
      confidence,
      avgEdge,
    };
  }

  /**
   * Generate all possible bet options from games
   */
  private generateBetOptions(
    games: GameData[],
    criteria: GeneratorCriteria,
    stateCode?: string
  ): Partial<ScoredBet>[] {
    const bets: Partial<ScoredBet>[] = [];

    for (const game of games) {
      const dk = game.bookmakers.find((b) => b.key === 'draftkings');
      if (!dk) continue;

      for (const market of dk.markets) {
        // Skip if market not requested
        if (!this.isMarketRequested(market.key, criteria)) continue;

        // Skip if market not allowed in user's state
        if (!isMarketAllowedInState(market.key, game.sport, stateCode)) continue;

        for (const outcome of market.outcomes) {
          // Check odds range
          if (
            outcome.price < criteria.odds_min ||
            outcome.price > criteria.odds_max
          ) {
            continue;
          }

          const bet: Partial<ScoredBet> = {
            id: crypto.randomUUID(),
            sport: game.sport,
            event_id: game.id,
            event_name: `${game.away_team} @ ${game.home_team}`,
            commence_time: game.commence_time,
            market: market.key,
            pick: this.formatOutcomeLabel(market.key, outcome),
            odds: outcome.price,
            participant: outcome.participant || null,
            point: outcome.point || null,
            bet_kind: this.classifyBetKind(market.key),
            bet_tag: this.classifyBetTag(market.key, outcome),
            dk_link: generateDraftKingsLink(
              game.sport,
              game.home_team,
              game.away_team,
              game.commence_time
            ),
            rawData: { game, outcome, market },
          };

          bets.push(bet);
        }
      }
    }

    return bets;
  }

  /**
   * Score a bet based on multiple factors
   */
  private async scoreBet(
    bet: Partial<ScoredBet>,
    allGames: GameData[]
  ): Promise<ScoredBet> {
    const game = allGames.find((g) => g.id === bet.event_id);
    if (!game) {
      throw new Error(`Game not found: ${bet.event_id}`);
    }

    const factors: AnalyticsFactor[] = [];

    // 1. Calculate line value (compare to market consensus)
    const lineValue = this.calculateLineValue(bet, game);
    // ALWAYS include line value for transparency
    factors.push(lineValue);

    // 1.5. Elo rating analysis (for moneyline and spread bets)
    if (bet.market === 'h2h' || bet.market === 'spreads') {
      const eloFactor = this.analyzeEloRatings(bet, game);
      if (eloFactor && Math.abs(eloFactor.impact) > 0.5) {
        factors.push(eloFactor);
      }
    }

    // 2. Sharp money analysis (simulated for now)
    const sharpMoney = this.analyzeSharpMoney(bet, game);
    // Include if ANY impact (lowered threshold from 1)
    if (Math.abs(sharpMoney.impact) > 0.5) {
      factors.push(sharpMoney);
    }

    // 3. Weather impact (if applicable)
    if (game.weather && this.isOutdoorSport(bet.sport!)) {
      const weather = this.analyzeWeather(bet, game.weather);
      // Include if ANY impact (lowered threshold from 1)
      if (Math.abs(weather.impact) > 0.5) {
        factors.push(weather);
      }
    }

    // 4. Situational factors
    const situational = this.analyzeSituational(bet, game);
    factors.push(...situational);

    // 5. Add game timing context
    const gameTime = new Date(game.commence_time);
    const now = new Date();
    const hoursUntil = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      factors.push({
        type: 'neutral',
        category: 'timing',
        description: `Game starts in ${Math.round(hoursUntil)} hours - lines are more settled`,
        impact: 0.5,
      });
    } else if (hoursUntil > 72) {
      factors.push({
        type: 'negative',
        category: 'timing',
        description: `Game is ${Math.round(hoursUntil/24)} days away - injury news may shift lines`,
        impact: -0.5,
      });
    }

    // 5. Historical trends (would need database of historical data)
    // TODO: Implement when historical data available

    // 6. Key numbers analysis (NFL 3/7, NBA 2/3)
    if (bet.point !== null && bet.bet_kind === 'side') {
      const keyNumber = this.analyzeKeyNumbers(bet);
      if (keyNumber) factors.push(keyNumber);
    }

    // Calculate aggregate scores
    const edgeScore = this.calculateEdgeScore(factors);
    const confidenceScore = this.calculateConfidenceScore(factors, bet);

    // Advanced betting metrics
    const marketImpliedProb = impliedProbability(bet.odds!);

    // Convert confidence score to true probability estimate
    // Confidence score is 0-100, we adjust market probability by the edge
    const trueProbability = this.estimateTrueProbability(
      confidenceScore,
      edgeScore,
      marketImpliedProb
    );

    // Calculate EV and Kelly sizing
    const expectedValue = calculateEVPercentage(trueProbability, bet.odds!);
    const kelly = kellyBetSize(
      trueProbability,
      bet.odds!,
      this.kellyMultiplier, // User's Kelly preference
      0.01, // 1% minimum edge
      0.05  // 5% maximum bet
    );

    // Grade the bet
    const betGrade = this.gradeBet(expectedValue, kelly.edge, confidenceScore);

    return {
      ...(bet as ScoredBet),
      edgeScore,
      confidenceScore,
      factors,
      analytics: {
        edge: edgeScore,
        sharp_money_pct: null, // Would come from real sharp money API
        public_money_pct: null,
        line_movement: null,
        factors,
        // Advanced metrics
        expected_value: expectedValue,
        kelly_fraction: kelly.fraction,
        kelly_units: kelly.units,
        true_probability: trueProbability,
        implied_probability: marketImpliedProb,
        bet_grade: betGrade,
      },
      status: 'pending',
      locked_by_user: false,
      bet_id: '',
    };
  }

  /**
   * Calculate line value by comparing to consensus
   */
  private calculateLineValue(
    bet: Partial<ScoredBet>,
    game: GameData
  ): AnalyticsFactor {
    // Get all books' odds for this market/outcome
    const allOdds: number[] = [];
    for (const book of game.bookmakers) {
      const market = book.markets.find((m) => m.key === bet.market);
      if (!market) continue;

      const outcome = market.outcomes.find((o) => {
        if (bet.point !== undefined) {
          return o.name === bet.rawData.outcome.name && o.point === bet.point;
        }
        return o.name === bet.rawData.outcome.name;
      });

      if (outcome) allOdds.push(outcome.price);
    }

    if (allOdds.length < 2) {
      // For props, single bookmaker is acceptable (props are harder to price)
      // Don't penalize with 0 impact - return slight positive for props
      if (bet.bet_kind === 'prop' && allOdds.length === 1) {
        return {
          type: 'neutral',
          category: 'value',
          description: 'Single bookmaker (props often have limited markets)',
          impact: 0.5,  // Small positive for prop availability
        };
      }

      return {
        type: 'neutral',
        category: 'value',
        description: 'Insufficient market data',
        impact: 0,
      };
    }

    // Calculate average (consensus)
    const avgOdds = allOdds.reduce((a, b) => a + b, 0) / allOdds.length;

    // Convert to implied probability
    const betProb = this.oddsToImpliedProbability(bet.odds!);
    const consensusProb = this.oddsToImpliedProbability(avgOdds);

    // Calculate edge as percentage difference
    const edge = ((consensusProb - betProb) / betProb) * 100;

    const impact = edge * 0.5; // Scale to 0-10

    // Create more detailed description
    let description: string;
    if (edge > 2) {
      description = `+${edge.toFixed(1)}% better value than market consensus (${allOdds.length} books averaged)`;
    } else if (edge < -2) {
      description = `${edge.toFixed(1)}% worse value than consensus - public overloading this side`;
    } else if (edge > 0.5) {
      description = `Slight edge vs market (+${edge.toFixed(1)}%) - decent value here`;
    } else if (edge < -0.5) {
      description = `Slightly worse than consensus (${edge.toFixed(1)}%) but within variance`;
    } else {
      description = `Fair market value - odds aligned with ${allOdds.length} books`;
    }

    return {
      type: edge > 0.5 ? 'positive' : edge < -2 ? 'negative' : 'neutral',
      category: 'value',
      description,
      impact: Math.min(Math.max(impact, -5), 5),
    };
  }

  /**
   * Analyze sharp money movement (simulated)
   */
  private analyzeSharpMoney(
    bet: Partial<ScoredBet>,
    game: GameData
  ): AnalyticsFactor {
    // In production, this would call a sharp money API or track line movements
    // For now, we'll use DraftKings vs Pinnacle as proxy (Pinnacle = sharp)

    const pinnacle = game.bookmakers.find((b) => b.key === 'pinnacle');
    const draftkings = game.bookmakers.find((b) => b.key === 'draftkings');

    if (!pinnacle || !draftkings) {
      return {
        type: 'neutral',
        category: 'sharp',
        description: 'No sharp book comparison available',
        impact: 0,
      };
    }

    // Compare odds between sharp (Pinnacle) and public (DK)
    // If DK has better odds than Pinnacle, public is overloading one side
    const pinnacleMarket = pinnacle.markets.find((m) => m.key === bet.market);
    const dkMarket = draftkings.markets.find((m) => m.key === bet.market);

    if (!pinnacleMarket || !dkMarket) {
      return {
        type: 'neutral',
        category: 'sharp',
        description: 'Market not available at both books',
        impact: 0,
      };
    }

    const pinnacleOutcome = pinnacleMarket.outcomes.find(
      (o) => o.name === bet.rawData.outcome.name
    );
    const dkOutcome = dkMarket.outcomes.find(
      (o) => o.name === bet.rawData.outcome.name
    );

    if (!pinnacleOutcome || !dkOutcome) {
      return {
        type: 'neutral',
        category: 'sharp',
        description: 'Outcome not found',
        impact: 0,
      };
    }

    // If DK odds are better (higher), public is on opposite side = good for us
    const oddsGap = dkOutcome.price - pinnacleOutcome.price;

    let description: string;
    let impact: number;
    let type: 'positive' | 'negative' | 'neutral';

    if (oddsGap > 10) {
      description = 'Sharp money likely on this side (DK adjusting line)';
      impact = 3;
      type = 'positive';
    } else if (oddsGap < -10) {
      description = 'Public heavy on this side (worse value)';
      impact = -2;
      type = 'negative';
    } else {
      description = 'Balanced action';
      impact = 0;
      type = 'neutral';
    }

    return { type, category: 'sharp', description, impact };
  }

  /**
   * Analyze weather impact
   */
  private analyzeWeather(
    bet: Partial<ScoredBet>,
    weather: WeatherData
  ): AnalyticsFactor {
    let impact = 0;
    const descriptions: string[] = [];

    // Wind
    if (weather.wind_speed > 20) {
      if (bet.bet_kind === 'total' && bet.bet_tag === 'under') {
        impact += 2.5;
        descriptions.push(`${weather.wind_speed}mph winds favor under`);
      } else if (bet.market?.includes('pass')) {
        impact -= 2;
        descriptions.push(`${weather.wind_speed}mph winds hurt passing`);
      }
    } else if (weather.wind_speed > 15) {
      if (bet.bet_kind === 'total' && bet.bet_tag === 'under') {
        impact += 1.5;
        descriptions.push(`${weather.wind_speed}mph winds slightly favor under`);
      }
    }

    // Temperature
    if (weather.temperature < 32) {
      if (bet.bet_kind === 'total' && bet.bet_tag === 'under') {
        impact += 1;
        descriptions.push(`Cold weather (${weather.temperature}°F) favors defense`);
      }
    }

    // Precipitation
    if (weather.precipitation > 60) {
      if (bet.bet_kind === 'total' && bet.bet_tag === 'under') {
        impact += 2;
        descriptions.push(`Heavy rain (${weather.precipitation}%) favors run game`);
      } else if (bet.market?.includes('pass') || bet.market?.includes('reception')) {
        impact -= 1.5;
        descriptions.push(`Rain hurts passing game`);
      }
    }

    const type =
      impact > 1 ? 'positive' : impact < -1 ? 'negative' : 'neutral';

    return {
      type,
      category: 'weather',
      description: descriptions.join('; ') || 'Good conditions',
      impact,
    };
  }

  /**
   * Analyze Elo ratings and matchup quality
   */
  private analyzeEloRatings(
    bet: Partial<ScoredBet>,
    game: GameData
  ): AnalyticsFactor | null {
    const matchup = this.teamData.getMatchupData(
      game.home_team,
      game.away_team,
      bet.sport!
    );

    const eloDiff = matchup.elo_difference;
    const homeWinProb = matchup.home_win_probability;

    // Determine if bet aligns with Elo prediction
    let impact = 0;
    let description = '';
    let type: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (bet.market === 'h2h') {
      // Moneyline bet
      const bettingOnHome = bet.rawData.outcome.name === game.home_team;

      if (bettingOnHome && homeWinProb > 0.55) {
        impact = (homeWinProb - 0.5) * 8; // Scale impact
        description = `Elo favors ${game.home_team} (${(homeWinProb * 100).toFixed(1)}% win probability, +${eloDiff.toFixed(0)} Elo edge)`;
        type = 'positive';
      } else if (!bettingOnHome && homeWinProb < 0.45) {
        impact = (0.5 - homeWinProb) * 8;
        description = `Elo favors ${game.away_team} (${((1 - homeWinProb) * 100).toFixed(1)}% win probability, ${eloDiff.toFixed(0)} Elo underdog)`;
        type = 'positive';
      } else if (Math.abs(homeWinProb - 0.5) < 0.05) {
        description = `Elo sees this as a toss-up (${(homeWinProb * 100).toFixed(1)}% vs ${((1 - homeWinProb) * 100).toFixed(1)}%)`;
        type = 'neutral';
        impact = 0;
      } else {
        // Betting against Elo prediction
        description = `Elo model disagrees with this pick`;
        type = 'negative';
        impact = -1.5;
      }
    } else if (bet.market === 'spreads') {
      // Spread bet - compare Elo implied spread to actual spread
      // Rough conversion: 25 Elo points ≈ 1 point spread
      const eloImpliedSpread = eloDiff / 25;
      const actualSpread = bet.point || 0;
      const spreadDiff = Math.abs(eloImpliedSpread - Math.abs(actualSpread));

      if (spreadDiff > 2) {
        description = `Elo model suggests ${spreadDiff.toFixed(1)} point difference from market spread`;
        type = 'positive';
        impact = Math.min(spreadDiff * 0.8, 3);
      } else if (spreadDiff < 0.5) {
        description = `Elo model aligns with market spread`;
        type = 'neutral';
        impact = 0.5;
      }
    }

    // Add rivalry/division bonus
    if (matchup.is_rivalry) {
      description += ` • Rivalry game (tends to be closer)`;
      if (bet.bet_kind === 'side') {
        impact -= 0.5; // Favorites don't cover as well in rivalries
      }
    }

    if (matchup.is_division) {
      description += ` • Division game`;
      if (bet.bet_kind === 'side') {
        impact -= 0.3; // Division games tend to be tighter
      }
    }

    if (Math.abs(impact) < 0.3) return null;

    return {
      type,
      category: 'matchup',
      description,
      impact: Math.max(-5, Math.min(5, impact)),
    };
  }

  /**
   * Analyze situational factors
   */
  private analyzeSituational(
    bet: Partial<ScoredBet>,
    game: GameData
  ): AnalyticsFactor[] {
    const factors: AnalyticsFactor[] = [];

    // Time of game (primetime, early west coast, etc)
    const gameHour = new Date(game.commence_time).getUTCHours();

    if (bet.sport === 'americanfootball_nfl') {
      // Thursday night games tend to be lower scoring
      const dayOfWeek = new Date(game.commence_time).getUTCDay();
      if (dayOfWeek === 4) {
        // Thursday
        if (bet.bet_kind === 'total' && bet.bet_tag === 'under') {
          factors.push({
            type: 'positive',
            category: 'situation',
            description: 'Thursday night games average 3pts lower than season avg',
            impact: 1.5,
          });
        }
      }

      // Division games tend to be tighter
      // (Would need team data to determine)
    }

    if (
      bet.sport === 'basketball_nba' ||
      bet.sport === 'basketball_ncaab'
    ) {
      // Back-to-back games (would need schedule data)
      // For now, placeholder
    }

    // Playoff implications (would need standings data)

    return factors;
  }

  /**
   * Analyze key numbers
   */
  private analyzeKeyNumbers(bet: Partial<ScoredBet>): AnalyticsFactor | null {
    if (bet.sport === 'americanfootball_nfl' && bet.point !== null) {
      const point = Math.abs(bet.point);

      if (point === 3) {
        return {
          type: 'positive',
          category: 'value',
          description: 'Landing on key number 3 (most common NFL margin)',
          impact: 2,
        };
      } else if (point === 7) {
        return {
          type: 'positive',
          category: 'value',
          description: 'Landing on key number 7 (touchdown)',
          impact: 1.5,
        };
      } else if (point === 2.5 || point === 3.5) {
        return {
          type: 'positive',
          category: 'value',
          description: `Crossing key number 3`,
          impact: 1,
        };
      }
    }

    return null;
  }

  /**
   * Calculate aggregate edge score
   * Focuses on predictive factors (Elo, trends, matchups) over just market consensus
   */
  private calculateEdgeScore(factors: AnalyticsFactor[]): number {
    const weights = {
      value: 0.15,      // Reduced - market consensus is less important
      sharp: 0.20,      // Sharp money still valuable
      weather: 0.15,    // Weather impacts outcomes
      situation: 0.25,  // Increased - situational edges are key
      trend: 0.15,      // Increased - recent performance matters
      matchup: 0.15,    // Increased - matchup analysis matters
    };

    let totalImpact = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      const weight = weights[factor.category] || 0.1;
      totalImpact += factor.impact * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalImpact / totalWeight : 0;
  }

  /**
   * Calculate confidence score (0-10)
   */
  private calculateConfidenceScore(
    factors: AnalyticsFactor[],
    bet: Partial<ScoredBet>
  ): number {
    const edgeScore = this.calculateEdgeScore(factors);

    // Factor in number of supporting factors
    const positiveFactors = factors.filter((f) => f.type === 'positive').length;
    const negativeFactors = factors.filter((f) => f.type === 'negative').length;

    const factorScore = (positiveFactors - negativeFactors) * 0.5;

    // Combine edge and factor count
    let confidence = 5 + edgeScore + factorScore;

    // Bonus for props (typically have more exploitable edges)
    if (bet.bet_kind === 'prop') {
      confidence += 1.5;  // Increased from 0.5 - props are harder for books to price
    }

    // Bonus for favorable odds range (sweet spot is -110 to +150)
    const odds = bet.odds || 0;
    if (odds >= -110 && odds <= 150) {
      confidence += 0.5;  // Fair odds range bonus
    }

    // Clamp to 0-10
    return Math.max(0, Math.min(10, confidence));
  }

  /**
   * Build optimal parlay respecting constraints
   */
  private buildParlay(
    scoredBets: ScoredBet[],
    targetLegs: number,
    sgpMode: 'none' | 'allow' | 'only',
    lockedLegs: BetLeg[]
  ): ScoredBet[] {
    const parlay: ScoredBet[] = [];
    const usedEvents = new Set<string>();
    const usedEventMarkets = new Map<string, Set<string>>();
    const usedEventPropKeys = new Map<string, Set<string>>(); // Track prop conflicts per event
    const usedEventHasSide = new Map<string, boolean>(); // Track if event has side bet
    const usedEventHasTotal = new Map<string, boolean>(); // Track if event has total bet

    // Add locked legs first
    for (const locked of lockedLegs) {
      const match = scoredBets.find(
        (b) =>
          b.event_id === locked.event_id &&
          b.market === locked.market &&
          b.pick === locked.pick
      );
      if (match) {
        parlay.push(match);
        usedEvents.add(match.event_id);

        if (!usedEventMarkets.has(match.event_id)) {
          usedEventMarkets.set(match.event_id, new Set());
        }
        usedEventMarkets.get(match.event_id)!.add(match.market);

        // Track prop conflicts for locked legs
        if (match.bet_kind === 'prop') {
          if (!usedEventPropKeys.has(match.event_id)) {
            usedEventPropKeys.set(match.event_id, new Set());
          }
          usedEventPropKeys.get(match.event_id)!.add(this.propConflictKey(match));
        }

        // Track side/total for locked legs
        if (match.bet_kind === 'side') {
          usedEventHasSide.set(match.event_id, true);
        }
        if (match.bet_kind === 'total') {
          usedEventHasTotal.set(match.event_id, true);
        }
      }
    }

    // Identify prop-capable events for reservation
    const propEventIds = new Set<string>(
      scoredBets
        .filter((b) => b.bet_kind === 'prop')
        .map((b) => b.event_id)
    );

    // Count prop vs standard legs needed
    const propsInLocked = parlay.filter(p => p.bet_kind === 'prop').length;
    const standardInLocked = parlay.filter(p => p.bet_kind === 'side' || p.bet_kind === 'total').length;
    const remainingLegs = targetLegs - parlay.length;

    // Fill remaining legs with sport diversity
    const usedSports = new Set<string>();
    const sportsRequested = new Set(scoredBets.map(b => b.sport));

    // First pass: Try to get one leg from each sport for diversity
    if (sgpMode === 'none' && sportsRequested.size > 1) {
      for (const bet of scoredBets) {
        if (parlay.length >= targetLegs) break;
        if (parlay.some((p) => p.id === bet.id)) continue;
        if (usedEvents.has(bet.event_id)) continue;
        if (usedSports.has(bet.sport)) continue; // Skip if we already have this sport

        // PROP RESERVATION: Don't use prop-capable events for standard bets if we need props
        const isStandardBet = bet.bet_kind === 'side' || bet.bet_kind === 'total';
        const needMoreProps = propsInLocked === 0 && propEventIds.size > 0;
        if (isStandardBet && needMoreProps && propEventIds.has(bet.event_id)) {
          continue; // Reserve this event for prop picks
        }

        parlay.push(bet);
        usedEvents.add(bet.event_id);
        usedSports.add(bet.sport);

        if (!usedEventMarkets.has(bet.event_id)) {
          usedEventMarkets.set(bet.event_id, new Set());
        }
        usedEventMarkets.get(bet.event_id)!.add(bet.market);

        // Track conflicts
        if (bet.bet_kind === 'prop') {
          if (!usedEventPropKeys.has(bet.event_id)) {
            usedEventPropKeys.set(bet.event_id, new Set());
          }
          usedEventPropKeys.get(bet.event_id)!.add(this.propConflictKey(bet));
        }
        if (bet.bet_kind === 'side') usedEventHasSide.set(bet.event_id, true);
        if (bet.bet_kind === 'total') usedEventHasTotal.set(bet.event_id, true);
      }
    }

    // Second pass: Fill remaining legs (can now repeat sports if needed)
    for (const bet of scoredBets) {
      if (parlay.length >= targetLegs) break;

      // Skip if already in parlay
      if (parlay.some((p) => p.id === bet.id)) continue;

      // SGP constraints
      if (sgpMode === 'none' && usedEvents.has(bet.event_id)) continue;

      // Fix SGP 'only' mode: after first leg, only allow legs from SAME event
      if (sgpMode === 'only') {
        if (usedEvents.size === 0) {
          // First leg - any event is fine
        } else {
          // After first leg - must be from the same event
          const firstEventId = Array.from(usedEvents)[0];
          if (bet.event_id !== firstEventId) continue;
        }
      }

      // Advanced conflict detection for same game parlays
      if (usedEvents.has(bet.event_id)) {
        // Check prop conflicts (same player, same market, different lines)
        if (bet.bet_kind === 'prop') {
          const propKey = this.propConflictKey(bet);
          if (usedEventPropKeys.has(bet.event_id) &&
              usedEventPropKeys.get(bet.event_id)!.has(propKey)) {
            continue; // Skip duplicate prop
          }
        }

        // Prevent multiple side bets (moneyline + spread conflict)
        if (bet.bet_kind === 'side' && usedEventHasSide.get(bet.event_id)) {
          continue;
        }

        // Prevent multiple total bets from same game
        if (bet.bet_kind === 'total' && usedEventHasTotal.get(bet.event_id)) {
          continue;
        }
      }

      // Add to parlay
      parlay.push(bet);
      usedEvents.add(bet.event_id);

      if (!usedEventMarkets.has(bet.event_id)) {
        usedEventMarkets.set(bet.event_id, new Set());
      }
      usedEventMarkets.get(bet.event_id)!.add(bet.market);

      // Track prop conflicts
      if (bet.bet_kind === 'prop') {
        if (!usedEventPropKeys.has(bet.event_id)) {
          usedEventPropKeys.set(bet.event_id, new Set());
        }
        usedEventPropKeys.get(bet.event_id)!.add(this.propConflictKey(bet));
      }

      // Track side/total usage
      if (bet.bet_kind === 'side') {
        usedEventHasSide.set(bet.event_id, true);
      }
      if (bet.bet_kind === 'total') {
        usedEventHasTotal.set(bet.event_id, true);
      }
    }

    return parlay;
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate unique conflict key for props to prevent duplicate player/stat combinations
   * Format: market|participant|point
   * Example: "player_points|patrick mahomes|250.5"
   */
  private propConflictKey(bet: Partial<ScoredBet>): string {
    const market = String(bet.market || '');
    const participant = String(bet.participant || '');
    const point = bet.point === 0 || bet.point ? String(bet.point) : '';
    const id = participant ? participant : String(bet.pick || '');
    return `${market}|${id}|${point}`.toLowerCase();
  }

  private oddsToImpliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }

  private isMarketRequested(market: Market, criteria: GeneratorCriteria): boolean {
    if (criteria.bet_types.includes('moneyline') && market === 'h2h') return true;
    if (criteria.bet_types.includes('spread') && market === 'spreads') return true;
    if (criteria.bet_types.includes('over_under') && market === 'totals') return true;
    if (criteria.extra_markets.some((m) => market.includes(m))) return true;
    return false;
  }

  private classifyBetKind(market: Market): 'side' | 'total' | 'prop' {
    if (market === 'h2h' || market === 'spreads') return 'side';
    if (market === 'totals') return 'total';
    return 'prop';
  }

  private classifyBetTag(market: Market, outcome: any): string | null {
    if (market === 'h2h') {
      return outcome.price < 0 ? 'favorite' : 'underdog';
    }
    if (market === 'spreads') {
      return outcome.point < 0 ? 'favorite' : 'underdog';
    }
    if (market === 'totals') {
      return outcome.name.toLowerCase().includes('over') ? 'over' : 'under';
    }
    return null;
  }

  private formatOutcomeLabel(market: Market, outcome: any): string {
    if (market === 'h2h') return outcome.name;

    if (market === 'spreads') {
      const point = outcome.point > 0 ? `+${outcome.point}` : outcome.point;
      return `${outcome.name} ${point}`;
    }

    if (market === 'totals') {
      return `${outcome.name} ${outcome.point}`;
    }

    // Props
    const participant = outcome.participant || outcome.description || '';
    const point = outcome.point ? ` ${outcome.point}` : '';
    return `${participant} ${outcome.name}${point}`.trim();
  }

  private isOutdoorSport(sport: Sport): boolean {
    return (
      sport === 'americanfootball_nfl' || sport === 'americanfootball_ncaaf'
    );
  }

  /**
   * Estimate true win probability based on confidence score and edge
   *
   * This converts our internal confidence/edge scores into a win probability
   * that can be compared against market odds.
   */
  private estimateTrueProbability(
    confidenceScore: number, // 0-100
    edgeScore: number, // typically -5 to +5
    marketImpliedProb: number // 0-1
  ): number {
    // Start with market probability as baseline
    // Add edge as adjustment (edgeScore represents percentage points)
    // Scale confidence to weight the adjustment
    const confidenceWeight = Math.min(confidenceScore / 100, 1);
    const edgeAdjustment = (edgeScore / 100) * confidenceWeight;

    let trueProbability = marketImpliedProb + edgeAdjustment;

    // Clamp between 0.05 and 0.95 (never say impossible or certain)
    trueProbability = Math.max(0.05, Math.min(0.95, trueProbability));

    return trueProbability;
  }

  /**
   * Grade a bet based on confidence and analytical factors
   * Focus on probability of hitting vs odds, not just raw EV
   *
   * S = Elite (strong analytical edge)
   * A = Excellent (good analytical support)
   * B = Good (some analytical edge)
   * C = Decent (slight edge or fair)
   * D = Marginal (no edge)
   */
  private gradeBet(
    expectedValue: number,
    edge: number,
    confidenceScore: number
  ): 'S' | 'A' | 'B' | 'C' | 'D' {
    // Grade primarily on confidence score (analytical factors)
    // EV is less important than quality of analysis
    if (confidenceScore >= 8) return 'S';
    if (confidenceScore >= 7) return 'A';
    if (confidenceScore >= 6) return 'B';
    if (confidenceScore >= 5) return 'C';
    return 'D';
  }
}
