'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, TrendingDown, Award, Flame,
  Target, Sparkles, Dices, Wallet, Trophy, Shield,
  Calendar, ChevronRight, Zap, Brain, RefreshCw,
} from 'lucide-react';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function StatCard({ label, value, sub, color = 'text-white', icon: Icon }: any) {
  return (
    <div className="stat-card">
      <div className="stat-label flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`stat-value-sm ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser]       = useState<any>(null);
  const [bets, setBets]       = useState<any[]>([]);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mrb_user');
    if (!stored) { setLoading(false); return; }
    const u = JSON.parse(stored);
    setUser(u);
    fetchBets(u.username);
  }, []);

  const fetchBets = async (username: string) => {
    try {
      const res  = await fetch(`/api/bets?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.bets) setBets(data.bets.slice(0, 5));
      if (data.stats) {
        setStats(data.stats);
        // Sync stats back into localStorage user object
        const stored = localStorage.getItem('mrb_user');
        if (stored) {
          const u = JSON.parse(stored);
          const merged = { ...u, stats: { ...u.stats, ...data.stats } };
          localStorage.setItem('mrb_user', JSON.stringify(merged));
          setUser(merged);
        }
      }
    } catch (_) {
      // Fall back to localStorage bets
      const storedBets = localStorage.getItem('bets');
      if (storedBets) setBets(JSON.parse(storedBets).slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton-title mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-card h-28" />)}
        </div>
        <div className="skeleton-card h-48" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Select your profile to continue.</p>
      </div>
    );
  }

  const s = user.stats ?? {};
  const totalBets = s.total_bets ?? 0;
  const wins      = s.wins      ?? 0;
  const losses    = s.losses    ?? 0;
  const roi       = s.roi       ?? 0;
  const unitsProfit = s.units_profit ?? 0;
  const streak    = s.current_streak ?? 0;
  const sharpScore = s.sharp_score ?? 50;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-lg flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            Welcome back, {user.username}
          </h1>
          <p className="text-muted mt-1">Your performance dashboard</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchBets(user.username); }}
          className="btn-secondary btn-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Record" icon={Award}
          value={<><span className="text-white">{wins}</span><span className="text-gray-500 mx-1">-</span><span className="text-white">{losses}</span></>}
          sub={`${totalBets} total bets`}
        />
        <StatCard
          label="ROI" icon={TrendingUp}
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
          color={roi >= 0 ? 'text-emerald-400' : 'text-red-400'}
          sub={`${unitsProfit >= 0 ? '+' : ''}${unitsProfit.toFixed(2)} units`}
        />
        <StatCard
          label="Streak" icon={Flame}
          value={`${streak > 0 ? '+' : ''}${streak}`}
          color={streak > 0 ? 'text-emerald-400' : streak < 0 ? 'text-red-400' : 'text-white'}
          sub={`Best: ${s.best_win_streak ?? 0}W`}
        />
        <StatCard
          label="Sharp Score" icon={Target}
          value={<>{sharpScore.toFixed(0)}<span className="text-xl text-gray-400">/100</span></>}
          color="text-amber-400"
          sub={sharpScore >= 70 ? 'Elite' : sharpScore >= 50 ? 'Sharp' : 'Improving'}
        />
      </div>

      {/* Advanced metrics */}
      <div className="card-glass">
        <div className="flex items-center gap-3 mb-5">
          <Shield className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Advanced Metrics</h2>
            <p className="text-xs text-muted">Professional betting analytics</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Avg Expected Value', icon: TrendingUp,
              value: `${(s.total_ev ?? 0) >= 0 ? '+' : ''}${(s.total_ev ?? 0).toFixed(2)}%`,
              color: (s.total_ev ?? 0) >= 3 ? 'text-emerald-400' : (s.total_ev ?? 0) >= 0 ? 'text-amber-400' : 'text-red-400',
              sub: (s.total_ev ?? 0) >= 5 ? 'Excellent edge' : (s.total_ev ?? 0) >= 3 ? 'Good edge' : (s.total_ev ?? 0) >= 0 ? 'Positive EV' : 'Negative EV',
            },
            {
              label: 'Closing Line Value', icon: Target,
              value: `${(s.avg_clv ?? 0) >= 0 ? '+' : ''}${((s.avg_clv ?? 0) * 100).toFixed(2)}%`,
              color: (s.avg_clv ?? 0) > 0 ? 'text-emerald-400' : 'text-amber-400',
              sub: (s.avg_clv ?? 0) > 0.01 ? 'Beating market' : 'At market',
            },
            {
              label: 'Sharpe Ratio', icon: BarChart3,
              value: (s.sharpe_ratio ?? 0).toFixed(2),
              color: (s.sharpe_ratio ?? 0) >= 2 ? 'text-emerald-400' : (s.sharpe_ratio ?? 0) >= 1 ? 'text-amber-400' : 'text-gray-400',
              sub: (s.sharpe_ratio ?? 0) >= 2 ? 'Excellent' : (s.sharpe_ratio ?? 0) >= 1 ? 'Good' : 'Needs improvement',
            },
          ].map(m => (
            <div key={m.label} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
              <div className="text-xs text-muted mb-2 flex items-center gap-1">
                <m.icon className="w-3 h-3" />
                {m.label}
              </div>
              <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-muted mt-1">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card-glass">
        <h2 className="heading-sm mb-4">Quick Picks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/generator?preset=kenpom"
            className="px-4 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-blue-500/50 transition-all text-center"
          >
            <Brain className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="font-bold text-white mb-1">KenPom Value</div>
            <div className="text-xs text-muted">3-4 legs · efficiency-driven</div>
          </Link>
          <Link
            href="/generator?preset=spots"
            className="px-4 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-emerald-500/50 transition-all text-center"
          >
            <Target className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-white mb-1">Situational Spots</div>
            <div className="text-xs text-muted">3-4 legs · traps & fatigue</div>
          </Link>
          <Link
            href="/generator?preset=chaos"
            className="px-4 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-red-500/50 transition-all text-center"
          >
            <Flame className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <div className="font-bold text-white mb-1">Chaos Mode</div>
            <div className="text-xs text-muted">5-6 legs · long odds</div>
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-700/50">
          <Link href="/generator" className="btn-primary btn-sm flex items-center gap-2">
            <Dices className="w-4 h-4" /> Generate Parlay
          </Link>
          <Link href="/portfolio" className="btn-secondary btn-sm flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Portfolio
          </Link>
          <Link href="/leaderboard" className="btn-secondary btn-sm flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </Link>
        </div>
      </div>

      {/* Recent bets */}
      <div className="card-glass">
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-sm">Recent Bets</h2>
          <Link href="/portfolio" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {bets.length === 0 ? (
          <div className="text-center py-10">
            <Dices className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-muted mb-4">No bets yet.</p>
            <Link href="/generator" className="btn-primary inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Generate Your First Parlay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map((bet: any) => (
              <Link
                key={bet.id}
                href={`/portfolio?bet=${bet.id}`}
                className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 border border-slate-700/50 hover:border-amber-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">
                        {bet.legs?.length ?? '?'}-Leg Parlay
                      </span>
                      <span className={`badge-xs ${
                        bet.status === 'won'  ? 'badge-success' :
                        bet.status === 'lost' ? 'badge-error'   : 'badge-neutral'
                      }`}>
                        {bet.status?.toUpperCase()}
                      </span>
                      {bet.confidence && (
                        <span className="badge-info badge-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {parseFloat(bet.confidence).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted space-y-0.5">
                      {(bet.legs ?? []).slice(0, 3).map((leg: any, i: number) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className="text-gray-600">•</span>
                          <span>{leg.pick}</span>
                        </div>
                      ))}
                      {(bet.legs?.length ?? 0) > 3 && (
                        <div className="text-xs text-gray-600">+ {bet.legs.length - 3} more</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-lg">{formatCurrency(bet.stake)}</div>
                    <div className="text-amber-400 text-sm">{bet.odds > 0 ? '+' : ''}{bet.odds}</div>
                    {bet.potential_return && (
                      <div className="text-xs text-muted">to win {formatCurrency(bet.potential_return)}</div>
                    )}
                  </div>
                </div>
                {bet.created_at && (
                  <div className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(bet.created_at).toLocaleDateString()}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Performance insight */}
      {totalBets >= 5 && (
        <div className={`card ${roi > 5 ? 'border-emerald-500/30 bg-emerald-950/20' : roi > 0 ? 'border-amber-500/30 bg-amber-950/10' : 'border-slate-600/30'}`}>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Insight
          </h3>
          <p className="text-secondary text-sm">
            {roi > 5
              ? `You're crushing it. ${roi.toFixed(1)}% ROI is elite territory. Stay disciplined.`
              : roi > 0
              ? `Profitable so far — ${roi.toFixed(1)}% ROI. Focus on B-tier plays and above to build the edge.`
              : `Stay patient. ${Math.abs(roi).toFixed(1)}% down. Sharp bettors focus on process over results.`}
          </p>
        </div>
      )}
    </div>
  );
}
