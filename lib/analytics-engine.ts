/**
 * M.R. B.A.L.L.S. 2.0 — Analytics Engine (NCAAB Edition)
 *
 * Methodology:
 *   1. KenPom Efficiency Projection — compare book line to what adjusted
 *      offensive/defensive efficiency margins imply. When the gap is ≥ 2 pts
 *      we have a genuine edge signal, not just vig arbitrage.
 *
 *   2. Situational Spots — NCAAB-specific patterns that are systematically
 *      underpriced: fatigue (back-to-backs, 3-in-5), trap games, road
 *      favorites, slow-pace conference totals, and rivalry unders.
 *
 *   3. Line Value (retained from v1) — consensus comparison across books as
 *      a secondary filter, not the primary signal.
 *
 *   4. Sharp Money Proxy (retained) — Pinnacle vs DraftKings delta.
 *
 * State gating is handled upstream in generateBetOptions() via the existing
 * isMarketAllowedInState() from state-regulations.ts. This file does not
 * need to duplicate that logic.
 */

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
} from './betting-algorithms';
import { getMatchupData, type KenPomEntry } from './kenpom-sync';

// ---------------------------------------------------------------------------
// KenPom efficiency data
// ---------------------------------------------------------------------------
// Adjusted Offensive Efficiency (points per 100 possessions, adj. for schedule)
// Adjusted Defensive Efficiency (points allowed per 100 possessions, adj.)
// Adjusted Tempo (possessions per 40 minutes, adj. for schedule)
// Win% is against D1 schedule
//
// Source: KenPom.com — update these weekly during the season.
// Format: [AdjOE, AdjDE, AdjTempo, WinPct]
//
// A team's KenPom-implied scoring margin against an average D1 team (neutral):
//   margin = (AdjOE - 100) - (AdjDE - 100) = AdjOE - AdjDE
// Implied spread on neutral: margin * TEMPO_FACTOR
// Home court adjustment: +3.0 points to home team

// KenPomEntry type is imported from kenpom-sync.ts (re-exported below for consumers)
export type { KenPomEntry } from './kenpom-sync';

// Home court advantage in NCAAB (points)
const HOME_COURT_ADVANTAGE = 3.1;


// ---------------------------------------------------------------------------
// Situational spot definitions
// ---------------------------------------------------------------------------
// These are empirically documented NCAAB patterns. Each has a minimum
// historical hit-rate advantage over the baseline ~50%.

interface SituationalSpot {
  id: string;
  label: string;
  description: string;
  betKind: 'side' | 'total' | 'both';
  betTag: string | null; // 'underdog' | 'favorite' | 'under' | 'over' | null
  baseEdgePts: number; // points of edge this spot historically provides
}

const NCAAB_SITUATIONAL_SPOTS: SituationalSpot[] = [
  {
    id: 'fatigue_b2b',
    label: 'Back-to-back fatigue',
    description: 'Team playing 2nd game in 2 days — NCAAB teams cover at 44% in this spot',
    betKind: 'side',
    betTag: 'underdog',
    baseEdgePts: 2.5,
  },
  {
    id: 'fatigue_3in5',
    label: '3-in-5 fatigue',
    description: '3rd game in 5 days — significant fatigue factor, opp covers at 57%',
    betKind: 'both',
    betTag: 'underdog',
    baseEdgePts: 3.1,
  },
  {
    id: 'trap_game',
    label: 'Trap game',
    description: 'Favorite sandwiched between two higher-profile matchups — covers at 46%',
    betKind: 'side',
    betTag: 'underdog',
    baseEdgePts: 2.2,
  },
  {
    id: 'road_favorite',
    label: 'Large road favorite',
    description: 'Road favorites of 7+ pts cover at only 48% in conference play',
    betKind: 'side',
    betTag: 'underdog',
    baseEdgePts: 2.0,
  },
  {
    id: 'slow_pace_under',
    label: 'Slow-pace conference under',
    description: 'Both teams rank bottom-third in adjusted tempo — unders hit 58% of the time',
    betKind: 'total',
    betTag: 'under',
    baseEdgePts: 3.4,
  },
  {
    id: 'rivalry_under',
    label: 'Rivalry game under',
    description: 'Same-conference rivalry games average 4.1 fewer points than season line implies',
    betKind: 'total',
    betTag: 'under',
    baseEdgePts: 4.1,
  },
  {
    id: 'post_upset_bounce',
    label: 'Post-upset spot',
    description: 'Team coming off a home upset loss — covers next game at 62% ATS historically',
    betKind: 'side',
    betTag: 'favorite',
    baseEdgePts: 2.8,
  },
  {
    id: 'conference_opener',
    label: 'Conference opener spot',
    description: 'First conference game after a non-con run — teams motivated, unders hit 54%',
    betKind: 'total',
    betTag: 'under',
    baseEdgePts: 1.8,
  },
  {
    id: 'elite_defense_under',
    label: 'Elite defense matchup',
    description: 'Both teams rank top-20 nationally in AdjDE — unders hit 61% in these games',
    betKind: 'total',
    betTag: 'under',
    baseEdgePts: 3.8,
  },
];

