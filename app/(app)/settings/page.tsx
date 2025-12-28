'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, DollarSign, TrendingUp, Shield, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [bankroll, setBankroll] = useState(1000);
  const [kellyMultiplier, setKellyMultiplier] = useState(0.25);
  const [defaultUnitSize, setDefaultUnitSize] = useState(10);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setBankroll(data.user.bankroll || 1000);
          setKellyMultiplier(data.user.kelly_multiplier || 0.25);
          setDefaultUnitSize(data.user.default_unit_size || 10);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/users/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankroll,
          kelly_multiplier: kellyMultiplier,
          default_unit_size: defaultUnitSize,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Settings saved successfully!');
        setUser({ ...user, bankroll, kelly_multiplier: kellyMultiplier, default_unit_size: defaultUnitSize });
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton-title mb-4" />
        <div className="skeleton-card h-96" />
      </div>
    );
  }

  const calculatedMaxBet = (bankroll * kellyMultiplier * 0.05).toFixed(2);
  const unitValue = (bankroll * 0.01).toFixed(2);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="heading-lg flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-amber-500" />
          Bankroll Settings
        </h1>
        <p className="text-muted mt-2">Configure your betting bankroll and risk parameters</p>
      </div>

      {/* Main Settings Card */}
      <div className="card-glass">
        <div className="space-y-8">
          {/* Bankroll Setting */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Total Bankroll
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
              <input
                type="number"
                value={bankroll}
                onChange={(e) => setBankroll(parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-4 py-4 rounded-xl bg-slate-900/80 border border-slate-600/50 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                min="100"
                step="100"
              />
            </div>
            <p className="text-xs text-muted mt-2 ml-1">
              Your total betting bankroll. This is used to calculate proper bet sizing.
            </p>
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-start gap-2 text-xs text-emerald-300">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Current calculation: 1 unit = 1% of bankroll</p>
                  <p className="text-gray-400">With ${bankroll} bankroll: <strong className="text-emerald-400">1U = ${unitValue}</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* Kelly Fraction Setting */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Kelly Criterion Multiplier
            </label>
            <div className="space-y-4">
              {/* Slider */}
              <div className="relative pt-2">
                <input
                  type="range"
                  value={kellyMultiplier}
                  onChange={(e) => setKellyMultiplier(parseFloat(e.target.value))}
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Conservative (0.1x)</span>
                  <span>Moderate (0.5x)</span>
                  <span>Aggressive (1.0x)</span>
                </div>
              </div>

              {/* Current Value Display */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setKellyMultiplier(0.25)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    kellyMultiplier === 0.25
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs text-muted mb-1">Quarter Kelly</div>
                  <div className="text-lg font-bold text-white">0.25x</div>
                  <div className="text-[10px] text-emerald-400 mt-1">Recommended</div>
                </button>

                <button
                  onClick={() => setKellyMultiplier(0.5)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    kellyMultiplier === 0.5
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs text-muted mb-1">Half Kelly</div>
                  <div className="text-lg font-bold text-white">0.5x</div>
                  <div className="text-[10px] text-amber-400 mt-1">Moderate</div>
                </button>

                <button
                  onClick={() => setKellyMultiplier(1.0)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    kellyMultiplier === 1.0
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs text-muted mb-1">Full Kelly</div>
                  <div className="text-lg font-bold text-white">1.0x</div>
                  <div className="text-[10px] text-red-400 mt-1">High Risk</div>
                </button>
              </div>

              {/* Current Selection Display */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-sm text-white font-semibold mb-2">
                  Current: <span className="text-amber-400">{kellyMultiplier.toFixed(2)}x Kelly</span>
                </div>
                <div className="text-xs text-gray-400">
                  {kellyMultiplier <= 0.25 ? (
                    <>Conservative approach. Reduces variance by 93.75% while still capturing 75%+ of growth. Best for most bettors.</>
                  ) : kellyMultiplier <= 0.5 ? (
                    <>Moderate approach. Balances growth and risk. Still significantly reduces variance compared to full Kelly.</>
                  ) : kellyMultiplier <= 0.75 ? (
                    <>Aggressive approach. Higher growth potential but increased variance. Only for experienced bettors with large bankrolls.</>
                  ) : (
                    <>Full Kelly. Maximum growth but extreme variance. Can lead to 50%+ drawdowns. Not recommended for most bettors.</>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-start gap-2 text-xs text-cyan-300">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Maximum bet with current settings:</p>
                  <p className="text-gray-400">
                    At {(kellyMultiplier * 100).toFixed(0)}% Kelly with 5% cap: <strong className="text-cyan-400">Max bet = ${calculatedMaxBet}</strong>
                  </p>
                  <p className="text-gray-500 mt-1 text-[10px]">
                    This is the most you'll bet on a single leg even with maximum edge.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-700/50">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Why Kelly Criterion */}
        <div className="card-glass">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-cyan-400" />
            Why Kelly Criterion?
          </h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              The Kelly Criterion is a mathematical formula that calculates the optimal bet size to maximize long-term bankroll growth.
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Maximizes growth:</strong> Optimal bet sizing for your edge</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Prevents ruin:</strong> Never risk too much on one bet</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Scales with edge:</strong> Bet more when edge is higher</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Risk Levels */}
        <div className="card-glass">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Risk Levels Explained
          </h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="font-semibold text-emerald-400 mb-1">Quarter Kelly (0.25x) - Recommended</div>
              <div className="text-xs text-gray-400">Reduces variance by ~94% while keeping ~75% of growth. Comfortable for most bettors.</div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="font-semibold text-amber-400 mb-1">Half Kelly (0.5x) - Moderate</div>
              <div className="text-xs text-gray-400">Reduces variance by ~75% while keeping ~87% of growth. Good middle ground.</div>
            </div>

            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="font-semibold text-red-400 mb-1">Full Kelly (1.0x) - High Risk</div>
              <div className="text-xs text-gray-400">Maximum growth but extreme swings. Can see 50%+ drawdowns. Not recommended.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
