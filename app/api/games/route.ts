/**
 * app/api/games/route.ts
 * Returns today's NCAA Tournament games enriched with KenPom projections.
 * This is the core data feed for the new game-card UI.
 */
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { OddsAPIClient } from '@/lib/odds-api-client';
import { normalizeTeamName } from '@/app/api/analytics/generate/route';

export const runtime = 'edge';

// 2026 tournament team whitelist
const TOURNAMENT_TEAMS = new Set([
  'UMBC','Howard','Texas','NC State','Prairie View','Lehigh','Miami OH','SMU',
  'Ohio State','TCU','Nebraska','Troy','Louisville','South Florida','Wisconsin','High Point',
  'Duke','Siena','Vanderbilt','McNeese','Michigan State','North Dakota State','Arkansas',"Hawai'i",
  'North Carolina','VCU','Michigan','BYU',"Saint Mary's",'Texas A&M','Illinois','Penn',
  'Georgia','Saint Louis','Gonzaga','Kennesaw State','Houston','Idaho',
  'Kentucky','Santa Clara','Texas Tech','Akron','Arizona','Long Island University',
  'Virginia','Wright State','Iowa State','Tennessee State','Alabama','Hofstra',
  'Villanova','Utah State','Tennessee','Florida','Clemson','Iowa',"St. John's",'UNI',
  'UCLA','UCF','Purdue','Queens','Kansas','Cal Baptist','UConn','Furman','Miami FL','Missouri',
]);

const VENUE_MAP: Record<string, string> = {
  'Duke':'Buffalo, NY','Siena':'Buffalo, NY','Ohio State':'Buffalo, NY','TCU':'Buffalo, NY',
  'Wisconsin':'Buffalo, NY','High Point':'Buffalo, NY','Michigan':'Buffalo, NY','BYU':'Buffalo, NY',
  'Louisville':'Greenville, SC','South Florida':'Greenville, SC','Vanderbilt':'Greenville, SC',
  'McNeese':'Greenville, SC','North Carolina':'Greenville, SC','VCU':'Greenville, SC',
  'Georgia':'Greenville, SC','Saint Louis':'Greenville, SC',
  'Nebraska':'Oklahoma City, OK','Troy':'Oklahoma City, OK','Arkansas':'Oklahoma City, OK',
  "Hawai'i":'Oklahoma City, OK','Michigan State':'Oklahoma City, OK',
  'North Dakota State':'Oklahoma City, OK','Illinois':'Oklahoma City, OK','Penn':'Oklahoma City, OK',
  "Saint Mary's":'Portland, OR','Texas A&M':'Portland, OR','Gonzaga':'Portland, OR',
  'Kennesaw State':'Portland, OR','Houston':'Portland, OR','Idaho':'Portland, OR',
  'Kentucky':'Tampa, FL','Santa Clara':'Tampa, FL','Iowa State':'Tampa, FL',
  'Tennessee State':'Tampa, FL','Clemson':'Tampa, FL','Iowa':'Tampa, FL',
  'Florida':'Tampa, FL','Miami FL':'Tampa, FL','Missouri':'Tampa, FL',
  'Texas Tech':'Philadelphia, PA','Akron':'Philadelphia, PA','Alabama':'Philadelphia, PA',
  'Hofstra':'Philadelphia, PA','Villanova':'Philadelphia, PA','Utah State':'Philadelphia, PA',
  "St. John's":'Philadelphia, PA','UNI':'Philadelphia, PA','Purdue':'Philadelphia, PA','Queens':'Philadelphia, PA',
  'Arizona':'San Diego, CA','Long Island University':'San Diego, CA','Tennessee':'San Diego, CA',
  'UCLA':'San Diego, CA','UCF':'San Diego, CA','UConn':'San Diego, CA','Furman':'San Diego, CA',
  'Virginia':'St. Louis, MO','Wright State':'St. Louis, MO','Kansas':'St. Louis, MO','Cal Baptist':'St. Louis, MO',
  'UMBC':'Dayton, OH','Howard':'Dayton, OH','Texas':'Dayton, OH','NC State':'Dayton, OH',
  'Prairie View':'Dayton, OH','Lehigh':'Dayton, OH','Miami OH':'Dayton, OH','SMU':'Dayton, OH',
};

interface KenPomEntry {
  adjOE: number; adjDE: number; adjTempo: number;
}

async function getKenPom(db: D1Database, team: string): Promise<KenPomEntry | null> {
  try {
    const row = await db.prepare(
      'SELECT adj_oe, adj_de, adj_tempo FROM kenpom_data WHERE team_name = ? LIMIT 1'
    ).bind(team).first<{ adj_oe: number; adj_de: number; adj_tempo: number }>();
    if (!row) return null;
    return { adjOE: row.adj_oe, adjDE: row.adj_de, adjTempo: row.adj_tempo };
  } catch { return null; }
}

