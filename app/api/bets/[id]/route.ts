import { getRequestContext } from '@cloudflare/next-on-pages';
// Get or update specific bet
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

// GET /api/bets/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    const bet = await db.getBetById(params.id);

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      bet,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch bet' }, { status: 500 });
  }
}

// PATCH /api/bets/[id] - Update bet status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { status, actual_return } = body;

    if (!['won', 'lost', 'push', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get bet to verify ownership
    const bet = await db.getBetById(params.id);
    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    if (bet.user_id !== session.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update bet
    await db.updateBetStatus(params.id, status, actual_return);

    // Update user stats
    const user = await db.getUserById(session.user_id as string);
    if (user) {
      const updates: any = {};

      if (status === 'won') {
        updates.wins = user.stats.wins + 1;
        updates.units_profit =
          user.stats.units_profit + (actual_return - bet.stake) / user.preferences.default_unit_size;
        updates.current_streak = user.stats.current_streak >= 0 ? user.stats.current_streak + 1 : 1;
        updates.best_win_streak = Math.max(updates.current_streak, user.stats.best_win_streak);
      } else if (status === 'lost') {
        updates.losses = user.stats.losses + 1;
        updates.units_profit = user.stats.units_profit - bet.stake / user.preferences.default_unit_size;
        updates.current_streak = user.stats.current_streak <= 0 ? user.stats.current_streak - 1 : -1;
      } else if (status === 'push') {
        updates.pushes = user.stats.pushes + 1;
      }

      if (Object.keys(updates).length > 0) {
        await db.updateUserStats(user.id, updates);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bet updated successfully',
    });
  } catch (error: any) {
    console.error('Update bet error:', error);
    return NextResponse.json({ error: 'Failed to update bet' }, { status: 500 });
  }
}
