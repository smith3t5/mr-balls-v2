// The Odds API Client with smart caching
import type { Sport, GameData, Bookmaker, BookmakerMarket } from '@/types';
import { Database } from './db';

export class OddsAPIClient {
  private baseUrl = 'https://api.the-odds-api.com/v4';

  constructor(
    private apiKey: string,
    private db: Database
  ) {}

  /**
   * Get odds for multiple sports (cached)
   */
  async getOddsForSports(
    sports: Sport[],
    markets: string[] = ['h2h', 'spreads', 'totals']
  ): Promise<GameData[]> {
    const allGames: GameData[] = [];

    for (const sport of sports) {
      const cacheKey = `odds_${sport}_${markets.join('_')}`;
      const cached = await this.db.getCached<GameData[]>(cacheKey);

      if (cached) {
        console.log(`Cache HIT: ${cacheKey}`);
        allGames.push(...cached);
        continue;
      }

      console.log(`Cache MISS: ${cacheKey} - Fetching from API`);

      try {
        const url = new URL(`${this.baseUrl}/sports/${sport}/odds`);
        url.searchParams.set('apiKey', this.apiKey);
        url.searchParams.set('regions', 'us');
        url.searchParams.set('markets', markets.join(','));
        url.searchParams.set('oddsFormat', 'american');

        const response = await fetch(url.toString());

        if (!response.ok) {
          console.error(`Odds API error for ${sport}:`, response.status);
          continue;
        }

        const data = await response.json();
        const games = this.transformOddsAPIResponse(data, sport);

        // Cache for 10 minutes (600s)
        await this.db.setCache(cacheKey, games, 600);

        allGames.push(...games);
      } catch (error) {
        console.error(`Error fetching odds for ${sport}:`, error);
      }
    }

    return allGames;
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
}
