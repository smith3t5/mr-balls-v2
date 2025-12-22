// Weather.gov API Client
import type { WeatherData } from '@/types';
import { Database } from './db';

interface Coordinates {
  lat: number;
  lon: number;
}

// Stadium coordinates (subset - expand as needed)
const STADIUM_COORDS: Record<string, Coordinates> = {
  // NFL
  'New England Patriots': { lat: 42.0909, lon: -71.2643 },
  'Buffalo Bills': { lat: 42.7738, lon: -78.7870 },
  'Miami Dolphins': { lat: 25.9580, lon: -80.2389 },
  'New York Jets': { lat: 40.8135, lon: -74.0745 },
  'Pittsburgh Steelers': { lat: 40.4468, lon: -80.0158 },
  'Cleveland Browns': { lat: 41.5061, lon: -81.6995 },
  'Baltimore Ravens': { lat: 39.2780, lon: -76.6227 },
  'Cincinnati Bengals': { lat: 39.0954, lon: -84.5160 },
  'Kansas City Chiefs': { lat: 39.0489, lon: -94.4839 },
  'Las Vegas Raiders': { lat: 36.0908, lon: -115.1831 },
  'Los Angeles Chargers': { lat: 33.8634, lon: -118.3390 },
  'Denver Broncos': { lat: 39.7439, lon: -105.0200 },
  'Green Bay Packers': { lat: 44.5013, lon: -88.0622 },
  'Chicago Bears': { lat: 41.8623, lon: -87.6167 },
  'Detroit Lions': { lat: 42.3400, lon: -83.0456 },
  'Minnesota Vikings': { lat: 44.9738, lon: -93.2578 },
  // Add more as needed...
};

// Dome stadiums (no weather impact)
const DOME_STADIUMS = new Set([
  'Arizona Cardinals',
  'Atlanta Falcons',
  'Dallas Cowboys',
  'Detroit Lions',
  'Houston Texans',
  'Indianapolis Colts',
  'Las Vegas Raiders',
  'Los Angeles Chargers',
  'Los Angeles Rams',
  'Minnesota Vikings',
  'New Orleans Saints',
]);

export class WeatherClient {
  constructor(private db: Database) {}

  /**
   * Get weather for a game
   */
  async getWeatherForGame(
    homeTeam: string,
    gameTime: number
  ): Promise<WeatherData | null> {
    // Check if dome stadium
    if (DOME_STADIUMS.has(homeTeam)) {
      return null; // No weather impact in dome
    }

    // Get coordinates
    const coords = STADIUM_COORDS[homeTeam];
    if (!coords) {
      console.warn(`No coordinates for team: ${homeTeam}`);
      return null;
    }

    // Check cache
    const cacheKey = `weather_${coords.lat}_${coords.lon}_${Math.floor(gameTime / 3600000)}`; // Hour granularity
    const cached = await this.db.getCached<WeatherData>(cacheKey);

    if (cached) {
      console.log(`Weather cache HIT: ${homeTeam}`);
      return cached;
    }

    console.log(`Weather cache MISS: ${homeTeam} - Fetching from API`);

    try {
      // Get weather from Weather.gov
      const weather = await this.fetchWeatherGov(coords);

      // Cache for 1 hour
      await this.db.setCache(cacheKey, weather, 3600);

      return weather;
    } catch (error) {
      console.error(`Error fetching weather for ${homeTeam}:`, error);
      return null;
    }
  }

  /**
   * Fetch weather from Weather.gov API
   */
  private async fetchWeatherGov(coords: Coordinates): Promise<WeatherData> {
    // Step 1: Get grid point
    const pointUrl = `https://api.weather.gov/points/${coords.lat},${coords.lon}`;
    const pointResponse = await fetch(pointUrl, {
      headers: {
        'User-Agent': 'MrBalls/2.0 (sports betting app)',
      },
    });

    if (!pointResponse.ok) {
      throw new Error(`Weather.gov points error: ${pointResponse.status}`);
    }

    const pointData = await pointResponse.json();
    const forecastUrl = pointData.properties.forecast;

    // Step 2: Get forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        'User-Agent': 'MrBalls/2.0 (sports betting app)',
      },
    });

    if (!forecastResponse.ok) {
      throw new Error(`Weather.gov forecast error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const current = forecastData.properties.periods[0];

    // Parse weather data
    const windSpeed = this.parseWindSpeed(current.windSpeed);
    const precipitation = this.parsePrecipitation(current.detailedForecast);
    const temperature = current.temperature;
    const conditions = current.shortForecast;

    return {
      wind_speed: windSpeed,
      precipitation,
      temperature,
      conditions,
    };
  }

  /**
   * Parse wind speed from string (e.g., "15 mph")
   */
  private parseWindSpeed(windStr: string): number {
    const match = windStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse precipitation chance from forecast text
   */
  private parsePrecipitation(forecast: string): number {
    const lowerForecast = forecast.toLowerCase();

    // Look for percentage
    const percentMatch = lowerForecast.match(/(\d+)%/);
    if (percentMatch) {
      return parseInt(percentMatch[1]);
    }

    // Qualitative assessment
    if (lowerForecast.includes('rain') || lowerForecast.includes('snow')) {
      return 80;
    }
    if (lowerForecast.includes('showers') || lowerForecast.includes('chance')) {
      return 50;
    }

    return 0;
  }
}
