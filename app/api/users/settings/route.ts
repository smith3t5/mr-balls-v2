import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

export async function PUT(request: NextRequest) {
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

    // Parse request body
    const { bankroll, kelly_multiplier, default_unit_size } = await request.json();

    // Validate inputs
    if (bankroll !== undefined && (bankroll < 100 || bankroll > 10000000)) {
      return NextResponse.json(
        { error: 'Bankroll must be between $100 and $10,000,000' },
        { status: 400 }
      );
    }

    if (kelly_multiplier !== undefined && (kelly_multiplier < 0.1 || kelly_multiplier > 1.0)) {
      return NextResponse.json(
        { error: 'Kelly multiplier must be between 0.1 and 1.0' },
        { status: 400 }
      );
    }

    // Update user settings
    await db.db
      .prepare(`
        UPDATE users
        SET
          bankroll = COALESCE(?, bankroll),
          kelly_multiplier = COALESCE(?, kelly_multiplier),
          default_unit_size = COALESCE(?, default_unit_size)
        WHERE id = ?
      `)
      .bind(
        bankroll ?? null,
        kelly_multiplier ?? null,
        default_unit_size ?? null,
        session.user_id
      )
      .run();

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}
