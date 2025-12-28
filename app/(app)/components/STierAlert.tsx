'use client';

import { useEffect, useState } from 'react';
import { Zap, X } from 'lucide-react';

export default function STierAlert() {
  const [alert, setAlert] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for S-tier bets every 5 minutes
    const checkForSTierBets = async () => {
      try {
        const response = await fetch('/api/sharp-play/s-tier');
        const data = await response.json();

        if (data.success && data.bet) {
          setAlert(data.bet);
          setDismissed(false); // Reset dismiss when new bet found
        }
      } catch (error) {
        console.error('Failed to check for S-tier bets:', error);
      }
    };

    // Check immediately on mount
    checkForSTierBets();

    // Then check every 5 minutes
    const interval = setInterval(checkForSTierBets, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!alert || dismissed) return null;

  return (
    <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-50 px-4 max-w-2xl">
      <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 rounded-lg shadow-2xl border-4 border-yellow-300">
        <div className="relative p-6">
          {/* Close button - highly visible */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
            aria-label="Dismiss alert"
          >
            <X className="w-6 h-6 text-slate-900" />
          </button>

          {/* Outrageous header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Zap className="w-10 h-10 text-slate-900" />
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                Listen up you stupid fucks!!!
              </h2>
              <Zap className="w-10 h-10 text-slate-900" />
            </div>
            <div className="text-xl font-bold text-slate-900 bg-white/30 inline-block px-4 py-2 rounded-full">
              🚨 S-TIER BET DETECTED 🚨
            </div>
          </div>

          {/* Bet details */}
          <div className="bg-white/90 rounded-lg p-6 space-y-3">
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900 mb-2">
                {alert.event_name}
              </div>
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {alert.pick}
              </div>
              <div className="text-xl font-semibold text-slate-700">
                {alert.odds > 0 ? '+' : ''}{alert.odds}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center bg-emerald-100 rounded-lg p-3">
                <div className="text-sm text-emerald-700 font-semibold">Expected Value</div>
                <div className="text-2xl font-black text-emerald-600">
                  +{alert.expected_value?.toFixed(1)}%
                </div>
              </div>
              <div className="text-center bg-amber-100 rounded-lg p-3">
                <div className="text-sm text-amber-700 font-semibold">Kelly Units</div>
                <div className="text-2xl font-black text-amber-600">
                  {alert.kelly_units?.toFixed(1)}U
                </div>
              </div>
              <div className="text-center bg-yellow-100 rounded-lg p-3">
                <div className="text-sm text-yellow-700 font-semibold">Grade</div>
                <div className="text-3xl font-black text-yellow-600">
                  {alert.bet_grade}
                </div>
              </div>
            </div>

            {/* Analysis - Most Important Part */}
            {alert.analysis && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                <div className="text-base font-bold text-emerald-900 mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Why This Bet is S-Tier:
                </div>
                <div className="text-base text-emerald-800 font-medium leading-relaxed">{alert.analysis}</div>
              </div>
            )}

            {/* CTA */}
            <div className="text-center mt-6">
              <a
                href="/generator"
                className="inline-block bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-xl px-8 py-4 rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg"
              >
                🔥 LOCK IT IN NOW 🔥
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
