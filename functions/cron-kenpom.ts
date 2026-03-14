/**
 * functions/cron-kenpom.ts
 *
 * Cloudflare Pages Function that runs on a daily cron schedule to
 * refresh KenPom efficiency data in D1.
 *
 * Schedule: configure in wrangler.toml (see below)
 * Also exposes a POST endpoint so you can trigger it manually
 * from the command line using your CRON_SECRET.
 *
 * ─── wrangler.toml setup ───────────────────────────────────────────────────
 *
 * Add this to your wrangler.toml:
 *
 *   [triggers]
 *   crons = ["0 6 * * *"]   # Every day at 6:00 AM UTC (1-2 AM ET)
 *
 * This runs after the overnight games settle and before any day games.
 * KenPom typically updates their ratings within an hour of game completion.
 *
 * ─── Manual trigger ────────────────────────────────────────────────────────
 *
 *   curl -X POST https://your-app.pages.dev/cron-kenpom \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * ─── Environment variables required ────────────────────────────────────────
 *
 *   KENPOM_EMAIL     — your KenPom subscriber email
 *   KENPOM_PASSWORD  — your KenPom subscriber password
 *   CRON_SECRET      — shared secret for manual trigger auth
 *   DB               — D1 database binding (already configured)
 *
 * Add KENPOM_EMAIL and KENPOM_PASSWORD to Cloudflare Pages:
 *   Dashboard → your project → Settings → Environment variables
 *   Mark both as "Encrypted" (they're credentials)
 *
 * ───────────────────────────────────────────────────────────────────────────
 */

import { syncKenPomData, getLastSyncTime } from '../lib/kenpom-sync';

interface Env {
  DB:               D1Database;
  KENPOM_EMAIL:     string;
  KENPOM_PASSWORD:  string;
  CRON_SECRET:      string;
  ENVIRONMENT?:     string;
}

// ---------------------------------------------------------------------------
// Scheduled trigger (cron)
// ---------------------------------------------------------------------------

export const onScheduled: PagesFunction<Env> = async (context) => {
  const { env } = context;

  console.log('[cron-kenpom] Scheduled trigger fired at', new Date().toISOString());

  if (!env.KENPOM_EMAIL || !env.KENPOM_PASSWORD) {
    console.error('[cron-kenpom] Missing KENPOM_EMAIL or KENPOM_PASSWORD env vars');
    return;
  }

  const result = await syncKenPomData(env.DB, env.KENPOM_EMAIL, env.KENPOM_PASSWORD);

  if (result.success) {
    console.log(`[cron-kenpom] Completed: ${result.teamsSynced} teams in ${result.durationMs}ms`);
  } else {
    console.error(`[cron-kenpom] Failed after ${result.durationMs}ms:`, result.error);
  }
};

// ---------------------------------------------------------------------------
// HTTP endpoint (manual trigger + status check)
// ---------------------------------------------------------------------------

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Auth check
  const authHeader = request.headers.get('Authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();

  if (!token || token !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status:  401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.KENPOM_EMAIL || !env.KENPOM_PASSWORD) {
    return new Response(
      JSON.stringify({ error: 'KENPOM_EMAIL or KENPOM_PASSWORD not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log('[cron-kenpom] Manual trigger by authenticated request');

  const result = await syncKenPomData(env.DB, env.KENPOM_EMAIL, env.KENPOM_PASSWORD);

  return new Response(JSON.stringify(result), {
    status:  result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Auth check
  const authHeader = request.headers.get('Authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();

  if (!token || token !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status:  401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return sync status
  const lastSync   = await getLastSyncTime(env.DB);
  const teamCount  = await env.DB.prepare('SELECT COUNT(*) as cnt FROM kenpom_data').first<{ cnt: number }>();
  const recentLogs = await env.DB.prepare(`
    SELECT ran_at, teams_synced, status, error_message, duration_ms
    FROM   kenpom_sync_log
    ORDER  BY ran_at DESC
    LIMIT  5
  `).all();

  return new Response(JSON.stringify({
    lastSync:      lastSync?.toISOString() ?? null,
    teamCount:     teamCount?.cnt ?? 0,
    staleness:     lastSync
      ? `${Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))}h ago`
      : 'never synced',
    recentRuns:    recentLogs.results,
  }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};
