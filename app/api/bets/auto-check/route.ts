import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Database } from '@/lib/db';
import { ScoreChecker } from '@/lib/score-checker';
import { withAuth, successResponse, errorResponse } from '@/lib/middleware';

export const runtime = 'edge';

// POST /api/bets/auto-check - Manually trigger auto-check for current user
export const POST = withAuth(async (request, context) => {
  try {
    const { env } = getRequestContext();
    const scoreChecker = new ScoreChecker(env.ODDS_API_KEY || '', context.db);

    const result = await scoreChecker.autoUpdatePendingLegs(context.userId);

    return successResponse({
      message: 'Auto-check complete',
      legs_updated: result.updated,
      bets_settled: result.settled_bets.length,
      settled_bet_ids: result.settled_bets,
    });
  } catch (error: any) {
    console.error('Auto-check error:', error);
    return errorResponse('Failed to auto-check bets', 500, error.message);
  }
});

// GET /api/bets/auto-check?cron_secret=XXX - Cron job endpoint (checks ALL users)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('cron_secret');

    const { env } = getRequestContext();

    if (cronSecret !== env.CRON_SECRET) {
      return errorResponse('Unauthorized', 401);
    }

    const db = new Database(env.DB as D1Database);
    const scoreChecker = new ScoreChecker(env.ODDS_API_KEY || '', db);

    // Get all users with pending bets
    const usersResult = await db.db
      .prepare(`
        SELECT DISTINCT u.id, u.username
        FROM users u
        INNER JOIN bets b ON b.user_id = u.id
        WHERE b.status = 'pending'
      `)
      .all();

    let totalLegsUpdated = 0;
    let totalBetsSettled = 0;
    const results = [];

    for (const user of usersResult.results) {
      const result = await scoreChecker.autoUpdatePendingLegs(user.id as string);
      totalLegsUpdated += result.updated;
      totalBetsSettled += result.settled_bets.length;

      if (result.updated > 0) {
        results.push({
          user_id: user.id,
          username: user.username,
          legs_updated: result.updated,
          bets_settled: result.settled_bets.length,
        });
      }
    }

    return successResponse({
      message: 'Cron job complete',
      users_checked: usersResult.results.length,
      total_legs_updated: totalLegsUpdated,
      total_bets_settled: totalBetsSettled,
      results,
    });
  } catch (error: any) {
    console.error('Cron auto-check error:', error);
    return errorResponse('Cron job failed', 500, error.message);
  }
}
