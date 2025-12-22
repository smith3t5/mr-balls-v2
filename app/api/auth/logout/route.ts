import { getRequestContext } from '@cloudflare/next-on-pages';
// Logout and clear session
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;

    if (sessionId) {
      const { env } = getRequestContext();
      const db = new Database(env.DB as D1Database);

      // Delete session
      await db.db
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run();
    }

    const response = NextResponse.json({ success: true });

    // Clear cookie
    response.cookies.set({
      name: 'session_id',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