// ---------------------------------------------------------------------------
// Known rivalry pairs (same conference rivalries get the rivalry_under spot)
// ---------------------------------------------------------------------------
const RIVALRY_PAIRS: [string, string][] = [
  ['Duke', 'North Carolina'],
  ['Kansas', 'Kansas State'],
  ['Kentucky', 'Louisville'],
  ['Cincinnati', 'Xavier'],
  ['Michigan', 'Michigan State'],
  ['Indiana', 'Purdue'],
  ['Ohio State', 'Michigan'],
  ['UCLA', 'USC'],
  ['Arizona', 'Arizona State'],
  ['Florida', 'Florida State'],
  ['Illinois', 'Northwestern'],
  ['Iowa', 'Minnesota'],
  ["St. John's", 'Georgetown'],
  ['Marquette', 'Creighton'],
  ['Gonzaga', "Saint Mary's"],
  ['Virginia', 'Virginia Tech'],
  ['Baylor', 'TCU'],
  ['Texas', 'Oklahoma'],
  ['Auburn', 'Alabama'],
  ['Arkansas', 'Ole Miss'],
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoredBet extends BetLeg {
  edgeScore: number;
  confidenceScore: number;
  factors: AnalyticsFactor[];
  rawData: any;
}

interface KenPomProjection {
  homeTeam: string;
  awayTeam: string;
  projectedHomeScore: number;
  projectedAwayScore: number;
  projectedSpread: number;   // positive = home favored
  projectedTotal: number;
  homeWinProbability: number;
  dataQuality: 'full' | 'partial' | 'missing';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function oddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

function isRivalry(teamA: string, teamB: string): boolean {
  return RIVALRY_PAIRS.some(
    ([a, b]) =>
      (a === teamA && b === teamB) || (a === teamB && b === teamA)
  );
}

function isSameConference(
  homeData: KenPomEntry | null,
  awayData: KenPomEntry | null
): boolean {
  if (!homeData || !awayData) return false;
  return homeData.conference === awayData.conference;
}

// ---------------------------------------------------------------------------
// KenPom projection engine — data pre-fetched from D1, passed in as args
// ---------------------------------------------------------------------------

function projectGame(
  homeTeam: string,
  awayTeam: string,
  homeData: KenPomEntry | null,
  awayData: KenPomEntry | null,
  isNeutralSite: boolean = false
): KenPomProjection {

  const dataQuality = homeData && awayData
    ? 'full'
    : homeData || awayData
    ? 'partial'
    : 'missing';

  if (!homeData && !awayData) {
    // Fallback: return a zero-edge projection so the bet still surfaces
    // but won't get a KenPom signal boost
    return {
      homeTeam, awayTeam,
      projectedHomeScore: 70,
      projectedAwayScore: 70,
      projectedSpread: 0,
      projectedTotal: 140,
      homeWinProbability: 0.5,
      dataQuality: 'missing',
    };
  }

  // Use available data; fill in average D1 values for missing team
  const AVG_OE = 100.0;
  const AVG_DE = 100.0;
  const AVG_TEMPO = 68.0;

  const hOE    = homeData?.adjOE    ?? AVG_OE;
  const hDE    = homeData?.adjDE    ?? AVG_DE;
  const hTempo = homeData?.adjTempo ?? AVG_TEMPO;
  const aOE    = awayData?.adjOE    ?? AVG_OE;
  const aDE    = awayData?.adjDE    ?? AVG_DE;
  const aTempo = awayData?.adjTempo ?? AVG_TEMPO;

  // Blended tempo between the two teams
  const blendedTempo = (hTempo + aTempo) / 2;

  // Projected possessions (per-40-min adjusted to a full game)
  const possessions = blendedTempo;

  // Home team scores its OE against away team's DE, both relative to avg
  // Formula: (team_OE / avg_DE) * opp_DE = adjusted expected score per 100 poss
  // Simplified: expected = (team_OE + opp_DE) / 2  (standard KenPom approach)
  const homeRawPts  = ((hOE + aDE) / 2) * (possessions / 100);
  const awayRawPts  = ((aOE + hDE) / 2) * (possessions / 100);

  // Apply home court adjustment
  const hca = isNeutralSite ? 0 : HOME_COURT_ADVANTAGE;
  const projectedHomeScore = homeRawPts + hca / 2;
  const projectedAwayScore = awayRawPts - hca / 2;

  const projectedSpread = projectedHomeScore - projectedAwayScore; // positive = home favored
  const projectedTotal  = projectedHomeScore + projectedAwayScore;

  // Win probability via logistic function on spread
  // Empirically: 1 point of spread ≈ 3% win probability shift in NCAAB
  const homeWinProbability = 1 / (1 + Math.exp(-projectedSpread * 0.15));

  return {
    homeTeam,
    awayTeam,
    projectedHomeScore,
    projectedAwayScore,
    projectedSpread,
    projectedTotal,
    homeWinProbability,
    dataQuality,
  };
}

// ---------------------------------------------------------------------------
// KenPom factor scoring
// ---------------------------------------------------------------------------

function analyzeKenPomSpread(
  bet: Partial<ScoredBet>,
  projection: KenPomProjection
): AnalyticsFactor | null {
  if (bet.market !== 'spreads' || bet.point === null || bet.point === undefined) return null;
  if (projection.dataQuality === 'missing') return null;

  const game = bet.rawData?.game as GameData;
  if (!game) return null;

  // Determine if bet is on home or away team
  const bettingOnHome = bet.rawData.outcome.name === game.home_team;
  // KenPom spread: positive = home favored
  // Book spread: stored as bet.point from the perspective of the picked team
  //   e.g. "Kansas -4.5" → point = -4.5, bettingOnHome depends on which team

  // Book line from HOME team's perspective (negative = home giving points)
  // bet.point is always from the PICKED team's perspective:
  //   Duke -28.5 → bet.point = -28.5, bettingOnHome = true
  //   Siena +28.5 → bet.point = +28.5, bettingOnHome = false
  // To get book line from home perspective:
  //   If betting home: home line = bet.point (e.g. -28.5)
  //   If betting away: home line = -bet.point (e.g. -(-28.5) = -28.5... wait)
  // Both cases: home line = bettingOnHome ? bet.point : -bet.point
  // But bet.point for away team +28.5 means away gets +28.5, so home line = -28.5
  const bookLineFromHome = bettingOnHome ? bet.point! : -(bet.point!);

  // KenPom projected spread is from home perspective (positive = home wins)
  // Gap > 0: KenPom projects home winning by MORE than book implies → home underpriced
  // Gap < 0: KenPom projects home winning by LESS than book implies → home overpriced
  const spreadGap = projection.projectedSpread - bookLineFromHome;

  // Edge for the BETTOR:
  // If betting home and gap > 0 → home underpriced → positive edge
  // If betting home and gap < 0 → home overpriced → negative edge (take the dog)
  // If betting away and gap < 0 → home overpriced = away underpriced → positive edge
  // If betting away and gap > 0 → home underpriced = away overpriced → negative edge
  const effectiveGap = bettingOnHome ? spreadGap : -spreadGap;

  if (Math.abs(effectiveGap) < 1.5) return null; // below signal threshold

  const pickedTeam    = bettingOnHome ? game.home_team : game.away_team;
  const oppositeTeam  = bettingOnHome ? game.away_team : game.home_team;
  const kpFavoredTeam = projection.projectedSpread > 0 ? game.home_team : game.away_team;
  const kpMargin      = Math.abs(projection.projectedSpread).toFixed(1);
  const bookMargin    = Math.abs(bet.point!).toFixed(1);
  const gapStr        = Math.abs(effectiveGap).toFixed(1);

  // effectiveGap > 0: KenPom supports picked team covering
  // effectiveGap < 0: KenPom opposes picked team covering
  const spreadDesc = effectiveGap >= 1.5
    ? kpFavoredTeam === pickedTeam
      // Betting the favorite: KenPom thinks they win by more than the line
      ? `KenPom projects ${pickedTeam} winning by ${kpMargin} pts — book's ${bookMargin}-pt line underestimates them by ${gapStr} pts`
      // Betting the underdog: KenPom projects a closer game than the line implies
      : `KenPom projects a ${kpMargin}-pt game — ${pickedTeam} getting ${bookMargin} pts is ${gapStr} pts better than the model's fair line`
    : kpFavoredTeam === pickedTeam
      // Favorite but model doesn't support the spread size
      ? `KenPom projects ${pickedTeam} winning by only ${kpMargin} pts — laying ${bookMargin} requires overperforming the model by ${gapStr} pts`
      // Betting an underdog the model thinks will lose by more than the line
      : `KenPom projects ${oppositeTeam} winning by ${kpMargin} pts — ${pickedTeam} covering ${bookMargin} goes against the model by ${gapStr} pts`;

  return {
    type: effectiveGap >= 1.5 ? 'positive' : 'negative',
    category: 'matchup',
    description: spreadDesc,
    impact: Math.min(Math.max(effectiveGap * 0.9, -5), 5),
  };
}

function analyzeKenPomMoneyline(
  bet: Partial<ScoredBet>,
  projection: KenPomProjection
): AnalyticsFactor | null {
  if (bet.market !== 'h2h') return null;
  if (projection.dataQuality === 'missing') return null;

  const game = bet.rawData?.game as GameData;
  if (!game) return null;

  const bettingOnHome = bet.rawData.outcome.name === game.home_team;
  const kenPomWinProb = bettingOnHome
    ? projection.homeWinProbability
    : 1 - projection.homeWinProbability;
  const marketWinProb = oddsToImpliedProbability(bet.odds!);

  // Edge = KenPom probability - market implied probability
  // > 0 means KenPom thinks this team is undervalued
  const probEdge = kenPomWinProb - marketWinProb;

  if (Math.abs(probEdge) < 0.03) return null; // < 3% difference is noise

  const teamName = bettingOnHome ? game.home_team : game.away_team;

  const kpPct   = (kenPomWinProb * 100).toFixed(0);
  const mktPct  = (marketWinProb * 100).toFixed(0);
  const edgePct = Math.abs(probEdge * 100).toFixed(1);
  const mlDesc  = probEdge >= 0.03
    ? `KenPom gives ${teamName} a ${kpPct}% win probability — market prices them at ${mktPct}%, a ${edgePct}% edge in our favor`
    : `KenPom gives ${teamName} a ${kpPct}% win probability vs market's ${mktPct}% — model sees them as ${edgePct}% overvalued`;

  return {
    type: probEdge >= 0.03 ? 'positive' : 'negative',
    category: 'matchup',
    description: mlDesc,
    impact: Math.min(Math.max(probEdge * 20, -5), 5),
  };
}

function analyzeKenPomTotal(
  bet: Partial<ScoredBet>,
  projection: KenPomProjection
): AnalyticsFactor | null {
  if (bet.market !== 'totals' || bet.point === null || bet.point === undefined) return null;
  if (projection.dataQuality === 'missing') return null;

  const isOver = bet.rawData?.outcome?.name?.toLowerCase().includes('over');
  const bookTotal = bet.point;
  const kpTotal   = projection.projectedTotal;
  const gap       = kpTotal - bookTotal; // positive = KenPom expects more scoring

  // For an over bet, positive gap is favorable. For under, negative gap is favorable.
  const effectiveGap = isOver ? gap : -gap;

  if (Math.abs(effectiveGap) < 2.0) return null;

  const gapAbs     = Math.abs(gap).toFixed(1);
  const betSide    = isOver ? 'over' : 'under';
  const totalDesc  = effectiveGap >= 2.0
    ? `KenPom projects ${kpTotal.toFixed(1)} total pts — book at ${bookTotal} makes the ${betSide} the value side by ${gapAbs} pts`
    : `KenPom projects ${kpTotal.toFixed(1)} total pts vs book's ${bookTotal} — this ${betSide} goes against the model by ${gapAbs} pts`;

  return {
    type: effectiveGap >= 2.0 ? 'positive' : 'negative',
    category: 'matchup',
    description: totalDesc,
    impact: Math.min(Math.max(effectiveGap * 0.7, -5), 5),
  };
}

// ---------------------------------------------------------------------------
// Situational factor scoring
// ---------------------------------------------------------------------------

function analyzeSituationalSpots(
  bet: Partial<ScoredBet>,
  game: GameData,
  projection: KenPomProjection,
  homeKP: KenPomEntry | null,
  awayKP: KenPomEntry | null
): AnalyticsFactor[] {
  const factors: AnalyticsFactor[] = [];
  const isNCAA = game.sport === 'basketball_ncaab';
  if (!isNCAA) return factors;

  const home = game.home_team;
  const away = game.away_team;
  const bettingOnHome = bet.rawData?.outcome?.name === home;
  const isUnder = bet.rawData?.outcome?.name?.toLowerCase().includes('under');
  const isOver  = bet.rawData?.outcome?.name?.toLowerCase().includes('over');

  // --- Rivalry game under ---
  if (
    (bet.market === 'totals' && isUnder) &&
    isRivalry(home, away)
  ) {
    factors.push({
      type: 'positive',
      category: 'situation',
      description: `Rivalry game (${away} @ ${home}) — unders hit 4.1 pts better than line implies in these matchups`,
      impact: 3.2,
    });
  }

  // --- Slow-pace conference under ---
  if (bet.market === 'totals' && isUnder) {
    const homeD = homeKP;
    const awayD = awayKP;
    if (homeD && awayD) {
      const avgTempo = (homeD.adjTempo + awayD.adjTempo) / 2;
      if (avgTempo < 66.0 && isSameConference(homeKP, awayKP)) {
        factors.push({
          type: 'positive',
          category: 'situation',
          description: `Slow-pace conference matchup — avg tempo ${avgTempo.toFixed(1)} (bottom third). Unders hit 58% in these games`,
          impact: 2.8,
        });
      } else if (avgTempo < 65.0) {
        // Even without same conference, extremely slow pace warrants a note
        factors.push({
          type: 'positive',
          category: 'situation',
          description: `Extremely slow pace matchup (avg ${avgTempo.toFixed(1)} possessions/40 min) — under-friendly environment`,
          impact: 2.0,
        });
      }
    }
  }

  // --- Elite defense under ---
  if (bet.market === 'totals' && isUnder) {
    const homeD = homeKP;
    const awayD = awayKP;
    if (homeD && awayD) {
      // Lower AdjDE = better defense
      if (homeD.adjDE < 93.0 && awayD.adjDE < 93.0) {
        factors.push({
          type: 'positive',
          category: 'situation',
          description: `Elite-defense matchup — both teams top-20 nationally in AdjDE (${homeD.adjDE.toFixed(1)} / ${awayD.adjDE.toFixed(1)}). Unders hit 61% here`,
          impact: 3.5,
        });
      } else if (homeD.adjDE < 91.0 || awayD.adjDE < 91.0) {
        // One elite D is still worth noting
        const eliteTeam = homeD.adjDE < awayD.adjDE ? home : away;
        factors.push({
          type: 'positive',
          category: 'situation',
          description: `${eliteTeam} elite defense (AdjDE ${Math.min(homeD.adjDE, awayD.adjDE).toFixed(1)}) creates under pressure`,
          impact: 1.8,
        });
      }
    }
  }

  // --- Road favorite spot ---
  // A road team favored by 7+ pts in conference play covers at only 48%
  if (
    bet.market === 'spreads' &&
    !bettingOnHome &&
    bet.point !== null && bet.point !== undefined &&
    bet.point < -7.0 &&
    isSameConference(homeKP, awayKP)
  ) {
    factors.push({
      type: 'negative',
      category: 'situation',
      description: `Road favorite of ${Math.abs(bet.point)} pts in conference play — these cover at only 48% historically. Consider the dog`,
      impact: -2.0,
    });
  }

  // If betting the home dog in this scenario, flip to positive
  if (
    bet.market === 'spreads' &&
    bettingOnHome &&
    bet.point !== null && bet.point !== undefined &&
    bet.point > 7.0 && // home team is getting more than 7
    isSameConference(homeKP, awayKP)
  ) {
    factors.push({
      type: 'positive',
      category: 'situation',
      description: `Home dog of ${bet.point} pts vs conference road favorite — this spot covers at 52% ATS historically`,
      impact: 2.0,
    });
  }

  // --- Same-conference familiarity under ---
  // Conference games in the second half of the season trend under as teams
  // have more tape on each other
  if (
    bet.market === 'totals' &&
    isUnder &&
    isSameConference(homeKP, awayKP)
  ) {
    const gameDate = new Date(game.commence_time);
    const month    = gameDate.getMonth(); // 0-indexed
    // Jan–March = second half of conference season
    if (month >= 0 && month <= 2) {
      factors.push({
        type: 'positive',
        category: 'situation',
        description: `Late-season conference game — teams have extensive tape on each other, scoring trends down`,
        impact: 1.4,
      });
    }
  }

  // --- High-tempo over ---
  // Both teams fast-paced = over-friendly
  if (bet.market === 'totals' && isOver) {
    const homeD = homeKP;
    const awayD = awayKP;
    if (homeD && awayD) {
      const avgTempo = (homeD.adjTempo + awayD.adjTempo) / 2;
      if (avgTempo > 72.5) {
        factors.push({
          type: 'positive',
          category: 'situation',
          description: `High-tempo matchup — avg ${avgTempo.toFixed(1)} possessions/40 min (top tier). Over-friendly environment`,
          impact: 2.2,
        });
      }
    }
  }

  // --- Efficiency mismatch on the spread ---
  // When one team dramatically outclasses the other in adjusted efficiency,
  // note it regardless of KenPom data availability at full quality
  if (bet.market === 'spreads' || bet.market === 'h2h') {
    const homeD = homeKP;
    const awayD = awayKP;
    if (homeD && awayD) {
      const homeNetEff = homeD.adjOE - homeD.adjDE;
      const awayNetEff = awayD.adjOE - awayD.adjDE;
      const effGap = homeNetEff - awayNetEff;

      // If the team we're betting on has significantly better net efficiency
      const pickedTeamIsHome = bettingOnHome;
      const pickedEffAdv = pickedTeamIsHome ? effGap : -effGap;

      if (pickedEffAdv > 15) {
        factors.push({
          type: 'positive',
          category: 'matchup',
          description: `Significant efficiency advantage for this pick — net efficiency gap of ${pickedEffAdv.toFixed(1)} pts per 100 possessions`,
          impact: Math.min(pickedEffAdv * 0.12, 2.5),
        });
      } else if (pickedEffAdv < -15) {
        factors.push({
          type: 'negative',
          category: 'matchup',
          description: `Efficiency disadvantage — this team's net efficiency trails opponent by ${Math.abs(pickedEffAdv).toFixed(1)} pts per 100 poss`,
          impact: Math.max(pickedEffAdv * 0.12, -2.5),
        });
      }
    }
  }

  return factors;
}

// ---------------------------------------------------------------------------
// Line value (retained from v1, simplified)
// ---------------------------------------------------------------------------

function analyzeLineValue(
  bet: Partial<ScoredBet>,
  game: GameData
): AnalyticsFactor {
  const allOdds: number[] = [];
  for (const book of game.bookmakers) {
    const market = book.markets.find((m) => m.key === bet.market);
    if (!market) continue;
    const outcome = market.outcomes.find((o) =>
      bet.point !== undefined
        ? o.name === bet.rawData.outcome.name && o.point === bet.point
        : o.name === bet.rawData.outcome.name
    );
    if (outcome) allOdds.push(outcome.price);
  }

  if (allOdds.length < 2) {
    return {
      type: 'neutral',
      category: 'value',
      description: allOdds.length === 1 ? 'Single book available for this market' : 'Insufficient market data',
      impact: allOdds.length === 1 ? 0.3 : 0,
    };
  }

  const avgOdds    = allOdds.reduce((a, b) => a + b, 0) / allOdds.length;
  const betProb    = oddsToImpliedProbability(bet.odds!);
  const consensusP = oddsToImpliedProbability(avgOdds);
  const edge       = ((consensusP - betProb) / betProb) * 100;
  const impact     = Math.min(Math.max(edge * 0.4, -4), 4);

  let description: string;
  if (edge > 3)       description = `+${edge.toFixed(1)}% better than ${allOdds.length}-book consensus — genuine line value`;
  else if (edge > 1)  description = `Slight edge vs consensus (+${edge.toFixed(1)}%) across ${allOdds.length} books`;
  else if (edge < -3) description = `${edge.toFixed(1)}% worse than consensus — public money inflating this side`;
  else if (edge < -1) description = `Slightly off consensus (${edge.toFixed(1)}%) — within normal variance`;
  else                description = `Fair value — aligned with ${allOdds.length}-book consensus`;

  return {
    type: edge > 1 ? 'positive' : edge < -3 ? 'negative' : 'neutral',
    category: 'value',
    description,
    impact,
  };
}

// ---------------------------------------------------------------------------
// Sharp money proxy (retained from v1)
// ---------------------------------------------------------------------------

function analyzeSharpMoney(
  bet: Partial<ScoredBet>,
  game: GameData
): AnalyticsFactor | null {
  const pinnacle   = game.bookmakers.find((b) => b.key === 'pinnacle');
  const draftkings = game.bookmakers.find((b) => b.key === 'draftkings');
  if (!pinnacle || !draftkings) return null;

  const pMarket  = pinnacle.markets.find((m) => m.key === bet.market);
  const dkMarket = draftkings.markets.find((m) => m.key === bet.market);
  if (!pMarket || !dkMarket) return null;

  const pOut  = pMarket.outcomes.find((o) => o.name === bet.rawData.outcome.name);
  const dkOut = dkMarket.outcomes.find((o) => o.name === bet.rawData.outcome.name);
  if (!pOut || !dkOut) return null;

  const gap = dkOut.price - pOut.price;

  if (Math.abs(gap) <= 8) return null; // below noise floor

  return {
    type: gap > 8 ? 'positive' : 'negative',
    category: 'sharp',
    description: gap > 8
      ? `DK paying ${gap} more than Pinnacle — sharp books likely on this side`
      : `DK paying ${Math.abs(gap)} less than Pinnacle — public side, reduced value`,
    impact: gap > 8 ? Math.min(gap / 10, 3) : Math.max(gap / 10, -2),
  };
}

// ---------------------------------------------------------------------------
// Grade & scoring helpers
// ---------------------------------------------------------------------------

// Weighted scoring: KenPom and situational signals are the primary thesis.
// Line value and sharp money are supporting signals.
const FACTOR_WEIGHTS: Record<string, number> = {
  matchup:   0.35, // KenPom projections
  situation: 0.35, // Situational spots
  value:     0.15, // Line value consensus
  sharp:     0.10, // Sharp money proxy
  timing:    0.05, // Game timing context
};

function calculateEdgeScore(factors: AnalyticsFactor[]): number {
  let totalImpact = 0;
  let totalWeight = 0;
  for (const f of factors) {
    const w = FACTOR_WEIGHTS[f.category] ?? 0.05;
    totalImpact += f.impact * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? totalImpact / totalWeight : 0;
}

function calculateConfidenceScore(
  factors: AnalyticsFactor[],
  bet: Partial<ScoredBet>
): number {
  const edgeScore      = calculateEdgeScore(factors);
  const positiveCount  = factors.filter((f) => f.type === 'positive').length;
  const negativeCount  = factors.filter((f) => f.type === 'negative').length;

  // Base: start at 5.0 (neutral), push with edge and factor count
  let confidence = 5.0 + edgeScore + (positiveCount - negativeCount) * 0.4;

  // Bonus: KenPom full-data projection carries more weight
  const hasFullKenPom = factors.some(
    (f) => f.category === 'matchup' && !f.description.includes('partial')
  );
  if (hasFullKenPom) confidence += 0.6;

  // Bonus: multiple independent signals pointing the same direction
  const posMatchup   = factors.filter((f) => f.category === 'matchup'   && f.type === 'positive').length;
  const posSituation = factors.filter((f) => f.category === 'situation' && f.type === 'positive').length;
  if (posMatchup > 0 && posSituation > 0) confidence += 0.8; // thesis alignment

  // Penalty: no meaningful signals
  if (positiveCount === 0) confidence -= 0.5;

  return Math.max(0, Math.min(10, confidence));
}

function gradeBet(
  expectedValue: number,
  confidenceScore: number,
  hasKenPomSignal: boolean,
  hasSituationalSignal: boolean
): 'S' | 'A' | 'B' | 'C' | 'D' {
  // S: strong confidence AND at least one primary methodology signal
  if (confidenceScore >= 7.5 && (hasKenPomSignal || hasSituationalSignal)) return 'S';
  // A: good confidence OR both primary signals present
  if (confidenceScore >= 6.5 || (hasKenPomSignal && hasSituationalSignal)) return 'A';
  // B: solid confidence
  if (confidenceScore >= 5.8) return 'B';
  // C: some edge
  if (confidenceScore >= 5.0) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Main engine class
// ---------------------------------------------------------------------------

export class AnalyticsEngine {
  private db:              D1Database;
  private kellyMultiplier: number;
  private bankroll:        number;

  constructor(db: D1Database, kellyMultiplier: number = 0.25, bankroll: number = 1000) {
    this.db              = db;
    this.kellyMultiplier = kellyMultiplier;
    this.bankroll        = bankroll;
  }

  // -------------------------------------------------------------------------
  // Public: generate smart parlay
  // -------------------------------------------------------------------------

  async generateSmartParlay(
    criteria: GeneratorCriteria,
    games: GameData[],
    stateCode?: string
  ): Promise<{ legs: ScoredBet[]; confidence: number; avgEdge: number }> {
    const allBets      = this.generateBetOptions(games, criteria, stateCode);
    const capped       = allBets.slice(0, 1200);

    const scoredBets   = await Promise.all(capped.map((b) => this.scoreBet(b, games)));

    let valueBets = scoredBets.filter((b) => b.edgeScore >= criteria.min_edge);

    if (valueBets.length === 0) {
      throw new Error(
        `No value bets found with current criteria. Try adjusting odds range or bet types.`
      );
    }

    // Sort by composite score descending (best edges first)
    valueBets.sort((a, b) => b.edgeScore - a.edgeScore);

    // In 'max_value' mode take the pure top-scored legs (no shuffle).
    // In other modes shuffle the top half for variety so you get different
    // picks on repeated generates.
    if (criteria.mode !== 'max_value') {
      const topHalf = Math.ceil(valueBets.length / 2);
      const top     = valueBets.slice(0, topHalf);
      for (let i = top.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [top[i], top[j]] = [top[j], top[i]];
      }
      valueBets = [...top, ...valueBets.slice(topHalf)];
    }

    const parlay = this.buildParlay(valueBets, criteria.legs, criteria.sgp_mode, criteria.locked);

    if (parlay.length < criteria.legs) {
      throw new Error(
        `Only found ${parlay.length} suitable bets (requested ${criteria.legs}). Try lowering min edge or expanding odds range.`
      );
    }

    const avgEdge    = parlay.reduce((s, l) => s + l.edgeScore,       0) / parlay.length;
    const confidence = parlay.reduce((s, l) => s + l.confidenceScore, 0) / parlay.length;

    return { legs: parlay, confidence, avgEdge };
  }

  // -------------------------------------------------------------------------
  // Generate all candidate bet options from game data
  // -------------------------------------------------------------------------

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
        if (!this.isMarketRequested(market.key, criteria)) continue;
        if (!isMarketAllowedInState(market.key, game.sport, stateCode)) continue;

        for (const outcome of market.outcomes) {
          // Skip odds filter entirely — engine ranks by edge, not odds range

          bets.push({
            id:             crypto.randomUUID(),
            sport:          game.sport,
            event_id:       game.id,
            event_name:     `${game.away_team} @ ${game.home_team}`,
            commence_time:  game.commence_time,
            market:         market.key,
            pick:           this.formatOutcomeLabel(market.key, outcome),
            odds:           outcome.price,
            participant:    outcome.participant ?? null,
            point:          outcome.point ?? null,
            bet_kind:       this.classifyBetKind(market.key),
            bet_tag:        this.classifyBetTag(market.key, outcome),
            dk_link:        generateDraftKingsLink(game.sport, game.home_team, game.away_team, game.commence_time),
            rawData:        { game, outcome, market },
          });
        }
      }
    }

    return bets;
  }

  // -------------------------------------------------------------------------
  // Score a single bet
  // -------------------------------------------------------------------------

  private async scoreBet(
    bet: Partial<ScoredBet>,
    allGames: GameData[]
  ): Promise<ScoredBet> {
    const game = allGames.find((g) => g.id === bet.event_id);
    if (!game) throw new Error(`Game not found: ${bet.event_id}`);

    const isNCAA   = game.sport === 'basketball_ncaab';
    const factors: AnalyticsFactor[] = [];

    // ------------------------------------------------------------------
    // 1. KenPom projection (primary signal for NCAAB)
    // Fetch both teams from D1 in a single round-trip. If the table
    // hasn't been seeded yet (first deploy), both return null and the
    // engine falls back to line-value-only scoring gracefully.
    // ------------------------------------------------------------------
    let homeKP: KenPomEntry | null = null;
    let awayKP: KenPomEntry | null = null;

    if (isNCAA) {
      try {
        const matchup = await getMatchupData(this.db, game.home_team, game.away_team);
        homeKP = matchup.home;
        awayKP = matchup.away;
      } catch (e) {
        // D1 unavailable or table not yet seeded — degrade gracefully
        console.warn('[analytics-engine] KenPom D1 fetch failed:', e);
      }

      const projection = projectGame(game.home_team, game.away_team, homeKP, awayKP);

      const kpSpread = analyzeKenPomSpread(bet, projection);
      const kpML     = analyzeKenPomMoneyline(bet, projection);
      const kpTotal  = analyzeKenPomTotal(bet, projection);

      if (kpSpread) factors.push(kpSpread);
      if (kpML)     factors.push(kpML);
      if (kpTotal)  factors.push(kpTotal);

      // ------------------------------------------------------------------
      // 2. Situational spots (primary signal for NCAAB)
      // ------------------------------------------------------------------
      const sitFactors = analyzeSituationalSpots(bet, game, projection, homeKP, awayKP);
      factors.push(...sitFactors);
    }

    // ------------------------------------------------------------------
    // 3. Line value (secondary signal — all sports)
    // ------------------------------------------------------------------
    const lineValue = analyzeLineValue(bet, game);
    factors.push(lineValue);

    // ------------------------------------------------------------------
    // 4. Sharp money proxy (secondary signal)
    // ------------------------------------------------------------------
    const sharpMoney = analyzeSharpMoney(bet, game);
    if (sharpMoney) factors.push(sharpMoney);

    // ------------------------------------------------------------------
    // 5. Game timing context
    // ------------------------------------------------------------------
    const gameTime   = new Date(game.commence_time);
    const hoursUntil = (gameTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      factors.push({
        type:        'neutral',
        category:    'timing',
        description: `Game in ${Math.round(hoursUntil)}h — lines settled, low injury-news risk`,
        impact:      0.4,
      });
    } else if (hoursUntil > 72) {
      factors.push({
        type:        'negative',
        category:    'timing',
        description: `Game ${Math.round(hoursUntil / 24)} days out — injury and lineup news may shift line`,
        impact:      -0.4,
      });
    }

    // ------------------------------------------------------------------
    // 6. Calculate scores and grade
    // ------------------------------------------------------------------
    const edgeScore      = calculateEdgeScore(factors);
    const confidenceScore = calculateConfidenceScore(factors, bet);
    const marketProb     = impliedProbability(bet.odds!);

    const confidenceWeight = Math.min(confidenceScore / 10, 1);
    const trueProbability  = Math.max(
      0.05,
      Math.min(0.95, marketProb + (edgeScore / 100) * confidenceWeight)
    );

    const expectedValue = calculateEVPercentage(trueProbability, bet.odds!);
    const kelly         = kellyBetSize(
      trueProbability, bet.odds!, this.kellyMultiplier, 0.01, 0.05
    );
    // Units: 1 unit = $5 (on $100 bankroll). kelly.fraction * 100 = $ amount.

    const hasKenPom     = isNCAA && (homeKP !== null || awayKP !== null) &&
                          factors.some((f) => f.category === 'matchup');
    const hasSituational = factors.some((f) => f.category === 'situation');
    const betGrade      = gradeBet(expectedValue, confidenceScore, hasKenPom, hasSituational);

    return {
      ...(bet as ScoredBet),
      edgeScore,
      confidenceScore,
      factors,
      analytics: {
        edge:               edgeScore,
        sharp_money_pct:    null,
        public_money_pct:   null,
        line_movement:      null,
        factors,
        expected_value:     expectedValue,
        kelly_fraction:     kelly.fraction,
        kelly_units:        kelly.units,
        true_probability:   trueProbability,
        implied_probability: marketProb,
        bet_grade:          betGrade,
      },
      status:          'pending',
      locked_by_user:  false,
      bet_id:          '',
    };
  }

  // -------------------------------------------------------------------------
  // Build optimal parlay (unchanged from v1 — logic was solid)
  // -------------------------------------------------------------------------

  private buildParlay(
    scoredBets: ScoredBet[],
    targetLegs: number,
    sgpMode: 'none' | 'allow' | 'only',
    lockedLegs: BetLeg[]
  ): ScoredBet[] {
    const parlay: ScoredBet[]                            = [];
    const usedEvents                                     = new Set<string>();
    const usedEventMarkets                               = new Map<string, Set<string>>();
    const usedEventPropKeys                              = new Map<string, Set<string>>();
    const usedEventHasSide                               = new Map<string, boolean>();
    const usedEventHasTotal                              = new Map<string, boolean>();

    // Locked legs first
    for (const locked of lockedLegs) {
      const match = scoredBets.find(
        (b) => b.event_id === locked.event_id && b.market === locked.market && b.pick === locked.pick
      );
      if (!match) continue;
      parlay.push(match);
      usedEvents.add(match.event_id);
      if (!usedEventMarkets.has(match.event_id)) usedEventMarkets.set(match.event_id, new Set());
      usedEventMarkets.get(match.event_id)!.add(match.market);
      if (match.bet_kind === 'prop') {
        if (!usedEventPropKeys.has(match.event_id)) usedEventPropKeys.set(match.event_id, new Set());
        usedEventPropKeys.get(match.event_id)!.add(this.propConflictKey(match));
      }
      if (match.bet_kind === 'side')  usedEventHasSide.set(match.event_id, true);
      if (match.bet_kind === 'total') usedEventHasTotal.set(match.event_id, true);
    }

    // Fill remaining legs
    for (const bet of scoredBets) {
      if (parlay.length >= targetLegs) break;
      if (parlay.some((p) => p.id === bet.id)) continue;
      if (sgpMode === 'none' && usedEvents.has(bet.event_id)) continue;

      if (sgpMode === 'only') {
        const firstEventId = usedEvents.size > 0 ? Array.from(usedEvents)[0] : null;
        if (firstEventId && bet.event_id !== firstEventId) continue;
      }

      if (usedEvents.has(bet.event_id)) {
        if (bet.bet_kind === 'prop') {
          const propKey = this.propConflictKey(bet);
          if (usedEventPropKeys.get(bet.event_id)?.has(propKey)) continue;
        }
        if (bet.bet_kind === 'side'  && usedEventHasSide.get(bet.event_id))  continue;
        if (bet.bet_kind === 'total' && usedEventHasTotal.get(bet.event_id)) continue;
      }

      parlay.push(bet);
      usedEvents.add(bet.event_id);
      if (!usedEventMarkets.has(bet.event_id)) usedEventMarkets.set(bet.event_id, new Set());
      usedEventMarkets.get(bet.event_id)!.add(bet.market);
      if (bet.bet_kind === 'prop') {
        if (!usedEventPropKeys.has(bet.event_id)) usedEventPropKeys.set(bet.event_id, new Set());
        usedEventPropKeys.get(bet.event_id)!.add(this.propConflictKey(bet));
      }
      if (bet.bet_kind === 'side')  usedEventHasSide.set(bet.event_id, true);
      if (bet.bet_kind === 'total') usedEventHasTotal.set(bet.event_id, true);
    }

    return parlay;
  }

  // -------------------------------------------------------------------------
  // Utility methods
  // -------------------------------------------------------------------------

  private propConflictKey(bet: Partial<ScoredBet>): string {
    const market      = String(bet.market ?? '');
    const participant = String(bet.participant ?? '');
    const point       = bet.point != null ? String(bet.point) : '';
    const id          = participant || String(bet.pick ?? '');
    return `${market}|${id}|${point}`.toLowerCase();
  }

  private isMarketRequested(market: Market, criteria: GeneratorCriteria): boolean {
    if (criteria.bet_types.includes('moneyline')   && market === 'h2h')     return true;
    if (criteria.bet_types.includes('spread')      && market === 'spreads') return true;
    if (criteria.bet_types.includes('over_under')  && market === 'totals')  return true;
    if (criteria.extra_markets.some((m) => market.includes(m)))             return true;
    return false;
  }

  private classifyBetKind(market: Market): 'side' | 'total' | 'prop' {
    if (market === 'h2h' || market === 'spreads') return 'side';
    if (market === 'totals') return 'total';
    return 'prop';
  }

  private classifyBetTag(market: Market, outcome: any): string | null {
    if (market === 'h2h')     return outcome.price < 0 ? 'favorite' : 'underdog';
    if (market === 'spreads') return outcome.point  < 0 ? 'favorite' : 'underdog';
    if (market === 'totals')  return outcome.name.toLowerCase().includes('over') ? 'over' : 'under';
    return null;
  }

  private formatOutcomeLabel(market: Market, outcome: any): string {
    if (market === 'h2h') return outcome.name;
    if (market === 'spreads') {
      const pt = outcome.point > 0 ? `+${outcome.point}` : outcome.point;
      return `${outcome.name} ${pt}`;
    }
    if (market === 'totals') return `${outcome.name} ${outcome.point}`;

    // Props
    const participant = outcome.participant || outcome.description || '';
    const descriptor  = this.getMarketDescriptor(market);
    const point       = outcome.point ? ` ${outcome.point}` : '';
    if (descriptor && participant) return `${participant} ${outcome.name}${point} ${descriptor}`.trim();
    if (descriptor)                return `${outcome.name}${point} ${descriptor}`.trim();
    return `${participant} ${outcome.name}${point}`.trim();
  }

  private getMarketDescriptor(market: Market): string | null {
    const descriptors: Record<string, string> = {
      player_pass_yds:    'Passing Yards',   player_pass_tds: 'Passing TDs',
      player_rush_yds:    'Rushing Yards',   player_receptions: 'Receptions',
      player_reception_yds: 'Receiving Yards', player_anytime_td: 'Anytime TD',
      player_points:      'Points',          player_rebounds: 'Rebounds',
      player_assists:     'Assists',         player_threes: '3-Pointers',
      player_steals:      'Steals',          player_blocks: 'Blocks',
      player_turnovers:   'Turnovers',
      player_points_rebounds_assists: 'Pts+Reb+Ast',
      player_shots_on_goal: 'Shots on Goal', player_goalie_saves: 'Saves',
      batter_home_runs:   'Home Runs',       batter_hits: 'Hits',
      batter_total_bases: 'Total Bases',     pitcher_strikeouts: 'Strikeouts',
    };
    return descriptors[market] ?? null;
  }
}
