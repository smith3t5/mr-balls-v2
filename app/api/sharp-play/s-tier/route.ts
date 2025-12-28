import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { AnalyticsEngine } from '@/lib/analytics-engine';
import { OddsAPIClient } from '@/lib/odds-api-client';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    // Initialize clients
    const oddsClient = new OddsAPIClient(env.ODDS_API_KEY || '', db);
    const analyticsEngine = new AnalyticsEngine(0.25, 1000);

    // Reset request counter
    oddsClient.resetRequestCounter();

    // Fetch odds for all major sports
    const sports = [
      'americanfootball_nfl',
      'basketball_nba',
      'icehockey_nhl',
    ] as any[];

    const markets = ['h2h', 'spreads', 'totals'];
    const games = await oddsClient.getOddsForSports(sports, markets, {
      sgpMode: 'none',
      requiredPropLegs: 0,
    });

    if (games.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No games available',
      });
    }

    // Generate best single bets
    const criteria = {
      sports,
      legs: 1, // Single bet only
      odds_min: -200,
      odds_max: 300,
      bet_types: ['moneyline', 'spread', 'over_under'] as any[],
      extra_markets: [],
      sgp_mode: 'none' as const,
      locked: [],
      min_edge: 0,
      min_tier: 'S' as const, // Only S-tier
      mode: 'max_value' as const,
    };

    try {
      const result = await analyticsEngine.generateSmartParlay(criteria, games);

      if (result.legs.length > 0) {
        const bet = result.legs[0];

        // Create analysis summary
        const positiveFactors = bet.factors.filter(f => f.type === 'positive');
        const analysis = positiveFactors.length > 0
          ? positiveFactors.map(f => f.description).join('. ')
          : 'Multiple value indicators align on this bet.';

        return NextResponse.json({
          success: true,
          bet: {
            event_name: bet.event_name,
            pick: bet.pick,
            odds: bet.odds,
            expected_value: bet.analytics.expected_value,
            kelly_units: bet.analytics.kelly_units,
            bet_grade: bet.analytics.bet_grade,
            confidence: bet.confidenceScore,
            analysis,
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'No S-tier bets found currently',
        });
      }
    } catch (error: any) {
      // No S-tier bets available - this is not an error
      console.log('No S-tier bets found:', error.message);
      return NextResponse.json({
        success: false,
        message: 'No S-tier bets available',
      });
    }
  } catch (error: any) {
    console.error('S-tier check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check for S-tier bets',
      },
      { status: 500 }
    );
  }
}
