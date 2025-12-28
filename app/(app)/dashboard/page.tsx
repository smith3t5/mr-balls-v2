'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Flame,
  Target,
  Lock,
  Sparkles,
  Dices,
  Wallet,
  Trophy,
  Shield,
  Calendar,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [sharpPlay, setSharpPlay] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/users/me').then(r => r.json()),
      fetch('/api/bets?limit=5').then(r => r.json()),
      fetch('/api/sharp-play/daily').then(r => r.json()),
    ]).then(([userData, betsData, sharpPlayData]) => {
      if (userData.success) setUser(userData.user);
      if (betsData.success) setBets(betsData.bets);
      if (sharpPlayData.success) setSharpPlay(sharpPlayData.sharp_play);
    }).catch((error) => {
      console.error('Failed to load dashboard data:', error);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const lockSharpPlay = () => {
    if (!sharpPlay) return;
    // Store sharp play in session storage and redirect to generator
    sessionStorage.setItem('locked_sharp_play', JSON.stringify(sharpPlay));
    window.location.href = '/generator?locked=sharp';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton-title mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card h-32" />
          ))}
        </div>
        <div className="skeleton-card h-64" />
        <div className="skeleton-card h-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div>
        <h1 className="heading-lg flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-amber-500" />
          Welcome back, {user.username}
        </h1>
        <p className="text-muted mt-2">Here's your performance overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <Award className="w-3 h-3" />
            Record
          </div>
          <div className="stat-value-sm">
            <span className="text-white">{user.stats.wins}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-white">{user.stats.losses}</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {user.stats.total_bets} total bets
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            ROI
          </div>
          <div className={`stat-value-sm ${user.stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {user.stats.roi >= 0 ? '+' : ''}{user.stats.roi.toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-1">
            {user.stats.units_profit >= 0 ? '+' : ''}{user.stats.units_profit.toFixed(2)} units
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <Flame className="w-3 h-3" />
            Current Streak
          </div>
          <div className={`stat-value-sm ${
            user.stats.current_streak > 0 ? 'text-emerald-400' :
            user.stats.current_streak < 0 ? 'text-red-400' :
            'text-white'
          }`}>
            {user.stats.current_streak > 0 && '+'}{user.stats.current_streak}
          </div>
          <div className="text-xs text-muted mt-1">
            Best: {user.stats.longest_win_streak}W
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <Target className="w-3 h-3" />
            Sharp Score
          </div>
          <div className="stat-value-sm text-amber-400">
            {user.stats.sharp_score.toFixed(0)}<span className="text-xl text-gray-400">/100</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {user.stats.sharp_score >= 70 ? 'Elite' :
             user.stats.sharp_score >= 50 ? 'Sharp' :
             user.stats.sharp_score >= 30 ? 'Improving' : 'Developing'}
          </div>
        </div>
      </div>

      {/* Performance Overview Chart */}
      {user.stats.total_bets > 0 && (
        <div className="card-glass">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Performance Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Win Rate Visualization */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Win Distribution</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Wins ({user.stats.wins})
                    </span>
                    <span className="text-emerald-400">{((user.stats.wins / user.stats.total_bets) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-500"
                      style={{ width: `${(user.stats.wins / user.stats.total_bets) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-red-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Losses ({user.stats.losses})
                    </span>
                    <span className="text-red-400">{((user.stats.losses / user.stats.total_bets) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-rose-500"
                      style={{ width: `${(user.stats.losses / user.stats.total_bets) * 100}%` }}
                    />
                  </div>
                </div>

                {user.stats.pushes > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-400 font-semibold flex items-center gap-1">
                        <Info className="w-4 h-4" />
                        Pushes ({user.stats.pushes})
                      </span>
                      <span className="text-gray-400">{((user.stats.pushes / user.stats.total_bets) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gray-500 to-slate-500"
                        style={{ width: `${(user.stats.pushes / user.stats.total_bets) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Units Profit Chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Units Performance</h3>
              <div className="p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
                <div className="text-center mb-4">
                  <div className={`text-4xl font-bold ${user.stats.units_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {user.stats.units_profit >= 0 ? '+' : ''}{user.stats.units_profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Total Units</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-3 rounded-lg bg-slate-800/50">
                    <div className="text-gray-400 mb-1">Wagered</div>
                    <div className="text-white font-semibold">{user.stats.units_wagered.toFixed(1)}U</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-800/50">
                    <div className="text-gray-400 mb-1">ROI</div>
                    <div className={`font-semibold ${user.stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {user.stats.roi >= 0 ? '+' : ''}{user.stats.roi.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Analytics Section */}
      <div className="card-glass">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Advanced Analytics</h2>
            <p className="text-xs text-muted">Professional betting metrics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Expected Value */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
            <div className="text-xs text-muted mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Avg Expected Value
            </div>
            <div className={`text-2xl font-bold ${
              (user.stats.total_ev || 0) >= 3 ? 'text-emerald-400' :
              (user.stats.total_ev || 0) >= 0 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {(user.stats.total_ev || 0) >= 0 ? '+' : ''}{(user.stats.total_ev || 0).toFixed(2)}%
            </div>
            <div className="text-xs text-muted mt-2">
              {(user.stats.total_ev || 0) >= 5 ? 'Excellent edge' :
               (user.stats.total_ev || 0) >= 3 ? 'Good edge' :
               (user.stats.total_ev || 0) >= 0 ? 'Positive EV' :
               'Negative EV'}
            </div>
          </div>

          {/* Closing Line Value */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
            <div className="text-xs text-muted mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Avg Closing Line Value
            </div>
            <div className={`text-2xl font-bold ${
              (user.stats.avg_clv || 0) > 0 ? 'text-emerald-400' :
              (user.stats.avg_clv || 0) === 0 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {(user.stats.avg_clv || 0) >= 0 ? '+' : ''}{((user.stats.avg_clv || 0) * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-muted mt-2">
              {(user.stats.avg_clv || 0) > 0.01 ? 'Beating market' :
               (user.stats.avg_clv || 0) >= 0 ? 'At market' :
               'Behind market'}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              Positive CLV = long-term profit
            </div>
          </div>

          {/* Sharpe Ratio */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
            <div className="text-xs text-muted mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Sharpe Ratio
            </div>
            <div className={`text-2xl font-bold ${
              (user.stats.sharpe_ratio || 0) >= 2 ? 'text-emerald-400' :
              (user.stats.sharpe_ratio || 0) >= 1 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {(user.stats.sharpe_ratio || 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted mt-2">
              {(user.stats.sharpe_ratio || 0) >= 2 ? 'Excellent' :
               (user.stats.sharpe_ratio || 0) >= 1 ? 'Good' :
               (user.stats.sharpe_ratio || 0) >= 0.5 ? 'Fair' :
               'Needs improvement'}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              Risk-adjusted returns
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <div className="flex items-start gap-2 text-xs text-cyan-300">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-1">What these metrics mean:</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-cyan-400">EV:</strong> Average expected profit per $100 wagered. Pro bettors target 3-5%+</li>
                <li><strong className="text-cyan-400">CLV:</strong> Consistently beating closing line predicts long-term profitability</li>
                <li><strong className="text-cyan-400">Sharpe:</strong> Higher ratio = better returns for risk taken. Above 1.0 is good</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Sharp Play of the Day */}
      {sharpPlay && (
        <div className="card-glass border-amber-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-amber-500" />
            <div>
              <h2 className="text-2xl font-bold text-amber-500">Sharp Play of the Day</h2>
              <p className="text-sm text-muted">Our highest edge pick for today</p>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-slate-700/50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm text-muted mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(sharpPlay.commence_time).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-xl font-bold text-white mb-1">{sharpPlay.event_name}</div>
                <div className="text-lg text-amber-400 font-semibold">{sharpPlay.pick}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-amber-400">
                  {sharpPlay.odds > 0 ? '+' : ''}{sharpPlay.odds}
                </div>
                <div className="text-sm text-muted">Odds</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700/50">
              <div>
                <div className="text-xs text-muted">Edge</div>
                <div className="text-lg font-bold text-emerald-400">+{sharpPlay.edge.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted">Confidence</div>
                <div className="text-lg font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  {sharpPlay.confidence.toFixed(0)}/10
                </div>
              </div>
            </div>

            {sharpPlay.analysis_summary && (
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="text-sm text-secondary">{sharpPlay.analysis_summary}</div>
              </div>
            )}
          </div>

          <button
            onClick={lockSharpPlay}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Lock in Sharp Play
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card-glass">
        <h2 className="heading-sm mb-4">Quick Actions</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Link href="/generator" className="btn-primary flex items-center gap-2">
              <Dices className="w-4 h-4" />
              Generate New Parlay
            </Link>
            <Link href="/portfolio" className="btn-secondary flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              View All Bets
            </Link>
            <Link href="/leaderboard" className="btn-secondary flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Check Leaderboard
            </Link>
          </div>

          {/* Auto-Generate Quick Picks */}
          <div className="pt-4 border-t border-slate-700/50">
            <h3 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Quick Picks (Auto-Generate)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/generator?preset=conservative"
                className="px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Conservative
                </div>
                <div className="text-xs text-muted">2-3 legs, safe picks</div>
              </Link>
              <Link
                href="/generator?preset=balanced"
                className="px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1 flex items-center justify-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Balanced
                </div>
                <div className="text-xs text-muted">3-4 legs, mixed odds</div>
              </Link>
              <Link
                href="/generator?preset=aggressive"
                className="px-4 py-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-amber-500/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1 flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4 text-red-400" />
                  Aggressive
                </div>
                <div className="text-xs text-muted">5-6 legs, high payout</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bets */}
      <div className="card-glass">
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-sm">Recent Bets</h2>
          <Link href="/portfolio" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {bets.length === 0 ? (
          <div className="text-center py-8">
            <Dices className="w-16 h-16 text-gray-600 mx-auto mb-3" />
            <p className="text-muted mb-4">No bets yet. Ready to make your first play?</p>
            <Link href="/generator" className="btn-primary inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Your First Parlay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map(bet => (
              <Link
                key={bet.id}
                href={`/portfolio?bet=${bet.id}`}
                className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 border border-slate-700/50 hover:border-amber-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">{bet.legs.length}-Leg Parlay</span>
                      <span className={`${
                        bet.status === 'won' ? 'badge-success' :
                        bet.status === 'lost' ? 'badge-error' :
                        'badge-neutral'
                      } badge-xs`}>
                        {bet.status.toUpperCase()}
                      </span>
                      {bet.confidence && (
                        <span className="badge-info badge-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {bet.confidence.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted space-y-1">
                      {bet.legs.slice(0, 3).map((leg: any, i: number) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className="text-gray-600">•</span>
                          <span>{leg.pick}</span>
                        </div>
                      ))}
                      {bet.legs.length > 3 && (
                        <div className="text-xs text-gray-600">
                          + {bet.legs.length - 3} more legs
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-muted">Stake</div>
                    <div className="font-bold text-lg">{formatCurrency(bet.stake)}</div>
                    <div className="text-amber-400 text-sm">{bet.odds > 0 ? '+' : ''}{bet.odds}</div>
                    {bet.potential_return && (
                      <div className="text-xs text-muted">
                        To win {formatCurrency(bet.potential_return)}
                      </div>
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

      {/* Performance Insight */}
      {user.stats.total_bets >= 10 && (
        <div className="card-success">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Insight
          </h3>
          <p className="text-secondary">
            {user.stats.roi > 5 ? (
              <>You're crushing it! Your ROI of {user.stats.roi.toFixed(1)}% is elite. Keep up the sharp play.</>
            ) : user.stats.roi > 0 ? (
              <>Profitable so far! You're beating the market. Focus on high-confidence plays to increase your edge.</>
            ) : (
              <>Stay patient. Even sharp bettors have rough patches. Focus on edge over results.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
