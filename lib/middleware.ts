// Middleware utilities for API routes
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Database } from './db';

export interface AuthenticatedRequest extends NextRequest {
  userId: string;
  db: Database;
}

/**
 * Validate user session and return user ID
 * Returns null if session is invalid or expired
 */
export async function validateSession(
  request: NextRequest
): Promise<{ userId: string; db: Database } | null> {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return null;
    }

    const { env } = getRequestContext();
    const db = new Database(env.DB as D1Database);

    const session = await db.db
      .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(sessionId, Date.now())
      .first();

    if (!session) {
      return null;
    }

    return {
      userId: session.user_id as string,
      db,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Middleware wrapper that requires authentication
 * Usage:
 *
 * export const GET = withAuth(async (request, context) => {
 *   const userId = context.userId;
 *   const db = context.db;
 *   // ... your handler
 * });
 */
export function withAuth<T extends Record<string, any>>(
  handler: (
    request: NextRequest,
    context: { userId: string; db: Database; params?: T }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    { params }: { params?: T } = {}
  ): Promise<NextResponse> => {
    const auth = await validateSession(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', success: false },
        { status: 401 }
      );
    }

    return handler(request, {
      userId: auth.userId,
      db: auth.db,
      params,
    });
  };
}

/**
 * Standard API error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Standard API success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

/**
 * Validate required fields in request body
 */
export function validateRequired(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `${field} is required`;
    }
  }
  return null;
}
