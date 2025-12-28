// The Odds API Client with smart caching
import type { Sport, GameData, Bookmaker, BookmakerMarket } from '@/types';
import { Database } from './db';

export class OddsAPIClient {
  private baseUrl = 'https://api.the-odds-api.com/v4';
  private requestCount = 0;
  private requestBudget = 50; // Conservative budget per generation request

  constructor(
    private apiKey: string,
    private db: Database
  ) {}

  /**
   * Get odds for multiple sports with intelligent prop handling
   */
  async getOddsForSports(
    sports: Sport[],
    markets: string[] = ['h2h', 'spreads', 'totals'],
    options?: {
      sgpMode?: 'none' | 'allow' | 'only';
      requiredPropLegs?: number;
    }
  ): Promise<GameData[]> {
    const allGames: GameData[] = [];

    // Separate standard markets from props
    const { standardMarkets, propMarkets } = this.separateMarkets(markets);
    const hasProps = propMarkets.length > 0;
    const wantsUniqueGames = options?.sgpMode === 'none';
    const requiredPropLegs = options?.requiredPropLegs || 0;

    console.log(`Fetching: ${sports.length} sports, ${standardMarkets.length} standard markets, ${propMarkets.length} prop markets`);

    for (const sport of sports) {
      // Phase 1: Fetch standard markets (h2h, spreads, totals)
      if (standardMarkets.length > 0) {
        const standardGames = await this.fetchMarkets(sport, standardMarkets, 60); // 60s cache
        allGames.push(...standardGames);
      }

      // Phase 2: Fetch props with chunking and breadth-first strategy
      if (hasProps && this.hasRequestBudget()) {
        const propGames = await this.fetchPropsOptimized(
          sport,
          propMarkets,
          wantsUniqueGames,
          requiredPropLegs
        );
        allGames.push(...propGames);
      }
    }

    console.log(`Total games fetched: ${allGames.length}, API requests used: ${this.requestCount}/${this.requestBudget}`);
    return allGames;
  }

  /**
   * Fetch props with market chunking and breadth-first strategy
   */
  private async fetchPropsOptimized(
    sport: Sport,
    propMarkets: string[],
    wantsUniqueGames: boolean,
    requiredPropLegs: number
  ): Promise<GameData[]> {
    const allPropGames: GameData[] = [];

    // Breadth-first mode: sample MANY events with FEW markets each
    const breadthMode = wantsUniqueGames && requiredPropLegs > 0;
    const targetUniqueEvents = breadthMode ? Math.min(40, requiredPropLegs + 4) : 0;

    // Chunk prop markets to avoid 422 errors (6-8 markets per call)
    const marketChunks = this.chunkArray(propMarkets, 6);
    console.log(`Breadth mode: ${breadthMode}, Target events: ${targetUniqueEvents}, Market chunks: ${marketChunks.length}`);

    if (breadthMode) {
      // Breadth-first: Fetch 1 chunk for many events
      const uniqueEventIds = new Set<string>();

      for (const chunk of marketChunks) {
        if (uniqueEventIds.size >= targetUniqueEvents) break;
        if (!this.hasRequestBudget()) break;

        const games = await this.fetchMarkets(sport, chunk, 75); // 75s cache for props

        // Track unique events with props
        for (const game of games) {
          if (game.bookmakers.length > 0) {
            uniqueEventIds.add(game.id);
          }
        }

        allPropGames.push(...games);

        // Early exit if we have enough unique prop events
        if (uniqueEventIds.size >= targetUniqueEvents) {
          console.log(`Early exit: ${uniqueEventIds.size} unique prop events collected`);
          break;
        }
      }
    } else {
      // Depth-first: Fetch all chunks for fewer events
      for (const chunk of marketChunks) {
        if (!this.hasRequestBudget()) break;

        const games = await this.fetchMarkets(sport, chunk, 75); // 75s cache for props
        allPropGames.push(...games);
      }
    }

    return allPropGames;
  }

