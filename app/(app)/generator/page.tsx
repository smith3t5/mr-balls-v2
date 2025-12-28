'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Zap,
  Settings,
  Shuffle,
  Save,
  Share2,
  TrendingUp,
  Shield,
  Target,
  Flame,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  Dices,
  Calendar,
  Lock,
} from 'lucide-react';
import { generateParlayShareText } from '@/lib/draftkings-links';

const SPORTS = [
  { key: 'americanfootball_nfl', name: 'NFL' },
  { key: 'americanfootball_ncaaf', name: 'College Football' },
  { key: 'basketball_nba', name: 'NBA' },
  { key: 'basketball_ncaab', name: 'College Basketball' },
  { key: 'icehockey_nhl', name: 'NHL' },
  { key: 'baseball_mlb', name: 'MLB' },
];

const BET_TYPES = [
  { key: 'spread', name: 'Spreads' },
  { key: 'over_under', name: 'Totals (O/U)' },
  { key: 'moneyline', name: 'Moneyline' },
];

const EXTRA_MARKETS = [
  // Basketball
  { key: 'player_points', name: 'Player Points' },
  { key: 'player_rebounds', name: 'Player Rebounds' },
  { key: 'player_assists', name: 'Player Assists' },
  { key: 'player_threes', name: 'Player 3-Pointers' },
  { key: 'player_blocks', name: 'Player Blocks' },
  { key: 'player_steals', name: 'Player Steals' },
  { key: 'player_double_double', name: 'Player Double Double' },

  // Football (NFL/NCAAF)
  { key: 'player_pass_tds', name: 'Pass Touchdowns' },
  { key: 'player_pass_yds', name: 'Passing Yards' },
  { key: 'player_pass_completions', name: 'Pass Completions' },
  { key: 'player_pass_attempts', name: 'Pass Attempts' },
  { key: 'player_pass_interceptions', name: 'Interceptions Thrown' },
  { key: 'player_rush_yds', name: 'Rushing Yards' },
  { key: 'player_rush_attempts', name: 'Rush Attempts' },
  { key: 'player_receptions', name: 'Receptions' },
  { key: 'player_reception_yds', name: 'Receiving Yards' },
  { key: 'player_anytime_td', name: 'Anytime TD Scorer' },
  { key: 'player_first_td', name: 'First TD Scorer' },
  { key: 'player_last_td', name: 'Last TD Scorer' },
  { key: 'player_kicking_points', name: 'Kicking Points' },

  // Baseball
  { key: 'batter_hits', name: 'Batter Hits' },
  { key: 'batter_total_bases', name: 'Batter Total Bases' },
  { key: 'batter_rbis', name: 'Batter RBIs' },
  { key: 'batter_runs_scored', name: 'Batter Runs Scored' },
  { key: 'batter_home_runs', name: 'Batter Home Runs' },
  { key: 'batter_stolen_bases', name: 'Stolen Bases' },
  { key: 'pitcher_strikeouts', name: 'Pitcher Strikeouts' },
  { key: 'pitcher_hits_allowed', name: 'Hits Allowed' },
  { key: 'pitcher_walks', name: 'Walks Allowed' },
  { key: 'pitcher_earned_runs', name: 'Earned Runs' },

  // Hockey
  { key: 'player_shots_on_goal', name: 'Shots on Goal' },
  { key: 'player_goals', name: 'Goals Scored' },
  { key: 'player_assists_hockey', name: 'Assists' },
  { key: 'player_points_hockey', name: 'Points (G+A)' },
  { key: 'player_power_play_points', name: 'Power Play Points' },
];

const LOADING_MESSAGES = [
  "Bribing the refs...",
  "Checking the weather in Buffalo...",
  "Consulting with sharp bettors...",
  "Reading tea leaves and injury reports...",
  "Analyzing decades of crushing disappointment...",
  "Channeling the spirit of Vegas Dave...",
  "Doing math that would make your accountant cry...",
  "Ignoring your bank account balance...",
  "Finding the most chaotic possible outcome...",
  "Praying to the gambling gods...",
];

