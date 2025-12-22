import { getRequestContext } from '@cloudflare/next-on-pages';
// Get leaderboard
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'all_time') as
      | 'daily'
      | 'weekly'
      | 'monthly'
      | 'all_time';

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    const leaderboard = await db.getLeaderboard(period);

    return NextResponse.json({
      success: true,
      leaderboard,
      period,
    });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