  /**
   * Fetch markets for a sport with caching
   */
  private async fetchMarkets(
    sport: Sport,
    markets: string[],
    cacheTTL: number
  ): Promise<GameData[]> {
    const cacheKey = `odds_${sport}_${markets.sort().join('_')}`;
    const cached = await this.db.getCached<GameData[]>(cacheKey);

    if (cached) {
      console.log(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    if (!this.hasRequestBudget()) {
      console.warn(`Request budget exhausted (${this.requestCount}/${this.requestBudget})`);
      return [];
    }

    console.log(`Cache MISS: ${cacheKey} - Fetching from API`);

    try {
      const url = new URL(`${this.baseUrl}/sports/${sport}/odds`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('regions', 'us');
      url.searchParams.set('markets', markets.join(','));
      url.searchParams.set('oddsFormat', 'american');

      this.requestCount++; // Track request
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Odds API error for ${sport}:`, response.status, errorText);

        // 422 typically means unsupported market
        if (response.status === 422) {
          console.error(`Some markets unavailable for ${sport}. Markets: ${markets.join(', ')}`);
        }
        return [];
      }

      const data = await response.json();
      const games = this.transformOddsAPIResponse(data, sport);

      // Variable cache TTL based on market type
      await this.db.setCache(cacheKey, games, cacheTTL);

      return games;
    } catch (error) {
      console.error(`Error fetching ${sport} markets:`, error);
      return [];
    }
  }

  /**
   * Get upcoming games (without odds)
   */
  async getUpcomingGames(sport: Sport): Promise<GameData[]> {
    const cacheKey = `games_${sport}`;
    const cached = await this.db.getCached<GameData[]>(cacheKey);

    if (cached) {
      console.log(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    console.log(`Cache MISS: ${cacheKey} - Fetching from API`);

    try {
      const url = new URL(`${this.baseUrl}/sports/${sport}/events`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('dateFormat', 'iso');

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Odds API error: ${response.status}`);
      }

      const data = await response.json();
      const games: GameData[] = data.map((game: any) => ({
        id: game.id,
        sport,
        commence_time: new Date(game.commence_time).getTime(),
        home_team: game.home_team,
        away_team: game.away_team,
        weather: null,
        bookmakers: [],
      }));

      // Cache for 1 hour (3600s)
      await this.db.setCache(cacheKey, games, 3600);

      return games;
    } catch (error) {
      console.error(`Error fetching games for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Transform Odds API response to our format
   */
  private transformOddsAPIResponse(data: any[], sport: Sport): GameData[] {
    return data.map((game) => ({
      id: game.id,
      sport,
      commence_time: new Date(game.commence_time).getTime(),
      home_team: game.home_team,
      away_team: game.away_team,
      weather: null, // Will be enriched separately
      bookmakers: this.transformBookmakers(game.bookmakers || []),
    }));
  }

  /**
   * Transform bookmakers data
   */
  private transformBookmakers(bookmakers: any[]): Bookmaker[] {
    return bookmakers.map((book) => ({
      key: book.key,
      title: book.title,
      markets: this.transformMarkets(book.markets || []),
    }));
  }

  /**
   * Transform markets data
   */
  private transformMarkets(markets: any[]): BookmakerMarket[] {
    return markets.map((market) => ({
      key: market.key,
      outcomes: market.outcomes.map((outcome: any) => ({
        name: outcome.name,
        price: outcome.price,
        point: outcome.point,
        description: outcome.description,
        participant: outcome.participant,
      })),
    }));
  }

  /**
   * Get usage stats (for monitoring free tier)
   */
  async getUsageStats(): Promise<{ requests_used: number; requests_remaining: number }> {
    try {
      const url = new URL(`${this.baseUrl}/sports`);
      url.searchParams.set('apiKey', this.apiKey);

      const response = await fetch(url.toString());

      const requestsUsed = response.headers.get('x-requests-used');
      const requestsRemaining = response.headers.get('x-requests-remaining');

      return {
        requests_used: requestsUsed ? parseInt(requestsUsed) : 0,
        requests_remaining: requestsRemaining ? parseInt(requestsRemaining) : 500,
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return { requests_used: 0, requests_remaining: 500 };
    }
  }

  /**
   * Separate standard markets from prop markets
   */
  private separateMarkets(markets: string[]): {
    standardMarkets: string[];
    propMarkets: string[];
  } {
    const standardMarkets: string[] = [];
    const propMarkets: string[] = [];

    const standardMarketKeys = ['h2h', 'spreads', 'totals'];

    for (const market of markets) {
      if (standardMarketKeys.includes(market)) {
        standardMarkets.push(market);
      } else {
        propMarkets.push(market);
      }
    }

    return { standardMarkets, propMarkets };
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Check if we have request budget remaining
   */
  private hasRequestBudget(): boolean {
    return this.requestCount < this.requestBudget;
  }

  /**
   * Get current request stats
   */
  getRequestStats(): { used: number; budget: number; remaining: number } {
    return {
      used: this.requestCount,
      budget: this.requestBudget,
      remaining: this.requestBudget - this.requestCount,
    };
  }

  /**
   * Reset request counter (called at start of each generation)
   */
  resetRequestCounter(): void {
    this.requestCount = 0;
  }
}
