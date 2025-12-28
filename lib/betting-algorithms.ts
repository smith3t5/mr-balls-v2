// Advanced Betting Algorithms
// Mathematical framework for profitable betting over time

/**
 * Calculate Expected Value (EV) for a bet
 */
export function calculateEV(
  trueProbability: number,
  americanOdds: number,
  stake: number = 100
): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const payout = stake * decimalOdds;
  const profit = payout - stake;

  const ev = trueProbability * profit - (1 - trueProbability) * stake;
  return ev;
}

/**
 * Calculate EV as a percentage of stake
 */
export function calculateEVPercentage(
  trueProbability: number,
  americanOdds: number
): number {
  const ev = calculateEV(trueProbability, americanOdds, 100);
  return (ev / 100) * 100; // Return as percentage
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  } else {
    return 1 + 100 / Math.abs(americanOdds);
  }
}

/**
 * Convert American odds to implied probability
 */
export function impliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Calculate the true edge (your model vs market)
 */
export function calculateEdge(
  trueProbability: number,
  americanOdds: number
): number {
  const marketImplied = impliedProbability(americanOdds);
  return trueProbability - marketImplied;
}

/**
 * Kelly Criterion - Optimal bet sizing
 * Returns fraction of bankroll to bet
 *
 * @param trueProbability Your model's win probability
 * @param americanOdds The odds you're getting
 * @param kellyFraction Safety multiplier (0.25 for quarter Kelly, 0.5 for half Kelly)
 * @param minEdge Minimum edge required to bet (default 2%)
 * @param maxBet Maximum fraction of bankroll (default 5%)
 */
export function kellyBetSize(
  trueProbability: number,
  americanOdds: number,
  kellyFraction: number = 0.25,
  minEdge: number = 0.001, // Lowered from 2% to 0.1% - trust analytical grading
  maxBet: number = 0.05
): {
  fraction: number;
  units: number;
  edge: number;
  ev: number;
  shouldBet: boolean;
  reason?: string;
} {
  // Calculate edge first
  const edge = calculateEdge(trueProbability, americanOdds);

  // Don't bet if edge is too small
  if (edge < minEdge) {
    return {
      fraction: 0,
      units: 0,
      edge,
      ev: calculateEVPercentage(trueProbability, americanOdds),
      shouldBet: false,
      reason: `Edge ${(edge * 100).toFixed(2)}% below minimum ${(minEdge * 100).toFixed(2)}%`,
    };
  }

  // Calculate Kelly fraction
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1; // Net odds
  const p = trueProbability;
  const q = 1 - trueProbability;

  const fullKelly = (b * p - q) / b;

  // Apply safety fraction and cap at max bet
  let betFraction = fullKelly * kellyFraction;
  betFraction = Math.max(0, Math.min(betFraction, maxBet));

  // Convert to units (assume 1% of bankroll = 1 unit)
  const units = betFraction * 100;

  return {
    fraction: betFraction,
    units,
    edge,
    ev: calculateEVPercentage(trueProbability, americanOdds),
    shouldBet: betFraction > 0,
  };
}

/**
 * Calculate Closing Line Value (CLV)
 * Positive CLV indicates you beat the closing line
 */
export function calculateCLV(
  yourOdds: number,
  closingOdds: number
): number {
  const yourDecimal = americanToDecimal(yourOdds);
  const closingDecimal = americanToDecimal(closingOdds);

  return (closingDecimal / yourDecimal) - 1;
}

/**
 * Poisson probability mass function
 * P(X = k) = (λ^k * e^-λ) / k!
 */
