'use client';

import { useEffect, useState } from 'react';
import { Zap, X } from 'lucide-react';

interface EdgeAlert {
  eventName:   string;
  pick:        string;
  description: string;
  magnitude:   number;
}

export default function STierAlert() {
  const [alert, setAlert]       = useState<EdgeAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('/api/games');
        const data = await res.json();
        if (!data.success) return;

        // Find the biggest genuine edge
        let best: EdgeAlert | null = null;
        let bestMag = 0;

        for (const game of data.games ?? []) {
          const kp = game.kenpom;
          if (!kp) continue;

          // Total edge > 4pts
          if (kp.totalGap != null && Math.abs(kp.totalGap) > 4) {
            const mag  = Math.abs(kp.totalGap);
            const side = kp.totalValueSide === 'over' ? 'Over' : 'Under';
            if (mag > bestMag) {
              bestMag = mag;
              best = {
                eventName:   `${game.awayTeam} @ ${game.homeTeam}`,
                pick:        `${side} ${kp.bookTotal}`,
                description: `KenPom projects ${kp.projectedTotal} total — book at ${kp.bookTotal} is ${mag.toFixed(1)} pts off the model`,
                magnitude:   mag,
              };
            }
          }

          // ML edge > 10%
          if (kp.mlEdgeHome != null && kp.mlEdgeHome > 10) {
            if (kp.mlEdgeHome > bestMag) {
              bestMag = kp.mlEdgeHome;
              best = {
                eventName:   `${game.awayTeam} @ ${game.homeTeam}`,
                pick:        `${game.homeTeam} ML`,
                description: `KenPom gives ${game.homeTeam} a ${kp.homeWinProb}% win probability — market prices them at ${(100 - kp.awayWinProb).toFixed(0)}%`,
                magnitude:   kp.mlEdgeHome,
              };
            }
          }
          if (kp.mlEdgeAway != null && kp.mlEdgeAway > 10) {
            if (kp.mlEdgeAway > bestMag) {
              bestMag = kp.mlEdgeAway;
              best = {
                eventName:   `${game.awayTeam} @ ${game.homeTeam}`,
                pick:        `${game.awayTeam} ML`,
                description: `KenPom gives ${game.awayTeam} a ${kp.awayWinProb}% win probability — market has them much lower`,
                magnitude:   kp.mlEdgeAway,
              };
            }
          }
        }

        if (best && best.magnitude > bestMag * 0.8) {
          setAlert(best);
          setDismissed(false);
        }
      } catch {}
    };

    check();
    const iv = setInterval(check, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(iv);
  }, []);

  if (!alert || dismissed) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-lg">
      <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 rounded-2xl shadow-2xl border-2 border-yellow-300/50 p-5">
        <button onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 rounded-full p-1.5 transition-colors">
          <X className="w-4 h-4 text-slate-900" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-slate-900/20 rounded-xl">
            <Zap className="w-6 h-6 text-slate-900" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900/70 uppercase tracking-wider">Sharp Edge Detected</div>
            <div className="text-lg font-black text-slate-900">{alert.eventName}</div>
          </div>
        </div>
        <div className="bg-white/30 rounded-xl p-4 mb-3">
          <div className="text-xl font-black text-slate-900 mb-1">{alert.pick}</div>
          <div className="text-sm text-slate-800">{alert.description}</div>
        </div>
        <a href="/generator"
          className="block w-full text-center py-2.5 rounded-xl bg-slate-900 text-amber-400 font-black text-sm hover:bg-slate-800 transition-colors">
          View in Today's Games →
        </a>
      </div>
    </div>
  );
}
