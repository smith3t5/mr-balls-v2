// Landing/Auth page
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const HARDCODED_USER = {
  username: 'smith3t5',
  password: 'Bomberxc09!',
  id: 'user-1',
  stats: {
    wins: 0,
    losses: 0,
    roi: 0,
    total_bets: 0,
    units_wagered: 0,
    units_profit: 0,
  }
};

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Simple hardcoded auth check
      if (username === HARDCODED_USER.username && password === HARDCODED_USER.password) {
        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify(HARDCODED_USER));
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        throw new Error('Invalid username or password');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#0a0f1a] via-[#0d1421] to-[#111927]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-gold/5 to-transparent blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-win/5 to-transparent blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-gold/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-win/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo Section */}
          <div className="text-center mb-12">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gold via-win to-primary-400 p-[2px] mb-6 shadow-2xl shadow-gold/20">
              <div className="flex items-center justify-center w-full h-full rounded-2xl bg-primary-900 text-3xl font-black text-gold">
                MB
              </div>
            </div>

            {/* Title */}
            <h1 className="text-6xl font-black mb-3 tracking-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                M.R.
              </span>
              <span className="bg-gradient-to-r from-gold via-yellow-400 to-gold bg-clip-text text-transparent">
                {' '}B.A.L.L.S.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-300 font-medium text-sm tracking-wide mb-2">
              THE ORACLE
            </p>

            {/* Description */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-800/50 border border-primary-700/50 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-win animate-pulse"></div>
              <p className="text-xs text-gray-300 font-medium">
                AI-Powered Sharp Analytics Engine
              </p>
            </div>
          </div>

          {/* Auth Card */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-gold via-win to-primary-400 rounded-2xl opacity-20 group-hover:opacity-30 blur transition-opacity"></div>

            {/* Card */}
            <div className="relative bg-gradient-to-br from-primary-800/90 to-primary-900/90 backdrop-blur-xl rounded-2xl border border-primary-700/50 shadow-2xl p-8">
              <form onSubmit={handleAuth} className="space-y-6">
                {/* Username Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-5 py-4 rounded-xl bg-primary-900/80 border border-primary-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all font-medium"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-4 rounded-xl bg-primary-900/80 border border-primary-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all font-medium"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-gradient-to-r from-loss/10 to-loss/5 border border-loss/30 rounded-xl p-4">
                    <p className="text-loss-light text-sm font-medium">Authentication Failed</p>
                    <p className="text-gray-400 text-xs mt-1">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gold via-win to-gold opacity-100 group-hover/btn:opacity-90 transition-opacity"></div>
                  <div className="relative px-6 py-4 text-lg font-bold text-primary-900 flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-3 border-primary-900 border-t-transparent rounded-full animate-spin"></div>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter The Oracle</span>
                        <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                      </>
                    )}
                  </div>
                </button>
              </form>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-primary-700/50">
                <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gold animate-pulse"></div>
                    <span>Exclusive Access</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-win animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span>For The Boys</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-primary-400 animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <span>Zero Luck</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Features */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-primary-800/30 backdrop-blur-sm border border-primary-700/30">
              <p className="text-xs text-gray-300 font-medium">AI Analysis</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary-800/30 backdrop-blur-sm border border-primary-700/30">
              <p className="text-xs text-gray-300 font-medium">Real-time Data</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary-800/30 backdrop-blur-sm border border-primary-700/30">
              <p className="text-xs text-gray-300 font-medium">Sharp Edge</p>
            </div>
          </div>

          {/* Version Badge */}
          <div className="mt-6 text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-primary-800/50 border border-primary-700/50 text-xs text-gray-400 font-mono">
              v2.1.0
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
