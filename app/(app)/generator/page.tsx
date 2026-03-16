'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles, Shuffle, Save, Share2, ExternalLink,
  CheckCircle2, AlertTriangle, Info, Loader2, Lock,
  Unlock, Calendar, Flame, Brain, Trophy, Zap,
  ChevronDown, ChevronUp, RefreshCw, Plus, X,
  Target, TrendingUp, Shield, Quote,
} from 'lucide-react';
import { generateParlayShareText } from '@/lib/draftkings-links';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORTS = [
  { key: 'basketball_ncaab', name: 'College Basketball', short: 'NCAAB' },
  { key: 'americanfootball_nfl', name: 'NFL', short: 'NFL' },
  { key: 'basketball_nba', name: 'NBA', short: 'NBA' },
  { key: 'icehockey_nhl', name: 'NHL', short: 'NHL' },
  { key: 'baseball_mlb', name: 'MLB', short: 'MLB' },
];

const BET_TYPES = [
  { key: 'spread',     name: 'Spreads'   },
  { key: 'over_under', name: 'Totals'    },
  { key: 'moneyline',  name: 'Moneyline' },
];

const LOADING_MESSAGES = [
  'Analyzing KenPom efficiency margins...',
  'Detecting situational edges...',
  'Cross-referencing sharp signals...',
  'Building the case for each pick...',
  'Stress-testing the logic...',
  'Finding where the line is soft...',
];

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS = [
  {
    id: 'best',
    name: 'Best of All',
    icon: Trophy,
    description: '4 legs · All methodologies · Engine picks the top edges',
    color: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    config: { sports: ['basketball_ncaab'], legs: 4, betTypes: ['spread', 'over_under', 'moneyline'] },
  },
  {
    id: 'upsets',
    name: 'First Round Upsets',
    icon: Zap,
    description: '3 legs · KenPom dogs · Moneyline value',
    color: 'text-yellow-400',
    glow: 'shadow-yellow-500/10',
    border: 'border-slate-700/60 hover:border-yellow-500/30',
    config: { sports: ['basketball_ncaab'], legs: 3, betTypes: ['moneyline'] },
  },
  {
    id: 'sharp',
    name: 'Sharp Totals',
    icon: Brain,
    description: '3 legs · Pace & defense mismatches',
    color: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    border: 'border-slate-700/60 hover:border-blue-500/30',
    config: { sports: ['basketball_ncaab'], legs: 3, betTypes: ['spread', 'over_under'] },
  },
  {
    id: 'chaos',
    name: 'Chaos Bracket',
    icon: Flame,
    description: '5 legs · Longer shots · Swinging for the fences',
    color: 'text-red-400',
    glow: 'shadow-red-500/10',
    border: 'border-slate-700/60 hover:border-red-500/30',
    config: { sports: ['basketball_ncaab'], legs: 5, betTypes: ['spread', 'over_under', 'moneyline'] },
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OddsChip({ odds }: { odds: number }) {
  const positive = odds > 0;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-black tracking-tight ${
      positive
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-slate-700/60 text-white border border-slate-600/40'
    }`}>
      {positive ? '+' : ''}{odds}
    </span>
  );
}

function MetricPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${
      highlight ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-800/80 border border-slate-700/40'
    }`}>
      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-0.5">{label}</span>
      <span className={`text-sm font-black ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, string> = {
    S: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900',
    A: 'bg-gradient-to-br from-emerald-400 to-green-500 text-white',
    B: 'bg-gradient-to-br from-blue-400 to-cyan-500 text-white',
    C: 'bg-slate-700 text-slate-300',
    D: 'bg-slate-800 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-xs ${map[grade] ?? map.C}`}>
      {grade}
    </span>
  );
}

