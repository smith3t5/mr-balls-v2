'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Share2,
  Trash2,
  RefreshCw,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';
import { generateParlayShareText } from '@/lib/draftkings-links';
import { formatCurrency } from '@/lib/utils';

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
  const [autoChecking, setAutoChecking] = useState(false);
  const [showManualBetModal, setShowManualBetModal] = useState(false);

  // Manual bet entry state
  const [betType, setBetType] = useState<'single' | 'parlay'>('single');
  const [legs, setLegs] = useState<Array<{
    sport: string;
    eventDate: string;
    eventName: string;
    pick: string;
    odds: string;
  }>>([{
    sport: 'NFL',
    eventDate: '',
    eventName: '',
    pick: '',
    odds: ''
  }]);
  const [stake, setStake] = useState('');
  const [sportsbook, setSportsbook] = useState('');
  const [betLink, setBetLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingManualBet, setSubmittingManualBet] = useState(false);

  // Cashout modal state
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutBetId, setCashoutBetId] = useState<string | null>(null);
  const [cashoutStatus, setCashoutStatus] = useState<'won' | 'lost' | 'push'>('won');
  const [cashoutAmount, setCashoutAmount] = useState('');

  useEffect(() => {
    loadBets();
  }, [filter]);

  useEffect(() => {
    if (highlightBetId) {
      const bet = bets.find((b) => b.id === highlightBetId);
      if (bet) setSelectedBet(bet);
    }
  }, [highlightBetId, bets]);

  const loadBets = async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/bets' : `/api/bets?status=${filter}`;
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    if (data.success) {
      setBets(data.bets);
    }
    setLoading(false);
  };

  const autoCheckResults = async () => {
    setAutoChecking(true);
    try {
      const response = await fetch('/api/bets/auto-check', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        await loadBets();
        if (data.legs_updated > 0) {
          toast.success(
            `Auto-check complete! ${data.legs_updated} legs updated, ${data.bets_settled} bets settled`,
            { duration: 5000 }
          );
        } else {
          toast.success('All bets are up to date!');
        }
      } else {
        toast.error(data.error || 'Failed to auto-check');
      }
    } catch (err) {
      console.error('Auto-check error:', err);
      toast.error('Failed to auto-check results');
    } finally {
      setAutoChecking(false);
    }
  };

  const openCashoutModal = (betId: string, status: 'won' | 'lost' | 'push') => {
    const bet = bets.find((b) => b.id === betId);
    if (!bet) return; // Safety check

    setCashoutBetId(betId);
    setCashoutStatus(status);
    // Pre-fill with potential return for won, 0 for lost, stake for push
    const defaultAmount = status === 'won' ? bet.potential_return : status === 'push' ? bet.stake : 0;
    setCashoutAmount(defaultAmount.toString());
    setShowCashoutModal(true);
  };

  const updateBetStatus = async () => {
    if (!cashoutBetId) return;

    const amount = parseFloat(cashoutAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/bets/${cashoutBetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: cashoutStatus, actual_return: amount }),
      });

      if (response.ok) {
        await loadBets();
        setSelectedBet(null);
        setShowCashoutModal(false);
        setCashoutBetId(null);
        toast.success(`Bet marked as ${cashoutStatus}`);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update bet');
      }
    } catch (err) {
      console.error('Failed to update bet:', err);
      toast.error('Failed to update bet');
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
        credentials: 'include',
      });

      if (response.ok) {
        await loadBets();
        setSelectedBet(null);
        toast.success('Bet deleted successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete bet');
      }
    } catch (err) {
      console.error('Failed to delete bet:', err);
      toast.error('Failed to delete bet');
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
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadBets();
        if (data.parlay_auto_updated) {
          toast.success(
            `Leg marked as ${status}! Parlay automatically updated to: ${data.parlay_status}`,
            { duration: 5000 }
          );
        } else {
          toast.success(`Leg marked as ${status}`);
        }
      } else {
        toast.error(data.error || 'Failed to update leg');
      }
    } catch (err) {
      console.error('Failed to update leg:', err);
      toast.error('Failed to update leg');
    } finally {
      setUpdatingLeg(null);
    }
  };

  const shareBet = (bet: any) => {
    const parlayOdds = bet.legs.reduce((acc: number, leg: any) => {
      const decimalOdds = leg.odds > 0 ? 1 + leg.odds / 100 : 1 + 100 / Math.abs(leg.odds);
      return acc * decimalOdds;
    }, 1);
    const americanOdds =
      parlayOdds >= 2 ? Math.round((parlayOdds - 1) * 100) : -Math.round(100 / (parlayOdds - 1));

    const shareText = generateParlayShareText({
      legs: bet.legs.map((leg: any) => ({
        event_name: leg.event_name,
        pick: leg.pick,
        odds: leg.odds,
      })),
      parlay_odds: americanOdds,
    });

    const fullText = `${shareText}\n\nTail this bet: Bet ID ${bet.id}`;

    navigator.clipboard.writeText(fullText).then(() => {
      toast.success('Bet copied to clipboard! Share with the boys');
    }).catch(() => {
      toast.error('Failed to copy. Try again.');
    });
  };

  const tailBet = async () => {
    const betId = prompt('Enter the Bet ID you want to tail:');
    if (!betId) return;

    try {
      const response = await fetch('/api/bets/tail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bet_id: betId.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Bet tailed successfully! Check your portfolio');
        await loadBets();
      } else {
        toast.error(data.error || 'Failed to tail bet');
      }
    } catch (err) {
      toast.error('Failed to tail bet');
    }
  };

  // Manual bet entry functions
  const resetManualBetForm = () => {
    setBetType('single');
    setLegs([{
      sport: 'NFL',
      eventDate: '',
      eventName: '',
      pick: '',
      odds: ''
    }]);
    setStake('');
    setSportsbook('');
    setBetLink('');
    setNotes('');
  };

  const addLeg = () => {
    setLegs([...legs, {
      sport: 'NFL',
      eventDate: '',
      eventName: '',
      pick: '',
      odds: ''
    }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter((_, i) => i !== index));
    }
  };

  const updateLeg = (index: number, field: keyof typeof legs[0], value: string) => {
    const newLegs = [...legs];
    newLegs[index] = { ...newLegs[index], [field]: value };
    setLegs(newLegs);
  };

  const handleManualBetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!stake || parseFloat(stake) <= 0) {
      toast.error('Please enter a valid stake amount');
      return;
    }

    if (legs.some(leg => !leg.eventName || !leg.pick || !leg.odds)) {
      toast.error('Please fill in all leg details');
      return;
    }

    // Calculate parlay odds
    let parlayOdds = 1;
    for (const leg of legs) {
      const odds = parseFloat(leg.odds);
      const decimalOdds = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
      parlayOdds *= decimalOdds;
    }
    const americanOdds = parlayOdds >= 2
      ? Math.round((parlayOdds - 1) * 100)
      : -Math.round(100 / (parlayOdds - 1));

    const potentialReturn = parseFloat(stake) * parlayOdds;

    setSubmittingManualBet(true);
    try {
      const response = await fetch('/api/bets/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bet_type: betType,
          legs: legs.map(leg => ({
            sport: leg.sport,
            event_date: leg.eventDate,
            event_name: leg.eventName,
            pick: leg.pick,
            odds: parseFloat(leg.odds),
          })),
          stake: parseFloat(stake),
          odds: americanOdds,
          potential_return: potentialReturn,
          sportsbook,
          bet_link: betLink || null,
          notes: notes || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${betType === 'single' ? 'Bet' : 'Parlay'} added successfully!`);
        await loadBets();
        setShowManualBetModal(false);
        resetManualBetForm();
      } else {
        toast.error(data.error || 'Failed to add bet');
      }
    } catch (err) {
      console.error('Failed to submit manual bet:', err);
      toast.error('Failed to add bet');
    } finally {
      setSubmittingManualBet(false);
    }
  };

  const stats = {
    total: bets.length,
    pending: bets.filter((b) => b.status === 'pending').length,
    won: bets.filter((b) => b.status === 'won').length,
    lost: bets.filter((b) => b.status === 'lost').length,
    totalWagered: bets.reduce((sum, b) => sum + b.stake, 0),
    totalReturn: bets.reduce((sum, b) => sum + (b.actual_return || 0), 0),
  };

  const profit = stats.totalReturn - stats.totalWagered;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-lg flex items-center gap-3">
            <Wallet className="w-8 h-8 text-amber-500" />
            Bet Portfolio
          </h1>
          <p className="text-muted mt-2">Track and manage all your bets</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={autoCheckResults}
            disabled={autoChecking || loading}
            className="btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${autoChecking ? 'animate-spin' : ''}`} />
            {autoChecking ? 'Checking...' : 'Auto-Check Results'}
          </button>
          <button
            onClick={() => setShowManualBetModal(true)}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Bet
          </button>
          <button onClick={tailBet} className="btn-secondary btn-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Tail a Bet
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="stat-label">Total Bets</div>
          <div className="stat-value-sm">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </div>
          <div className="stat-value-sm text-amber-400">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Won
          </div>
          <div className="stat-value-sm text-emerald-400">{stats.won}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Lost
          </div>
          <div className="stat-value-sm text-red-400">{stats.lost}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit/Loss</div>
          <div
            className={`stat-value-sm flex items-center gap-1 ${
              profit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatCurrency(profit)}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card-glass">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 shadow-lg'
                  : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card h-48" />
          ))}
        </div>
      ) : bets.length === 0 ? (
        /* Empty State */
        <div className="card-glass text-center py-16">
          <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="heading-sm mb-2">No bets found</h3>
          <p className="text-muted">
            {filter === 'all' ? "You haven't placed any bets yet" : `No ${filter} bets`}
          </p>
        </div>
      ) : (
        /* Bets List */
        <div className="space-y-4">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className={`card-interactive ${
                selectedBet?.id === bet.id ? 'border-amber-500/50 shadow-2xl' : ''
              }`}
              onClick={() => setSelectedBet(selectedBet?.id === bet.id ? null : bet)}
            >
              {/* Bet Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="heading-sm">{bet.legs.length}-Leg Parlay</span>
                    <span
                      className={`${
                        bet.status === 'won'
                          ? 'badge-success'
                          : bet.status === 'lost'
                          ? 'badge-error'
                          : bet.status === 'push'
                          ? 'badge-neutral'
                          : 'badge-warning'
                      }`}
                    >
                      {bet.status === 'won' && <CheckCircle2 className="w-3 h-3" />}
                      {bet.status === 'lost' && <XCircle className="w-3 h-3" />}
                      {bet.status === 'push' && <RotateCw className="w-3 h-3" />}
                      {bet.status === 'pending' && <Clock className="w-3 h-3" />}
                      {bet.status.toUpperCase()}
                    </span>
                    {bet.confidence && (
                      <span className="badge-info">
                        <Sparkles className="w-3 h-3" />
                        {bet.confidence.toFixed(1)}/10
                      </span>
                    )}
                  </div>

                  {/* Legs Preview */}
                  <div className="space-y-1.5">
                    {bet.legs
                      .slice(0, selectedBet?.id === bet.id ? bet.legs.length : 2)
                      .map((leg: any, i: number) => (
                        <div key={i} className="text-sm text-secondary flex items-center gap-2">
                          <span className="text-gray-500">•</span>
                          <span className="font-medium">{leg.pick}</span>
                          <span className="text-muted">
                            ({leg.odds > 0 ? '+' : ''}
                            {leg.odds})
                          </span>
                        </div>
                      ))}
                    {bet.legs.length > 2 && selectedBet?.id !== bet.id && (
                      <div className="text-sm text-muted flex items-center gap-1">
                        <ChevronDown className="w-4 h-4" />
                        {bet.legs.length - 2} more legs
                      </div>
                    )}
                  </div>
                </div>

                {/* Bet Stats */}
                <div className="text-right ml-6">
                  <div className="text-xs text-muted mb-1">Stake</div>
                  <div className="text-2xl font-bold">{formatCurrency(bet.stake)}</div>
                  <div className="text-amber-400 text-sm font-semibold mt-1">
                    {bet.odds > 0 ? '+' : ''}
                    {bet.odds}
                  </div>
                  {bet.potential_return && (
                    <div className="text-xs text-muted mt-2">
                      To win {formatCurrency(bet.potential_return)}
                    </div>
                  )}
                  {bet.actual_return > 0 && (
                    <div className="text-sm text-emerald-400 font-bold mt-2 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Won {formatCurrency(bet.actual_return)}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded View */}
              {selectedBet?.id === bet.id && (
                <div className="mt-6 pt-6 border-t border-slate-700/50 space-y-4 animate-fade-in">
                  {/* Individual Legs */}
                  {bet.legs.map((leg: any, i: number) => (
                    <div key={i} className="card-glass p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted font-semibold">LEG {i + 1}</span>
                            <span
                              className={`${
                                leg.status === 'won'
                                  ? 'badge-success'
                                  : leg.status === 'lost'
                                  ? 'badge-error'
                                  : leg.status === 'push'
                                  ? 'badge-neutral'
                                  : 'badge-warning'
                              } badge-xs`}
                            >
                              {leg.status === 'won' && <CheckCircle2 className="w-3 h-3" />}
                              {leg.status === 'lost' && <XCircle className="w-3 h-3" />}
                              {leg.status === 'push' && <RotateCw className="w-3 h-3" />}
                              {leg.status === 'pending' && <Clock className="w-3 h-3" />}
                              {leg.status === 'won'
                                ? 'Won'
                                : leg.status === 'lost'
                                ? 'Lost'
                                : leg.status === 'push'
                                ? 'Push'
                                : 'Pending'}
                            </span>
                          </div>
                          <div className="font-semibold text-white">{leg.event_name}</div>
                          <div className="text-amber-400 text-sm font-medium mt-1">{leg.pick}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {leg.odds > 0 ? '+' : ''}
                            {leg.odds}
                          </div>
                          {leg.analytics?.edge && (
                            <div className="text-xs text-emerald-400 mt-1">
                              {leg.analytics.edge.toFixed(1)}% edge
                            </div>
                          )}
                        </div>
                      </div>

                      {/* DK Link */}
                      {leg.dk_link && (
                        <a
                          href={leg.dk_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-bold transition-all shadow-lg mt-3"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View on DraftKings
                        </a>
                      )}

                      {/* Leg Status Buttons */}
                      {bet.status === 'pending' && leg.status === 'pending' && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                          <div className="text-xs text-muted mb-2">Mark this leg:</div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLegStatus(leg.id, 'won');
                              }}
                              disabled={updatingLeg === leg.id}
                              className="btn-success btn-xs flex-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Won
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLegStatus(leg.id, 'lost');
                              }}
                              disabled={updatingLeg === leg.id}
                              className="btn-danger btn-xs flex-1"
                            >
                              <XCircle className="w-3 h-3" />
                              Lost
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLegStatus(leg.id, 'push');
                              }}
                              disabled={updatingLeg === leg.id}
                              className="btn-secondary btn-xs flex-1"
                            >
                              <RotateCw className="w-3 h-3" />
                              Push
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Bet Status Update (if pending) */}
                  {bet.status === 'pending' && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <div className="text-xs text-muted mb-2 font-semibold">Mark entire bet:</div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCashoutModal(bet.id, 'won');
                          }}
                          className="btn-success btn-sm flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Won
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCashoutModal(bet.id, 'lost');
                          }}
                          className="btn-danger btn-sm flex-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Lost
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCashoutModal(bet.id, 'push');
                          }}
                          className="btn-secondary btn-sm flex-1"
                        >
                          <RotateCw className="w-4 h-4" />
                          Push
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        shareBet(bet);
                      }}
                      className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Bet
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBet(bet.id);
                      }}
                      disabled={deleting}
                      className="btn-danger btn-sm flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual Bet Entry Modal */}
      {showManualBetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Plus className="w-6 h-6 text-amber-500" />
                Add Manual Bet
              </h2>
              <button
                onClick={() => setShowManualBetModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleManualBetSubmit} className="p-6 space-y-6">
              {/* Bet Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bet Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBetType('single');
                      setLegs([legs[0]]);
                    }}
                    className={betType === 'single' ? 'btn-primary' : 'btn-secondary'}
                  >
                    Single Bet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBetType('parlay');
                      if (legs.length === 1) addLeg();
                    }}
                    className={betType === 'parlay' ? 'btn-primary' : 'btn-secondary'}
                  >
                    Parlay
                  </button>
                </div>
              </div>

              {/* Legs */}
              {legs.map((leg, index) => (
                <div key={index} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  {betType === 'parlay' && (
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-amber-500">Leg {index + 1}</h3>
                      {legs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLeg(index)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sport
                      </label>
                      <select
                        className="input"
                        value={leg.sport}
                        onChange={(e) => updateLeg(index, 'sport', e.target.value)}
                      >
                        <option value="NFL">NFL</option>
                        <option value="NBA">NBA</option>
                        <option value="NHL">NHL</option>
                        <option value="MLB">MLB</option>
                        <option value="NCAAF">NCAAF</option>
                        <option value="NCAAB">NCAAB</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Event Date
                      </label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={leg.eventDate}
                        onChange={(e) => updateLeg(index, 'eventDate', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Game/Event (e.g., "Chiefs @ Bills")
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Team A @ Team B"
                      value={leg.eventName}
                      onChange={(e) => updateLeg(index, 'eventName', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pick/Selection
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Patrick Mahomes Over 250.5 Passing Yards"
                      value={leg.pick}
                      onChange={(e) => updateLeg(index, 'pick', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Odds (American)
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="-110"
                      value={leg.odds}
                      onChange={(e) => updateLeg(index, 'odds', e.target.value)}
                      required
                    />
                  </div>
                </div>
              ))}

              {/* Add Leg Button */}
              {betType === 'parlay' && (
                <button
                  type="button"
                  onClick={addLeg}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Leg
                </button>
              )}

              {/* Bet-level details */}
              <div className="border-t border-slate-700 pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Stake ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="10.00"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sportsbook
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="DraftKings, FanDuel, etc."
                    value={sportsbook}
                    onChange={(e) => setSportsbook(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bet Slip Link (Optional)
                  </label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://..."
                    value={betLink}
                    onChange={(e) => setBetLink(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="Add any notes about this bet..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualBetModal(false);
                    resetManualBetForm();
                  }}
                  className="btn-secondary flex-1"
                  disabled={submittingManualBet}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={submittingManualBet}
                >
                  {submittingManualBet ? 'Adding...' : 'Add Bet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cashout Modal */}
      {showCashoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Mark Bet as {cashoutStatus === 'won' ? 'Won' : cashoutStatus === 'lost' ? 'Lost' : 'Push'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {cashoutStatus === 'won' ? 'Payout Amount ($)' : cashoutStatus === 'push' ? 'Return Amount ($)' : 'Lost Amount ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    placeholder="Enter amount"
                    autoFocus
                  />
                  <div className="text-xs text-muted mt-1">
                    {cashoutStatus === 'won' && 'Enter the full payout or cashout amount'}
                    {cashoutStatus === 'lost' && 'Usually $0 unless partial cashout'}
                    {cashoutStatus === 'push' && 'Enter the amount returned (usually your stake)'}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCashoutModal(false);
                      setCashoutBetId(null);
                    }}
                    className="btn-secondary flex-1"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateBetStatus}
                    className="btn-primary flex-1"
                    disabled={updating}
                  >
                    {updating ? 'Updating...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
