import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { PerformanceTracker, type BetRecord } from '@/lib/betting-algorithms';

export const runtime = 'edge';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

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

    // Parse request body
    const { status, closing_odds } = await request.json();

    // Validate status
    if (!['won', 'lost', 'push', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be won, lost, push, or cancelled' },
        { status: 400 }
      );
    }

    // Get bet details
    const bet = await db.db
      .prepare('SELECT * FROM bets WHERE id = ? AND user_id = ?')
      .bind(id, session.user_id)
      .first();

    if (!bet) {
      return NextResponse.json(
        { error: 'Bet not found' },
        { status: 404 }
      );
    }

    // Get bet legs for performance tracking
    const legs = await db.db
      .prepare('SELECT * FROM bet_legs WHERE bet_id = ?')
      .bind(id)
      .all();

    // Calculate actual return
    let actualReturn = 0;
    if (status === 'won') {
      actualReturn = bet.potential_return;
    } else if (status === 'push') {
      actualReturn = bet.stake;
    }

    const profit = actualReturn - bet.stake;

    // Update bet status
    await db.db
      .prepare(`
        UPDATE bets
        SET status = ?, actual_return = ?, settled_at = ?
        WHERE id = ?
      `)
      .bind(status, actualReturn, Date.now(), id)
      .run();

    // Update bet legs status
    await db.db
      .prepare(`
        UPDATE bet_legs
        SET status = ?
        WHERE bet_id = ?
      `)
      .bind(status, id)
      .run();

    // If closing odds provided, calculate CLV for each leg
    if (closing_odds && Array.isArray(closing_odds)) {
      for (const legUpdate of closing_odds) {
        const { leg_id, closing_line } = legUpdate;

        // Get leg details
        const leg = legs.results.find((l: any) => l.id === leg_id);
        if (!leg) continue;

        // Calculate CLV
        const openingDecimal = leg.odds > 0 ? 1 + leg.odds / 100 : 1 + 100 / Math.abs(leg.odds);
        const closingDecimal = closing_line > 0 ? 1 + closing_line / 100 : 1 + 100 / Math.abs(closing_line);
        const clv = (closingDecimal / openingDecimal) - 1;

        // Update leg with closing odds and CLV
        await db.db
          .prepare(`
            UPDATE bet_legs
            SET closing_odds = ?, clv = ?
            WHERE id = ?
          `)
          .bind(closing_line, clv, leg_id)
          .run();

        // Store in performance tracking table
        await db.db
          .prepare(`
            INSERT INTO bet_performance (
              id, bet_leg_id, prediction_id, user_id, sport, event_id, market,
              odds, closing_odds, stake, result, profit, clv, roi, placed_at, settled_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            leg_id,
            leg_id, // Using leg_id as prediction_id for now
            session.user_id,
            leg.sport,
            leg.event_id,
            leg.market,
            leg.odds,
            closing_line,
            bet.stake / legs.results.length, // Split stake evenly across legs
            status === 'won' ? 'win' : status === 'lost' ? 'loss' : 'push',
            profit / legs.results.length,
            clv,
            (profit / bet.stake) * 100,
            bet.created_at,
            Date.now()
          )
          .run();
      }
    }

    // Update user statistics
    const statsUpdate: Record<string, number> = {};

    if (status === 'won') {
      statsUpdate.wins = 1;
      statsUpdate.current_streak = bet.current_streak >= 0 ? bet.current_streak + 1 : 1;
    } else if (status === 'lost') {
      statsUpdate.losses = 1;
      statsUpdate.current_streak = bet.current_streak <= 0 ? bet.current_streak - 1 : -1;
    } else if (status === 'push') {
      statsUpdate.pushes = 1;
    }

    // Update user stats
    await db.db
      .prepare(`
        UPDATE users
        SET
          wins = wins + ?,
          losses = losses + ?,
          pushes = pushes + ?,
          units_wagered = units_wagered + ?,
          units_profit = units_profit + ?,
          current_streak = ?
        WHERE id = ?
      `)
      .bind(
        statsUpdate.wins || 0,
        statsUpdate.losses || 0,
        statsUpdate.pushes || 0,
        bet.stake / 10, // Assuming 1 unit = $10
        profit / 10,
        statsUpdate.current_streak || 0,
        session.user_id
      )
      .run();

    // Recalculate advanced metrics (CLV, Sharpe ratio)
    await recalculateUserMetrics(db, session.user_id);

    return NextResponse.json({
      success: true,
      message: 'Bet outcome recorded',
      bet: {
        id,
        status,
        profit,
        roi: (profit / bet.stake) * 100,
      },
    });
  } catch (error: any) {
    console.error('Bet outcome error:', error);
    return NextResponse.json(
      { error: 'Failed to record outcome', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Recalculate user's advanced metrics (CLV, Sharpe, etc.)
 */
async function recalculateUserMetrics(db: Database, userId: string) {
  try {
    // Get all settled bets for this user
    const performance = await db.db
      .prepare(`
        SELECT * FROM bet_performance
        WHERE user_id = ? AND result != 'pending'
        ORDER BY settled_at DESC
      `)
      .bind(userId)
      .all();

    if (!performance.results || performance.results.length === 0) {
      return;
    }

    // Calculate metrics
    const bets = performance.results as any[];
    const totalBets = bets.length;
    const totalWagered = bets.reduce((sum, bet) => sum + bet.stake, 0);
    const totalProfit = bets.reduce((sum, bet) => sum + bet.profit, 0);
    const roi = (totalProfit / totalWagered) * 100;

    // Average CLV (only for bets with closing line)
    const betsWithCLV = bets.filter(b => b.clv !== null);
    const avgCLV = betsWithCLV.length > 0
      ? betsWithCLV.reduce((sum, bet) => sum + bet.clv, 0) / betsWithCLV.length
      : 0;

    // Calculate Sharpe ratio
    const returns = bets.map(bet => bet.roi / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Average EV (would need to store this from predictions)
    // For now, use edge from bet_legs
    const legs = await db.db
      .prepare(`
        SELECT AVG(expected_value) as avg_ev
        FROM bet_legs bl
        JOIN bets b ON bl.bet_id = b.id
        WHERE b.user_id = ? AND b.status IN ('won', 'lost', 'push')
      `)
      .bind(userId)
      .first();

    const avgEV = legs?.avg_ev || 0;

    // Update user stats
    await db.db
      .prepare(`
        UPDATE users
        SET
          avg_clv = ?,
          sharpe_ratio = ?,
          total_ev = ?
        WHERE id = ?
      `)
      .bind(avgCLV, sharpeRatio, avgEV, userId)
      .run();

  } catch (error) {
    console.error('Error recalculating metrics:', error);
  }
}
