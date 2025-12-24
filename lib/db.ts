// Database utilities for D1
import type { D1Database } from '@cloudflare/workers-types';
import type { User, Bet, BetLeg, SharpPlay } from '@/types';

export class Database {
  constructor(private db: D1Database) {}

  // ============================================
  // USERS
  // ============================================

  async getUserById(id: string): Promise<User | null> {
    const user = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first();

    if (!user) return null;
    return this.serializeUser(user);
  }

  async getUserByNFCTag(nfc_tag_id: string): Promise<User | null> {
    const user = await this.db
      .prepare('SELECT * FROM users WHERE nfc_tag_id = ?')
      .bind(nfc_tag_id)
      .first();

    if (!user) return null;
    return this.serializeUser(user);
  }

  async createUser(data: {
    id: string;
    username: string;
    nfc_tag_id: string;
    state_code?: string | null;
  }): Promise<User> {
    await this.db
      .prepare(
        `INSERT INTO users (id, username, nfc_tag_id, state_code, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(data.id, data.username, data.nfc_tag_id, data.state_code || null, Date.now())
      .run();

    return this.getUserById(data.id) as Promise<User>;
  }

  async updateUserStats(userId: string, stats: Partial<User['stats']>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    Object.entries(stats).forEach(([key, value]) => {
      setClauses.push(`${key} = ?`);
      values.push(value);
    });

    values.push(userId);

    await this.db
      .prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // ============================================
  // BETS
  // ============================================

  async createBet(data: {
    id: string;
    user_id: string;
    stake: number;
    odds: number;
    potential_return: number;
    confidence?: number;
    notes?: string;
    avg_edge?: number;
    contrarian_score?: number;
  }): Promise<string> {
    await this.db
      .prepare(
        `INSERT INTO bets (
          id, user_id, created_at, status, stake, odds, potential_return,
          confidence, notes, avg_edge, contrarian_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.id,
        data.user_id,
        Date.now(),
        'pending',
        data.stake,
        data.odds,
        data.potential_return,
        data.confidence || null,
        data.notes || null,
        data.avg_edge || null,
        data.contrarian_score || null
      )
      .run();

    return data.id;
  }

  async createBetLeg(data: {
    id: string;
    bet_id: string;
    sport: string;
    event_id: string;
    event_name: string;
    commence_time: number;
    market: string;
    pick: string;
    odds: number;
    participant?: string;
    point?: number;
    bet_kind: string;
    bet_tag?: string;
    dk_link?: string;
    edge?: number;
    sharp_money_pct?: number;
    public_money_pct?: number;
    line_movement?: number;
    locked_by_user?: boolean;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO bet_legs (
          id, bet_id, sport, event_id, event_name, commence_time,
          market, pick, odds, participant, point, bet_kind, bet_tag,
          dk_link, edge, sharp_money_pct, public_money_pct, line_movement,
          locked_by_user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.id,
        data.bet_id,
        data.sport,
        data.event_id,
        data.event_name,
        data.commence_time,
        data.market,
        data.pick,
        data.odds,
        data.participant || null,
        data.point || null,
        data.bet_kind,
        data.bet_tag || null,
        data.dk_link || null,
        data.edge || null,
        data.sharp_money_pct || null,
        data.public_money_pct || null,
        data.line_movement || null,
        data.locked_by_user ? 1 : 0
      )
      .run();
  }

  async getBetById(id: string): Promise<Bet | null> {
    const bet = await this.db
      .prepare('SELECT * FROM bets WHERE id = ?')
      .bind(id)
      .first();

    if (!bet) return null;

    const legs = await this.db
      .prepare('SELECT * FROM bet_legs WHERE bet_id = ? ORDER BY created_at')
      .bind(id)
      .all();

    return this.serializeBet(bet, legs.results);
  }

  async getUserBets(
    userId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<Bet[]> {
    let query = 'SELECT * FROM bets WHERE user_id = ?';
    const params: any[] = [userId];

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const bets = await this.db.prepare(query).bind(...params).all();

    if (bets.results.length === 0) {
      return [];
    }

    // Fetch ALL legs for these bets in ONE query (fix N+1 problem)
    const betIds = bets.results.map((bet: any) => bet.id);
    const placeholders = betIds.map(() => '?').join(',');
    const legsQuery = `SELECT * FROM bet_legs WHERE bet_id IN (${placeholders}) ORDER BY bet_id`;

    const allLegs = await this.db.prepare(legsQuery).bind(...betIds).all();

    // Group legs by bet_id
    const legsByBetId = new Map<string, any[]>();
    for (const leg of allLegs.results) {
      if (!legsByBetId.has(leg.bet_id as string)) {
        legsByBetId.set(leg.bet_id as string, []);
      }
      legsByBetId.get(leg.bet_id as string)!.push(leg);
    }

    // Serialize bets with their legs
    return bets.results.map((bet: any) => {
      const legs = legsByBetId.get(bet.id) || [];
      return this.serializeBet(bet, legs);
    });
  }

  async updateBetStatus(
    betId: string,
    status: string,
    actualReturn?: number
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE bets SET status = ?, actual_return = ?, settled_at = ? WHERE id = ?`
      )
      .bind(status, actualReturn || null, Date.now(), betId)
      .run();
  }

  async updateBetLegStatus(legId: string, status: string): Promise<void> {
    await this.db
      .prepare('UPDATE bet_legs SET status = ? WHERE id = ?')
      .bind(status, legId)
      .run();
  }

  async deleteBet(betId: string): Promise<void> {
    // Delete bet legs first (foreign key constraint)
    await this.db
      .prepare('DELETE FROM bet_legs WHERE bet_id = ?')
      .bind(betId)
      .run();

    // Delete the bet
    await this.db
      .prepare('DELETE FROM bets WHERE id = ?')
      .bind(betId)
      .run();
  }

  // ============================================
  // SHARP PLAYS
  // ============================================

  async getActiveSharpPlays(sport?: string): Promise<SharpPlay[]> {
    const now = Date.now();
    let query = 'SELECT * FROM sharp_plays WHERE expires_at > ? ORDER BY confidence DESC LIMIT 20';
    const params = [now];

    if (sport) {
      query = 'SELECT * FROM sharp_plays WHERE expires_at > ? AND sport = ? ORDER BY confidence DESC LIMIT 20';
      params.push(sport);
    }

    const plays = await this.db.prepare(query).bind(...params).all();
    return plays.results.map((p: any) => this.serializeSharpPlay(p));
  }

  async createSharpPlay(data: Omit<SharpPlay, 'id' | 'found_at'>): Promise<void> {
    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO sharp_plays (
          id, sport, event_id, event_name, commence_time, market, pick, odds,
          edge, confidence, sharp_money_pct, line_value, situational_score,
          weather_impact, trend_score, analysis_summary, found_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.sport,
        data.event_id,
        data.event_name,
        data.commence_time,
        data.market,
        data.pick,
        data.odds,
        data.edge,
        data.confidence,
        data.sharp_money_pct || null,
        data.line_value || null,
        data.situational_score || null,
        data.weather_impact || null,
        data.trend_score || null,
        data.analysis_summary,
        Date.now(),
        data.expires_at
      )
      .run();
  }

  // ============================================
  // LEADERBOARD
  // ============================================

  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'all_time') {
    const cached = await this.db
      .prepare('SELECT data FROM leaderboard_cache WHERE period = ?')
      .bind(period)
      .first();

    if (cached) {
      return JSON.parse(cached.data as string);
    }

    // Calculate on the fly if no cache
    const users = await this.db
      .prepare(
        `SELECT
          id, username, avatar_url,
          wins, losses, pushes, units_wagered, units_profit, sharp_score
        FROM users
        WHERE total_bets > 0
        ORDER BY units_profit DESC
        LIMIT 100`
      )
      .all();

    return users.results.map((u: any, idx: number) => ({
      rank: idx + 1,
      user_id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      roi: u.units_wagered > 0 ? (u.units_profit / u.units_wagered) * 100 : 0,
      units_profit: u.units_profit,
      total_bets: u.wins + u.losses + u.pushes,
      win_rate: u.wins + u.losses > 0 ? (u.wins / (u.wins + u.losses)) * 100 : 0,
      sharp_score: u.sharp_score,
    }));
  }

  // ============================================
  // CACHE
  // ============================================

  async getCached<T = any>(key: string): Promise<T | null> {
    const cached = await this.db
      .prepare('SELECT data, expires_at FROM api_cache WHERE key = ?')
      .bind(key)
      .first();

    if (!cached) return null;

    if (cached.expires_at < Date.now()) {
      // Expired, delete it
      await this.db.prepare('DELETE FROM api_cache WHERE key = ?').bind(key).run();
      return null;
    }

    return JSON.parse(cached.data as string);
  }

  async setCache(key: string, data: any, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO api_cache (key, data, expires_at)
         VALUES (?, ?, ?)`
      )
      .bind(key, JSON.stringify(data), expiresAt)
      .run();
  }

  // ============================================
  // SERIALIZERS
  // ============================================

  private serializeUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      nfc_tag_id: row.nfc_tag_id,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      tier: row.tier,
      stats: {
        total_bets: row.total_bets,
        wins: row.wins,
        losses: row.losses,
        pushes: row.pushes,
        units_wagered: row.units_wagered,
        units_profit: row.units_profit,
        roi:
          row.units_wagered > 0
            ? (row.units_profit / row.units_wagered) * 100
            : 0,
        best_win_streak: row.best_win_streak,
        current_streak: row.current_streak,
        sharp_score: row.sharp_score,
      },
      preferences: {
        default_unit_size: row.default_unit_size,
        notifications_enabled: !!row.notifications_enabled,
      },
    };
  }

