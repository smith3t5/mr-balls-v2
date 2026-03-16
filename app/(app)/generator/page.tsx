'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles, Shuffle, Save, Share2, ExternalLink,
  CheckCircle2, AlertTriangle, Info, Loader2, Lock,
  Unlock, Calendar, Target, Flame, Brain,
  ChevronDown, ChevronUp, RefreshCw, Plus, X,
} from 'lucide-react';
import { generateParlayShareText } from '@/lib/draftkings-links';

const SPORTS = [
  { key: 'basketball_ncaab',     name: 'College Basketball', short: 'NCAAB' },
  { key: 'americanfootball_nfl', name: 'NFL',                short: 'NFL'   },
  { key: 'basketball_nba',       name: 'NBA',                short: 'NBA'   },
  { key: 'icehockey_nhl',        name: 'NHL',                short: 'NHL'   },
  { key: 'baseball_mlb',         name: 'MLB',                short: 'MLB'   },
];

const BET_TYPES = [
  { key: 'spread',     name: 'Spreads'   },
  { key: 'over_under', name: 'Totals'    },
  { key: 'moneyline',  name: 'Moneyline' },
];

const NCAAB_PROPS = [
  { key: 'player_points',   name: 'Player Points'     },
  { key: 'player_rebounds', name: 'Player Rebounds'   },
  { key: 'player_assists',  name: 'Player Assists'    },
  { key: 'player_threes',   name: 'Player 3-Pointers' },
];

const OTHER_PROPS = [
  { key: 'player_pass_tds',      name: 'Pass TDs'        },
  { key: 'player_pass_yds',      name: 'Passing Yards'   },
  { key: 'player_rush_yds',      name: 'Rushing Yards'   },
  { key: 'player_reception_yds', name: 'Receiving Yards' },
  { key: 'player_anytime_td',    name: 'Anytime TD'      },
  { key: 'pitcher_strikeouts',   name: 'Pitcher Ks'      },
  { key: 'player_shots_on_goal', name: 'Shots on Goal'   },
];

const LOADING_MESSAGES = [
  'Consulting KenPom efficiency margins...',
  'Sniffing out situational spots...',
  'Cross-referencing sharp money signals...',
  'Checking pace mismatch data...',
  'Identifying trap game candidates...',
  'Analyzing fatigue spots...',
  'Running the numbers the books hope you ignore...',
  'Asking the oracle nicely...',
];

