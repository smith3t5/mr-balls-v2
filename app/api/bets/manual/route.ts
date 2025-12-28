import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

// POST /api/bets/manual - Create manually entered bet
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
    const { legs, stake, odds, potential_return, sportsbook, bet_link, notes } = body;

    // Validation
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

    // Create bet
    const betId = crypto.randomUUID();
    await db.createBet({
      id: betId,
      user_id: session.user_id as string,
      stake,
      odds,
      potential_return,
      confidence: null, // Manual bets don't have confidence scores
      notes: notes || null,
      avg_edge: null, // Manual bets don't have edge calculations
    });

    // Create legs
    for (const leg of legs) {
      try {
        // Convert event_date to Unix timestamp
        const commenceTime = leg.event_date ? new Date(leg.event_date).getTime() : Date.now();

        await db.createBetLeg({
          id: crypto.randomUUID(),
          bet_id: betId,
          sport: leg.sport,
          event_id: null, // Manual bets don't have event IDs
          event_name: leg.event_name,
          commence_time: commenceTime,
          market: 'manual', // Tag manual entries
          pick: leg.pick,
          odds: leg.odds,
          participant: null,
          point: null,
          bet_kind: 'manual',
          bet_tag: sportsbook || 'manual',
          dk_link: bet_link || null,
          edge: null,
          locked_by_user: true, // Manual bets are always locked
        });
      } catch (legError: any) {
        console.error('Failed to create manual leg:', legError);
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
    console.error('Create manual bet error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bet' },
      { status: 500 }
    );
  }
}
