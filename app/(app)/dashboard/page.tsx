'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trophy, TrendingUp, TrendingDown, Clock,
  CheckCircle2, XCircle, Percent, DollarSign,
  ChevronRight, Crown, Flame, Target,
} from 'lucide-react';

const FRIEND_GROUP = ['Tyler', 'Brian', 'Deepak', 'Shashank', 'Jen'];

interface BetStats {
  total_bets: number; wins: number; losses: number; pending: number;
  win_rate: number; roi: number; profit_loss: number; current_streak: number;
}

interface FriendEntry {
  username:    string;
  total_bets:  number;
  wins:        number;
  losses:      number;
  roi:         number;
  profit_loss: number;
  win_rate:    number;
  streak:      number;
  recentBets:  any[];
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = {
    won:     'bg-emerald-400',
    lost:    'bg-red-400',
    pending: 'bg-amber-400',
    push:    'bg-slate-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[status] ?? c.pending}`} />;
}

function StatBox({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-2xl font-black ${up === undefined ? 'text-white' : up ? 'text-emerald-400' : 'text-red-400'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const router  = useRouter();
  const [me, setMe]           = useState<string>('');
  const [stats, setStats]     = useState<BetStats | null>(null);
  const [myBets, setMyBets]   = useState<any[]>([]);
  const [board, setBoard]     = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mrb_user');
    const u = stored ? JSON.parse(stored).username : '';
    setMe(u);
    loadAll(u);
  }, []);

  const loadAll = async (username: string) => {
    setLoading(true);
    try {
      // Load all friends in parallel
      const results = await Promise.allSettled(
        FRIEND_GROUP.map(async name => {
          const res  = await fetch(`/api/bets?username=${encodeURIComponent(name)}`);
          const data = await res.json();
          if (!data.success) return null;
          return {
            username:    name,
            total_bets:  data.stats?.total_bets  ?? 0,
            wins:        data.stats?.wins         ?? 0,
            losses:      data.stats?.losses       ?? 0,
            roi:         data.stats?.roi          ?? 0,
            profit_loss: data.stats?.profit_loss  ?? 0,
            win_rate:    data.stats?.win_rate     ?? 0,
            streak:      data.stats?.current_streak ?? 0,
            recentBets:  (data.bets ?? []).slice(0, 3),
          } as FriendEntry;
        })
      );

      const entries = results
        .filter((r): r is PromiseFulfilledResult<FriendEntry> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
        .filter(e => e.total_bets > 0)
        .sort((a, b) => b.roi - a.roi);

      setBoard(entries);

      // Find my stats
      const mine = entries.find(e => e.username === username);
      if (mine) {
        setStats({
          total_bets: mine.total_bets, wins: mine.wins, losses: mine.losses,
          pending: mine.total_bets - mine.wins - mine.losses,
          win_rate: mine.win_rate, roi: mine.roi, profit_loss: mine.profit_loss,
          current_streak: mine.streak,
        } as BetStats);
        // Get full bet list for my feed
        const myRes  = await fetch(`/api/bets?username=${encodeURIComponent(username)}`);
        const myData = await myRes.json();
        if (myData.success) setMyBets(myData.bets ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pl = stats?.profit_loss ?? 0;
  const wr = stats?.win_rate ?? 0;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {me ? `${me}'s Dashboard` : 'Dashboard'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Tournament tracker · {FRIEND_GROUP.length} players</p>
        </div>
        <button onClick={() => router.push('/generator')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-sm transition-all shadow-lg shadow-amber-500/20">
          Today's Games →
        </button>
      </div>

      {/* My stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-800/40 animate-pulse" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBox label="P/L" value={`${pl >= 0 ? '+' : ''}$${Math.abs(pl).toFixed(0)}`}
            sub={`${stats.total_bets} bets`} up={pl >= 0} />
          <StatBox label="ROI" value={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`}
            sub="return on investment" up={stats.roi >= 0} />
          <StatBox label="Win Rate" value={`${wr.toFixed(0)}%`}
            sub={`${stats.wins}W · ${stats.losses}L`} up={wr >= 50} />
          <StatBox label="Streak"
            value={stats.current_streak === 0 ? '—' : `${Math.abs(stats.current_streak)}${stats.current_streak > 0 ? 'W 🔥' : 'L'}`}
            sub={stats.pending > 0 ? `${stats.pending} pending` : 'settled'} />
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-dashed border-slate-800 p-8 text-center">
          <p className="text-slate-500 text-sm">No bets yet — head to Today's Games to get started</p>
          <button onClick={() => router.push('/generator')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-sm transition-all">
            View Games
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Leaderboard */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
            </h2>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />)}
              </div>
            ) : board.length === 0 ? (
              <div className="p-8 text-center text-slate-600 text-sm">
                No bets placed yet — be the first!
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {board.map((entry, i) => {
                  const isMe    = entry.username === me;
                  const medals  = ['🥇', '🥈', '🥉'];
                  const medal   = medals[i] ?? `${i + 1}.`;
                  return (
                    <div key={entry.username} className={`flex items-center gap-4 px-5 py-4 ${isMe ? 'bg-amber-500/5' : ''}`}>
                      <div className="text-lg w-8 text-center">{medal}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm ${isMe ? 'text-amber-400' : 'text-white'}`}>
                          {entry.username} {isMe && '(you)'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.wins}W {entry.losses}L · {entry.win_rate.toFixed(0)}% WR
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black ${entry.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                        </div>
                        <div className={`text-xs ${entry.profit_loss >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                          {entry.profit_loss >= 0 ? '+' : ''}${entry.profit_loss.toFixed(0)}
                        </div>
                      </div>
                      {entry.streak > 1 && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-400 font-bold">
                          <Flame className="w-3.5 h-3.5" />{entry.streak}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Recent Activity</h2>
            <button onClick={() => router.push('/portfolio')}
              className="text-sm text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors">
              My bets <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-slate-800/40 animate-pulse" />)
            ) : board.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 border border-dashed border-slate-800 p-8 text-center text-slate-600 text-sm">
                No activity yet
              </div>
            ) : (
              // Flatten all friends' recent bets into a single feed sorted by time
              board
                .flatMap(e => e.recentBets.map(b => ({ ...b, username: e.username })))
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 8)
                .map((bet: any) => {
                  const isMe  = bet.username === me;
                  const legs  = bet.legs ?? [];
                  const pnl   = bet.status === 'won'
                    ? (bet.actual_return ?? bet.potential_return ?? 0) - bet.stake
                    : bet.status === 'lost' ? -bet.stake : null;
                  return (
                    <div key={`${bet.username}-${bet.id}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                        isMe ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-900 border-slate-800'
                      }`}>
                      <StatusDot status={bet.status ?? 'pending'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">
                          <span className={isMe ? 'text-amber-400' : 'text-slate-400'}>{bet.username}</span>
                          {' '}placed a {legs.length}-leg parlay
                        </div>
                        <div className="text-[10px] text-slate-600 truncate">
                          {legs.slice(0, 2).map((l: any) => l.pick).join(' · ')}
                          {legs.length > 2 && ` +${legs.length - 2} more`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {pnl !== null ? (
                          <div className={`text-sm font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-400 font-bold">
                            ${bet.stake} to win ${((bet.potential_return ?? 0) - bet.stake).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
