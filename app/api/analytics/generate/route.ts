import { getRequestContext } from '@cloudflare/next-on-pages';
// Generate smart parlay
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { AnalyticsEngine } from '@/lib/analytics-engine';
import { OddsAPIClient } from '@/lib/odds-api-client';
import { WeatherClient } from '@/lib/weather-client';
import type { GeneratorCriteria } from '@/types';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Check session
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    // Validate session and get user
    const session = await db.db
      .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(sessionId, Date.now())
      .first();

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get user's state and settings for regulations and Kelly calculations
    const user = await db.db
      .prepare('SELECT state_code, kelly_multiplier, bankroll FROM users WHERE id = ?')
      .bind(session.user_id)
      .first();

    const userStateCode = user?.state_code || undefined;
    const kellyMultiplier = user?.kelly_multiplier || 0.25;
    const bankroll = user?.bankroll || 1000;

    // Parse request body
    const criteria: GeneratorCriteria = await request.json();

    // Validate criteria
    if (!criteria.sports || criteria.sports.length === 0) {
      return NextResponse.json(
        { error: 'At least one sport required' },
        { status: 400 }
      );
    }

    if (criteria.legs < 1 || criteria.legs > 8) {
      return NextResponse.json(
        { error: 'Legs must be between 1 and 8' },
        { status: 400 }
      );
    }

    // Initialize clients
    const oddsClient = new OddsAPIClient(env.ODDS_API_KEY || '', db);
    const weatherClient = new WeatherClient(db);
    const analyticsEngine = new AnalyticsEngine(kellyMultiplier, bankroll);

    // Fetch odds data
    console.log(`Fetching odds for sports: ${criteria.sports.join(', ')}`);

    const markets: string[] = [];
    if (criteria.bet_types.includes('moneyline')) markets.push('h2h');
    if (criteria.bet_types.includes('spread')) markets.push('spreads');
    if (criteria.bet_types.includes('over_under')) markets.push('totals');

    // Add player props if requested
    if (criteria.extra_markets && criteria.extra_markets.length > 0) {
      // Simply add all requested prop markets to the list
      // The Odds API uses the same naming convention we do
      markets.push(...criteria.extra_markets);
    }

    let games = await oddsClient.getOddsForSports(criteria.sports, markets);

    // If no games found and we requested props, try again with just basic markets
    if (games.length === 0 && criteria.extra_markets && criteria.extra_markets.length > 0) {
      console.log('No games found with props, retrying with basic markets only');
      const basicMarkets = markets.filter(m => ['h2h', 'spreads', 'totals'].includes(m));
      if (basicMarkets.length > 0) {
        games = await oddsClient.getOddsForSports(criteria.sports, basicMarkets);
      }
    }

    // Filter by date range if specified
    if (criteria.date_from || criteria.date_to) {
      const fromDate = criteria.date_from ? new Date(criteria.date_from).getTime() : 0;
      const toDate = criteria.date_to ? new Date(criteria.date_to).setHours(23, 59, 59, 999) : Infinity;

      games = games.filter(game => {
        const gameTime = game.commence_time;
        return gameTime >= fromDate && gameTime <= toDate;
      });

      console.log(`Filtered to ${games.length} games within date range`);
    }

    if (games.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No games available for selected sports',
        warnings: [
          'Try selecting different sports or check back later',
          criteria.extra_markets?.length > 0 ? 'Some player props may require a paid API tier' : null,
        ].filter(Boolean),
      });
    }

    console.log(`Found ${games.length} games`);

    // Enrich with weather data (for outdoor sports) - PARALLEL
    await Promise.all(
      games.map(async (game) => {
        if (
          game.sport === 'americanfootball_nfl' ||
          game.sport === 'americanfootball_ncaaf'
        ) {
          game.weather = await weatherClient.getWeatherForGame(
            game.home_team,
            game.commence_time
          );
        }
      })
    );

    // Generate smart parlay
    console.log('Running analytics engine...');
    const result = await analyticsEngine.generateSmartParlay(criteria, games, userStateCode);

    // Return result
    return NextResponse.json({
      success: true,
      parlay: result.legs.map((leg) => ({
        id: leg.id,
        sport: leg.sport,
        event_id: leg.event_id,
        event_name: leg.event_name,
        commence_time: leg.commence_time,
        market: leg.market,
        pick: leg.pick,
        odds: leg.odds,
        participant: leg.participant,
        point: leg.point,
        bet_kind: leg.bet_kind,
        bet_tag: leg.bet_tag,
        dk_link: leg.dk_link,
        confidence: leg.confidenceScore,
        edge: leg.edgeScore,
        factors: leg.factors,
        locked_by_user: leg.locked_by_user,
        // Advanced betting metrics
        expected_value: leg.analytics.expected_value,
        kelly_units: leg.analytics.kelly_units,
        kelly_fraction: leg.analytics.kelly_fraction,
        true_probability: leg.analytics.true_probability,
        implied_probability: leg.analytics.implied_probability,
        bet_grade: leg.analytics.bet_grade,
      })),
      meta: {
        total_confidence: result.confidence,
        avg_edge: result.avgEdge,
        parlay_odds: calculateParlayOdds(result.legs.map((l) => l.odds)),
      },
      warnings: [],
    });
  } catch (error: any) {
    console.error('Analytics generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate parlay',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

function calculateParlayOdds(americanOdds: number[]): number {
  const decimalOdds = americanOdds.map((odds) => {
    if (odds > 0) {
      return 1 + odds / 100;
    } else {
      return 1 + 100 / Math.abs(odds);
    }
  });

  const parlayDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);

  // Convert back to American
  if (parlayDecimal >= 2) {
    return Math.round((parlayDecimal - 1) * 100);
  } else {
    return -Math.round(100 / (parlayDecimal - 1));
  }
}
