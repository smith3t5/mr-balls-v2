'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, Plus, X, Save, Share2,
  ExternalLink, RefreshCw, Loader2, ChevronDown,
  ChevronUp, AlertTriangle, Clock, MapPin, Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KenPom {
  projectedScore:  string;
  projectedSpread: number;
  projectedTotal:  number;
  homeWinProb:     number;
  awayWinProb:     number;
  bookSpread:      number | null;
  bookTotal:       number | null;
  homeML:          number | null;
  awayML:          number | null;
  spreadGap:       number | null;
  totalGap:        number | null;
  mlEdgeHome:      number | null;
  mlEdgeAway:      number | null;
  totalValueSide:  'over' | 'under' | null;
  mlValueSide:     'home' | 'away' | null;
  hasEdge:         boolean;
}

interface Game {
  id:           string;
  homeTeam:     string;
  awayTeam:     string;
  commenceTime: number;
  venue:        string;
  kenpom:       KenPom | null;
  bookmakers:   any[];
}

interface ParlayLeg {
  gameId:    string;
  eventName: string;
  pick:      string;
  betType:   'spread' | 'ml' | 'total';
  odds:      number;
  side:      string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtOdds(o: number | null) {
  if (o == null) return '—';
  return o > 0 ? `+${o}` : `${o}`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function gapColor(gap: number | null, invert = false) {
  if (gap == null) return 'text-slate-500';
  const val = invert ? -gap : gap;
  if (Math.abs(gap) < 1.5) return 'text-slate-500';
  return val > 0 ? 'text-emerald-400' : 'text-red-400';
}

function GapBadge({ label, gap, invert = false }: { label: string; gap: number | null; invert?: boolean }) {
  if (gap == null) return null;
  const abs   = Math.abs(gap);
  if (abs < 1.5) return (
    <div className="text-center">
      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-slate-600">aligned</div>
    </div>
  );
  const color = (invert ? -gap : gap) > 0 ? 'text-emerald-400' : 'text-red-400';
  const bg    = (invert ? -gap : gap) > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';
  return (
    <div className={`text-center px-3 py-1.5 rounded-lg ${bg}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label} gap</div>
      <div className={`text-sm font-black ${color}`}>
        {gap > 0 ? '+' : ''}{gap.toFixed(1)}
      </div>
    </div>
  );
}

function MlEdge({ team, edge, odds, onAdd }: { team: string; edge: number | null; odds: number | null; onAdd: () => void }) {
  const hasEdge = edge != null && Math.abs(edge) > 5;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${hasEdge ? 'bg-slate-800/80' : 'bg-slate-900/40'}`}>
      <div>
        <div className="text-xs font-semibold text-white truncate max-w-[120px]">{team}</div>
        <div className="text-xs text-slate-500">{fmtOdds(odds)}</div>
      </div>
      <div className="flex items-center gap-2">
        {edge != null && (
          <div className={`text-xs font-bold ${edge > 5 ? 'text-emerald-400' : edge < -5 ? 'text-red-400' : 'text-slate-600'}`}>
            {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
          </div>
        )}
        {hasEdge && edge! > 0 && (
          <button onClick={onAdd} className="p-1 rounded-md bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Generator() {
  const [games, setGames]       = useState<Game[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [parlay, setParlay]     = useState<ParlayLeg[]>([]);
  const [stake, setStake]       = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter]     = useState<'all' | 'value'>('all');
  const [saving, setSaving]     = useState(false);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/games');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setGames(data.games);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGames(); }, [loadGames]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addLeg = (leg: ParlayLeg) => {
    if (parlay.some(l => l.gameId === leg.gameId && l.betType === leg.betType && l.side === leg.side)) {
      toast('Already in parlay');
      return;
    }
    setParlay(prev => [...prev, leg]);
    toast.success(`Added: ${leg.pick}`);
  };

  const removeLeg = (i: number) => {
    setParlay(prev => prev.filter((_, idx) => idx !== i));
  };

  const parlayOdds = parlay.length === 0 ? null : (() => {
    const dec = parlay.map(l => l.odds > 0 ? 1 + l.odds / 100 : 1 + 100 / Math.abs(l.odds));
    const tot = dec.reduce((a, b) => a * b, 1);
    return tot >= 2 ? Math.round((tot - 1) * 100) : -Math.round(100 / (tot - 1));
  })();

  const toWin = parlayOdds == null ? 0
    : parlayOdds > 0 ? stake * parlayOdds / 100
    : stake * 100 / Math.abs(parlayOdds);

  const handleSave = async () => {
    if (!parlay.length) return;
    setSaving(true);
    const stored   = localStorage.getItem('mrb_user');
    const username = stored ? JSON.parse(stored).username : 'Unknown';
    try {
      const res = await fetch('/api/bets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          bet: {
            stake,
            meta: { parlay_odds: parlayOdds, total_confidence: 5, avg_edge: 0 },
            legs: parlay.map(l => ({
              event_name: l.eventName,
              pick:       l.pick,
              odds:       l.odds,
              market:     l.betType === 'ml' ? 'h2h' : l.betType === 'spread' ? 'spreads' : 'totals',
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Saved to portfolio!');
      setParlay([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (!parlay.length) return;
    const text = parlay.map(l => `${l.pick} (${fmtOdds(l.odds)})`).join('\n');
    navigator.clipboard.writeText(`🏀 M.R. B.A.L.L.S. Parlay\n${text}\n\nParlay odds: ${fmtOdds(parlayOdds)}`);
    toast.success('Copied!');
  };

  const displayed = filter === 'value' ? games.filter(g => g.kenpom?.hasEdge) : games;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Today's Games</h1>
          <p className="text-slate-500 text-sm mt-1">
            KenPom projections vs book lines · {games.length} tournament games
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter(f => f === 'all' ? 'value' : 'all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              filter === 'value'
                ? 'bg-amber-500 border-amber-500 text-slate-900'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500/40'
            }`}
          >
            {filter === 'value' ? '⚡ Value only' : 'All games'}
          </button>
          <button onClick={loadGames} disabled={loading}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* ── GAME CARDS ── */}
        <div className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div className="text-center py-20 text-slate-600">
              {filter === 'value' ? 'No value edges found right now — check back as lines move' : 'No games available'}
            </div>
          )}

          {!loading && displayed.map(game => {
            const kp   = game.kenpom;
            const open = expanded.has(game.id);
            const dk   = game.bookmakers.find((b: any) => b.key === 'draftkings') ?? game.bookmakers[0];

            // Get DK odds
            const dkSpread = dk?.markets.find((m: any) => m.key === 'spreads');
            const dkTotal  = dk?.markets.find((m: any) => m.key === 'totals');
            const dkML     = dk?.markets.find((m: any) => m.key === 'h2h');

            const homeSpreadOut = dkSpread?.outcomes.find((o: any) => o.name.includes(game.homeTeam.split(' ')[0]));
            const awaySpreadOut = dkSpread?.outcomes.find((o: any) => !o.name.includes(game.homeTeam.split(' ')[0]));
            const overOut       = dkTotal?.outcomes.find((o: any) => o.name.toLowerCase().includes('over'));
            const underOut      = dkTotal?.outcomes.find((o: any) => o.name.toLowerCase().includes('under'));
            const homeMLOut     = dkML?.outcomes.find((o: any) => o.name.includes(game.homeTeam.split(' ')[0]));
            const awayMLOut     = dkML?.outcomes.find((o: any) => !o.name.includes(game.homeTeam.split(' ')[0]));

            return (
              <div key={game.id} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                kp?.hasEdge ? 'border-amber-500/30 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}>
                {kp?.hasEdge && <div className="h-0.5 bg-gradient-to-r from-amber-500/80 to-yellow-400/80" />}

                {/* Game header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {kp?.hasEdge && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                            <Zap className="w-2.5 h-2.5" /> Value
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />{game.venue}
                        </span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{fmtTime(game.commenceTime)}
                        </span>
                      </div>
                      <div className="text-lg font-black text-white">
                        {game.awayTeam} <span className="text-slate-600 font-normal text-sm">@</span> {game.homeTeam}
                      </div>
                      {kp && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          KenPom: <span className="text-slate-400">{kp.projectedScore}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleExpand(game.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors flex-shrink-0 ml-2">
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Value gap summary row */}
                  {kp && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {kp.totalGap != null && Math.abs(kp.totalGap) > 1.5 && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                          kp.totalValueSide === 'over'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : kp.totalValueSide === 'under'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          {kp.totalValueSide === 'over'
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
                          {kp.totalValueSide === 'over' ? 'Over' : 'Under'} {kp.bookTotal}
                          <span className="text-[10px] opacity-70 ml-0.5">
                            (model: {kp.projectedTotal})
                          </span>
                          <button
                            onClick={() => overOut && addLeg({
                              gameId:    game.id,
                              eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                              pick:      `${kp.totalValueSide === 'over' ? 'Over' : 'Under'} ${kp.bookTotal}`,
                              betType:   'total',
                              odds:      kp.totalValueSide === 'over' ? overOut.price : underOut?.price ?? 0,
                              side:      kp.totalValueSide ?? 'over',
                            })}
                            className="ml-1 p-0.5 rounded bg-current/20 hover:bg-current/40 transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {kp.mlValueSide && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400">
                          <TrendingUp className="w-3 h-3" />
                          {kp.mlValueSide === 'home' ? game.homeTeam : game.awayTeam} ML
                          <span className="text-[10px] opacity-70 ml-0.5">
                            ({kp.mlValueSide === 'home' ? kp.mlEdgeHome?.toFixed(1) : kp.mlEdgeAway?.toFixed(1)}% edge)
                          </span>
                          <button
                            onClick={() => {
                              const mlOut = kp.mlValueSide === 'home' ? homeMLOut : awayMLOut;
                              if (!mlOut) return;
                              addLeg({
                                gameId:    game.id,
                                eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                                pick:      `${kp.mlValueSide === 'home' ? game.homeTeam : game.awayTeam} ML`,
                                betType:   'ml',
                                odds:      mlOut.price,
                                side:      kp.mlValueSide,
                              });
                            }}
                            className="ml-1 p-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded: full odds table */}
                {open && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
                    {/* Spread */}
                    {dkSpread && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Spread</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[homeSpreadOut, awaySpreadOut].filter(Boolean).map((out: any, i: number) => {
                            const isHome = i === 0;
                            const team   = isHome ? game.homeTeam : game.awayTeam;
                            return (
                              <button key={i}
                                onClick={() => addLeg({
                                  gameId:    game.id,
                                  eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                                  pick:      `${team} ${out.point > 0 ? '+' : ''}${out.point}`,
                                  betType:   'spread',
                                  odds:      out.price,
                                  side:      isHome ? 'home' : 'away',
                                })}
                                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40 hover:border-amber-500/30 transition-all text-left group">
                                <div>
                                  <div className="text-xs font-bold text-white">{team}</div>
                                  <div className="text-sm font-black text-amber-400">
                                    {out.point > 0 ? '+' : ''}{out.point}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-300">{fmtOdds(out.price)}</span>
                                  <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    {dkTotal && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">
                          Total {kp?.bookTotal != null ? `(KenPom: ${kp.projectedTotal})` : ''}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[overOut, underOut].filter(Boolean).map((out: any, i: number) => {
                            const isOver   = out.name.toLowerCase().includes('over');
                            const hasValue = isOver
                              ? kp?.totalValueSide === 'over'
                              : kp?.totalValueSide === 'under';
                            return (
                              <button key={i}
                                onClick={() => addLeg({
                                  gameId:    game.id,
                                  eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                                  pick:      `${out.name} ${out.point}`,
                                  betType:   'total',
                                  odds:      out.price,
                                  side:      isOver ? 'over' : 'under',
                                })}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left group ${
                                  hasValue
                                    ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                                    : 'bg-slate-800/80 border-slate-700/40 hover:border-amber-500/30'
                                }`}>
                                <div>
                                  <div className={`text-xs font-bold ${hasValue ? 'text-emerald-400' : 'text-white'}`}>
                                    {out.name} {out.point}
                                  </div>
                                  {hasValue && kp?.totalGap != null && (
                                    <div className="text-[10px] text-emerald-500/70">
                                      {Math.abs(kp.totalGap).toFixed(1)}pt edge
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-300">{fmtOdds(out.price)}</span>
                                  <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Moneyline */}
                    {dkML && kp && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Moneyline</div>
                        <div className="grid grid-cols-2 gap-2">
                          <MlEdge team={game.homeTeam} edge={kp.mlEdgeHome} odds={kp.homeML}
                            onAdd={() => homeMLOut && addLeg({
                              gameId:    game.id,
                              eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                              pick:      `${game.homeTeam} ML`,
                              betType:   'ml',
                              odds:      homeMLOut.price,
                              side:      'home',
                            })} />
                          <MlEdge team={game.awayTeam} edge={kp.mlEdgeAway} odds={kp.awayML}
                            onAdd={() => awayMLOut && addLeg({
                              gameId:    game.id,
                              eventName: `${game.awayTeam} @ ${game.homeTeam}`,
                              pick:      `${game.awayTeam} ML`,
                              betType:   'ml',
                              odds:      awayMLOut.price,
                              side:      'away',
                            })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <div className="text-center text-[10px] text-slate-600">
                            KenPom: {kp.homeWinProb}%
                          </div>
                          <div className="text-center text-[10px] text-slate-600">
                            KenPom: {kp.awayWinProb}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── PARLAY BUILDER ── */}
        <div className="lg:sticky lg:top-6 space-y-4 h-fit">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className={`h-1 transition-all ${parlay.length > 0 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-slate-800'}`} />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-white text-lg">
                  {parlay.length === 0 ? 'Parlay Builder' : `${parlay.length}-Leg Parlay`}
                </h3>
                {parlayOdds != null && (
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-400">{fmtOdds(parlayOdds)}</div>
                    <div className="text-[10px] text-slate-600">parlay odds</div>
                  </div>
                )}
              </div>

              {parlay.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-slate-700 text-sm">
                    Hit <Plus className="w-3 h-3 inline" /> on any bet to add it here
                  </div>
                  <div className="text-slate-600 text-xs mt-1">
                    Value picks are highlighted in green
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {parlay.map((leg, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-amber-400 truncate">{leg.pick}</div>
                        <div className="text-[10px] text-slate-500 truncate">{leg.eventName}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-white">{fmtOdds(leg.odds)}</span>
                        <button onClick={() => removeLeg(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {parlay.length > 0 && (
                <>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Stake ($)</label>
                      <input type="number" min="1" value={stake} onChange={e => setStake(+e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">To Win</label>
                      <div className="px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 text-amber-400 font-black text-sm">
                        ${toWin.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-black text-sm transition-all col-span-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                    <button onClick={handleShare}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-sm transition-all border border-slate-700">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  {parlay[0]?.odds && (
                    <button
                      onClick={() => window.open('https://sportsbook.draftkings.com/leagues/basketball/ncaab', '_blank')}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-bold transition-all border border-emerald-500/20">
                      <ExternalLink className="w-3.5 h-3.5" /> Open DraftKings
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick stat */}
          {games.length > 0 && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Today's tournament</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-black text-white">{games.length}</div>
                  <div className="text-[10px] text-slate-600">games</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-amber-400">{games.filter(g => g.kenpom?.hasEdge).length}</div>
                  <div className="text-[10px] text-slate-600">value edges</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
