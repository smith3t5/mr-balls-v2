'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles, Shuffle, Save, Share2, ExternalLink,
  CheckCircle2, AlertTriangle, Info, Loader2, Lock,
  Unlock, Calendar, Target, Flame, Brain, Trophy,
  ChevronDown, ChevronUp, RefreshCw, Plus, X, Zap,
} from 'lucide-react';
import { generateParlayShareText } from '@/lib/draftkings-links';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  'Scanning all 68 teams...',
  'Finding where the line is soft...',
];

// ---------------------------------------------------------------------------
// March Madness presets
// ---------------------------------------------------------------------------

const PRESETS = [
  {
    id: 'upsets',
    name: 'First Round Upsets',
    icon: Zap,
    description: '3 legs · KenPom dogs with efficiency edge · Moneyline',
    color: 'text-yellow-400',
    border: 'hover:border-yellow-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         3,
      betTypes:     ['moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      100,   // underdogs only (+100 or better)
      oddsMax:      600,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'sharp',
    name: 'Sharp Totals',
    icon: Brain,
    description: '3-4 legs · Pace & defense mismatches · Spread + totals',
    color: 'text-blue-400',
    border: 'hover:border-blue-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         3,
      betTypes:     ['spread', 'over_under'],
      extraMarkets: [] as string[],
      oddsMin:      -200,
      oddsMax:      200,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'value',
    name: 'KenPom Value',
    icon: Target,
    description: '4 legs · Best efficiency edges across all bet types',
    color: 'text-emerald-400',
    border: 'hover:border-emerald-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         4,
      betTypes:     ['spread', 'over_under', 'moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      -250,
      oddsMax:      350,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'chaos',
    name: 'Chaos Bracket',
    icon: Flame,
    description: '5-6 legs · Longer shots · High variance · All bet types',
    color: 'text-red-400',
    border: 'hover:border-red-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         5,
      betTypes:     ['spread', 'over_under', 'moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      -130,
      oddsMax:      600,
      sgpMode:      'none' as const,
    },
  },
  {
    id: 'best',
    name: 'Best of All',
    icon: Trophy,
    description: '4 legs · All methodologies combined · Engine picks the top edges',
    color: 'text-amber-400',
    border: 'hover:border-amber-500/50',
    config: {
      sports:       ['basketball_ncaab'],
      legs:         4,
      betTypes:     ['spread', 'over_under', 'moneyline'],
      extraMarkets: [] as string[],
      oddsMin:      -300,
      oddsMax:      500,
      sgpMode:      'none' as const,
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Generator() {
  const [selectedSports, setSelectedSports] = useState<string[]>(['basketball_ncaab']);
  const [numLegs, setNumLegs]               = useState(3);
  const [betTypes, setBetTypes]             = useState<string[]>(['spread', 'over_under', 'moneyline']);
  const [extraMarkets, setExtraMarkets]     = useState<string[]>([]);
  const [oddsMin, setOddsMin]               = useState(-250);
  const [oddsMax, setOddsMax]               = useState(400);
  const [sgpMode, setSgpMode]               = useState<'none' | 'allow' | 'only'>('none');
  const [showAdvanced, setShowAdvanced]     = useState(false);

  const [generating, setGenerating] = useState(false);
  const [parlay, setParlay]         = useState<any>(null);
  const [error, setError]           = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [lockedLegs, setLockedLegs]     = useState<any[]>([]);
  const [selectedLegs, setSelectedLegs] = useState<Set<number>>(new Set());
  const [stake, setStake]               = useState(10);

  const [manualPicks, setManualPicks]         = useState<any[]>([]);
  const [showPickBuilder, setShowPickBuilder] = useState(false);
  const [pickTeam, setPickTeam]               = useState('');
  const [pickBetType, setPickBetType]         = useState('spread');
  const [pickLine, setPickLine]               = useState('');

  const runGenerate = useCallback(async (
    config: {
      sports:       string[];
      legs:         number;
      betTypes:     string[];
      extraMarkets: string[];
      oddsMin:      number;
      oddsMax:      number;
      sgpMode:      string;
    },
    locked: any[] = []
  ) => {
    if (!config.sports?.length)   { setError('Select at least one sport');    return; }
    if (!config.betTypes?.length && !config.extraMarkets?.length) {
      setError('Select at least one bet type'); return;
    }

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
          min_tier:      'any',   // engine decides — no tier filtering
          mode:          'max_value',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || 'Failed to generate parlay');
      setParlay(data);
      setSelectedLegs(new Set()); // reset selection on new parlay
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleGenerate = (keepLocked = false) => {
    if (!keepLocked) setLockedLegs([]);
    runGenerate(
      { sports: selectedSports, legs: numLegs, betTypes, extraMarkets, oddsMin, oddsMax, sgpMode },
      keepLocked ? lockedLegs : []
    );
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const c = preset.config;
    setSelectedSports(c.sports);
    setNumLegs(c.legs);
    setBetTypes(c.betTypes);
    setExtraMarkets(c.extraMarkets);
    setOddsMin(c.oddsMin);
    setOddsMax(c.oddsMax);
    setSgpMode(c.sgpMode);
    setLockedLegs([]);
    runGenerate({
      sports: c.sports, legs: c.legs, betTypes: c.betTypes,
      extraMarkets: c.extraMarkets, oddsMin: c.oddsMin,
      oddsMax: c.oddsMax, sgpMode: c.sgpMode,
    });
  };

  const toggleSport   = (s: string) => setSelectedSports(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleBetType = (t: string) => setBetTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleMarket  = (m: string) => setExtraMarkets(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

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

  const toggleSelectLeg = (i: number) => {
    setSelectedLegs(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectAllLegs = () => {
    setSelectedLegs(new Set(legs.map((_: any, i: number) => i)));
  };

  const clearSelection = () => setSelectedLegs(new Set());

  const buildFromSelected = async () => {
    if (selectedLegs.size === 0) { toast.error('Select at least one leg'); return; }
    const picked = legs.filter((_: any, i: number) => selectedLegs.has(i));
    const stored   = localStorage.getItem('mrb_user');
    const username = stored ? JSON.parse(stored).username : 'Unknown';

    // Calculate parlay odds from selected legs
    const decOdds  = picked.map((l: any) => l.odds > 0 ? 1 + l.odds / 100 : 1 + 100 / Math.abs(l.odds));
    const parlayDec = decOdds.reduce((a: number, b: number) => a * b, 1);
    const parlayOdds = parlayDec >= 2
      ? Math.round((parlayDec - 1) * 100)
      : -Math.round(100 / (parlayDec - 1));
    const avgConf = picked.reduce((s: number, l: any) => s + (l.confidence ?? 5), 0) / picked.length;
    const avgEdge = picked.reduce((s: number, l: any) => s + (l.edge ?? 0), 0) / picked.length;

    const customParlay = {
      parlay: picked,
      meta:   { parlay_odds: parlayOdds, total_confidence: avgConf, avg_edge: avgEdge },
    };

    // Show it in the results panel
    setParlay(customParlay);
    setSelectedLegs(new Set());
    toast.success(`Built ${picked.length}-leg parlay from your selection`);
  };

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
    toast.success('Pick added');
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
      toast.success('Saved to portfolio!');
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
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const legs = parlay?.parlay ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="heading-lg flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          March Madness Generator
        </h1>
        <p className="text-muted mt-1">KenPom-powered tournament picks · engine selects the best available edges</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ---- LEFT ---- */}
        <div className="lg:col-span-1 space-y-5">

          {/* Tournament Presets */}
          <div className="card-glass border-amber-500/20">
            <h3 className="heading-sm mb-1 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Tournament Presets
            </h3>
            <p className="text-xs text-muted mb-4">Engine picks the best legs — no manual filtering needed</p>
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
                      <Sparkles className="w-4 h-4 text-gray-600" />
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
              <h4 className="text-sm font-semibold text-muted mb-2">Player Props <span className="text-xs font-normal">(KY only)</span></h4>
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
                  <button onClick={addManualPick} className="btn-primary btn-xs flex-1">Add</button>
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
              <p className="text-xs text-muted">Lock specific teams into the parlay before generating.</p>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="card-glass">
            <button onClick={() => setShowAdvanced(p => !p)} className="w-full flex items-center justify-between text-left">
              <h3 className="heading-sm">Advanced Settings</h3>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>
            {showAdvanced && (
              <div className="space-y-4 mt-4 pt-4 border-t border-slate-700/50">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Number of Legs</label>
                  <input type="number" min="1" max="8" value={numLegs}
                    onChange={e => setNumLegs(parseInt(e.target.value))} className="input-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Odds Range (per leg)</label>
                  <div className="flex gap-2">
                    <input type="number" value={oddsMin} onChange={e => setOddsMin(parseInt(e.target.value))}
                      placeholder="Min" className="input-sm flex-1" />
                    <input type="number" value={oddsMax} onChange={e => setOddsMax(parseInt(e.target.value))}
                      placeholder="Max" className="input-sm flex-1" />
                  </div>
                  <p className="text-xs text-muted mt-1">Use +100 min to target underdogs only</p>
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

          {/* Generate */}
          <div className="space-y-2">
            <button onClick={() => handleGenerate(false)} disabled={generating}
              className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2">
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                : <><Shuffle className="w-5 h-5" /> Generate Parlay</>}
            </button>
            {legs.length > 0 && lockedLegs.length > 0 && (
              <button onClick={() => handleGenerate(true)} disabled={generating}
                className="w-full btn-secondary py-2.5 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate Unlocked ({legs.length - lockedLegs.length} legs)
              </button>
            )}
            {legs.length > 0 && lockedLegs.length === 0 && (
              <button onClick={() => handleGenerate(false)} disabled={generating}
                className="w-full btn-secondary py-2.5 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerate All
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
              <p className="text-sm text-muted mt-1">Cross-referencing KenPom efficiency data for all 68 teams</p>
            </div>
          )}

          {legs.length > 0 && !generating && (
            <div className="space-y-4">
              {/* Summary bar */}
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
                  <button onClick={() => window.open(buildDraftKingsDeepLink(legs), '_blank', 'noopener,noreferrer')}
                    className="btn-success btn-sm flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Open in DraftKings
                  </button>
                  <button onClick={handleShare} className="btn-secondary btn-sm flex items-center justify-center gap-1.5">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={() => handleGenerate(lockedLegs.length > 0)} disabled={generating}
                    className="btn-secondary btn-sm flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Regenerate
                  </button>
                </div>
              </div>

              {/* Selection action bar */}
              {legs.length > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {selectedLegs.size === 0 ? 'Select legs to build a custom parlay' : `${selectedLegs.size} of ${legs.length} selected`}
                    </span>
                    {selectedLegs.size === 0
                      ? <button onClick={selectAllLegs} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Select all</button>
                      : <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear</button>
                    }
                  </div>
                  {selectedLegs.size > 0 && selectedLegs.size < legs.length && (
                    <button
                      onClick={buildFromSelected}
                      className="btn-primary btn-xs flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      Build {selectedLegs.size}-Leg Parlay
                    </button>
                  )}
                </div>
              )}

              {/* Individual legs */}
              {legs.map((leg: any, i: number) => {
                const locked = isLocked(leg);
                return (
                  <div key={i} className={`card-hover ${locked ? 'border-amber-500/40' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      {/* Checkbox for custom selection */}
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => toggleSelectLeg(i)}
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all cursor-pointer ${
                            selectedLegs.has(i)
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-slate-600 hover:border-amber-500/50'
                          }`}
                        >
                          {selectedLegs.has(i) && (
                            <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-muted group-hover:text-white transition-colors">
                          {selectedLegs.has(i) ? 'Selected' : 'Add to parlay'}
                        </span>
                      </label>
                      {locked && (
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                          <Lock className="w-3 h-3" /> Locked
                        </div>
                      )}
                    </div>
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
                          {new Date(leg.commence_time).toLocaleString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </p>
                        <p className="text-amber-400 font-bold mt-1 text-lg">{leg.pick}</p>
                      </div>
                      <div className="text-right ml-4 flex flex-col items-end gap-2">
                        <div className={`text-2xl font-bold ${leg.odds > 0 ? 'text-emerald-400' : 'text-white'}`}>
                          {leg.odds > 0 ? '+' : ''}{leg.odds}
                        </div>
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

                    {/* Metrics */}
                    {leg.expected_value !== undefined && (
                      <div className="grid grid-cols-4 gap-2 mb-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700/30 text-center">
                        <div>
                          <div className="text-xs text-muted mb-0.5">EV</div>
                          <div className={`text-sm font-bold ${(leg.expected_value ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(leg.expected_value ?? 0) >= 0 ? '+' : ''}{(leg.expected_value ?? 0).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted mb-0.5">Kelly</div>
                          <div className="text-sm font-bold text-white">{(leg.kelly_units ?? 0).toFixed(1)}u</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted mb-0.5">Model %</div>
                          <div className="text-sm font-bold text-white">
                            {leg.true_probability != null ? (leg.true_probability * 100).toFixed(0) : '--'}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted mb-0.5">Market %</div>
                          <div className="text-sm font-bold text-white">
                            {leg.implied_probability != null ? (leg.implied_probability * 100).toFixed(0) : '--'}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Factors */}
                    {Array.isArray(leg.factors) && leg.factors.length > 0 && (
                      <div className="space-y-1.5 pt-3 border-t border-slate-700/50">
                        {leg.factors.map((f: any, j: number) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className="mt-0.5 flex-shrink-0">
                              {f.type === 'positive' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                : f.type === 'negative' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                : <Info className="w-3.5 h-3.5 text-blue-400" />}
                            </span>
                            <span className={`text-xs leading-relaxed ${
                              f.type === 'positive' ? 'text-emerald-300' :
                              f.type === 'negative' ? 'text-amber-300' : 'text-gray-400'
                            }`}>{f.description}</span>
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
                        ? (parlay.meta.parlay_odds / 100)
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

          {legs.length === 0 && !generating && !error && (
            <div className="card-glass text-center py-20">
              <Trophy className="w-16 h-16 text-amber-500/30 mx-auto mb-4" />
              <h3 className="heading-sm mb-2">March Madness is here</h3>
              <p className="text-muted text-sm mb-1">Hit a preset or configure manually and let the engine find the edges.</p>
              <p className="text-muted text-xs">KenPom data refreshes daily at 6 AM UTC.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
