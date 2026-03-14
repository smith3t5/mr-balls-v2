'use client';

import { useEffect, useState } from 'react';

type Period = 'daily' | 'weekly' | 'monthly' | 'all_time';

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('all_time');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadLeaderboard();
    loadCurrentUser();
  }, [period]);

  const loadLeaderboard = async () => {
    setLoading(true);

    // Load user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);

      // Calculate stats from bets
      const storedBets = localStorage.getItem('bets');
      const bets = storedBets ? JSON.parse(storedBets) : [];

      const wins = bets.filter((b: any) => b.status === 'won').length;
      const losses = bets.filter((b: any) => b.status === 'lost').length;
      const pushes = bets.filter((b: any) => b.status === 'push').length;
      const totalBets = bets.length;

      const totalWagered = bets.reduce((sum: number, b: any) => sum + (b.stake || 0), 0);
      const totalReturn = bets
        .filter((b: any) => b.status !== 'pending')
        .reduce((sum: number, b: any) => sum + (b.actual_return || 0), 0);
      const unitsProfit = totalReturn - totalWagered;
      const roi = totalWagered > 0 ? ((totalReturn - totalWagered) / totalWagered) * 100 : 0;

      // Calculate current streak
      let currentStreak = 0;
      const sortedBets = [...bets]
        .filter((b: any) => b.status !== 'pending')
        .sort((a: any, b: any) => b.settled_at - a.settled_at);

      for (const bet of sortedBets) {
        if (bet.status === 'won') {
          currentStreak++;
        } else if (bet.status === 'lost') {
          currentStreak--;
        } else {
          break;
        }
        if (Math.sign(currentStreak) !== Math.sign(bet.status === 'won' ? 1 : -1)) {
          break;
        }
      }

      const leaderboardEntry = {
        username: user.username,
        wins,
        losses,
        total_bets: totalBets,
        roi,
        units_profit: unitsProfit,
        sharp_score: user.stats?.sharp_score || 50.0,
        current_streak: currentStreak,
      };

      // For single user app, leaderboard is just the current user
      setLeaderboard([leaderboardEntry]);
    }

    setLoading(false);
  };

  const loadCurrentUser = async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getSharpBadge = (score: number) => {
    if (score >= 80) return { emoji: '💎', label: 'Diamond', color: 'text-blue-400' };
    if (score >= 70) return { emoji: '⭐', label: 'Elite', color: 'text-gold' };
    if (score >= 60) return { emoji: '🔥', label: 'Sharp', color: 'text-orange-400' };
    if (score >= 50) return { emoji: '📈', label: 'Rising', color: 'text-green-400' };
    return { emoji: '🌱', label: 'Developing', color: 'text-gray-400' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-gray-300 mt-1">Compete with the boys, track your rank</p>
      </div>

      {/* Period Selector */}
      <div className="card">
        <div className="flex gap-2">
          {[
            { key: 'daily', label: 'Today' },
            { key: 'weekly', label: 'This Week' },
            { key: 'monthly', label: 'This Month' },
            { key: 'all_time', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as Period)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === p.key
                  ? 'bg-gold text-primary-900'
                  : 'bg-primary-700 text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Your Rank */}
      {currentUser && (
        <div className="card bg-gradient-to-r from-gold/20 to-primary-700 border-gold/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">Your Rank</div>
              <div className="text-2xl font-bold">
                {leaderboard.findIndex(u => u.username === currentUser.username) + 1 || 'Unranked'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">ROI</div>
              <div className={`text-2xl font-bold ${currentUser.stats.roi >= 0 ? 'text-win' : 'text-loss'}`}>
                {currentUser.stats.roi >= 0 ? '+' : ''}{currentUser.stats.roi.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Sharp Score</div>
              <div className="text-2xl font-bold text-gold">
                {currentUser.stats.sharp_score.toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="text-gray-400">Loading rankings...</div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-bold mb-2">No rankings yet</h3>
          <p className="text-gray-400">Be the first to place a bet and climb the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((user, index) => {
            const rank = index + 1;
            const isCurrentUser = currentUser && user.username === currentUser.username;
            const badge = getSharpBadge(user.sharp_score);

            return (
              <div
                key={user.username}
                className={`card transition-all ${
                  isCurrentUser
                    ? 'border-gold ring-2 ring-gold/20 bg-gold/5'
                    : 'hover:border-primary-600'
                } ${rank <= 3 ? 'border-gold/30' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`text-3xl font-bold min-w-[60px] text-center ${
                    rank === 1 ? 'text-gold' :
                    rank === 2 ? 'text-gray-300' :
                    rank === 3 ? 'text-orange-400' :
                    'text-gray-500'
                  }`}>
                    {getRankEmoji(rank)}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">
                        {user.username}
                        {isCurrentUser && <span className="ml-2 text-gold text-sm">(You)</span>}
                      </span>
                      <span className={`text-xl ${badge.color}`} title={badge.label}>
                        {badge.emoji}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>
                        <span className="text-white">{user.wins}</span>
                        <span className="mx-1">-</span>
                        <span className="text-white">{user.losses}</span>
                      </span>
                      <span>•</span>
                      <span>{user.total_bets} bets</span>
                      <span>•</span>
                      <span>
                        Streak: {user.current_streak > 0 && '+'}{user.current_streak}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">ROI</div>
                      <div className={`text-xl font-bold ${user.roi >= 0 ? 'text-win' : 'text-loss'}`}>
                        {user.roi >= 0 ? '+' : ''}{user.roi.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Profit</div>
                      <div className={`text-xl font-bold ${user.units_profit >= 0 ? 'text-win' : 'text-loss'}`}>
                        {user.units_profit >= 0 ? '+' : ''}{user.units_profit.toFixed(1)}u
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Sharp Score</div>
                      <div className="text-xl font-bold text-gold">
                        {user.sharp_score.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explanation */}
      <div className="card bg-primary-700">
        <h3 className="font-bold mb-3">How Rankings Work</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <strong className="text-white">Primary Ranking:</strong> Return on Investment (ROI) -
            Your profit as a percentage of total amount wagered.
          </p>
          <p>
            <strong className="text-white">Sharp Score:</strong> Measures the quality of your bets based on:
          </p>
          <ul className="ml-6 space-y-1 text-gray-400">
            <li>• Average edge (line value vs market)</li>
            <li>• Betting on high-confidence plays</li>
            <li>• Following sharp money indicators</li>
            <li>• Avoiding public traps</li>
            <li>• Consistency over time</li>
          </ul>
          <p className="pt-2 text-gray-400 italic">
            A 70+ sharp score indicates elite handicapping ability. Most professionals maintain 60-75.
          </p>
        </div>
      </div>

      {/* Badge Legend */}
      <div className="card bg-primary-700">
        <h3 className="font-bold mb-3">Sharp Badges</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl mb-1">💎</div>
            <div className="font-semibold text-blue-400">Diamond</div>
            <div className="text-xs text-gray-400">80+ Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">⭐</div>
            <div className="font-semibold text-gold">Elite</div>
            <div className="text-xs text-gray-400">70-79 Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">🔥</div>
            <div className="font-semibold text-orange-400">Sharp</div>
            <div className="text-xs text-gray-400">60-69 Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">📈</div>
            <div className="font-semibold text-green-400">Rising</div>
            <div className="text-xs text-gray-400">50-59 Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">🌱</div>
            <div className="font-semibold text-gray-400">Developing</div>
            <div className="text-xs text-gray-400">&lt;50 Score</div>
          </div>
        </div>
      </div>
    </div>
  );
}