function project(home: KenPomEntry, away: KenPomEntry) {
  const tempo     = (home.adjTempo + away.adjTempo) / 2;
  const homeScore = home.adjOE * (away.adjDE / 100) * (tempo / 100);
  const awayScore = away.adjOE * (home.adjDE / 100) * (tempo / 100);
  return {
    homeScore: Math.round(homeScore * 10) / 10,
    awayScore: Math.round(awayScore * 10) / 10,
    spread:    Math.round((homeScore - awayScore) * 10) / 10,
    total:     Math.round((homeScore + awayScore) * 10) / 10,
    homeWinProb: 1 / (1 + Math.exp(-(homeScore - awayScore) * 0.15)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db      = (env as any).DB as D1Database;
    const oddsClient = new OddsAPIClient((env as any).ODDS_API_KEY || '', db);

    // Fetch odds for NCAAB — all markets
    let games = await oddsClient.getOddsForSports(
      ['basketball_ncaab'],
      ['h2h', 'spreads', 'totals'],
      { sgpMode: 'none', requiredPropLegs: 0 }
    );

    // Filter to tournament teams only
    games = games.filter(g => {
      const h = normalizeTeamName(g.home_team);
      const a = normalizeTeamName(g.away_team);
      return TOURNAMENT_TEAMS.has(h) || TOURNAMENT_TEAMS.has(a);
    });

    // Enrich each game with KenPom projection
    const enriched = await Promise.all(games.map(async (game) => {
      const homeNorm = normalizeTeamName(game.home_team);
      const awayNorm = normalizeTeamName(game.away_team);

      const [homeKP, awayKP] = await Promise.all([
        getKenPom(db, homeNorm),
        getKenPom(db, awayNorm),
      ]);

      let kenpom: any = null;
      if (homeKP && awayKP) {
        const proj = project(homeKP, awayKP);
        // Get book lines for comparison
        const dk = game.bookmakers.find(b => b.key === 'draftkings')
                ?? game.bookmakers[0];

        let bookSpread: number | null = null;
        let bookTotal:  number | null = null;
        let homeML:     number | null = null;
        let awayML:     number | null = null;

        if (dk) {
          const spreadMkt = dk.markets.find(m => m.key === 'spreads');
          const totalMkt  = dk.markets.find(m => m.key === 'totals');
          const mlMkt     = dk.markets.find(m => m.key === 'h2h');

          if (spreadMkt) {
            const homeOut = spreadMkt.outcomes.find(o =>
              normalizeTeamName(o.name) === homeNorm
            );
            if (homeOut) bookSpread = homeOut.point;
          }
          if (totalMkt) {
            const overOut = totalMkt.outcomes.find(o =>
              o.name.toLowerCase().includes('over')
            );
            if (overOut) bookTotal = overOut.point;
          }
          if (mlMkt) {
            homeML = mlMkt.outcomes.find(o => normalizeTeamName(o.name) === homeNorm)?.price ?? null;
            awayML = mlMkt.outcomes.find(o => normalizeTeamName(o.name) === awayNorm)?.price ?? null;
          }
        }

        const spreadGap = bookSpread != null
          ? Math.round((proj.spread - bookSpread) * 10) / 10
          : null;
        const totalGap  = bookTotal != null
          ? Math.round((proj.total - bookTotal) * 10) / 10
          : null;

        // Market implied probabilities
        const homeImplied = homeML != null
          ? (homeML > 0 ? 100 / (homeML + 100) : Math.abs(homeML) / (Math.abs(homeML) + 100))
          : null;
        const awayImplied = awayML != null
          ? (awayML > 0 ? 100 / (awayML + 100) : Math.abs(awayML) / (Math.abs(awayML) + 100))
          : null;

        const mlEdgeHome = homeImplied != null
          ? Math.round((proj.homeWinProb - homeImplied) * 1000) / 10
          : null;
        const mlEdgeAway = awayImplied != null
          ? Math.round(((1 - proj.homeWinProb) - awayImplied) * 1000) / 10
          : null;

        kenpom = {
          projectedScore:    `${homeNorm} ${proj.homeScore} – ${awayNorm} ${proj.awayScore}`,
          projectedSpread:   proj.spread,
          projectedTotal:    proj.total,
          homeWinProb:       Math.round(proj.homeWinProb * 1000) / 10,
          awayWinProb:       Math.round((1 - proj.homeWinProb) * 1000) / 10,
          bookSpread,
          bookTotal,
          homeML,
          awayML,
          spreadGap,         // positive = KenPom thinks home better than book implies
          totalGap,          // positive = KenPom projects more scoring than book total
          mlEdgeHome,        // positive = KenPom thinks home is underpriced
          mlEdgeAway,        // positive = KenPom thinks away is underpriced
          // Value flags — these drive the highlight system
          totalValueSide:   totalGap != null
            ? (totalGap > 2 ? 'over' : totalGap < -2 ? 'under' : null)
            : null,
          mlValueSide:      (mlEdgeHome != null && mlEdgeHome > 5)  ? 'home'
                          : (mlEdgeAway != null && mlEdgeAway > 5)  ? 'away'
                          : null,
          hasEdge:          (Math.abs(totalGap ?? 0) > 2) || (Math.abs(mlEdgeHome ?? 0) > 5) || (Math.abs(mlEdgeAway ?? 0) > 5),
        };
      }

      return {
        id:           game.id,
        homeTeam:     homeNorm,
        awayTeam:     awayNorm,
        commenceTime: game.commence_time,
        venue:        VENUE_MAP[homeNorm] ?? VENUE_MAP[awayNorm] ?? 'Neutral Site',
        sport:        game.sport,
        bookmakers:   game.bookmakers,
        kenpom,
      };
    }));

    // Sort: games with edges first, then by time
    enriched.sort((a, b) => {
      const aEdge = a.kenpom?.hasEdge ? 1 : 0;
      const bEdge = b.kenpom?.hasEdge ? 1 : 0;
      if (aEdge !== bEdge) return bEdge - aEdge;
      return a.commenceTime - b.commenceTime;
    });

    return NextResponse.json({ success: true, games: enriched });
  } catch (err: any) {
    console.error('[games] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
