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
