/**
 * app/api/cron-kenpom/route.ts
 * Uses official KenPom API (Bearer token auth)
 */

import { getRequestContext } from '@cloudflare/next-on-pages';
import { type NextRequest, NextResponse } from 'next/server';
import { syncKenPomData, getLastSyncTime } from '@/lib/kenpom-sync';

export const runtime = 'edge';

function checkAuth(request: NextRequest, cronSecret: string): boolean {
  const auth  = request.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  return token.length > 0 && token === cronSecret;
}

export async function POST(request: NextRequest) {
  const { env } = getRequestContext();

  if (!checkAuth(request, (env as any).CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(env as any).KENPOM_API_KEY) {
    return NextResponse.json(
      { error: 'KENPOM_API_KEY not configured in environment' },
      { status: 500 }
    );
  }

  const result = await syncKenPomData(
    (env as any).DB as D1Database,
    (env as any).KENPOM_API_KEY as string
  );

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  const { env } = getRequestContext();

  if (!checkAuth(request, (env as any).CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db        = (env as any).DB as D1Database;
  const lastSync  = await getLastSyncTime(db);
  const teamCount = await db.prepare(
    'SELECT COUNT(*) as cnt FROM kenpom_data'
  ).first<{ cnt: number }>();

  const recentLogs = await db.prepare(`
    SELECT ran_at, teams_synced, status, error_message, duration_ms
    FROM   kenpom_sync_log
    ORDER  BY ran_at DESC
    LIMIT  5
  `).all();

  return NextResponse.json({
    lastSync:   lastSync?.toISOString() ?? null,
    teamCount:  teamCount?.cnt ?? 0,
    staleness:  lastSync
      ? `${Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))}h ago`
      : 'never synced',
    recentRuns: recentLogs.results,
  });
}