const PRESETS = [
  {
    id: 'kenpom',
    name: 'KenPom Value',
    icon: Brain,
    description: '3-4 legs · Efficiency-driven · Spread & total edges',
    color: 'text-blue-400',
    border: 'hover:border-blue-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         3,
      betTypes:     ['spread', 'over_under'],
      extraMarkets: [] as string[],
      oddsMin:      -180,
      oddsMax:      200,
      minTier:      'B' as const,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'spots',
    name: 'Situational Spots',
    icon: Target,
    description: '3-4 legs · Fatigue, trap games, pace mismatches',
    color: 'text-emerald-400',
    border: 'hover:border-emerald-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         4,
      betTypes:     ['spread', 'over_under', 'moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      -150,
      oddsMax:      300,
      minTier:      'B' as const,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'chaos',
    name: 'Chaos Mode',
    icon: Flame,
    description: '5-6 legs · Longer odds · Swinging for the fences',
    color: 'text-red-400',
    border: 'hover:border-red-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         5,
      betTypes:     ['spread', 'over_under', 'moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      -130,
      oddsMax:      400,
      minTier:      'C' as const,
      sgpMode:      'none' as const,
    },
  },
];

function buildDraftKingsDeepLink(legs: any[]): string {
  const firstLeg = legs?.[0];
  if (!firstLeg?.dk_link) return 'https://sportsbook.draftkings.com/leagues/basketball/ncaab';
  return firstLeg.dk_link;
}

function GradeBadge({ grade }: { grade: string }) {
  const styles: Record<string, string> = {
    S: 'bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900',
    A: 'bg-gradient-to-br from-emerald-400 to-green-500 text-white',
    B: 'bg-gradient-to-br from-blue-400 to-cyan-500 text-white',
    C: 'bg-slate-600 text-white',
    D: 'bg-slate-700 text-gray-400',
  };
  return (
    <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${styles[grade] ?? styles.D}`}>
      {grade}
    </div>
  );
}

export default function Generator() {
  const [selectedSports, setSelectedSports] = useState<string[]>(['basketball_ncaab']);
  const [numLegs, setNumLegs]               = useState(3);
  const [betTypes, setBetTypes]             = useState<string[]>(['spread', 'over_under']);
  const [extraMarkets, setExtraMarkets]     = useState<string[]>([]);
  const [oddsMin, setOddsMin]               = useState(-180);
  const [oddsMax, setOddsMax]               = useState(250);
  const [sgpMode, setSgpMode]               = useState<'none' | 'allow' | 'only'>('none');
  const [minTier, setMinTier]               = useState<'S' | 'A' | 'B' | 'C' | 'D' | 'any'>('C');
  const [showAdvanced, setShowAdvanced]     = useState(false);

  const [generating, setGenerating] = useState(false);
  const [parlay, setParlay]         = useState<any>(null);
  const [error, setError]           = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [lockedLegs, setLockedLegs] = useState<any[]>([]);
  const [stake, setStake]           = useState(10);

  const [manualPicks, setManualPicks]           = useState<any[]>([]);
  const [showPickBuilder, setShowPickBuilder]   = useState(false);
  const [pickTeam, setPickTeam]                 = useState('');
  const [pickBetType, setPickBetType]           = useState('spread');
  const [pickLine, setPickLine]                 = useState('');

  // Core generate function — accepts explicit config so preset can pass values
  // directly without waiting for React state to settle
  const runGenerate = useCallback(async (
    config: {
      sports:       string[];
      legs:         number;
      betTypes:     string[];
      extraMarkets: string[];
      oddsMin:      number;
      oddsMax:      number;
      minTier:      string;
      sgpMode:      string;
    },
    locked: any[] = []
  ) => {
    if (!config.sports?.length) { setError('Select at least one sport'); return; }
    if (!config.betTypes?.length && !config.extraMarkets?.length) { setError('Select at least one bet type'); return; }

    setGenerating(true);
    setError('');
    setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

    try {
      const response = await fetch('/api/analytics/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sports:        config.sports,
          legs:          config.legs,
          odds_min:      config.oddsMin,
          odds_max:      config.oddsMax,
          bet_types:     config.betTypes,
          extra_markets: config.extraMarkets,
          sgp_mode:      config.sgpMode,
          locked,
          min_edge:      0,
          min_tier:      config.minTier,
          mode:          'max_value',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || 'Failed to generate parlay');
      setParlay(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleGenerate = (keepLocked = false) => {
    if (!keepLocked) setLockedLegs([]);
    runGenerate(
      { sports: selectedSports, legs: numLegs, betTypes, extraMarkets, oddsMin, oddsMax, minTier, sgpMode },
      keepLocked ? lockedLegs : []
    );
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const c = preset.config;
    // Update UI state for display
    setSelectedSports(c.sports);
    setNumLegs(c.legs);
    setBetTypes(c.betTypes);
    setExtraMarkets(c.extraMarkets);
    setOddsMin(c.oddsMin);
    setOddsMax(c.oddsMax);
    setMinTier(c.minTier);
    setSgpMode(c.sgpMode);
    setLockedLegs([]);
    // Pass config directly — no setTimeout needed, no stale state
    runGenerate({ sports: c.sports, legs: c.legs, betTypes: c.betTypes, extraMarkets: c.extraMarkets, oddsMin: c.oddsMin, oddsMax: c.oddsMax, minTier: c.minTier, sgpMode: c.sgpMode });
  };

  const handleRegenerate = () => handleGenerate(true);

  const toggleSport    = (s: string) => setSelectedSports(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleBetType  = (t: string) => setBetTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleMarket   = (m: string) => setExtraMarkets(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  const toggleLock = (leg: any) => {
    const key = `${leg.event_id}_${leg.pick}`;
    setLockedLegs(prev => {
      const exists = prev.some(l => `${l.event_id}_${l.pick}` === key);
      if (exists) { toast('Leg unlocked'); return prev.filter(l => `${l.event_id}_${l.pick}` !== key); }
      toast.success('Leg locked — regenerate to keep it');
      return [...prev, leg];
    });
  };

  const isLocked = (leg: any) =>
    lockedLegs.some(l => `${l.event_id}_${l.pick}` === `${leg.event_id}_${leg.pick}`);

  const addManualPick = () => {
    if (!pickTeam.trim()) return;
    setManualPicks(prev => [...prev, {
      id:      crypto.randomUUID(),
      label:   `${pickTeam} ${pickBetType === 'spread' ? pickLine : pickBetType === 'total' ? `O/U ${pickLine}` : 'ML'}`,
      team:    pickTeam.trim(),
      betType: pickBetType,
      line:    pickLine,
    }]);
    setPickTeam(''); setPickLine(''); setShowPickBuilder(false);
    toast.success('Pick added — it will be locked in on generate');
  };

  const handleSave = async () => {
    if (!parlay) return;
    const stored   = localStorage.getItem('mrb_user');
    const username = stored ? JSON.parse(stored).username : 'Unknown';

    try {
      const res  = await fetch('/api/bets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, bet: { stake, meta: parlay.meta, legs: parlay.parlay } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Parlay saved to portfolio!');
    } catch {
      const parlayOdds      = parlay.meta.parlay_odds;
      const potentialReturn = stake + (parlayOdds > 0 ? stake * (parlayOdds / 100) : stake * (100 / Math.abs(parlayOdds)));
      const allBets         = JSON.parse(localStorage.getItem('bets') ?? '[]');
      allBets.unshift({ id: crypto.randomUUID(), created_at: Date.now(), status: 'pending', stake, odds: parlayOdds, potential_return: potentialReturn, confidence: parlay.meta.total_confidence, legs: parlay.parlay });
      localStorage.setItem('bets', JSON.stringify(allBets));
      toast.success('Saved locally');
    }
  };

  const handleShare = () => {
    if (!parlay) return;
    const text = generateParlayShareText({
      legs:        (parlay.parlay ?? []).map((l: any) => ({ event_name: l.event_name, pick: l.pick, odds: l.odds })),
      parlay_odds: parlay.meta.parlay_odds,
      confidence:  parlay.meta.total_confidence,
      avg_edge:    parlay.meta.avg_edge,
    });
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard!'));
  };

  const legs = parlay?.parlay ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-lg flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-500" />
            Parlay Generator
          </h1>
          <p className="text-muted mt-1">KenPom-powered picks with situational edge detection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ---- LEFT: Config ---- */}
        <div className="lg:col-span-1 space-y-5">

          {/* Presets */}
          <div className="card-glass">
            <h3 className="heading-sm mb-4">Presets</h3>
            <div className="space-y-2">
              {PRESETS.map(preset => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    disabled={generating}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 ${preset.border} transition-all text-left disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold flex items-center gap-2 ${preset.color}`}>
                          <Icon className="w-4 h-4" />{preset.name}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{preset.description}</div>
                      </div>
                      <Sparkles className="w-4 h-4 text-gray-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sports */}
          <div className="card-glass">
            <h3 className="heading-sm mb-3">Sports</h3>
            <div className="space-y-2">
              {SPORTS.map(s => (
                <label key={s.key} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={selectedSports.includes(s.key)} onChange={() => toggleSport(s.key)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-secondary group-hover:text-white transition-colors">
                    {s.name} <span className="text-xs text-gray-600">{s.short}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Bet Types */}
          <div className="card-glass">
            <h3 className="heading-sm mb-3">Bet Types</h3>
            <div className="space-y-2">
              {BET_TYPES.map(t => (
                <label key={t.key} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={betTypes.includes(t.key)} onChange={() => toggleBetType(t.key)}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-secondary group-hover:text-white transition-colors">{t.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <h4 className="text-sm font-semibold text-muted mb-2">Player Props</h4>
              <div className="space-y-2">
                {[...NCAAB_PROPS, ...OTHER_PROPS].map(m => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={extraMarkets.includes(m.key)} onChange={() => toggleMarket(m.key)}
                      className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-secondary group-hover:text-white transition-colors">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Anchor Picks */}
          <div className="card-glass">
            <div className="flex items-center justify-between mb-3">
              <h3 className="heading-sm">Anchor Picks</h3>
              <button onClick={() => setShowPickBuilder(p => !p)} className="btn-xs btn-secondary flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {showPickBuilder && (
              <div className="space-y-3 mb-4 p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                <input type="text" placeholder="Team name (e.g. Duke)" value={pickTeam}
                  onChange={e => setPickTeam(e.target.value)} className="input-sm" />
                <div className="flex gap-2">
                  <select value={pickBetType} onChange={e => setPickBetType(e.target.value)} className="input-sm flex-1">
                    <option value="spread">Spread</option>
                    <option value="moneyline">Moneyline</option>
                    <option value="total">Total</option>
                  </select>
                  <input type="text" placeholder={pickBetType === 'spread' ? '-3.5' : pickBetType === 'total' ? 'O 142.5' : 'ML'}
                    value={pickLine} onChange={e => setPickLine(e.target.value)} className="input-sm flex-1" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addManualPick} className="btn-primary btn-xs flex-1">Add Pick</button>
                  <button onClick={() => setShowPickBuilder(false)} className="btn-secondary btn-xs">Cancel</button>
                </div>
              </div>
            )}
            {manualPicks.length > 0 ? (
              <div className="space-y-2">
                {manualPicks.map(pick => (
                  <div key={pick.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div>
                      <div className="text-xs font-bold text-amber-400">{pick.team}</div>
                      <div className="text-xs text-muted">{pick.label}</div>
                    </div>
                    <button onClick={() => setManualPicks(p => p.filter(x => x.id !== pick.id))}
                      className="text-gray-500 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">Add specific teams or bets to anchor the parlay around them.</p>
            )}
          </div>

          {/* Settings */}
          <div className="card-glass">
            <button onClick={() => setShowAdvanced(p => !p)} className="w-full flex items-center justify-between text-left">
              <h3 className="heading-sm">Settings</h3>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>
            {showAdvanced && (
              <div className="space-y-4 mt-4 pt-4 border-t border-slate-700/50">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Legs</label>
                  <input type="number" min="1" max="8" value={numLegs}
                    onChange={e => setNumLegs(parseInt(e.target.value))} className="input-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Odds Range</label>
                  <div className="flex gap-2">
                    <input type="number" value={oddsMin} onChange={e => setOddsMin(parseInt(e.target.value))} placeholder="Min" className="input-sm flex-1" />
                    <input type="number" value={oddsMax} onChange={e => setOddsMax(parseInt(e.target.value))} placeholder="Max" className="input-sm flex-1" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Minimum Quality</label>
                  <select value={minTier} onChange={e => setMinTier(e.target.value as any)} className="input-sm">
                    <option value="any">Any</option>
                    <option value="D">D or better</option>
                    <option value="C">C or better</option>
                    <option value="B">B or better</option>
                    <option value="A">A or better</option>
                    <option value="S">S only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Same Game Parlay</label>
                  <select value={sgpMode} onChange={e => setSgpMode(e.target.value as any)} className="input-sm">
                    <option value="none">Different games only</option>
                    <option value="allow">Allow mixed</option>
                    <option value="only">Same game only</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Generate buttons */}
          <div className="space-y-2">
            <button onClick={() => handleGenerate(false)} disabled={generating}
              className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2">
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                : <><Shuffle className="w-5 h-5" /> Generate Parlay</>}
            </button>
            {parlay && lockedLegs.length > 0 && (
              <button onClick={handleRegenerate} disabled={generating}
                className="w-full btn-secondary py-3 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate Unlocked ({legs.length - lockedLegs.length} legs)
              </button>
            )}
          </div>
        </div>

        {/* ---- RIGHT: Results ---- */}
        <div className="lg:col-span-2">
          {error && (
            <div className="card-error mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" /><p>{error}</p>
            </div>
          )}

          {generating && (
            <div className="card-glass text-center py-16">
              <Loader2 className="w-14 h-14 text-amber-500 mx-auto mb-4 animate-spin" />
              <p className="text-secondary text-lg font-semibold">{loadingMsg}</p>
              <p className="text-sm text-muted mt-1">Cross-referencing KenPom efficiency data</p>
            </div>
          )}

          {parlay && !generating && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="card-glass border-amber-500/20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{legs.length}-Leg Parlay</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
                      <span className="text-muted">Confidence: <span className="text-amber-400 font-bold">{(parlay.meta?.total_confidence ?? 0).toFixed(1)}/10</span></span>
                      <span className="text-gray-600">•</span>
                      <span className="text-muted">Avg Edge: <span className="text-emerald-400 font-bold">{(parlay.meta?.avg_edge ?? 0).toFixed(1)}%</span></span>
                      {lockedLegs.length > 0 && (
                        <><span className="text-gray-600">•</span>
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" />{lockedLegs.length} locked
                        </span></>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-amber-400">
                      {(parlay.meta?.parlay_odds ?? 0) > 0 ? '+' : ''}{parlay.meta?.parlay_odds ?? 0}
                    </div>
                    <div className="text-xs text-muted">parlay odds</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { const url = buildDraftKingsDeepLink(legs); window.open(url, '_blank', 'noopener,noreferrer'); }}
                    className="btn-success btn-sm flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Open in DraftKings
                  </button>
                  <button onClick={handleShare} className="btn-secondary btn-sm flex items-center justify-center gap-1.5">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={handleRegenerate} disabled={generating}
                    className="btn-secondary btn-sm flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Regenerate
                  </button>
                </div>
              </div>

              {/* Legs */}
              {legs.map((leg: any, i: number) => {
                const locked = isLocked(leg);
                return (
                  <div key={i} className={`card-hover ${locked ? 'border-amber-500/40' : ''}`}>
                    {locked && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-400 font-semibold">
                        <Lock className="w-3 h-3" /> Locked — will stay on regenerate
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold text-muted">LEG {i + 1}</span>
                          <span className="badge-neutral badge-xs">
                            {SPORTS.find(s => s.key === leg.sport)?.short ?? leg.sport}
                          </span>
                          {leg.bet_grade && <GradeBadge grade={leg.bet_grade} />}
                        </div>
                        <h4 className="font-bold text-white">{leg.event_name}</h4>
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(leg.commence_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="text-amber-400 font-bold mt-1 text-lg">{leg.pick}</p>
                      </div>
                      <div className="text-right ml-4 flex flex-col items-end gap-2">
                        <div className="text-2xl font-bold">{leg.odds > 0 ? '+' : ''}{leg.odds}</div>
                        <button onClick={() => toggleLock(leg)}
                          className={`btn-xs flex items-center gap-1 ${locked ? 'bg-amber-500 text-slate-900 font-bold' : 'btn-secondary'}`}>
                          {locked ? <><Lock className="w-3 h-3" /> Locked</> : <><Unlock className="w-3 h-3" /> Lock</>}
                        </button>
                        {leg.dk_link && (
                          <a href={leg.dk_link} target="_blank" rel="noopener noreferrer"
                            className="btn-xs btn-secondary flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> DK
                          </a>
                        )}
                      </div>
                    </div>

                    {leg.expected_value !== undefined && (
                      <div className="grid grid-cols-4 gap-2 mb-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
                        <div className="text-center">
                          <div className="text-xs text-muted mb-0.5">EV</div>
                          <div className={`text-sm font-bold ${(leg.expected_value ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(leg.expected_value ?? 0) >= 0 ? '+' : ''}{(leg.expected_value ?? 0).toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted mb-0.5">Kelly</div>
                          <div className="text-sm font-bold text-white">{(leg.kelly_units ?? 0).toFixed(1)}u</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted mb-0.5">True %</div>
                          <div className="text-sm font-bold text-white">
                            {leg.true_probability != null ? (leg.true_probability * 100).toFixed(0) : '--'}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted mb-0.5">Market %</div>
                          <div className="text-sm font-bold text-white">
                            {leg.implied_probability != null ? (leg.implied_probability * 100).toFixed(0) : '--'}%
                          </div>
                        </div>
                      </div>
                    )}

                    {Array.isArray(leg.factors) && leg.factors.length > 0 && (
                      <div className="space-y-1.5 pt-3 border-t border-slate-700/50">
                        {leg.factors.map((f: any, j: number) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className="mt-0.5 flex-shrink-0">
                              {f.type === 'positive' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                : f.type === 'negative' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                : <Info className="w-3.5 h-3.5 text-blue-400" />}
                            </span>
                            <span className={`text-xs ${f.type === 'positive' ? 'text-emerald-300' : f.type === 'negative' ? 'text-amber-300' : 'text-gray-400'}`}>
                              {f.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Save */}
              <div className="card-glass">
                <h3 className="heading-sm mb-4">Save to Portfolio</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-2">Stake ($)</label>
                    <input type="number" min="1" step="1" value={stake}
                      onChange={e => setStake(parseFloat(e.target.value))} className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-2">To Win</label>
                    <div className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 font-bold">
                      ${(stake * ((parlay.meta?.parlay_odds ?? 0) > 0
                        ? (parlay.meta.parlay_odds) / 100
                        : Math.abs(100 / (parlay.meta?.parlay_odds || -100)))).toFixed(2)}
                    </div>
                  </div>
                  <button onClick={handleSave} className="btn-primary flex items-center gap-2 h-[50px] px-6">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {!parlay && !generating && !error && (
            <div className="card-glass text-center py-20">
              <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="heading-sm mb-2">Ready to Generate</h3>
              <p className="text-muted text-sm">Pick a preset or configure manually, then hit Generate.</p>
              <p className="text-muted text-xs mt-2">KenPom efficiency data updates daily at 6 AM UTC.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
