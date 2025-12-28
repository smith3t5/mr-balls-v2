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
    const gamesMap = new Map<string, GameData>();

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
        this.mergeGamesIntoMap(gamesMap, standardGames);
      }

      // Phase 2: Fetch props with chunking and breadth-first strategy
      if (hasProps && this.hasRequestBudget()) {
        const propGames = await this.fetchPropsOptimized(
          sport,
          propMarkets,
          wantsUniqueGames,
          requiredPropLegs
        );
        this.mergeGamesIntoMap(gamesMap, propGames);
      }
    }

    const allGames = Array.from(gamesMap.values());
    console.log(`Total unique games: ${allGames.length}, API requests used: ${this.requestCount}/${this.requestBudget}`);
    return allGames;
  }

  /**
   * Fetch props with market chunking and breadth-first strategy
   * Uses event-specific endpoint which works on lower API tiers
   */
  private async fetchPropsOptimized(
    sport: Sport,
    propMarkets: string[],
    wantsUniqueGames: boolean,
    requiredPropLegs: number
  ): Promise<GameData[]> {
    console.log(`Fetching props for ${sport} using event-specific endpoint`);

    // Step 1: Get list of upcoming events
    const events = await this.getUpcomingGames(sport);
    if (events.length === 0) {
      console.log(`No events found for ${sport}`);
      return [];
    }

    console.log(`Found ${events.length} events for ${sport}`);

    const gamesMap = new Map<string, GameData>();

    // Breadth-first mode: sample MANY events with FEW markets each
    const breadthMode = wantsUniqueGames && requiredPropLegs > 0;
    const targetUniqueEvents = breadthMode ? Math.min(40, requiredPropLegs + 4) : Math.min(20, events.length);

    // Chunk prop markets (6 markets per call as per original code)
    const marketChunks = this.chunkArray(propMarkets, 6);
    console.log(`Breadth mode: ${breadthMode}, Target events: ${targetUniqueEvents}, Market chunks: ${marketChunks.length}`);

    let eventsProcessed = 0;
    let propsFound = 0;

    // Step 2: Fetch props for each event using event-specific endpoint
    for (const event of events) {
      if (eventsProcessed >= targetUniqueEvents) break;
      if (!this.hasRequestBudget()) break;

      // In breadth mode, fetch fewer market chunks per event
      // In depth mode, fetch all chunks for each event
      const chunksToFetch = breadthMode ? marketChunks.slice(0, 1) : marketChunks;

      for (const chunk of chunksToFetch) {
        if (!this.hasRequestBudget()) break;

        const game = await this.fetchEventProps(sport, event.id, chunk, 75);

        if (game && game.bookmakers.length > 0) {
          // Merge this game's prop data
          this.mergeGamesIntoMap(gamesMap, [game]);
          propsFound++;
        }
      }

      eventsProcessed++;

      // Early exit if breadth mode and we have enough events
      if (breadthMode && gamesMap.size >= targetUniqueEvents) {
        console.log(`Early exit: ${gamesMap.size} unique prop events collected`);
        break;
      }
    }

    const allPropGames = Array.from(gamesMap.values());
    console.log(`✅ Fetched props for ${eventsProcessed} events, found props in ${propsFound} calls, ${allPropGames.length} unique games`);

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
   * Fetch props for a specific event using event-specific endpoint
   * This endpoint has different access rules and works on lower API tiers
   */
  private async fetchEventProps(
    sport: Sport,
    eventId: string,
    markets: string[],
    cacheTTL: number
  ): Promise<GameData | null> {
    const cacheKey = `event_props_${sport}_${eventId}_${markets.sort().join('_')}`;
    const cached = await this.db.getCached<GameData>(cacheKey);

    if (cached) {
      return cached;
    }

    if (!this.hasRequestBudget()) {
      return null;
    }

    try {
      const url = new URL(`${this.baseUrl}/sports/${sport}/events/${eventId}/odds`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('regions', 'us');
      // Fetch ALL US bookmakers for maximum line shopping opportunities
      // Don't filter by bookmaker - get all available to find edge
      url.searchParams.set('markets', markets.join(','));
      url.searchParams.set('oddsFormat', 'american');

      this.requestCount++;
      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status !== 422) { // Don't log 422 as errors (just unavailable)
          console.error(`Event props error for ${sport}/${eventId}:`, response.status);
        }
        return null;
      }

      const data = await response.json();

      // Transform single event response to GameData format
      const game: GameData = {
        id: data.id,
        sport,
        commence_time: new Date(data.commence_time).getTime(),
        home_team: data.home_team,
        away_team: data.away_team,
        weather: null,
        bookmakers: this.transformBookmakers(data.bookmakers || []),
      };

      // Cache successfully fetched props
      await this.db.setCache(cacheKey, game, cacheTTL);

      return game;
    } catch (error) {
      console.error(`Error fetching event props for ${sport}/${eventId}:`, error);
      return null;
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
   * Merge games into map, combining bookmakers for same event
   */
  private mergeGamesIntoMap(gamesMap: Map<string, GameData>, newGames: GameData[]): void {
    for (const game of newGames) {
      const existing = gamesMap.get(game.id);

      if (existing) {
        // Merge bookmakers - combine markets from different fetches
        for (const newBook of game.bookmakers) {
          const existingBook = existing.bookmakers.find(b => b.key === newBook.key);

          if (existingBook) {
            // Combine markets for same bookmaker
            const existingMarketKeys = new Set(existingBook.markets.map(m => m.key));
            for (const newMarket of newBook.markets) {
              if (!existingMarketKeys.has(newMarket.key)) {
                existingBook.markets.push(newMarket);
              }
            }
          } else {
            // Add new bookmaker
            existing.bookmakers.push(newBook);
          }
        }
      } else {
        // First time seeing this game
        gamesMap.set(game.id, game);
      }
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