  private serializeBet(betRow: any, legRows: any[]): Bet {
    return {
      id: betRow.id,
      user_id: betRow.user_id,
      created_at: betRow.created_at,
      status: betRow.status,
      legs: legRows.map((leg) => this.serializeBetLeg(leg)),
      stake: betRow.stake,
      odds: betRow.odds,
      potential_return: betRow.potential_return,
      actual_return: betRow.actual_return,
      confidence: betRow.confidence,
      notes: betRow.notes,
      settled_at: betRow.settled_at,
      analytics: {
        avg_edge: betRow.avg_edge,
        contrarian_score: betRow.contrarian_score,
      },
    };
  }

  private serializeBetLeg(row: any): BetLeg {
    return {
      id: row.id,
      bet_id: row.bet_id,
      sport: row.sport,
      event_id: row.event_id,
      event_name: row.event_name,
      commence_time: row.commence_time,
      market: row.market,
      pick: row.pick,
      odds: row.odds,
      status: row.status,
      participant: row.participant,
      point: row.point,
      bet_kind: row.bet_kind,
      bet_tag: row.bet_tag,
      dk_link: row.dk_link,
      analytics: {
        edge: row.edge,
        sharp_money_pct: row.sharp_money_pct,
        public_money_pct: row.public_money_pct,
        line_movement: row.line_movement,
        factors: [], // Populated separately if needed
      },
      locked_by_user: !!row.locked_by_user,
    };
  }

  private serializeSharpPlay(row: any): SharpPlay {
    return {
      id: row.id,
      sport: row.sport,
      event_id: row.event_id,
      event_name: row.event_name,
      commence_time: row.commence_time,
      market: row.market,
      pick: row.pick,
      odds: row.odds,
      edge: row.edge,
      confidence: row.confidence,
      sharp_money_pct: row.sharp_money_pct,
      line_value: row.line_value,
      situational_score: row.situational_score,
      weather_impact: row.weather_impact,
      trend_score: row.trend_score,
      analysis_summary: row.analysis_summary,
      found_at: row.found_at,
      expires_at: row.expires_at,
    };
  }
}
