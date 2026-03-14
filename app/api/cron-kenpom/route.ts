/**
 * app/api/cron-kenpom/route.ts
 *
 * KenPom sync endpoint — callable manually via POST or by the
 * Cloudflare Pages cron trigger.
 *
 * POST /api/cron-kenpom  — trigger a sync (requires Authorization header)
 * GET  /api/cron-kenpom  — check sync status (requires Authorization header)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { syncKenPomData, getLastSyncTime } from '@/lib/kenpom-sync';
import { getCloudflareContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(request: NextRequest, cronSecret: string): boolean {
  const auth  = request.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  return token.length > 0 && token === cronSecret;
}

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  if (!checkAuth(request, env.CRON_SECRET ?? '')) return unauthorized();

  if (!env.KENPOM_EMAIL || !env.KENPOM_PASSWORD) {
    return NextResponse.json(
      { error: 'KENPOM_EMAIL or KENPOM_PASSWORD not configured' },
      { status: 500 }
    );
  }

  const result = await syncKenPomData(env.DB, env.KENPOM_EMAIL, env.KENPOM_PASSWORD);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();

  if (!checkAuth(request, env.CRON_SECRET ?? '')) return unauthorized();

  const lastSync  = await getLastSyncTime(env.DB);
  const teamCount = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM kenpom_data'
  ).first<{ cnt: number }>();

  const recentLogs = await env.DB.prepare(`
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
