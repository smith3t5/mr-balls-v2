import { getRequestContext } from '@cloudflare/next-on-pages';
// List user bets or create new bet
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

// GET /api/bets - List user's bets
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    const session = await db.db
      .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(sessionId, Date.now())
      .first();

    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const bets = await db.getUserBets(session.user_id as string, {
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      bets,
      pagination: {
        limit,
        offset,
        total: bets.length,
      },
    });
  } catch (error: any) {
    console.error('Get bets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}

// POST /api/bets - Create new bet
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    const session = await db.db
      .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(sessionId, Date.now())
      .first();

    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { legs, stake, notes } = body;

    if (!legs || legs.length === 0) {
      return NextResponse.json(
        { error: 'At least one leg required' },
        { status: 400 }
      );
    }

    if (!stake || stake <= 0) {
      return NextResponse.json(
        { error: 'Valid stake required' },
        { status: 400 }
      );
    }

    // Calculate parlay odds
    const parlayOdds = calculateParlayOdds(legs.map((l: any) => l.odds));
    const parlayDecimal =
      parlayOdds > 0 ? 1 + parlayOdds / 100 : 1 + 100 / Math.abs(parlayOdds);
    const potentialReturn = stake * parlayDecimal;

    // Calculate analytics
    const avgEdge = legs.reduce((sum: number, l: any) => sum + (l.edge || 0), 0) / legs.length;
    const confidence = legs.reduce((sum: number, l: any) => sum + (l.confidence || 5), 0) / legs.length;

    // Create bet
    const betId = crypto.randomUUID();
    await db.createBet({
      id: betId,
      user_id: session.user_id as string,
      stake,
      odds: parlayOdds,
      potential_return: potentialReturn,
      confidence,
      notes: notes || null,
      avg_edge: avgEdge,
    });

    // Create legs
    for (const leg of legs) {
      try {
        await db.createBetLeg({
          id: crypto.randomUUID(),
          bet_id: betId,
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
          edge: leg.edge,
          locked_by_user: leg.locked_by_user || false,
        });
      } catch (legError: any) {
        console.error('Failed to create leg:', legError);
        console.error('Leg data:', JSON.stringify(leg));
        throw new Error(`Failed to create leg: ${legError.message}`);
      }
    }

    // Update user stats
    const user = await db.getUserById(session.user_id as string);
    if (user) {
      await db.updateUserStats(user.id, {
        total_bets: user.stats.total_bets + 1,
        units_wagered: user.stats.units_wagered + stake / user.preferences.default_unit_size,
      });
    }

    return NextResponse.json({
      success: true,
      bet_id: betId,
    });
  } catch (error: any) {
    console.error('Create bet error:', error);
    return NextResponse.json(
      { error: 'Failed to create bet' },
      { status: 500 }
    );
  }
}

function calculateParlayOdds(americanOdds: number[]): number {
  const decimalOdds = americanOdds.map((odds) => {
    if (odds > 0) return 1 + odds / 100;
    return 1 + 100 / Math.abs(odds);
  });

  const parlayDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);

  if (parlayDecimal >= 2) {
    return Math.round((parlayDecimal - 1) * 100);
  }
  return -Math.round(100 / (parlayDecimal - 1));
}
