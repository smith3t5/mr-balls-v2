/**
 * app/api/cron-kenpom-debug/route.ts
 *
 * Temporary diagnostic endpoint — dumps raw KenPom HTML snippet
 * so we can inspect the table structure and fix the parser.
 * DELETE THIS FILE once the parser is working.
 */

import { getRequestContext } from '@cloudflare/next-on-pages';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const KENPOM_BASE    = 'https://kenpom.com';
const LOGIN_ENDPOINT = `${KENPOM_BASE}/handlers/login_handler.php`;
const RATINGS_PAGE   = `${KENPOM_BASE}/index.php`;

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

export async function POST(request: NextRequest) {
  const { env } = getRequestContext();

  const auth  = request.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== (env as any).CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Login
    const loginBody = new URLSearchParams({
      email:    (env as any).KENPOM_EMAIL,
      password: (env as any).KENPOM_PASSWORD,
    });

    const loginResp = await fetch(LOGIN_ENDPOINT, {
      method:   'POST',
      headers:  {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer':      `${KENPOM_BASE}/`,
        'Origin':       KENPOM_BASE,
      },
      body:     loginBody.toString(),
      redirect: 'manual',
    });

    const setCookie = loginResp.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(',').map((c: string) => c.split(';')[0].trim()).filter((c: string) => c.includes('=')).join('; ');

    if (!cookie) {
      return NextResponse.json({
        error: 'Login failed — no cookie returned',
        loginStatus: loginResp.status,
        loginHeaders: Object.fromEntries(loginResp.headers.entries()),
      }, { status: 500 });
    }

    // Step 2: Fetch ratings page
    const pageResp = await fetch(RATINGS_PAGE, {
      headers: {
        ...BROWSER_HEADERS,
        'Cookie':  cookie,
        'Referer': KENPOM_BASE,
      },
    });

    const html = await pageResp.text();

    // Step 3: Return diagnostics
    const hasRatingsTable  = html.includes('ratings-table');
    const hasDataTable     = html.includes('dataTable');
    const hasLoginForm     = html.includes('name="password"');
    const tableMatches     = (html.match(/<table/gi) ?? []).length;

    // Find the first table's opening tag
    const firstTableMatch  = html.match(/<table[^>]*>/i);
    const firstTableTag    = firstTableMatch ? firstTableMatch[0] : 'none found';

    // Grab a snippet around where the table should be
    const tableIdx         = html.indexOf('<table');
    const tableSnippet     = tableIdx >= 0
      ? html.slice(tableIdx, tableIdx + 1500)
      : 'no table found';

    // First 500 chars of body
    const bodyIdx          = html.indexOf('<body');
    const bodySnippet      = bodyIdx >= 0
      ? html.slice(bodyIdx, bodyIdx + 500)
      : html.slice(0, 500);

    return NextResponse.json({
      pageStatus:       pageResp.status,
      htmlLength:       html.length,
      hasRatingsTable,
      hasDataTable,
      hasLoginForm,
      tableCount:       tableMatches,
      firstTableTag,
      bodySnippet,
      tableSnippet,
      cookiePreview:    cookie.slice(0, 80) + '...',
    });

  } catch (err) {
    return NextResponse.json({
      error:  'Fetch failed',
      detail: String(err),
    }, { status: 500 });
  }
}