function poissonPMF(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate game outcome probabilities using Poisson distribution
 * Used for sports with discrete scoring (soccer, hockey, baseball to some extent)
 */
export function poissonGameProbabilities(
  homeExpectedGoals: number,
  awayExpectedGoals: number,
  maxGoals: number = 8
): {
  homeWin: number;
  awayWin: number;
  draw: number;
  overUnder: Map<number, { over: number; under: number }>;
} {
  let homeWin = 0;
  let awayWin = 0;
  let draw = 0;

  const overUnder = new Map<number, { over: number; under: number }>();

  // Calculate probability matrix
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
      const prob =
        poissonPMF(homeExpectedGoals, homeGoals) *
        poissonPMF(awayExpectedGoals, awayGoals);

      if (homeGoals > awayGoals) homeWin += prob;
      else if (awayGoals > homeGoals) awayWin += prob;
      else draw += prob;

      // Calculate over/under for various totals
      const totalGoals = homeGoals + awayGoals;
      for (let line = 0.5; line <= 7.5; line += 0.5) {
        if (!overUnder.has(line)) {
          overUnder.set(line, { over: 0, under: 0 });
        }

        const current = overUnder.get(line)!;
        if (totalGoals > line) {
          current.over += prob;
        } else {
          current.under += prob;
        }
      }
    }
  }

  return { homeWin, awayWin, draw, overUnder };
}

/**
 * Simple Elo rating system for teams
 */
export class EloSystem {
  private kFactor: number;
  private homeAdvantage: number;

  constructor(kFactor: number = 32, homeAdvantage: number = 65) {
    this.kFactor = kFactor;
    this.homeAdvantage = homeAdvantage;
  }

  /**
   * Calculate expected win probability
   */
  expectedResult(ratingA: number, ratingB: number, isHomeTeam: boolean = false): number {
    const adjustedRatingA = isHomeTeam ? ratingA + this.homeAdvantage : ratingA;
    return 1 / (1 + Math.pow(10, (ratingB - adjustedRatingA) / 400));
  }

  /**
   * Update ratings after a game
   * @param actualResult 1 for win, 0.5 for draw, 0 for loss
   */
  updateRatings(
    winnerRating: number,
    loserRating: number,
    actualResult: number,
    isHomeTeam: boolean = false
  ): { newWinnerRating: number; newLoserRating: number } {
    const expected = this.expectedResult(winnerRating, loserRating, isHomeTeam);

    const winnerChange = this.kFactor * (actualResult - expected);
    const loserChange = this.kFactor * ((1 - actualResult) - (1 - expected));

    return {
      newWinnerRating: winnerRating + winnerChange,
      newLoserRating: loserRating + loserChange,
    };
  }

  /**
   * Convert Elo difference to win probability
   */
  eloDifferenceToWinProb(eloDiff: number): number {
    return 1 / (1 + Math.pow(10, -eloDiff / 400));
  }
}

/**
 * Sharpe Ratio for betting - risk-adjusted return metric
 * Higher is better (>1 is good, >2 is excellent)
 */
export function calculateSharpeRatio(
  returns: number[], // Array of bet returns (as decimals, e.g., 0.10 for 10% return)
  riskFreeRate: number = 0 // Assume 0 for betting
): number {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (avgReturn - riskFreeRate) / stdDev;
}

/**
 * Calculate required bankroll for given risk of ruin
 * Using simplified rule of thumb
 */
export function requiredBankroll(
  avgEdge: number, // As decimal (0.05 for 5%)
  avgOdds: number, // Average decimal odds
  riskOfRuin: number = 0.01, // 1% risk of ruin
  kellyFraction: number = 0.25
): {
  unitsRequired: number;
  explanation: string;
} {
  // Simplified calculation based on Kelly Criterion variance
  // More accurate would require Monte Carlo simulation

  const kellySizePerBet = (avgEdge * kellyFraction) / (avgOdds - 1);
  const numberOfBets = Math.log(riskOfRuin) / Math.log(1 - kellySizePerBet);
  const unitsRequired = Math.ceil(numberOfBets / kellyFraction);

  return {
    unitsRequired,
    explanation: `With ${(avgEdge * 100).toFixed(2)}% average edge and ${(
      kellyFraction * 100
    ).toFixed(0)}% Kelly, you need ${unitsRequired} units to maintain ${(
      (1 - riskOfRuin) *
      100
    ).toFixed(0)}% survival probability`,
  };
}

/**
 * Track and evaluate bet performance
 */
