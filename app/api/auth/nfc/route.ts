// Authentication via NFC tag
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { AuthService } from '@/lib/auth';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nfc_tag_id, username, state_code } = body;

    if (!nfc_tag_id) {
      return NextResponse.json(
        { error: 'NFC tag ID required' },
        { status: 400 }
      );
    }

    // Get environment bindings (Cloudflare Pages)
    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);
    const auth = new AuthService(db, env.SESSION_SECRET as string || 'dev-secret');

    // Check if NFC tag secret matches (if enabled)
    if (env.NFC_TAG_SECRET) {
      if (!auth.timingSafeEqual(nfc_tag_id, env.NFC_TAG_SECRET)) {
        return NextResponse.json(
          { error: 'Invalid NFC tag' },
          { status: 401 }
        );
      }
    }

    // Get or create user
    let user = await db.getUserByNFCTag(nfc_tag_id);

    if (!user) {
      // New user - create account
      if (!username || username.length < 3) {
        return NextResponse.json(
          { error: 'Username required (min 3 characters)' },
          { status: 400 }
        );
      }

      const userId = crypto.randomUUID();
      user = await db.createUser({
        id: userId,
        username,
        nfc_tag_id,
        state_code: state_code || null,
      });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store session in database
    await db.db
      .prepare(
        `INSERT INTO sessions (id, user_id, nfc_tag_id, created_at, expires_at, last_activity)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(sessionId, user.id, nfc_tag_id, Date.now(), expiresAt, Date.now())
      .run();

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        stats: user.stats,
      },
    });

    // Set session cookie
    response.cookies.set({
      name: 'session_id',
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    );
  }
}
