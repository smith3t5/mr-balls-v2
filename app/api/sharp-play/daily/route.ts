// Get today's Sharp Play of the Day
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Database } from '@/lib/db';
import { AnalyticsEngine } from '@/lib/analytics-engine';
import { OddsAPIClient } from '@/lib/odds-api-client';
import { WeatherClient } from '@/lib/weather-client';
import type { GeneratorCriteria } from '@/types';

export const runtime = 'edge';

// Get today's sharp play (cached)
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    // Check cache for today's sharp play
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const cachedPlay = await db.db
      .prepare(
        'SELECT * FROM sharp_plays WHERE found_at >= ? ORDER BY confidence DESC, edge DESC LIMIT 1'
      )
      .bind(todayStartMs)
      .first();

    if (cachedPlay) {
      return NextResponse.json({
        success: true,
        sharp_play: {
          id: cachedPlay.id,
          sport: cachedPlay.sport,
          event_id: cachedPlay.event_id,
          event_name: cachedPlay.event_name,
          commence_time: cachedPlay.commence_time,
          market: cachedPlay.market,
          pick: cachedPlay.pick,
          odds: cachedPlay.odds,
          edge: cachedPlay.edge,
          confidence: cachedPlay.confidence,
          sharp_money_pct: cachedPlay.sharp_money_pct,
          line_value: cachedPlay.line_value,
          situational_score: cachedPlay.situational_score,
          weather_impact: cachedPlay.weather_impact,
          trend_score: cachedPlay.trend_score,
          analysis_summary: cachedPlay.analysis_summary,
          found_at: cachedPlay.found_at,
          expires_at: cachedPlay.expires_at,
        },
      });
    }

    // No cached play found - generate new one
    return NextResponse.json({
      success: false,
      error: 'No sharp play available yet. Check back soon.',
    });
  } catch (error: any) {
    console.error('Sharp play fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sharp play', details: error.message },
      { status: 500 }
    );
  }
}

// Generate today's sharp play (admin/cron endpoint)
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    // Simple auth check (use env variable for cron secret)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = env.CRON_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate sharp play for all available sports
    const allSports = [
      'americanfootball_nfl',
      'basketball_nba',
      'icehockey_nhl',
      'americanfootball_ncaaf',
      'basketball_ncaab',
    ];

    const oddsClient = new OddsAPIClient(env.ODDS_API_KEY || '', db);
    const weatherClient = new WeatherClient(db);
    const analyticsEngine = new AnalyticsEngine();

    // Fetch all games for all sports
    console.log('Fetching odds for sharp play generation...');
    const games = await oddsClient.getOddsForSports(
      allSports,
      ['h2h', 'spreads', 'totals']
    );

    if (games.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No games available',
      });
    }

    // Enrich with weather
    for (const game of games) {
      if (
        game.sport === 'americanfootball_nfl' ||
        game.sport === 'americanfootball_ncaaf'
      ) {
        game.weather = await weatherClient.getWeatherForGame(
          game.home_team,
          game.commence_time
        );
      }
    }

    // Generate multiple parlays and find best single bet
    console.log('Analyzing all bets...');

    // Use balanced criteria to get diverse options
    const criteria: GeneratorCriteria = {
      sports: allSports,
      legs: 1, // Single bet for sharp play
      odds_min: -200,
      odds_max: 300,
      bet_types: ['moneyline', 'spread', 'over_under'],
      extra_markets: [],
      sgp_mode: 'none',
      locked: [],
      min_edge: 2, // Require at least 2% edge
      mode: 'max_value',
    };

    const result = await analyticsEngine.generateSmartParlay(criteria, games);

    if (result.legs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No qualifying sharp plays found',
      });
    }

    // Take the best bet
    const sharpBet = result.legs[0];

    // Calculate expiry (24 hours or game time, whichever is sooner)
    const expiresAt = Math.min(
      Date.now() + 24 * 60 * 60 * 1000,
      sharpBet.commence_time
    );

    // Store in database
    await db.createSharpPlay({
      sport: sharpBet.sport,
      event_id: sharpBet.event_id,
      event_name: sharpBet.event_name,
      commence_time: sharpBet.commence_time,
      market: sharpBet.market,
      pick: sharpBet.pick,
      odds: sharpBet.odds,
      edge: sharpBet.edgeScore,
      confidence: sharpBet.confidenceScore,
      sharp_money_pct: null,
      line_value: null,
      situational_score: null,
      weather_impact: null,
      trend_score: null,
      analysis_summary: sharpBet.factors
        .filter((f) => f.type === 'positive')
        .map((f) => f.description)
        .join('. '),
      expires_at: expiresAt,
    });

    console.log('Sharp play generated successfully');

    return NextResponse.json({
      success: true,
      sharp_play: {
        sport: sharpBet.sport,
        event_name: sharpBet.event_name,
        market: sharpBet.market,
        pick: sharpBet.pick,
        odds: sharpBet.odds,
        edge: sharpBet.edgeScore,
        confidence: sharpBet.confidenceScore,
        commence_time: sharpBet.commence_time,
      },
    });
  } catch (error: any) {
    console.error('Sharp play generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate sharp play',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
