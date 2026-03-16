/**
 * app/api/bets/route.ts
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

    // Upsert user row
    await db.prepare(`
      INSERT INTO users (id, username, nfc_tag_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).bind(crypto.randomUUID(), username, `local_${username}`, now).run();

    const userRow = await db.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username).first<{ id: string }>();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const parlayOdds      = bet.meta?.parlay_odds ?? 0;
    const potentialReturn = bet.stake + (parlayOdds > 0
      ? bet.stake * (parlayOdds / 100)
      : bet.stake * (100 / Math.abs(parlayOdds || 1)));

    // Insert bet
    await db.prepare(`
      INSERT INTO bets (id, user_id, created_at, status, stake, odds, potential_return, confidence, avg_edge)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).bind(
      betId, userRow.id, now,
      bet.stake, parlayOdds, potentialReturn,
      bet.meta?.total_confidence ?? null,
      bet.meta?.avg_edge ?? null,
    ).run();

    // Insert legs — guard against empty array (db.batch([]) throws)
    const legs = bet.legs ?? [];
    if (legs.length > 0) {
      const legStmts = legs.map((leg: any) =>
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
          leg.sport            ?? null,
          leg.event_id         ?? null,
          leg.event_name       ?? null,
          leg.commence_time    ?? now,
          leg.market           ?? null,
          leg.pick             ?? null,
          leg.odds             ?? null,
          leg.participant      ?? null,
          leg.point            ?? null,
          leg.bet_kind         ?? null,
          leg.bet_tag          ?? null,
          leg.dk_link          ?? null,
          leg.edge             ?? null,
          leg.expected_value   ?? null,
          leg.kelly_fraction   ?? null,
          leg.kelly_units      ?? null,
          leg.true_probability    ?? null,
          leg.implied_probability ?? null,
          leg.bet_grade        ?? null,
          leg.locked_by_user ? 1 : 0,
        )
      );
      await db.batch(legStmts);
    }

    // Update user stats
    await db.prepare(`UPDATE users SET total_bets = total_bets + 1 WHERE id = ?`)
      .bind(userRow.id).run();

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

    const userRow = await db.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username).first<{ id: string }>();

    if (!userRow) {
      return NextResponse.json({ success: true, bets: [], stats: emptyStats() });
    }

    // Fetch bets
    const betsResult = await db.prepare(`
      SELECT id, created_at, status, stake, odds,
             potential_return, actual_return, confidence, avg_edge
      FROM   bets
      WHERE  user_id = ?
      ORDER  BY created_at DESC
      LIMIT  50
    `).bind(userRow.id).all();

    const bets = betsResult.results as any[];

    // Fetch legs for each bet
    const betIds = bets.map((b: any) => b.id);
    const legsMap: Record<string, any[]> = {};

    if (betIds.length > 0) {
      const placeholders = betIds.map(() => '?').join(',');
      const legsResult = await db.prepare(`
        SELECT * FROM bet_legs WHERE bet_id IN (${placeholders}) ORDER BY bet_id
      `).bind(...betIds).all();

      for (const leg of legsResult.results as any[]) {
        if (!legsMap[leg.bet_id]) legsMap[leg.bet_id] = [];
        legsMap[leg.bet_id].push(leg);
      }
    }

    const enrichedBets = bets.map((b: any) => ({
      ...b,
      legs: legsMap[b.id] ?? [],
    }));

    // Calculate stats from actual bet data
    const won     = bets.filter((b: any) => b.status === 'won');
    const lost    = bets.filter((b: any) => b.status === 'lost');
    const settled = [...won, ...lost];
    const pending = bets.filter((b: any) => b.status === 'pending');

    const totalWagered  = bets.reduce((s: number, b: any) => s + (b.stake ?? 0), 0);
    const totalReturned = won.reduce((s: number, b: any) => s + (b.actual_return ?? b.potential_return ?? 0), 0);
    const totalStakeWon = won.reduce((s: number, b: any) => s + (b.stake ?? 0), 0);
    const totalStakeLost = lost.reduce((s: number, b: any) => s + (b.stake ?? 0), 0);
    const profitLoss    = totalReturned - totalStakeWon - totalStakeLost;
    const roi           = totalWagered > 0 ? (profitLoss / totalWagered) * 100 : 0;
    const winRate       = settled.length > 0 ? (won.length / settled.length) * 100 : 0;

    // Current streak (most recent settled bets)
    let streak = 0;
    const sortedSettled = [...settled].sort((a: any, b: any) => b.created_at - a.created_at);
    for (const b of sortedSettled) {
      if (b.status === 'won') {
        if (streak < 0) break;
        streak++;
      } else {
        if (streak > 0) break;
        streak--;
      }
    }

    return NextResponse.json({
      success: true,
      bets:    enrichedBets,
      stats: {
        total_bets:     bets.length,
        wins:           won.length,
        losses:         lost.length,
        pending:        pending.length,
        win_rate:       winRate,
        roi,
        total_wagered:  totalWagered,
        total_return:   totalReturned,
        profit_loss:    profitLoss,
        current_streak: streak,
      },
    });
  } catch (err: any) {
    console.error('Get bets error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function emptyStats() {
  return {
    total_bets: 0, wins: 0, losses: 0, pending: 0,
    win_rate: 0, roi: 0, total_wagered: 0,
    total_return: 0, profit_loss: 0, current_streak: 0,
  };
}
