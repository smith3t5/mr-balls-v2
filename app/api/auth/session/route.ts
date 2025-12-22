import { getRequestContext } from '@cloudflare/next-on-pages';
// Validate current session
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session' },
        { status: 401 }
      );
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    // Get session from database
    const session = await db.db
      .prepare(
        `SELECT s.*, u.username, u.avatar_url
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = ? AND s.expires_at > ?`
      )
      .bind(sessionId, Date.now())
      .first();

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Update last activity
    await db.db
      .prepare('UPDATE sessions SET last_activity = ? WHERE id = ?')
      .bind(Date.now(), sessionId)
      .run();

    // Get user details
    const user = await db.getUserById(session.user_id as string);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Session validation failed' },
      { status: 500 }
    );
  }
}
