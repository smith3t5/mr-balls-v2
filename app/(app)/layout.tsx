'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Sparkles,
  Wallet,
  Trophy,
  LogOut,
  TrendingUp,
  TrendingDown,
  Loader2,
  Settings,
  History,
} from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
        } else {
          router.push('/');
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const nav = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Generator', href: '/generator', icon: Sparkles },
    { name: 'Portfolio', href: '/portfolio', icon: Wallet },
    { name: 'History', href: '/history', icon: History },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-spin" />
          <div className="text-muted">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Premium Header */}
      <header className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-lg border-b border-slate-700/50 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              M.R. B.A.L.L.S.
            </h1>
            <p className="text-xs text-muted flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              The Oracle v2.0
            </p>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-white flex items-center justify-end gap-1">
                @{user.username}
              </div>
              <div className="text-xs text-muted flex items-center justify-end gap-1">
                <span>{user.stats.wins}-{user.stats.losses}</span>
                <span className="text-gray-600">•</span>
                <span className={`flex items-center gap-0.5 ${user.stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {user.stats.roi >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {user.stats.roi >= 0 ? '+' : ''}{user.stats.roi.toFixed(1)}%
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost btn-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </div>

        {/* Premium Navigation */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {nav.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-4 py-3 rounded-t-lg font-semibold transition-all
                    flex items-center gap-2
                    ${isActive
                      ? 'bg-gradient-to-b from-slate-800/80 to-slate-900/80 text-amber-400 shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
