/**
 * app/api/cron-kenpom/route.ts
 *
 * Diagnostic version — surfaces the actual error instead of a generic 500.
 * Replace with the clean version once we know what's failing.
 */

import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Check auth header is present
    const auth = request.headers.get('Authorization');
    if (!auth) {
      return NextResponse.json({ error: 'No Authorization header' }, { status: 401 });
    }

    // Step 2: Try to get Cloudflare context
    let cfEnv: any;
    try {
      const { getCloudflareContext } = await import('@cloudflare/next-on-pages');
      const cf = getCloudflareContext();
      cfEnv = cf.env;
    } catch (e) {
      return NextResponse.json({
        error: 'getCloudflareContext failed',
        detail: String(e),
        step: 'cloudflare_context',
      }, { status: 500 });
    }

    // Step 3: Check what bindings/secrets are available (don't log values)
    const available = {
      DB:               !!cfEnv?.DB,
      CRON_SECRET:      !!cfEnv?.CRON_SECRET,
      KENPOM_EMAIL:     !!cfEnv?.KENPOM_EMAIL,
      KENPOM_PASSWORD:  !!cfEnv?.KENPOM_PASSWORD,
    };

    // Step 4: Auth check
    const token = auth.replace('Bearer ', '').trim();
    if (!cfEnv?.CRON_SECRET || token !== cfEnv.CRON_SECRET) {
      return NextResponse.json({
        error: 'Unauthorized',
        bindings_available: available,
      }, { status: 401 });
    }

    // Step 5: Try importing the sync module
    let syncKenPomData: any;
    try {
      const mod = await import('@/lib/kenpom-sync');
      syncKenPomData = mod.syncKenPomData;
    } catch (e) {
      return NextResponse.json({
        error: 'Failed to import kenpom-sync',
        detail: String(e),
        step: 'module_import',
        bindings_available: available,
      }, { status: 500 });
    }

    // Step 6: Run the sync
    try {
      const result = await syncKenPomData(
        cfEnv.DB,
        cfEnv.KENPOM_EMAIL,
        cfEnv.KENPOM_PASSWORD
      );
      return NextResponse.json({ ...result, bindings_available: available });
    } catch (e) {
      return NextResponse.json({
        error: 'syncKenPomData threw an error',
        detail: String(e),
        step: 'sync_execution',
        bindings_available: available,
      }, { status: 500 });
    }

  } catch (err) {
    return NextResponse.json({
      error: 'Unhandled exception',
      detail: String(err),
      step: 'outer_catch',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'cron-kenpom diagnostic endpoint is live',
    method: 'POST to trigger sync',
  });
}