export interface BetRecord {
  id: string;
  trueProbability: number;
  odds: number;
  closingOdds?: number;
  result: 'win' | 'loss' | 'push';
  stake: number;
  profit: number;
  timestamp: number;
}

export class PerformanceTracker {
  private bets: BetRecord[] = [];

  addBet(bet: BetRecord) {
    this.bets.push(bet);
  }

  getMetrics(): {
    totalBets: number;
    winRate: number;
    roi: number;
    averageCLV: number;
    sharpeRatio: number;
    totalProfit: number;
    avgEdge: number;
    yieldPercentage: number;
  } {
    if (this.bets.length === 0) {
      return {
        totalBets: 0,
        winRate: 0,
        roi: 0,
        averageCLV: 0,
        sharpeRatio: 0,
        totalProfit: 0,
        avgEdge: 0,
        yieldPercentage: 0,
      };
    }

    const wins = this.bets.filter((b) => b.result === 'win').length;
    const winRate = wins / this.bets.length;

    const totalStaked = this.bets.reduce((sum, bet) => sum + bet.stake, 0);
    const totalProfit = this.bets.reduce((sum, bet) => sum + bet.profit, 0);
    const roi = (totalProfit / totalStaked) * 100;

    const clvBets = this.bets.filter((b) => b.closingOdds !== undefined);
    const averageCLV =
      clvBets.length > 0
        ? clvBets.reduce(
            (sum, bet) => sum + calculateCLV(bet.odds, bet.closingOdds!),
            0
          ) / clvBets.length
        : 0;

    const returns = this.bets.map((bet) => bet.profit / bet.stake);
    const sharpeRatio = calculateSharpeRatio(returns);

    const avgEdge =
      this.bets.reduce(
        (sum, bet) => sum + calculateEdge(bet.trueProbability, bet.odds),
        0
      ) / this.bets.length;

    const yieldPercentage = roi;

    return {
      totalBets: this.bets.length,
      winRate,
      roi,
      averageCLV,
      sharpeRatio,
      totalProfit,
      avgEdge,
      yieldPercentage,
    };
  }

  /**
   * Get calibration curve - are your probability estimates accurate?
   * Returns bins of [predicted probability, actual win rate]
   */
  getCalibrationCurve(bins: number = 10): Array<{
    predictedProb: number;
    actualWinRate: number;
    count: number;
  }> {
    const binSize = 1 / bins;
    const binned: Array<{ predictedProb: number; actualWinRate: number; count: number }> =
      [];

    for (let i = 0; i < bins; i++) {
      const minProb = i * binSize;
      const maxProb = (i + 1) * binSize;
      const betsInBin = this.bets.filter(
        (b) => b.trueProbability >= minProb && b.trueProbability < maxProb
      );

      if (betsInBin.length > 0) {
        const wins = betsInBin.filter((b) => b.result === 'win').length;
        binned.push({
          predictedProb: (minProb + maxProb) / 2,
          actualWinRate: wins / betsInBin.length,
          count: betsInBin.length,
        });
      }
    }

    return binned;
  }
}

/**
 * Market efficiency detection
 * Helps identify which markets/sports have the most opportunity
 */
export function detectMarketEfficiency(bets: BetRecord[]): {
  efficiency: number; // 0-1, higher = more efficient (harder to beat)
  recommendation: string;
} {
  const tracker = new PerformanceTracker();
  bets.forEach((bet) => tracker.addBet(bet));

  const metrics = tracker.getMetrics();

  // Efficient markets have:
  // - Small average CLV
  // - Low edge
  // - Win rate close to implied probability

  const efficiencyScore =
    1 - Math.abs(metrics.averageCLV) * 10 - Math.abs(metrics.avgEdge) * 5;
  const efficiency = Math.max(0, Math.min(1, efficiencyScore));

  let recommendation = '';
  if (efficiency < 0.5) {
    recommendation = 'Market shows inefficiencies - good opportunity for value betting';
  } else if (efficiency < 0.75) {
    recommendation = 'Moderately efficient - selective betting required';
  } else {
    recommendation = 'Highly efficient market - very difficult to beat consistently';
  }

  return { efficiency, recommendation };
}
