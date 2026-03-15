/**
 * app/api/cron-kenpom/route.ts
 * Compatible with @cloudflare/next-on-pages v1.13.16
 *
 * Note: getRequestContext has broken type declarations in this version.
 * The @ts-ignore comments suppress the TS error — it works correctly at runtime.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { syncKenPomData, getLastSyncTime } from '@/lib/kenpom-sync';

export const runtime = 'edge';

function checkAuth(request: NextRequest, cronSecret: string): boolean {
  const auth  = request.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  return token.length > 0 && token === cronSecret;
}

export async function POST(request: NextRequest) {
  // @ts-ignore — type declarations broken in next-on-pages 1.13.x, works at runtime
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  const { env } = getRequestContext();

  if (!checkAuth(request, (env as any).CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(env as any).KENPOM_EMAIL || !(env as any).KENPOM_PASSWORD) {
    return NextResponse.json(
      { error: 'KENPOM_EMAIL or KENPOM_PASSWORD not configured' },
      { status: 500 }
    );
  }

  if (!(env as any).DB) {
    return NextResponse.json(
      { error: 'D1 binding DB not found — check Cloudflare Pages bindings' },
      { status: 500 }
    );
  }

  const result = await syncKenPomData(
    (env as any).DB,
    (env as any).KENPOM_EMAIL,
    (env as any).KENPOM_PASSWORD
  );

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  // @ts-ignore — type declarations broken in next-on-pages 1.13.x, works at runtime
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  const { env } = getRequestContext();

  if (!checkAuth(request, (env as any).CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = (env as any).DB as D1Database;

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