function ReasoningCard({ reasoning }: { reasoning: { headline: string; supporting: string; risk: string } }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-700/40">
      {/* Headline */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-slate-700/40">
        <div className="flex items-start gap-2.5">
          <Quote className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-white leading-snug">{reasoning.headline}</p>
        </div>
      </div>
      {/* Supporting + Risk */}
      <div className="grid grid-cols-2 divide-x divide-slate-700/40 bg-slate-900/40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500">The Edge</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{reasoning.supporting}</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-500">The Risk</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{reasoning.risk}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Generator() {
  const [selectedSports, setSelectedSports] = useState<string[]>(['basketball_ncaab']);
  const [numLegs, setNumLegs]               = useState(3);
  const [betTypes, setBetTypes]             = useState<string[]>(['spread', 'over_under', 'moneyline']);
  const [extraMarkets, setExtraMarkets]     = useState<string[]>([]);
  const [sgpMode, setSgpMode]               = useState<'none' | 'allow' | 'only'>('none');
  const [showAdvanced, setShowAdvanced]     = useState(false);

  const [generating, setGenerating]         = useState(false);
  const [parlay, setParlay]                 = useState<any>(null);
  const [error, setError]                   = useState('');
  const [loadingMsg, setLoadingMsg]         = useState('');
  const [loadingStep, setLoadingStep]       = useState(0);

  const [lockedLegs, setLockedLegs]         = useState<any[]>([]);
  const [selectedLegs, setSelectedLegs]     = useState<Set<number>>(new Set());
  const [stake, setStake]                   = useState(10);

  const [showPickBuilder, setShowPickBuilder] = useState(false);
  const [pickTeam, setPickTeam]               = useState('');
  const [pickBetType, setPickBetType]         = useState('spread');
  const [pickLine, setPickLine]               = useState('');
  const [manualPicks, setManualPicks]         = useState<any[]>([]);

  // Cycling loading messages
  const cycleMessages = useCallback(() => {
    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const iv = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
      setLoadingStep(i);
    }, 1800);
    return iv;
  }, []);

  const runGenerate = useCallback(async (
    config: { sports: string[]; legs: number; betTypes: string[]; extraMarkets?: string[]; sgpMode?: string },
    locked: any[] = []
  ) => {
    if (!config.sports?.length) { setError('Select at least one sport'); return; }
    if (!config.betTypes?.length) { setError('Select at least one bet type'); return; }

    setGenerating(true);
    setError('');
    setParlay(null);
    setSelectedLegs(new Set());

    const msgInterval = cycleMessages();

    try {
      const response = await fetch('/api/analytics/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sports:        config.sports,
          legs:          config.legs,
          odds_min:      -9999,
          odds_max:      9999,
          bet_types:     config.betTypes,
          extra_markets: config.extraMarkets ?? [],
          sgp_mode:      config.sgpMode ?? 'none',
          locked,
          min_edge:      0,
          min_tier:      'any',
          mode:          'max_value',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || 'Failed to generate');
      setParlay(data);

    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(msgInterval);
      setGenerating(false);
    }
  }, [cycleMessages]);

  const handleGenerate = (keepLocked = false) => {
    if (!keepLocked) setLockedLegs([]);
    runGenerate(
      { sports: selectedSports, legs: numLegs, betTypes, extraMarkets, sgpMode },
      keepLocked ? lockedLegs : []
    );
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const c = preset.config;
    setSelectedSports(c.sports);
    setNumLegs(c.legs);
    setBetTypes(c.betTypes);
    setLockedLegs([]);
    runGenerate({ sports: c.sports, legs: c.legs, betTypes: c.betTypes });
  };

  const toggleSport   = (s: string) => setSelectedSports(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleBetType = (t: string) => setBetTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const toggleLock = (leg: any) => {
    const key = `${leg.event_id}_${leg.pick}`;
    setLockedLegs(prev => {
      const exists = prev.some(l => `${l.event_id}_${l.pick}` === key);
      if (exists) { toast('Unlocked'); return prev.filter(l => `${l.event_id}_${l.pick}` !== key); }
      toast.success('Locked — stays on regenerate');
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

  const buildFromSelected = () => {
    if (selectedLegs.size === 0) { toast.error('Select at least one leg'); return; }
    const picked = legs.filter((_: any, i: number) => selectedLegs.has(i));

    const decOdds   = picked.map((l: any) => l.odds > 0 ? 1 + l.odds / 100 : 1 + 100 / Math.abs(l.odds));
    const parlayDec = decOdds.reduce((a: number, b: number) => a * b, 1);
    const parlayOdds = parlayDec >= 2
      ? Math.round((parlayDec - 1) * 100)
      : -Math.round(100 / (parlayDec - 1));
    const avgConf = picked.reduce((s: number, l: any) => s + (l.confidence ?? 5), 0) / picked.length;
    const avgEdge = picked.reduce((s: number, l: any) => s + (l.edge ?? 0), 0) / picked.length;

    setParlay({ parlay: picked, meta: { parlay_odds: parlayOdds, total_confidence: avgConf, avg_edge: avgEdge } });
    setSelectedLegs(new Set());
    toast.success(`Built ${picked.length}-leg parlay`);
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
      toast.success('Saved to portfolio');
    } catch {
      const parlayOdds = parlay.meta.parlay_odds;
      const toWin      = stake * (parlayOdds > 0 ? parlayOdds / 100 : 100 / Math.abs(parlayOdds));
      const all        = JSON.parse(localStorage.getItem('bets') ?? '[]');
      all.unshift({
        id: crypto.randomUUID(), created_at: Date.now(), status: 'pending',
        stake, odds: parlayOdds, potential_return: stake + toWin,
        confidence: parlay.meta.total_confidence, legs: parlay.parlay,
      });
      localStorage.setItem('bets', JSON.stringify(all));
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
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  };

  const legs = parlay?.parlay ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            March Madness
          </h1>
          <p className="text-slate-500 text-sm mt-1">KenPom efficiency engine · AI-reasoned picks</p>
        </div>
        {legs.length > 0 && (
          <div className="flex items-center gap-2">
            <OddsChip odds={parlay.meta?.parlay_odds ?? 0} />
            <span className="text-slate-500 text-sm">parlay odds</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ---- LEFT PANEL ---- */}
        <div className="space-y-4">

          {/* Presets */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Tournament Presets</h3>
              <p className="text-xs text-slate-600 mt-0.5">Engine picks the best legs — no manual tuning</p>
            </div>
            <div className="p-3 space-y-2">
              {PRESETS.map(preset => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    disabled={generating}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-800/60 border ${preset.border} transition-all duration-200 text-left disabled:opacity-40 group`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold text-sm flex items-center gap-2 ${preset.color}`}>
                          <Icon className="w-4 h-4" />
                          {preset.name}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{preset.description}</div>
                      </div>
                      <Sparkles className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sports */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4">
            <h3 className="text-sm font-bold text-white mb-3">Sports</h3>
            <div className="space-y-2.5">
              {SPORTS.map(s => (
                <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => toggleSport(s.key)}
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer flex-shrink-0 ${
                      selectedSports.includes(s.key)
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-slate-600 hover:border-amber-500/50'
                    }`}
                  >
                    {selectedSports.includes(s.key) && (
                      <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 group-hover:text-white transition-colors">
                    {s.name} <span className="text-slate-600 text-xs">{s.short}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Bet Types */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4">
            <h3 className="text-sm font-bold text-white mb-3">Bet Types</h3>
            <div className="space-y-2.5">
              {BET_TYPES.map(t => (
                <label key={t.key} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => toggleBetType(t.key)}
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer flex-shrink-0 ${
                      betTypes.includes(t.key)
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-slate-600 hover:border-amber-500/50'
                    }`}
                  >
                    {betTypes.includes(t.key) && (
                      <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 group-hover:text-white transition-colors">{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Anchor Picks */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Anchor Picks</h3>
              <button onClick={() => setShowPickBuilder(p => !p)}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {showPickBuilder && (
              <div className="space-y-2 mb-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
                <input type="text" placeholder="Team (e.g. Duke)" value={pickTeam}
                  onChange={e => setPickTeam(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50" />
                <div className="flex gap-2">
                  <select value={pickBetType} onChange={e => setPickBetType(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500/50">
                    <option value="spread">Spread</option>
                    <option value="moneyline">Moneyline</option>
                    <option value="total">Total</option>
                  </select>
                  <input type="text" placeholder="-3.5 / +120" value={pickLine}
                    onChange={e => setPickLine(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!pickTeam.trim()) return;
                    setManualPicks(p => [...p, { id: crypto.randomUUID(), team: pickTeam.trim(), betType: pickBetType, line: pickLine, label: `${pickTeam} ${pickLine}` }]);
                    setPickTeam(''); setPickLine(''); setShowPickBuilder(false); toast.success('Pick anchored');
                  }} className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors">
                    Add Anchor
                  </button>
                  <button onClick={() => setShowPickBuilder(false)}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {manualPicks.length > 0 ? (
              <div className="space-y-2">
                {manualPicks.map(pick => (
                  <div key={pick.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div>
                      <div className="text-xs font-bold text-amber-400">{pick.team}</div>
                      <div className="text-xs text-slate-500">{pick.label}</div>
                    </div>
                    <button onClick={() => setManualPicks(p => p.filter(x => x.id !== pick.id))}
                      className="text-slate-600 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Lock specific teams before generating.</p>
            )}
          </div>

          {/* Advanced */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4">
            <button onClick={() => setShowAdvanced(p => !p)} className="w-full flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Advanced</h3>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </button>
            {showAdvanced && (
              <div className="space-y-4 mt-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Number of Legs</label>
                  <input type="number" min="1" max="8" value={numLegs}
                    onChange={e => setNumLegs(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Same Game Parlay</label>
                  <select value={sgpMode} onChange={e => setSgpMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500/50">
                    <option value="none">Different games only</option>
                    <option value="allow">Allow mixed</option>
                    <option value="only">Same game only</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="space-y-2">
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-black text-base flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-amber-500/20"
            >
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                : <><Shuffle className="w-5 h-5" /> Generate Parlay</>}
            </button>
            {legs.length > 0 && (
              <button
                onClick={() => handleGenerate(lockedLegs.length > 0)}
                disabled={generating}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                {lockedLegs.length > 0 ? `Regenerate Unlocked` : 'Regenerate All'}
              </button>
            )}
          </div>
        </div>

        {/* ---- RIGHT PANEL: Results ---- */}
        <div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Loading */}
          {generating && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-16 text-center">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-amber-500/40 animate-ping" style={{ animationDelay: '0.3s' }} />
                <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-amber-500 animate-spin" />
              </div>
              <p className="text-white font-bold text-lg">{loadingMsg}</p>
              <p className="text-slate-600 text-sm mt-2">Running every available game through the KenPom model</p>
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mt-5">
                {LOADING_MESSAGES.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-500 ${
                    i === loadingStep ? 'w-4 h-1.5 bg-amber-500' : 'w-1.5 h-1.5 bg-slate-700'
                  }`} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!generating && legs.length === 0 && !error && (
            <div className="rounded-2xl bg-slate-900 border border-dashed border-slate-800 p-20 text-center">
              <Trophy className="w-14 h-14 text-slate-800 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">March Madness is live</h3>
              <p className="text-slate-600 text-sm">Pick a preset or configure manually, then let the engine find the edges.</p>
              <p className="text-slate-700 text-xs mt-2">KenPom data refreshes daily · 362 teams tracked</p>
            </div>
          )}

          {/* Results */}
          {legs.length > 0 && !generating && (
            <div className="space-y-4">

              {/* Summary bar */}
              <div className="rounded-2xl bg-slate-900 border border-amber-500/20 overflow-hidden">
                {/* Top strip */}
                <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">{legs.length}-Leg Parlay</h2>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Confidence <span className="text-amber-400 font-bold">{(parlay.meta?.total_confidence ?? 0).toFixed(1)}/10</span>
                        </span>
                        <span className="text-slate-700">·</span>
                        <span className="text-xs text-slate-500">
                          Avg Edge <span className="text-emerald-400 font-bold">{(parlay.meta?.avg_edge ?? 0).toFixed(1)}%</span>
                        </span>
                        {lockedLegs.length > 0 && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> {lockedLegs.length} locked
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-amber-400">
                        {(parlay.meta?.parlay_odds ?? 0) > 0 ? '+' : ''}{parlay.meta?.parlay_odds ?? 0}
                      </div>
                      <div className="text-xs text-slate-600">parlay odds</div>
                    </div>
                  </div>

                  {/* Selection bar */}
                  {legs.length > 1 && (
                    <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {selectedLegs.size === 0 ? 'Tap legs to build a custom subset' : `${selectedLegs.size} of ${legs.length} selected`}
                        </span>
                        {selectedLegs.size === 0
                          ? <button onClick={() => setSelectedLegs(new Set(legs.map((_: any, i: number) => i)))} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Select all</button>
                          : <button onClick={() => setSelectedLegs(new Set())} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Clear</button>
                        }
                      </div>
                      {selectedLegs.size > 0 && selectedLegs.size < legs.length && (
                        <button onClick={buildFromSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black transition-colors">
                          <Sparkles className="w-3 h-3" /> Build {selectedLegs.size}-Leg Parlay
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => window.open(legs[0]?.dk_link ?? 'https://sportsbook.draftkings.com', '_blank', 'noopener,noreferrer')}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> DraftKings
                    </button>
                    <button onClick={handleShare} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors border border-slate-700">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                    <button onClick={() => handleGenerate(lockedLegs.length > 0)} disabled={generating} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-sm transition-colors border border-slate-700">
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {/* Individual leg cards */}
              {legs.map((leg: any, i: number) => {
                const locked   = isLocked(leg);
                const selected = selectedLegs.has(i);
                const positive = leg.expected_value >= 0;

                return (
                  <div
                    key={i}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      locked    ? 'border-amber-500/30 bg-slate-900' :
                      selected  ? 'border-amber-500/50 bg-slate-900' :
                      'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    {/* Color accent bar */}
                    <div className={`h-0.5 ${
                      locked   ? 'bg-amber-500' :
                      selected ? 'bg-amber-400' :
                      positive ? 'bg-emerald-500/60' : 'bg-slate-700'
                    }`} />

                    <div className="p-5">
                      {/* Leg header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {/* Selection checkbox */}
                          <div
                            onClick={() => toggleSelectLeg(i)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all cursor-pointer flex-shrink-0 ${
                              selected ? 'bg-amber-500 border-amber-500' : 'border-slate-600 hover:border-amber-500/60'
                            }`}
                          >
                            {selected && (
                              <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black tracking-widest uppercase text-slate-600">Leg {i + 1}</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700/60">
                                {SPORTS.find(s => s.key === leg.sport)?.short ?? 'NCAAB'}
                              </span>
                              {leg.bet_grade && <GradeBadge grade={leg.bet_grade} />}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(leg.commence_time).toLocaleString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <OddsChip odds={leg.odds} />
                          <button
                            onClick={() => toggleLock(leg)}
                            className={`p-2 rounded-lg border transition-all ${
                              locked
                                ? 'bg-amber-500 border-amber-500 text-slate-900'
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-amber-500/40 hover:text-amber-400'
                            }`}
                          >
                            {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          {leg.dk_link && (
                            <a href={leg.dk_link} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Game + Pick */}
                      <div className="mb-4">
                        {/* Tournament + venue badges */}
                        {(leg.tournament || leg.venue) && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {leg.tournament && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                                {leg.tournament}
                              </span>
                            )}
                            {leg.venue && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700/60">
                                {leg.venue}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-base font-bold text-white">{leg.event_name}</p>
                        <p className="text-xl font-black text-amber-400 mt-1">{leg.pick}</p>
                      </div>

                      {/* Metrics row */}
                      <div className="flex gap-2 flex-wrap mb-1">
                        <MetricPill
                          label="EV"
                          value={`${(leg.expected_value ?? 0) >= 0 ? '+' : ''}${(leg.expected_value ?? 0).toFixed(1)}%`}
                          highlight={(leg.expected_value ?? 0) > 0}
                        />
                        <MetricPill label="Kelly" value={`${((leg.kelly_fraction ?? 0) * 100).toFixed(1)}% · $${((leg.kelly_fraction ?? 0) * 100).toFixed(0)}`} />
                        <MetricPill
                          label="Model"
                          value={leg.true_probability != null ? `${(leg.true_probability * 100).toFixed(0)}%` : '—'}
                        />
                        <MetricPill
                          label="Market"
                          value={leg.implied_probability != null ? `${(leg.implied_probability * 100).toFixed(0)}%` : '—'}
                        />
                      </div>

                      {/* Claude reasoning card */}
                      {leg.reasoning ? (
                        <ReasoningCard reasoning={leg.reasoning} />
                      ) : (
                        /* Fallback: factor bullets if no Claude reasoning */
                        Array.isArray(leg.factors) && leg.factors.length > 0 && (
                          <div className="mt-4 space-y-1.5 pt-4 border-t border-slate-800">
                            {leg.factors.map((f: any, j: number) => (
                              <div key={j} className="flex items-start gap-2">
                                {f.type === 'positive'
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                  : f.type === 'negative'
                                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                  : <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />}
                                <span className={`text-xs leading-relaxed ${
                                  f.type === 'positive' ? 'text-emerald-300/80' :
                                  f.type === 'negative' ? 'text-amber-300/80' : 'text-slate-500'
                                }`}>{f.description}</span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Save card */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
                <h3 className="text-sm font-bold text-white mb-4">Save to Portfolio</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stake ($) <span className="text-slate-700 normal-case font-normal">· $5 = 1 unit</span></label>
                    <input type="number" min="1" step="1" value={stake}
                      onChange={e => setStake(parseFloat(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To Win</label>
                    <div className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700/40 text-amber-400 font-black text-sm">
                      ${(stake * ((parlay.meta?.parlay_odds ?? 0) > 0
                        ? (parlay.meta.parlay_odds / 100)
                        : (100 / Math.abs(parlay.meta?.parlay_odds || 100)))).toFixed(2)}
                    </div>
                  </div>
                  <button onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-sm transition-all shadow-lg shadow-amber-500/20">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
