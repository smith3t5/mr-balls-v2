/**
 * app/api/bets/route.ts
 * Save a new bet to D1 and fetch bets for a user.
 */
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = (env as any).DB as D1Database;
    const body = await request.json();
    const { username, bet } = body;

    if (!username || !bet) {
      return NextResponse.json({ error: 'username and bet required' }, { status: 400 });
    }

    const betId = crypto.randomUUID();
    const now   = Date.now();

    // Upsert user row (creates if not exists)
    await db.prepare(`
      INSERT INTO users (id, username, nfc_tag_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).bind(crypto.randomUUID(), username, `local_${username}`, now).run();

    // Get user id
    const userRow = await db.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username).first<{ id: string }>();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const parlayOdds = bet.meta.parlay_odds;
    const potentialReturn = bet.stake + (parlayOdds > 0
      ? bet.stake * (parlayOdds / 100)
      : bet.stake * (100 / Math.abs(parlayOdds)));

    // Insert bet
    await db.prepare(`
      INSERT INTO bets (id, user_id, created_at, status, stake, odds, potential_return, confidence, avg_edge)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).bind(
      betId, userRow.id, now,
      bet.stake, parlayOdds, potentialReturn,
      bet.meta.total_confidence ?? null,
      bet.meta.avg_edge ?? null,
    ).run();

    // Insert legs
    const legStmts = bet.legs.map((leg: any) =>
      db.prepare(`
        INSERT INTO bet_legs (
          id, bet_id, sport, event_id, event_name, commence_time,
          market, pick, odds, status, participant, point,
          bet_kind, bet_tag, dk_link,
          edge, expected_value, kelly_fraction, kelly_units,
          true_probability, implied_probability, bet_grade, locked_by_user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), betId,
        leg.sport, leg.event_id ?? null, leg.event_name, leg.commence_time,
        leg.market, leg.pick, leg.odds,
        leg.participant ?? null, leg.point ?? null,
        leg.bet_kind ?? null, leg.bet_tag ?? null, leg.dk_link ?? null,
        leg.edge ?? null, leg.expected_value ?? null,
        leg.kelly_fraction ?? null, leg.kelly_units ?? null,
        leg.true_probability ?? null, leg.implied_probability ?? null,
        leg.bet_grade ?? null, leg.locked_by_user ? 1 : 0,
      )
    );

    await db.batch(legStmts);

    // Update user stats
    await db.prepare(`
      UPDATE users SET total_bets = total_bets + 1 WHERE id = ?
    `).bind(userRow.id).run();

    return NextResponse.json({ success: true, betId });
  } catch (err: any) {
    console.error('Save bet error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db      = (env as any).DB as D1Database;
    const url     = new URL(request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'username required' }, { status: 400 });
    }

    const userRow = await db.prepare('SELECT id, wins, losses, units_profit FROM users WHERE username = ?')
      .bind(username).first<{ id: string; wins: number; losses: number; units_profit: number }>();

    if (!userRow) {
      return NextResponse.json({ bets: [], stats: null });
    }

    const bets = await db.prepare(`
      SELECT b.id, b.created_at, b.status, b.stake, b.odds,
             b.potential_return, b.actual_return, b.confidence, b.avg_edge
      FROM   bets b
      WHERE  b.user_id = ?
      ORDER  BY b.created_at DESC
      LIMIT  50
    `).bind(userRow.id).all();

    // Fetch legs for each bet
    const betIds = bets.results.map((b: any) => b.id);
    const legsMap: Record<string, any[]> = {};

    if (betIds.length > 0) {
      const placeholders = betIds.map(() => '?').join(',');
      const legs = await db.prepare(`
        SELECT * FROM bet_legs WHERE bet_id IN (${placeholders}) ORDER BY bet_id
      `).bind(...betIds).all();

      for (const leg of legs.results) {
        const l = leg as any;
        if (!legsMap[l.bet_id]) legsMap[l.bet_id] = [];
        legsMap[l.bet_id].push(l);
      }
    }

    const enrichedBets = bets.results.map((b: any) => ({
      ...b,
      legs: legsMap[b.id] ?? [],
    }));

    return NextResponse.json({
      bets: enrichedBets,
      stats: {
        wins:         userRow.wins,
        losses:       userRow.losses,
        units_profit: userRow.units_profit,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
