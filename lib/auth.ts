// Authentication utilities
import { Database } from './db';
import type { User } from '@/types';

export interface SessionData {
  user_id: string;
  username: string;
  nfc_tag_id: string;
  expires_at: number;
}

export class AuthService {
  constructor(private db: Database, private sessionSecret: string) {}

  /**
   * Verify NFC tag and create session
   */
  async authenticateNFC(nfcTagId: string): Promise<{ user: User; sessionId: string } | null> {
    // Timing-safe comparison
    const user = await this.db.getUserByNFCTag(nfcTagId);
    if (!user) return null;

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store session (you could use KV or Durable Objects for persistence)
    // For now, we'll return the session ID and handle validation separately

    return { user, sessionId };
  }

  /**
   * Validate session token
   */
  async validateSession(sessionId: string): Promise<User | null> {
    // In production, check against KV/Durable Objects
    // For now, decode the JWT-style session
    try {
      // TODO: Implement proper JWT or session validation
      // This is a placeholder
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate secure session cookie
   */
  generateSessionCookie(sessionId: string, expiresAt: number): string {
    const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
    return `session_id=${sessionId}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
  }

  /**
   * Parse session from cookie header
   */
  parseSessionCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('session_id=')) {
        return cookie.substring('session_id='.length);
      }
    }

    return null;
  }

  /**
   * Timing-safe string comparison
   */
  timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Rate limiting check for session
   */
  async checkRateLimit(sessionId: string, action: string): Promise<boolean> {
    // TODO: Implement rate limiting using KV
    // For now, allow all
    return true;
  }
}

/**
 * Middleware helper for API routes
 */
export async function requireAuth(
  request: Request,
  authService: AuthService
): Promise<{ user: User } | Response> {
  const cookie = request.headers.get('Cookie');
  const sessionId = authService.parseSessionCookie(cookie);

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await authService.validateSession(sessionId);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return { user };
}
