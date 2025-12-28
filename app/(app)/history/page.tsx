'use client';

import { useEffect, useState } from 'react';
import { History, CheckCircle2, XCircle, Minus, Calendar, TrendingUp, Target, DollarSign, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BetWithLegs {
  bet: any;
  legs: any[];
}

export default function HistoryPage() {
  const [bets, setBets] = useState<BetWithLegs[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost' | 'push'>('all');

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      const response = await fetch('/api/bets?limit=50');
      const data = await response.json();

      if (data.success) {
        setBets(data.bets);
      }
    } catch (error) {
      toast.error('Failed to load bet history');
    } finally {
      setLoading(false);
    }
  };

  const markOutcome = async (betId: string, status: 'won' | 'lost' | 'push') => {
    setUpdating(betId);
    try {
      const response = await fetch(`/api/bets/${betId}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Bet marked as ${status}!`);
        loadBets(); // Reload bets
      } else {
        toast.error(data.error || 'Failed to update bet');
      }
    } catch (error) {
      toast.error('Failed to update bet outcome');
    } finally {
      setUpdating(null);
    }
  };

  const filteredBets = bets.filter(({ bet }) => {
    if (filter === 'all') return true;
    return bet.status === filter;
  });

  const stats = {
    total: bets.length,
    pending: bets.filter(({ bet }) => bet.status === 'pending').length,
    won: bets.filter(({ bet }) => bet.status === 'won').length,
    lost: bets.filter(({ bet }) => bet.status === 'lost').length,
    push: bets.filter(({ bet }) => bet.status === 'push').length,
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton-title mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card h-24" />
          ))}
        </div>
        <div className="skeleton-card h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="heading-lg flex items-center gap-3">
          <History className="w-8 h-8 text-amber-500" />
          Bet History
        </h1>
        <p className="text-muted mt-2">Track your bets and record outcomes for performance analysis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="stat-label">Total Bets</div>
          <div className="stat-value-sm text-white">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value-sm text-amber-400">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Won</div>
          <div className="stat-value-sm text-emerald-400">{stats.won}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Lost</div>
          <div className="stat-value-sm text-red-400">{stats.lost}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Push</div>
          <div className="stat-value-sm text-gray-400">{stats.push}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'won', 'lost', 'push'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              filter === f
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 opacity-75">
                ({f === 'pending' ? stats.pending : f === 'won' ? stats.won : f === 'lost' ? stats.lost : stats.push})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bets List */}
      <div className="space-y-4">
        {filteredBets.length === 0 ? (
          <div className="card-glass text-center py-12">
            <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No bets found</h3>
            <p className="text-gray-500">
              {filter === 'all' ? 'Start generating parlays to build your history' : `No ${filter} bets`}
            </p>
          </div>
        ) : (
          filteredBets.map(({ bet, legs }) => (
            <div key={bet.id} className="card-glass">
              {/* Bet Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{legs.length}-Leg Parlay</h3>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      bet.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' :
                      bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                      bet.status === 'push' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {bet.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(bet.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      ${bet.stake.toFixed(2)} stake
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {bet.odds > 0 ? '+' : ''}{bet.odds} odds
                    </span>
                  </div>
                </div>

                {/* Action Buttons (only for pending bets) */}
                {bet.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => markOutcome(bet.id, 'won')}
                      disabled={updating === bet.id}
                      className="btn-xs bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Won
                    </button>
                    <button
                      onClick={() => markOutcome(bet.id, 'lost')}
                      disabled={updating === bet.id}
                      className="btn-xs bg-red-500 hover:bg-red-600 text-white flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Lost
                    </button>
                    <button
                      onClick={() => markOutcome(bet.id, 'push')}
                      disabled={updating === bet.id}
                      className="btn-xs bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-1"
                    >
                      <Minus className="w-4 h-4" />
                      Push
                    </button>
                  </div>
                )}

                {/* Result Display (for settled bets) */}
                {bet.status !== 'pending' && bet.actual_return !== null && (
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      bet.status === 'won' ? 'text-emerald-400' :
                      bet.status === 'lost' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {bet.status === 'won' && '+'}
                      ${(bet.actual_return - bet.stake).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {((bet.actual_return - bet.stake) / bet.stake * 100).toFixed(1)}% ROI
                    </div>
                  </div>
                )}
              </div>

              {/* Legs */}
              <div className="space-y-3">
                {legs.map((leg: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-400">LEG {i + 1}</span>
                          <span className="text-xs text-gray-500">
                            {leg.sport.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-white mb-1">{leg.event_name}</h4>
                        <p className="text-sm text-amber-400">{leg.pick}</p>
                        {leg.expected_value && (
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                            <span>EV: {leg.expected_value >= 0 ? '+' : ''}{leg.expected_value.toFixed(1)}%</span>
                            {leg.clv && (
                              <span className={leg.clv > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                CLV: {leg.clv >= 0 ? '+' : ''}{(leg.clv * 100).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-white">
                          {leg.odds > 0 ? '+' : ''}{leg.odds}
                        </div>
                        {leg.bet_grade && (
                          <div className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black mt-1 ${
                            leg.bet_grade === 'S' ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900' :
                            leg.bet_grade === 'A' ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white' :
                            leg.bet_grade === 'B' ? 'bg-gradient-to-br from-blue-400 to-cyan-500 text-white' :
                            'bg-gradient-to-br from-slate-400 to-slate-500 text-white'
                          }`}>
                            {leg.bet_grade}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confidence & Edge */}
              {bet.confidence && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">
                      Confidence: <span className="text-amber-400 font-semibold">{bet.confidence.toFixed(1)}/10</span>
                    </span>
                    {bet.avg_edge && (
                      <span className="text-gray-400">
                        Avg Edge: <span className="text-emerald-400 font-semibold">{bet.avg_edge.toFixed(1)}%</span>
                      </span>
                    )}
                  </div>
                  {bet.potential_return && (
                    <span className="text-gray-400">
                      Potential: <span className="text-white font-semibold">${bet.potential_return.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
