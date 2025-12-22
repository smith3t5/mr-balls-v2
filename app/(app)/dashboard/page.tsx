'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user.username}</h1>
        <p className="text-gray-300 mt-1">Here's your performance overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label">Record</div>
          <div className="stat-value">
            <span className="text-white">{user.stats.wins}</span>
            <span className="text-white mx-1">-</span>
            <span className="text-white">{user.stats.losses}</span>
          </div>
          <div className="text-xs text-white/80 mt-1">
            {user.stats.total_bets} total bets
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">ROI</div>
          <div className={`stat-value ${user.stats.roi >= 0 ? 'text-win' : 'text-loss'}`}>
            {user.stats.roi >= 0 ? '+' : ''}{user.stats.roi.toFixed(1)}%
          </div>
          <div className="text-xs text-white/80 mt-1">
            {user.stats.units_profit >= 0 ? '+' : ''}{user.stats.units_profit.toFixed(2)} units
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Current Streak</div>
          <div className={`stat-value ${
            user.stats.current_streak > 0 ? 'text-win' :
            user.stats.current_streak < 0 ? 'text-loss' :
            'text-white'
          }`}>
            {user.stats.current_streak > 0 && '+'}{user.stats.current_streak}
          </div>
          <div className="text-xs text-white/80 mt-1">
            Best: {user.stats.longest_win_streak}W
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Sharp Score</div>
          <div className="stat-value text-gold">
            {user.stats.sharp_score.toFixed(0)}<span className="text-xl text-white">/100</span>
          </div>
          <div className="text-xs text-white/80 mt-1">
            {user.stats.sharp_score >= 70 ? 'Elite' :
             user.stats.sharp_score >= 50 ? 'Sharp' :
             user.stats.sharp_score >= 30 ? 'Improving' : 'Developing'}
          </div>
        </div>
      </div>

      {/* Sharp Play of the Day */}
      {sharpPlay && (
        <div className="card bg-gradient-to-br from-gold/10 via-primary-800 to-primary-700 border-2 border-gold/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl">⚡</span>
            <div>
              <h2 className="text-2xl font-bold text-gold">Sharp Play of the Day</h2>
              <p className="text-sm text-gray-300">Our highest edge pick for today</p>
            </div>
          </div>

          <div className="bg-primary-900/50 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm text-gray-400 mb-1">
                  {new Date(sharpPlay.commence_time).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-xl font-bold text-white mb-1">{sharpPlay.event_name}</div>
                <div className="text-lg text-gold font-semibold">{sharpPlay.pick}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gold">
                  {sharpPlay.odds > 0 ? '+' : ''}{sharpPlay.odds}
                </div>
                <div className="text-sm text-gray-400">Odds</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700">
              <div>
                <div className="text-xs text-gray-400">Edge</div>
                <div className="text-lg font-bold text-win">+{sharpPlay.edge.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Confidence</div>
                <div className="text-lg font-bold text-gold">
                  {sharpPlay.confidence.toFixed(0)}/10
                </div>
              </div>
            </div>

            {sharpPlay.analysis_summary && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-sm text-gray-300">{sharpPlay.analysis_summary}</div>
              </div>
            )}
          </div>

          <button
            onClick={lockSharpPlay}
            className="w-full btn-primary bg-gradient-to-r from-gold to-gold-light hover:from-gold-light hover:to-gold"
          >
            🔒 Lock in Sharp Play
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Link href="/generator" className="btn-primary">
              🎲 Generate New Parlay
            </Link>
            <Link href="/portfolio" className="btn-secondary">
              💼 View All Bets
            </Link>
            <Link href="/leaderboard" className="btn-secondary">
              🏆 Check Leaderboard
            </Link>
          </div>

          {/* Auto-Generate Quick Picks */}
          <div className="pt-4 border-t border-primary-700">
            <h3 className="text-sm font-semibold text-white mb-3">⚡ Quick Picks (Auto-Generate)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/generator?preset=conservative"
                className="px-4 py-3 rounded-lg bg-primary-700 hover:bg-primary-600 border border-primary-600 hover:border-gold/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1">🛡️ Conservative</div>
                <div className="text-xs text-white/80">2-3 legs, safe picks</div>
              </Link>
              <Link
                href="/generator?preset=balanced"
                className="px-4 py-3 rounded-lg bg-primary-700 hover:bg-primary-600 border border-primary-600 hover:border-gold/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1">⚖️ Balanced</div>
                <div className="text-xs text-white/80">3-4 legs, mixed odds</div>
              </Link>
              <Link
                href="/generator?preset=aggressive"
                className="px-4 py-3 rounded-lg bg-primary-700 hover:bg-primary-600 border border-primary-600 hover:border-gold/50 transition-all text-center"
              >
                <div className="font-bold text-white mb-1">🔥 Aggressive</div>
                <div className="text-xs text-white/80">5-6 legs, high payout</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Bets</h2>
          <Link href="/portfolio" className="text-sm text-gold hover:text-gold-light">
            View all →
          </Link>
        </div>

        {bets.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🎲</div>
            <p className="text-gray-400 mb-4">No bets yet. Ready to make your first play?</p>
            <Link href="/generator" className="btn-primary inline-block">
              Generate Your First Parlay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map(bet => (
              <Link
                key={bet.id}
                href={`/portfolio?bet=${bet.id}`}
                className="block p-4 bg-primary-700 rounded-xl hover:bg-primary-600 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{bet.legs.length}-Leg Parlay</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        bet.status === 'won' ? 'bg-win/20 text-win' :
                        bet.status === 'lost' ? 'bg-loss/20 text-loss' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {bet.status.toUpperCase()}
                      </span>
                      {bet.confidence && (
                        <span className="text-xs text-gold">
                          {'⭐'.repeat(Math.round(bet.confidence / 2))}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {bet.legs.map((leg: any, i: number) => (
                        <div key={i}>• {leg.pick}</div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-gray-400">Stake</div>
                    <div className="font-bold text-lg">${bet.stake.toFixed(0)}</div>
                    <div className="text-gold text-sm">{bet.odds > 0 ? '+' : ''}{bet.odds}</div>
                    {bet.potential_return && (
                      <div className="text-xs text-gray-400">
                        To win ${bet.potential_return.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
                {bet.created_at && (
                  <div className="text-xs text-gray-400 mt-2">
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
        <div className="card bg-gradient-to-r from-primary-800 to-primary-700">
          <h3 className="text-lg font-bold mb-2">Performance Insight</h3>
          <p className="text-gray-300">
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
