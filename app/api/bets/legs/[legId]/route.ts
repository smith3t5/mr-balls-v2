import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/middleware';
import { calculateParlayResult } from '@/lib/utils';

export const runtime = 'edge';

// PATCH /api/bets/legs/[legId] - Update leg status
export const PATCH = withAuth(async (request, context) => {
  try {
    const { legId } = context.params as { legId: string };
    const body = await request.json();
    const { status } = body;

    if (!['won', 'lost', 'push', 'pending'].includes(status)) {
      return errorResponse('Invalid status', 400);
    }

    // Get the leg to find its bet_id
    const leg = await context.db.db
      .prepare('SELECT bet_id FROM bet_legs WHERE id = ?')
      .bind(legId)
      .first();

    if (!leg) {
      return errorResponse('Leg not found', 404);
    }

    // Get the bet to verify ownership
    const bet = await context.db.getBetById(leg.bet_id as string);
    if (!bet) {
      return errorResponse('Bet not found', 404);
    }

    if (bet.user_id !== context.userId) {
      return errorResponse('Unauthorized', 403);
    }

    // Update the leg status
    await context.db.updateBetLegStatus(legId, status);

    // Get all legs for this bet to check if we should auto-update bet status
    const allLegs = await context.db.db
      .prepare('SELECT status FROM bet_legs WHERE bet_id = ?')
      .bind(leg.bet_id)
      .all();

    const legStatuses = allLegs.results.map(
      (l: any) => l.status
    ) as ('won' | 'lost' | 'push' | 'pending')[];

    // Calculate parlay result based on leg statuses
    const parlayResult = calculateParlayResult(legStatuses);

    // If parlay result changed (all legs settled), update bet status
    if (parlayResult !== 'pending' && bet.status === 'pending') {
      const actualReturn = parlayResult === 'won' ? bet.potential_return : 0;
      await context.db.updateBetStatus(
        leg.bet_id as string,
        parlayResult,
        actualReturn
      );

      // Update user stats
      const user = await context.db.getUserById(context.userId);
      if (user) {
        const updates: any = {};

        if (parlayResult === 'won') {
          updates.wins = user.stats.wins + 1;
          updates.units_profit =
            user.stats.units_profit +
            (actualReturn - bet.stake) / user.preferences.default_unit_size;
          updates.current_streak =
            user.stats.current_streak >= 0
              ? user.stats.current_streak + 1
              : 1;
          updates.best_win_streak = Math.max(
            updates.current_streak,
            user.stats.best_win_streak
          );
        } else if (parlayResult === 'lost') {
          updates.losses = user.stats.losses + 1;
          updates.units_profit =
            user.stats.units_profit -
            bet.stake / user.preferences.default_unit_size;
          updates.current_streak =
            user.stats.current_streak <= 0
              ? user.stats.current_streak - 1
              : -1;
        } else if (parlayResult === 'push') {
          updates.pushes = user.stats.pushes + 1;
        }

        if (Object.keys(updates).length > 0) {
          await context.db.updateUserStats(context.userId, updates);
        }
      }
    }

    return successResponse({
      message: 'Leg status updated',
      parlay_status: parlayResult,
      parlay_auto_updated: parlayResult !== 'pending',
    });
  } catch (error: any) {
    console.error('Update leg status error:', error);
    return errorResponse('Failed to update leg status', 500, error.message);
  }
});
