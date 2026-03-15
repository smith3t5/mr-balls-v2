'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Sparkles, Wallet, Trophy,
  TrendingUp, TrendingDown, Settings, History,
  ChevronDown, Check,
} from 'lucide-react';
import STierAlert from './components/STierAlert';

// ---------------------------------------------------------------------------
// Hardcoded friend group — edit this list to add/remove members
// ---------------------------------------------------------------------------
const FRIEND_GROUP = [
  'Tyler',
  'John',
  'Kevin A',
  'Kevin H',
  'Steven',
];

const DEFAULT_STATS = {
  wins: 0, losses: 0, roi: 0, units_profit: 0,
  total_bets: 0, pushes: 0, sharp_score: 50,
  current_streak: 0, best_win_streak: 0,
  units_wagered: 0, total_ev: 0, avg_clv: 0, sharpe_ratio: 0,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser]             = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mrb_user');
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      setShowPicker(true);
    }
  }, []);

  const selectUser = (name: string) => {
    // Check if we have saved stats for this user
    const savedStats = localStorage.getItem(`mrb_stats_${name}`);
    const stats = savedStats ? JSON.parse(savedStats) : DEFAULT_STATS;
    const newUser = { username: name, stats };
    localStorage.setItem('mrb_user', JSON.stringify(newUser));
    setUser(newUser);
    setShowPicker(false);
  };

  const switchUser = (name: string) => {
    const savedStats = localStorage.getItem(`mrb_stats_${name}`);
    const stats = savedStats ? JSON.parse(savedStats) : DEFAULT_STATS;
    const newUser = { username: name, stats };
    localStorage.setItem('mrb_user', JSON.stringify(newUser));
    setUser(newUser);
    setPickerOpen(false);
  };

  const nav = [
    { name: 'Dashboard',  href: '/dashboard',   icon: BarChart3  },
    { name: 'Generator',  href: '/generator',   icon: Sparkles   },
    { name: 'Portfolio',  href: '/portfolio',   icon: Wallet     },
    { name: 'History',    href: '/history',     icon: History    },
    { name: 'Leaderboard',href: '/leaderboard', icon: Trophy     },
    { name: 'Settings',   href: '/settings',    icon: Settings   },
  ];

  // Username picker modal
  if (showPicker) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
        <div className="card w-full max-w-sm mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-1">
              M.R. B.A.L.L.S.
            </h1>
            <p className="text-xs text-muted">Machine-Randomized Bet-Assisted Leg-Lock System</p>
          </div>
          <h2 className="heading-sm text-center mb-6">Who are you?</h2>
          <div className="space-y-2">
            {FRIEND_GROUP.map(name => (
              <button
                key={name}
                onClick={() => selectUser(name)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-white font-semibold transition-all text-left flex items-center justify-between group"
              >
                <span>{name}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-amber-400 -rotate-90 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      <STierAlert />

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-lg border-b border-slate-700/50 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              M.R. B.A.L.L.S.
            </h1>
            <p className="text-xs text-muted flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              The Oracle v2.0
            </p>
          </div>

          {/* User switcher */}
          <div className="relative">
            <button
              onClick={() => setPickerOpen(p => !p)}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 transition-all"
            >
              <div className="text-right">
                <div className="text-sm font-semibold text-white">@{user.username}</div>
                <div className="text-xs text-muted flex items-center justify-end gap-1">
                  <span>{user.stats?.wins ?? 0}-{user.stats?.losses ?? 0}</span>
                  <span className="text-gray-600">•</span>
                  <span className={`flex items-center gap-0.5 ${user.stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(user.stats?.roi ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(user.stats?.roi ?? 0) >= 0 ? '+' : ''}{(user.stats?.roi ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {pickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 text-xs text-muted border-b border-slate-700">Switch user</div>
                {FRIEND_GROUP.map(name => (
                  <button
                    key={name}
                    onClick={() => switchUser(name)}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-slate-700 transition-colors flex items-center justify-between"
                  >
                    <span className={name === user.username ? 'text-amber-400 font-semibold' : 'text-white'}>{name}</span>
                    {name === user.username && <Check className="w-4 h-4 text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {nav.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-3 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-gradient-to-b from-slate-800/80 to-slate-900/80 text-amber-400 shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Close picker on outside click */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