const SUCCESS_MESSAGES = [
  "Lock it in, this one's different!",
  "Vegas doesn't want you to see this...",
  "The sharps are all over these picks!",
  "Mortgage the house? (kidding... unless?)",
  "This parlay was blessed by Bill Belichick himself",
  "Your bookie is NOT gonna like this one",
  "The Oracle has spoken. Hammer time.",
  "Zero luck. All skill. Mostly luck.",
  "This is the one that changes everything!",
  "Statistical arbitrage or pure chaos? Yes.",
];

export default function Generator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generating, setGenerating] = useState(false);
  const [parlay, setParlay] = useState<any>(null);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lockedSharpPlay, setLockedSharpPlay] = useState<any>(null);

  // Form state
  const [selectedSports, setSelectedSports] = useState(['americanfootball_nfl']);
  const [numLegs, setNumLegs] = useState(3);
  const [betTypes, setBetTypes] = useState(['spread', 'over_under']);
  const [extraMarkets, setExtraMarkets] = useState<string[]>([]);
  const [oddsMin, setOddsMin] = useState(-300);
  const [oddsMax, setOddsMax] = useState(300);
  const [sgpMode, setSgpMode] = useState<'none' | 'allow' | 'only'>('none');
  const [stake, setStake] = useState(10);
  const [minTier, setMinTier] = useState<'S' | 'A' | 'B' | 'C' | 'D' | 'any'>('C'); // Minimum bet grade
  const [lockedLegs, setLockedLegs] = useState<any[]>([]); // Legs locked by user
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Check for locked sharp play or preset
  useEffect(() => {
    // Check for locked sharp play
    if (searchParams.get('locked') === 'sharp') {
      const sharpPlayData = sessionStorage.getItem('locked_sharp_play');
      if (sharpPlayData) {
        const sharpPlay = JSON.parse(sharpPlayData);
        setLockedSharpPlay(sharpPlay);
        sessionStorage.removeItem('locked_sharp_play');

        // Auto-generate with sharp play locked
        setNumLegs(1);
        setTimeout(() => handleGenerate(), 500);
      }
    }

    // Check for preset parameter
    const preset = searchParams.get('preset');
    if (preset === 'conservative' || preset === 'balanced' || preset === 'aggressive') {
      setTimeout(() => applyPreset(preset), 100);
    }
  }, [searchParams]);

  const toggleSport = (sport: string) => {
    setSelectedSports(prev =>
      prev.includes(sport)
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const toggleBetType = (type: string) => {
    setBetTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleExtraMarket = (market: string) => {
    setExtraMarkets(prev =>
      prev.includes(market)
        ? prev.filter(m => m !== market)
        : [...prev, market]
    );
  };

  const applyPreset = (preset: 'conservative' | 'balanced' | 'aggressive') => {
    switch (preset) {
      case 'conservative':
        setNumLegs(2 + Math.floor(Math.random() * 2)); // 2-3 legs
        setOddsMin(-200);
        setOddsMax(150);
        setBetTypes(['moneyline', 'spread']);
        setExtraMarkets([]);
        break;
      case 'balanced':
        setNumLegs(3 + Math.floor(Math.random() * 2)); // 3-4 legs
        setOddsMin(-250);
        setOddsMax(250);
        setBetTypes(['moneyline', 'spread', 'over_under']);
        setExtraMarkets([]);
        break;
      case 'aggressive':
        setNumLegs(5 + Math.floor(Math.random() * 2)); // 5-6 legs
        setOddsMin(-150);
        setOddsMax(400);
        setBetTypes(['spread', 'over_under']);
        setExtraMarkets(['player_points', 'player_assists']);
        break;
    }
    // Auto-generate after preset is applied
    setTimeout(() => handleGenerate(), 100);
  };

  const handleGenerate = async () => {
    if (selectedSports.length === 0) {
      setError('Select at least one sport');
      return;
    }
    if (betTypes.length === 0 && extraMarkets.length === 0) {
      setError('Select at least one bet type');
      return;
    }

    setGenerating(true);
    setError('');
    setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

    try {
      const response = await fetch('/api/analytics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sports: selectedSports,
          legs: numLegs,
          odds_min: oddsMin,
          odds_max: oddsMax,
          bet_types: betTypes,
          extra_markets: extraMarkets,
          sgp_mode: sgpMode,
          locked: lockedLegs,
          min_edge: 0, // Use 0 internally, not user-configurable
          min_tier: minTier,
          mode: 'max_value',
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate parlay');
      }

      setParlay(data);
      setSuccessMessage(SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!parlay) return;

    try {
      const response = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legs: parlay.parlay.map((leg: any) => ({
            sport: leg.sport,
            event_id: leg.event_id,
            event_name: leg.event_name,
            commence_time: leg.commence_time,
            market: leg.market,
            pick: leg.pick,
            odds: leg.odds,
            participant: leg.participant,
            point: leg.point,
            bet_kind: leg.bet_kind,
            bet_tag: leg.bet_tag,
            dk_link: leg.dk_link,
            confidence: leg.confidence,
            edge: leg.edge,
            factors: leg.factors,
            locked_by_user: leg.locked_by_user || false,
          })),
          stake,
          notes: `Generated with ${parlay.meta.total_confidence.toFixed(1)}/10 confidence`,
        }),
      });

      if (response.ok) {
        toast.success('Parlay saved to portfolio!');
        router.push('/portfolio');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save bet');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleShareParlay = () => {
    if (!parlay) return;

    const shareText = generateParlayShareText({
      legs: parlay.parlay.map((leg: any) => ({
        event_name: leg.event_name,
        pick: leg.pick,
        odds: leg.odds,
      })),
      parlay_odds: parlay.meta.parlay_odds,
      confidence: parlay.meta.total_confidence,
      avg_edge: parlay.meta.avg_edge,
    });

    // Copy to clipboard
    navigator.clipboard.writeText(shareText).then(() => {
      toast.success('Parlay copied to clipboard! Share it with the boys');
    }).catch(() => {
      toast.error('Failed to copy. Please try again.');
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="heading-lg flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-500" />
          Smart Parlay Generator
        </h1>
        <p className="text-muted mt-2">AI-powered picks based on value, sharp money, weather & more</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Presets */}
          <div className="card-glass border-amber-500/30">
            <h3 className="heading-sm flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              Quick Presets
            </h3>
            <p className="text-xs text-muted mb-4">Auto-generate with optimized settings</p>
            <div className="space-y-2">
              <button
                onClick={() => applyPreset('conservative')}
                disabled={generating}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      Conservative
                    </div>
                    <div className="text-xs text-muted mt-1">2-3 legs • Safer odds • Favorites</div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => applyPreset('balanced')}
                disabled={generating}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-400" />
                      Balanced
                    </div>
                    <div className="text-xs text-muted mt-1">3-4 legs • Moderate odds • Mixed</div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => applyPreset('aggressive')}
                disabled={generating}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-red-400" />
                      Aggressive
                    </div>
                    <div className="text-xs text-muted mt-1">5-6 legs • High odds • With props</div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Sports Selection */}
          <div className="card-glass">
            <h3 className="heading-sm mb-3">Sports</h3>
            <div className="space-y-2">
              {SPORTS.map(sport => (
                <label key={sport.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(sport.key)}
                    onChange={() => toggleSport(sport.key)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-secondary group-hover:text-white transition-colors">{sport.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bet Types */}
          <div className="card-glass">
            <h3 className="heading-sm mb-3">Bet Types</h3>
            <div className="space-y-2">
              {BET_TYPES.map(type => (
                <label key={type.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={betTypes.includes(type.key)}
                    onChange={() => toggleBetType(type.key)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-secondary group-hover:text-white transition-colors">{type.name}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <h4 className="text-sm font-semibold mb-2 text-muted">Player Props</h4>
              <div className="space-y-2">
                {EXTRA_MARKETS.map(market => (
                  <label key={market.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={extraMarkets.includes(market.key)}
                      onChange={() => toggleExtraMarket(market.key)}
                      className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-secondary group-hover:text-white transition-colors">{market.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="card-glass">
            <h3 className="heading-sm flex items-center gap-2 mb-3">
              <Settings className="w-5 h-5 text-gray-400" />
              Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Number of Legs</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={numLegs}
                  onChange={(e) => setNumLegs(parseInt(e.target.value))}
                  className="input input-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Date Range <span className="text-xs text-muted font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input input-sm flex-1"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input input-sm flex-1"
                    placeholder="To"
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  Filter games by start date. Leave blank for all upcoming games.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Odds Range <span className="text-xs text-muted font-normal">(per leg)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={oddsMin}
                    onChange={(e) => setOddsMin(parseInt(e.target.value))}
                    placeholder="Min"
                    className="input input-sm flex-1"
                  />
                  <input
                    type="number"
                    value={oddsMax}
                    onChange={(e) => setOddsMax(parseInt(e.target.value))}
                    placeholder="Max"
                    className="input input-sm flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Same Game Parlay</label>
                <select
                  value={sgpMode}
                  onChange={(e) => setSgpMode(e.target.value as any)}
                  className="input input-sm"
                >
                  <option value="none">Different Games Only</option>
                  <option value="allow">Allow Mixed</option>
                  <option value="only">Same Game Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Minimum Bet Quality
                </label>
                <select
                  value={minTier}
                  onChange={(e) => setMinTier(e.target.value as any)}
                  className="input input-sm"
                >
                  <option value="any">Any Quality</option>
                  <option value="D">D-Tier or Better</option>
                  <option value="C">C-Tier or Better (Recommended)</option>
                  <option value="B">B-Tier or Better</option>
                  <option value="A">A-Tier or Better</option>
                  <option value="S">S-Tier Only (Elite)</option>
                </select>
                <p className="text-xs text-muted mt-1">
                  Filter bets by quality grade. Higher tiers = better expected value.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shuffle className="w-5 h-5" />
                Find Sharp Plays
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {error && (
            <div className="card-error mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {generating && (
            <div className="card-glass text-center py-12">
              <Loader2 className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-spin" />
              <p className="text-secondary mb-2 text-lg font-semibold">{loadingMessage}</p>
              <p className="text-sm text-muted">Analyzing odds, weather, sharp money & trends</p>
            </div>
          )}

          {parlay && !generating && (
            <div className="space-y-4">
              {/* Success Message Banner */}
              <div className="card-success text-center py-4">
                <p className="text-lg font-bold text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  {successMessage}
                </p>
              </div>

              {/* Summary Card */}
              <div className="card-glass border-amber-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{parlay.parlay.length}-Leg Parlay</h3>
                    <p className="text-sm text-secondary">
                      Confidence: <span className="text-amber-400 font-bold">{parlay.meta.total_confidence.toFixed(1)}/10</span>
                      <span className="mx-2 text-gray-600">•</span>
                      Avg Edge: <span className="text-emerald-400 font-bold">{parlay.meta.avg_edge.toFixed(1)}%</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-amber-400">
                      {parlay.meta.parlay_odds > 0 ? '+' : ''}{parlay.meta.parlay_odds}
                    </div>
                    <div className="text-sm text-muted">Parlay Odds</div>
                  </div>
                </div>
                <button
                  onClick={handleShareParlay}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share with the Boys
                </button>
              </div>

              {/* Legs */}
              {parlay.parlay.map((leg: any, i: number) => (
                <div key={i} className="card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-muted">LEG {i + 1}</span>
                        <span className="badge-neutral badge-xs">
                          {leg.sport.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-white">{leg.event_name}</h4>
                      <p className="text-xs text-muted mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(leg.commence_time).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-amber-400 font-semibold mt-1">{leg.pick}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-2 justify-end mb-2">
                        <button
                          onClick={() => {
                            const isLocked = lockedLegs.some(l => l.event_id === leg.event_id && l.pick === leg.pick);
                            if (isLocked) {
                              setLockedLegs(lockedLegs.filter(l => !(l.event_id === leg.event_id && l.pick === leg.pick)));
                              toast.success('Leg unlocked');
                            } else {
                              setLockedLegs([...lockedLegs, leg]);
                              toast.success('Leg locked! Click regenerate to build around it.');
                            }
                          }}
                          className={`btn-xs ${lockedLegs.some(l => l.event_id === leg.event_id && l.pick === leg.pick) ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-2xl font-bold">{leg.odds > 0 ? '+' : ''}{leg.odds}</div>
                      <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {leg.confidence.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics */}
                  {leg.expected_value !== undefined && (
                    <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
                      <div>
                        <div className="text-xs text-muted mb-1">Expected Value</div>
                        <div className={`text-lg font-bold ${leg.expected_value >= 3 ? 'text-emerald-400' : leg.expected_value >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {leg.expected_value >= 0 ? '+' : ''}{leg.expected_value.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Recommended Units</div>
                        <div className="text-lg font-bold text-white">
                          {leg.kelly_units !== undefined ? leg.kelly_units.toFixed(1) : '0.0'}U
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Bet Grade</div>
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${
                          leg.bet_grade === 'S' ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900' :
                          leg.bet_grade === 'A' ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white' :
                          leg.bet_grade === 'B' ? 'bg-gradient-to-br from-blue-400 to-cyan-500 text-white' :
                          leg.bet_grade === 'C' ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white' :
                          'bg-gradient-to-br from-gray-600 to-gray-700 text-white'
                        }`}>
                          {leg.bet_grade || 'D'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">True vs Market</div>
                        <div className="text-xs text-white">
                          {leg.true_probability !== undefined && leg.implied_probability !== undefined ? (
                            <>
                              {(leg.true_probability * 100).toFixed(1)}% vs {(leg.implied_probability * 100).toFixed(1)}%
                            </>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Factors */}
                  {leg.factors && leg.factors.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-700/50">
                      {leg.factors.map((factor: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5">
                            {factor.type === 'positive' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : factor.type === 'negative' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Info className="w-4 h-4 text-blue-400" />
                            )}
                          </span>
                          <span className={
                            factor.type === 'positive' ? 'text-emerald-400' :
                            factor.type === 'negative' ? 'text-amber-400' :
                            'text-muted'
                          }>
                            {factor.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DraftKings Button */}
                  {leg.dk_link && (
                    <div className="mt-4">
                      <a
                        href={leg.dk_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold transition-all shadow-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on DraftKings
                      </a>
                    </div>
                  )}
                </div>
              ))}

              {/* Save Section */}
              <div className="card-glass">
                <h3 className="heading-sm mb-4">Save to Portfolio</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-2">Stake ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={stake}
                      onChange={(e) => setStake(parseFloat(e.target.value))}
                      className="input"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-2">To Win</label>
                    <div className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 font-bold">
                      ${(stake * (parlay.meta.parlay_odds > 0 ? parlay.meta.parlay_odds / 100 : Math.abs(100 / parlay.meta.parlay_odds))).toFixed(2)}
                    </div>
                  </div>
                </div>
                <button onClick={handleSave} className="w-full btn-primary mt-4 flex items-center justify-center gap-2">
                  <Save className="w-5 h-5" />
                  Save Parlay
                </button>
              </div>
            </div>
          )}

          {!parlay && !generating && !error && (
            <div className="card-glass text-center py-16">
              <Dices className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="heading-sm mb-2">Ready to Generate</h3>
              <p className="text-muted">Configure your preferences and click "Find Sharp Plays"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
