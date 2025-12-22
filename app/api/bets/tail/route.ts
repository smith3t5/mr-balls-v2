import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

/**
 * POST /api/bets/tail
 * Copy another user's bet to your portfolio
 */
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

    // Validate session
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

    const { bet_id } = await request.json();

    if (!bet_id) {
      return NextResponse.json({ error: 'Bet ID required' }, { status: 400 });
    }

    // Get the original bet
    const originalBet = await db.db
      .prepare('SELECT * FROM bets WHERE id = ?')
      .bind(bet_id)
      .first();

    if (!originalBet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    // Get the legs for the original bet
    const originalLegs = await db.db
      .prepare('SELECT * FROM bet_legs WHERE bet_id = ? ORDER BY leg_number')
      .bind(bet_id)
      .all();

    if (!originalLegs.results || originalLegs.results.length === 0) {
      return NextResponse.json({ error: 'Bet has no legs' }, { status: 400 });
    }

    // Create new bet for current user
    const newBetId = crypto.randomUUID();
    const createdAt = Date.now();

    await db.db
      .prepare(
        `INSERT INTO bets (id, user_id, type, stake, potential_payout, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newBetId,
        session.user_id,
        originalBet.type,
        0, // User can set their own stake
        0,
        'pending',
        `Tailed from user (Original bet: ${bet_id})`,
        createdAt
      )
      .run();

    // Copy all legs
    for (const leg of originalLegs.results) {
      const legId = crypto.randomUUID();
      await db.db
        .prepare(
          `INSERT INTO bet_legs (
            id, bet_id, leg_number, sport, event_id, event_name, commence_time,
            market, pick, odds, participant, point, bet_kind, bet_tag,
            dk_link, edge, sharp_money_pct, public_money_pct, line_movement,
            confidence_score, factors, status, result
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          legId,
          newBetId,
          leg.leg_number,
          leg.sport,
          leg.event_id,
          leg.event_name,
          leg.commence_time,
          leg.market,
          leg.pick,
          leg.odds,
          leg.participant,
          leg.point,
          leg.bet_kind,
          leg.bet_tag,
          leg.dk_link,
          leg.edge,
          leg.sharp_money_pct,
          leg.public_money_pct,
          leg.line_movement,
          leg.confidence_score,
          leg.factors,
          'pending',
          null
        )
        .run();
    }

    return NextResponse.json({
      success: true,
      bet_id: newBetId,
      message: 'Bet tailed successfully!',
    });
  } catch (error: any) {
    console.error('Tail bet error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to tail bet',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
