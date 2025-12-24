'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { generateParlayShareText } from '@/lib/draftkings-links';

export default function Portfolio() {
  const searchParams = useSearchParams();
  const highlightBetId = searchParams.get('bet');

  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
  const [selectedBet, setSelectedBet] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingLeg, setUpdatingLeg] = useState<string | null>(null);

  useEffect(() => {
    loadBets();
  }, [filter]);

  useEffect(() => {
    if (highlightBetId) {
      const bet = bets.find(b => b.id === highlightBetId);
      if (bet) setSelectedBet(bet);
    }
  }, [highlightBetId, bets]);

  const loadBets = async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/bets' : `/api/bets?status=${filter}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.success) {
      setBets(data.bets);
    }
    setLoading(false);
  };

  const updateBetStatus = async (betId: string, status: 'won' | 'lost' | 'push') => {
    setUpdating(true);
    try {
      const bet = bets.find(b => b.id === betId);
      const actualReturn = status === 'won' ? bet.potential_return : 0;

      const response = await fetch(`/api/bets/${betId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actual_return: actualReturn }),
      });

      if (response.ok) {
        await loadBets();
        setSelectedBet(null);
      }
    } catch (err) {
      console.error('Failed to update bet:', err);
    } finally {
      setUpdating(false);
    }
  };

  const deleteBet = async (betId: string) => {
    if (!confirm('Are you sure you want to delete this bet? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/bets/${betId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadBets();
        setSelectedBet(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete bet');
      }
    } catch (err) {
      console.error('Failed to delete bet:', err);
      alert('Failed to delete bet');
    } finally {
      setDeleting(false);
    }
  };

  const updateLegStatus = async (legId: string, status: 'won' | 'lost' | 'push') => {
    setUpdatingLeg(legId);
    try {
      const response = await fetch(`/api/bets/legs/${legId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadBets();
        // Show message if parlay was auto-updated
        if (data.parlay_auto_updated) {
          alert(`✅ Leg marked as ${status}! Parlay automatically updated to: ${data.parlay_status}`);
        }
      } else {
        alert(data.error || 'Failed to update leg');
      }
    } catch (err) {
      console.error('Failed to update leg:', err);
      alert('Failed to update leg');
    } finally {
      setUpdatingLeg(null);
    }
  };

  const shareBet = (bet: any) => {
    const parlayOdds = bet.legs.reduce((acc: number, leg: any) => {
      const decimalOdds = leg.odds > 0 ? 1 + leg.odds / 100 : 1 + 100 / Math.abs(leg.odds);
      return acc * decimalOdds;
    }, 1);
    const americanOdds = parlayOdds >= 2 ? Math.round((parlayOdds - 1) * 100) : -Math.round(100 / (parlayOdds - 1));

    const shareText = generateParlayShareText({
      legs: bet.legs.map((leg: any) => ({
        event_name: leg.event_name,
        pick: leg.pick,
        odds: leg.odds,
      })),
      parlay_odds: americanOdds,
    });

    const fullText = `${shareText}\n\n📋 Tail this bet: Bet ID ${bet.id}`;

    navigator.clipboard.writeText(fullText).then(() => {
      alert('Bet copied to clipboard! Share with the boys and they can tail it.');
    }).catch(() => {
      alert(fullText);
    });
  };

  const tailBet = async () => {
    const betId = prompt('Enter the Bet ID you want to tail:');
    if (!betId) return;

    try {
      const response = await fetch('/api/bets/tail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet_id: betId.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet tailed successfully! Check your portfolio.');
        await loadBets();
      } else {
        alert(data.error || 'Failed to tail bet');
      }
    } catch (err) {
      alert('Failed to tail bet');
    }
  };

  const stats = {
    total: bets.length,
    pending: bets.filter(b => b.status === 'pending').length,
    won: bets.filter(b => b.status === 'won').length,
    lost: bets.filter(b => b.status === 'lost').length,
    totalWagered: bets.reduce((sum, b) => sum + b.stake, 0),
    totalReturn: bets.reduce((sum, b) => sum + (b.actual_return || 0), 0),
  };

  const profit = stats.totalReturn - stats.totalWagered;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bet Portfolio</h1>
          <p className="text-gray-300 mt-1">Track and manage all your bets</p>
        </div>
        <button
          onClick={tailBet}
          className="px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 text-white font-semibold transition-colors"
        >
          🎯 Tail a Bet
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="stat-label">Total Bets</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value text-gray-400">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Won</div>
          <div className="stat-value text-white">{stats.won}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Lost</div>
          <div className="stat-value text-white">{stats.lost}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit/Loss</div>
          <div className={`stat-value ${profit >= 0 ? 'text-win' : 'text-loss'}`}>
            {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card">
        <div className="flex gap-2">
          {['all', 'pending', 'won', 'lost'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-gold text-primary-900'
                  : 'bg-primary-700 text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bets List */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="text-gray-400">Loading bets...</div>
        </div>
      ) : bets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">💼</div>
          <h3 className="text-xl font-bold mb-2">No bets found</h3>
          <p className="text-gray-400">
            {filter === 'all'
              ? "You haven't placed any bets yet"
              : `No ${filter} bets`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className={`card cursor-pointer transition-all ${
                selectedBet?.id === bet.id
                  ? 'border-gold ring-2 ring-gold/20'
                  : 'hover:border-primary-600'
              }`}
              onClick={() => setSelectedBet(selectedBet?.id === bet.id ? null : bet)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-bold text-lg">{bet.legs.length}-Leg Parlay</span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      bet.status === 'won' ? 'bg-win/20 text-win' :
                      bet.status === 'lost' ? 'bg-loss/20 text-loss' :
                      bet.status === 'push' ? 'bg-gray-700 text-gray-400' :
                      'bg-gold/20 text-gold'
                    }`}>
                      {bet.status.toUpperCase()}
                    </span>
                    {bet.confidence && (
                      <span className="text-sm text-gold">
                        {'⭐'.repeat(Math.round(bet.confidence / 2))} {bet.confidence.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Legs Preview */}
                  <div className="space-y-1">
                    {bet.legs.slice(0, selectedBet?.id === bet.id ? bet.legs.length : 2).map((leg: any, i: number) => (
                      <div key={i} className="text-sm">
                        <span className="text-gray-400">• </span>
                        <span className="font-medium">{leg.pick}</span>
                        <span className="text-gray-500 ml-2">({leg.odds > 0 ? '+' : ''}{leg.odds})</span>
                      </div>
                    ))}
                    {bet.legs.length > 2 && selectedBet?.id !== bet.id && (
                      <div className="text-sm text-gray-500">+ {bet.legs.length - 2} more</div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {selectedBet?.id === bet.id && (
                    <div className="mt-4 pt-4 border-t border-primary-700 space-y-3">
                      {bet.legs.map((leg: any, i: number) => (
                        <div key={i} className="bg-primary-700 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-xs text-gray-500">LEG {i + 1}</div>
                                {/* Leg Status Indicator */}
                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                  leg.status === 'won' ? 'bg-win/20 text-win' :
                                  leg.status === 'lost' ? 'bg-loss/20 text-loss' :
                                  leg.status === 'push' ? 'bg-gray-600 text-gray-300' :
                                  'bg-gold/20 text-gold'
                                }`}>
                                  {leg.status === 'won' ? '✅ Won' :
                                   leg.status === 'lost' ? '❌ Lost' :
                                   leg.status === 'push' ? '🔄 Push' :
                                   '⏳ Pending'}
                                </span>
                              </div>
                              <div className="font-semibold">{leg.event_name}</div>
                              <div className="text-gold text-sm mt-1">{leg.pick}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{leg.odds > 0 ? '+' : ''}{leg.odds}</div>
                              {leg.analytics?.edge && (
                                <div className="text-xs text-win mt-1">
                                  {leg.analytics.edge.toFixed(1)}% edge
                                </div>
                              )}
                            </div>
                          </div>
                          {leg.analytics?.factors && leg.analytics.factors.length > 0 && (
                            <div className="space-y-1 mt-2 pt-2 border-t border-primary-600">
                              {leg.analytics.factors.slice(0, 3).map((factor: any, j: number) => (
                                <div key={j} className="text-xs flex items-start gap-1">
                                  <span>
                                    {factor.type === 'positive' ? '✅' :
                                     factor.type === 'negative' ? '⚠️' : 'ℹ️'}
                                  </span>
                                  <span className="text-gray-400">{factor.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {leg.dk_link && (
                            <div className="mt-2">
                              <a
                                href={leg.dk_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#53d337] to-[#3aa82a] hover:from-[#3aa82a] hover:to-[#53d337] text-white text-sm font-bold transition-all"
                              >
                                <span>🎰</span>
                                <span>View on DraftKings</span>
                              </a>
                            </div>
                          )}

                          {/* Leg Status Update Buttons (only for pending bets) */}
                          {bet.status === 'pending' && leg.status === 'pending' && (
                            <div className="mt-3 pt-3 border-t border-primary-600">
                              <div className="text-xs text-gray-500 mb-2">Mark this leg:</div>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLegStatus(leg.id, 'won');
                                  }}
                                  disabled={updatingLeg === leg.id}
                                  className="flex-1 px-2 py-1 rounded text-xs bg-win/20 text-win hover:bg-win/30 font-semibold disabled:opacity-50"
                                >
                                  ✅ Won
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLegStatus(leg.id, 'lost');
                                  }}
                                  disabled={updatingLeg === leg.id}
                                  className="flex-1 px-2 py-1 rounded text-xs bg-loss/20 text-loss hover:bg-loss/30 font-semibold disabled:opacity-50"
                                >
                                  ❌ Lost
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLegStatus(leg.id, 'push');
                                  }}
                                  disabled={updatingLeg === leg.id}
                                  className="flex-1 px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 font-semibold disabled:opacity-50"
                                >
                                  🔄 Push
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {bet.notes && (
                        <div className="text-sm text-gray-400 italic">
                          Note: {bet.notes}
                        </div>
                      )}

                      {/* Action Buttons for Pending Bets */}
                      {bet.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBetStatus(bet.id, 'won');
                            }}
                            disabled={updating}
                            className="flex-1 px-4 py-2 rounded-lg bg-win/20 text-win hover:bg-win/30 font-semibold"
                          >
                            ✅ Mark Won
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBetStatus(bet.id, 'lost');
                            }}
                            disabled={updating}
                            className="flex-1 px-4 py-2 rounded-lg bg-loss/20 text-loss hover:bg-loss/30 font-semibold"
                          >
                            ❌ Mark Lost
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBetStatus(bet.id, 'push');
                            }}
                            disabled={updating}
                            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 font-semibold"
                          >
                            Push
                          </button>
                        </div>
                      )}

                      {/* Share and Delete Buttons */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareBet(bet);
                          }}
                          className="flex-1 px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 text-white font-semibold transition-colors"
                        >
                          📱 Share Bet
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBet(bet.id);
                          }}
                          disabled={deleting}
                          className="px-4 py-2 rounded-lg bg-loss/20 text-loss hover:bg-loss/30 font-semibold transition-colors disabled:opacity-50"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side - Stakes & Returns */}
                <div className="text-right ml-6">
                  <div className="text-sm text-gray-400 mb-1">Stake</div>
                  <div className="font-bold text-xl">${bet.stake.toFixed(0)}</div>
                  <div className="text-gold text-sm mt-1">
                    {bet.odds > 0 ? '+' : ''}{bet.odds}
                  </div>
                  {bet.potential_return && (
                    <div className="text-xs text-gray-500 mt-2">
                      To win ${bet.potential_return.toFixed(0)}
                    </div>
                  )}
                  {bet.actual_return > 0 && (
                    <div className="text-sm text-win font-bold mt-2">
                      Won ${bet.actual_return.toFixed(0)}
                    </div>
                  )}
                  {bet.created_at && (
                    <div className="text-xs text-gray-600 mt-2">
                      {new Date(bet.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
