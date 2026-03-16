'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Target, Trophy,
  Clock, CheckCircle2, XCircle, ChevronRight,
  Sparkles, BarChart2, Percent, DollarSign,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BetStats {
  total_bets:     number;
  wins:           number;
  losses:         number;
  pending:        number;
  win_rate:       number;
  roi:            number;
  total_wagered:  number;
  total_return:   number;
  profit_loss:    number;
  current_streak: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatCard({
  label, value, sub, icon: Icon, positive, neutral,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; positive?: boolean; neutral?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/60 p-5 hover:border-amber-500/30 transition-all duration-300">
      {/* Ambient glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-500">{label}</span>
          <div className={`p-2 rounded-xl ${neutral ? 'bg-slate-700/60' : positive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <Icon className={`w-4 h-4 ${neutral ? 'text-slate-400' : positive ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
        </div>
        <div className={`text-3xl font-black tracking-tight ${
          neutral ? 'text-white' :
          positive ? 'text-emerald-400' : 'text-red-400'
        }`}>{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-1 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    won:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    lost:    'bg-red-500/15 text-red-400 border-red-500/20',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    push:    'bg-slate-500/15 text-slate-400 border-slate-500/20',
  };
  const icons: Record<string, React.ReactNode> = {
    won:     <CheckCircle2 className="w-3 h-3" />,
    lost:    <XCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    push:    <Target className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] ?? styles.pending}`}>
      {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats]       = useState<BetStats | null>(null);
  const [bets, setBets]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('mrb_user');
    const u = stored ? JSON.parse(stored).username : null;
    if (u) {
      setUsername(u);
      loadData(u);
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = async (u: string) => {
    try {
      const res  = await fetch(`/api/bets?username=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setBets((data.bets ?? []).slice(0, 5));
      }
    } catch {
      // localStorage fallback
      const raw  = localStorage.getItem('bets');
      const all  = raw ? JSON.parse(raw) : [];
      setBets(all.slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  const pl         = stats?.profit_loss ?? 0;
  const roi        = stats?.roi ?? 0;
  const winRate    = stats?.win_rate ?? 0;
  const streak     = stats?.current_streak ?? 0;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {username ? `${username}'s Dashboard` : 'Dashboard'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Season performance overview
          </p>
        </div>
        <button
          onClick={() => router.push('/generator')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Generate Parlay
        </button>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Profit / Loss"
            value={`${pl >= 0 ? '+' : ''}$${Math.abs(pl).toFixed(2)}`}
            sub={`$${(stats?.total_wagered ?? 0).toFixed(0)} wagered`}
            icon={pl >= 0 ? TrendingUp : TrendingDown}
            positive={pl >= 0}
          />
          <StatCard
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            sub={`${stats?.wins ?? 0}W · ${stats?.losses ?? 0}L · ${stats?.pending ?? 0} pending`}
            icon={Percent}
            positive={winRate >= 50}
            neutral={winRate === 0}
          />
          <StatCard
            label="ROI"
            value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
            sub="return on investment"
            icon={BarChart2}
            positive={roi >= 0}
            neutral={roi === 0}
          />
          <StatCard
            label="Current Streak"
            value={streak === 0 ? '—' : `${Math.abs(streak)} ${streak > 0 ? 'W' : 'L'}`}
            sub={streak === 0 ? 'No settled bets' : streak > 0 ? 'Win streak 🔥' : 'Variance happens'}
            icon={Trophy}
            positive={streak > 0}
            neutral={streak === 0}
          />
        </div>
      )}

      {/* Recent bets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Recent Bets</h2>
          <button
            onClick={() => router.push('/portfolio')}
            className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 font-semibold transition-colors"
          >
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : bets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
            <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No bets yet</p>
            <p className="text-slate-600 text-sm mt-1">Generate your first parlay to get started</p>
            <button
              onClick={() => router.push('/generator')}
              className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-all"
            >
              Generate Parlay
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map((bet: any) => {
              const legs    = bet.legs ?? [];
              const isWon   = bet.status === 'won';
              const isLost  = bet.status === 'lost';
              const pnl     = isWon
                ? (bet.actual_return ?? 0) - (bet.stake ?? 0)
                : isLost ? -(bet.stake ?? 0) : null;

              return (
                <button
                  key={bet.id}
                  onClick={() => router.push(`/portfolio?bet=${bet.id}`)}
                  className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-1.5 h-12 rounded-full flex-shrink-0 ${
                        bet.status === 'won' ? 'bg-emerald-500' :
                        bet.status === 'lost' ? 'bg-red-500' :
                        'bg-amber-500'
                      }`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">
                            {legs.length}-Leg Parlay
                          </span>
                          <StatusPill status={bet.status ?? 'pending'} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {legs.slice(0, 2).map((l: any) => l.pick ?? l.event_name).join(' · ')}
                          {legs.length > 2 && ` +${legs.length - 2} more`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className={`text-base font-black ${
                        pnl === null ? 'text-slate-400' :
                        pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {pnl === null
                          ? `$${(bet.stake ?? 0).toFixed(0)} to win`
                          : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {bet.odds > 0 ? '+' : ''}{bet.odds}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-500 ml-3 flex-shrink-0 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
