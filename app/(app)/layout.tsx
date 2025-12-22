'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

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
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Generator', href: '/generator', icon: '🎲' },
    { name: 'Portfolio', href: '/portfolio', icon: '💼' },
    { name: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-900">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎲</div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-primary-900">
      {/* Header */}
      <header className="bg-primary-800 border-b border-primary-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-white">M.R. </span>
              <span className="text-loss">B</span>
              <span className="text-gold">.</span>
              <span className="text-gold-light">A</span>
              <span className="text-gold">.</span>
              <span className="text-win">L</span>
              <span className="text-gold">.</span>
              <span className="text-win-light">L</span>
              <span className="text-gold">.</span>
              <span className="text-primary-400">S</span>
              <span className="text-gold">.</span>
            </h1>
            <p className="text-xs text-gray-400">The Oracle v2.0</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-white">@{user.username}</div>
              <div className="text-xs text-gray-400">
                {user.stats.wins}-{user.stats.losses} ({user.stats.roi >= 0 ? '+' : ''}{user.stats.roi.toFixed(1)}%)
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-primary-800 border-b border-primary-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            {nav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  pathname === item.href
                    ? 'border-gold text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
