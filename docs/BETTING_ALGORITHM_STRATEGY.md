# Advanced Betting Algorithm Strategy

## Executive Summary

Professional sports betting is fundamentally about **finding positive expected value (EV) bets and sizing them optimally**. This document outlines a mathematically rigorous approach to identifying profitable betting opportunities and managing bankroll for long-term success.

## Core Principles

### 1. You Don't Need to Win More Than 50% of Bets

This is the most important concept to understand:

**Example:**
- You bet on underdogs at +200 (3.00 decimal odds)
- You win 35% of the time
- Win rate: 35% (below 50%)
- Expected ROI: (0.35 × 200) - (0.65 × 100) = +5% profit

**The key:** Finding bets where your estimated probability is higher than the market's implied probability.

### 2. Bankroll Management is More Important Than Picking Winners

- Even with a 5% edge, poor bankroll management leads to ruin
- Kelly Criterion provides optimal bet sizing
- Fractional Kelly (1/4 or 1/2) reduces variance
- Never bet more than 5% of bankroll on single bet

### 3. Closing Line Value (CLV) is the Ultimate Metric

Studies show:
- Consistently beating closing line → long-term profitability
- Short-term record is largely variance
- CLV is the best predictor of skill vs luck

## Mathematical Framework

### Expected Value (EV)

```
EV = (True_Prob × Payout) - ((1 - True_Prob) × Stake)
```

**Break-even calculation:**
```
At +100 odds (even money):
Need >50% win probability for +EV

At +200 odds (2-to-1):
Need >33.3% win probability for +EV

At -200 odds (1-to-2):
Need >66.7% win probability for +EV
```

### Kelly Criterion

**Full Kelly:**
```
f* = (bp - q) / b

Where:
f* = optimal fraction of bankroll
b = net decimal odds (decimal - 1)
p = true win probability
q = loss probability (1 - p)
```

**Practical Example:**
```
Your model: 58% win probability
Market odds: -110 (1.909 decimal, b = 0.909)

Full Kelly = (0.909 × 0.58 - 0.42) / 0.909 = 0.119 = 11.9%

Quarter Kelly (recommended) = 2.98% of bankroll
```

**Why Fractional Kelly?**
- Full Kelly maximizes growth but has high variance
- Quarter Kelly reduces variance by 93.75%
- Still captures 75%+ of full Kelly growth
- Much more comfortable psychologically

### Risk of Ruin

With proper Kelly sizing, risk of ruin approaches 0% even with 100+ bets.

**Rule of thumb:**
```
Units needed = 100 / Kelly_Fraction

Quarter Kelly → 400 units
Half Kelly → 200 units
```

**Example:**
- Starting bankroll: $10,000
- Quarter Kelly max bet: $250 (2.5%)
- This gives 400 units of staying power
- With 5% edge, probability of going broke < 0.1%

## Implementation Tiers

### Tier 1: Foundation (Current System +)

**What we have:**
- Odds aggregation from multiple books
- Basic line value analysis
- Sharp money indicators

**What to add:**
1. **Probability Estimation**
   - Use ensemble of models (Elo, Poisson, regression)
   - Weight by historical accuracy
   - Continuous calibration

2. **EV Calculation**
   - Real expected value for every bet
   - Minimum threshold (e.g., +2% EV)
   - Display in UI: "Expected Return: +5.2%"

3. **Unit Sizing**
   - Kelly Calculator integration
   - User sets: bankroll, Kelly fraction (default 0.25)
   - Show recommended units for each bet

**Database Schema Addition:**
```sql
CREATE TABLE model_predictions (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  outcome_type TEXT, -- 'moneyline', 'spread', 'total'
  predicted_probability REAL,
  confidence REAL,
  model_version TEXT,
  created_at INTEGER
);

CREATE TABLE bet_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_id TEXT,
  prediction_id TEXT,
  odds INTEGER,
  closing_odds INTEGER,
  stake REAL,
  result TEXT, -- 'win', 'loss', 'push', 'pending'
  profit REAL,
  ev REAL,
  clv REAL,
  created_at INTEGER,
  settled_at INTEGER
);
```

### Tier 2: Advanced Analytics

1. **Model Ensemble**
   ```typescript
   const predictions = {
     elo: eloModel.predict(homeTeam, awayTeam),
     poisson: poissonModel.predict(homeExpectedGoals, awayExpectedGoals),
     regression: regressionModel.predict(features),
     marketConsensus: aggregateBookmakerOdds(),
   };

   // Weighted average based on historical accuracy
   const finalProbability =
     0.25 * predictions.elo +
     0.25 * predictions.poisson +
     0.30 * predictions.regression +
     0.20 * predictions.marketConsensus;
   ```

2. **Situational Analysis**
   - Rest days vs opponent rest
   - Travel distance
   - Back-to-back games
   - Altitude changes
   - Weather impact (for outdoor sports)
   - Referee tendencies
   - Divisional matchups

3. **Player Impact Models**
   - Win shares / VORP for missing players
   - Lineup optimization impact
   - Injury severity assessment

### Tier 3: Machine Learning (Advanced)

1. **Feature Engineering**
   ```python
   features = {
       # Team metrics (last 10 games)
       'offensive_rating': 115.2,
       'defensive_rating': 108.4,
       'pace': 102.3,
       'effective_fg_pct': 0.542,

       # Situational
       'rest_advantage': 2,  # days rest difference
       'home_court': 1,
       'altitude_diff': 5000,  # feet

       # Recent form
       'last_5_ats': 0.600,  # against the spread
       'win_streak': 3,

       # Market
       'line_movement': -1.5,  # points
       'sharp_money_pct': 0.68,
       'public_betting_pct': 0.45,
   }
   ```

2. **Model Training**
   ```python
   from xgboost import XGBClassifier

   model = XGBClassifier(
       max_depth=6,
       learning_rate=0.05,
       n_estimators=500,
       objective='binary:logistic',
       eval_metric='logloss'
   )

   # Train on historical data
   model.fit(X_train, y_train,
             eval_set=[(X_test, y_test)],
             early_stopping_rounds=20)
   ```

3. **Continuous Learning**
   - Retrain models weekly with new data
   - Track model performance by sport/market
   - Adjust weights in ensemble based on recent accuracy

### Tier 4: Professional Features

1. **Portfolio Optimization**
   - Manage correlated bets
   - Hedge recommendations
   - Parlay EV calculation (usually negative!)
   - Maximum exposure limits

2. **Closing Line Tracking**
   - Alert when you beat closing by >3%
   - Track CLV by sport/bet type
   - Identify which markets you're best at

3. **Backtesting Framework**
   - Historical simulation
   - Walk-forward analysis
   - Stress testing (what if we hit 10-bet losing streak?)

4. **Live Betting Integration**
   - In-game probability updates
   - Detect +EV live opportunities
   - Middle/arbitrage detection

## Practical Recommendations

### For Individual Bets

**Minimum Requirements to Place Bet:**
1. ✅ Expected Value > +2%
2. ✅ Positive CLV expected (line shopping)
3. ✅ Kelly suggests > 0.5% bankroll
4. ✅ Model confidence > 60%

**Bet Grading:**
```
S-Tier: EV > +8%, Strong model agreement
A-Tier: EV +5% to +8%, Good fundamentals
B-Tier: EV +3% to +5%, Slight edge
C-Tier: EV +2% to +3%, Marginal
```

### For Parlays

**Important Truth:** Parlays are -EV unless EVERY leg is +EV

**Example:**
```
Leg 1: +3% EV
Leg 2: +2% EV
Leg 3: -1% EV (fair value)

Parlay EV ≈ +4% (not +5%!)
```

**Why current system works:**
- We filter for +EV legs only
- Same-game parlays can capture correlation
- But: variance is much higher

**Recommendation:**
- Straight bets > Parlays for bankroll growth
- Parlays acceptable for entertainment
- Use smaller Kelly fraction (1/8 instead of 1/4)

### Bankroll Management Rules

1. **Never bet more than 5% on single event**
   - Even with huge perceived edge
   - Your model could be wrong
   - Preserves bankroll through variance

2. **Separate unit sizing by confidence**
   ```
   High confidence (>70%): Use full Kelly recommendation
   Medium confidence (60-70%): Use 0.5× Kelly
   Lower confidence (<60%): Use 0.25× Kelly or pass
   ```

3. **Adjust for correlation**
   - Multiple bets on same game? Reduce each by 50%
   - Same sport same day? Consider reducing
   - Different sports? Full sizing OK

4. **Weekly/Monthly limits**
   - Don't blow through bankroll in one day
   - Limit total action to 20-30% of bankroll per day
   - Forces discipline and reduces tilt betting

## Performance Metrics to Track

### Essential Metrics

1. **ROI (Return on Investment)**
   ```
   ROI = (Total Profit / Total Wagered) × 100%

   Professional: +5% to +8% annually
   Good: +3% to +5%
   Break-even: 0%
   ```

2. **Closing Line Value (CLV)**
   ```
   Average CLV > +1% = Excellent
   Average CLV > 0% = Beating the market
   Average CLV < 0% = Need to improve
   ```

3. **Sharpe Ratio**
   ```
   Return / Volatility

   > 2.0 = Excellent
   > 1.0 = Good
   < 0.5 = High risk for return
   ```

4. **Units Won**
   - More stable than dollar profit
   - Accounts for bet sizing
   - Should trend upward over time

### Diagnostic Metrics

1. **Win Rate by Odds Range**
   ```
   Heavy favorites (-300+): Should win ~75%+
   Favorites (-150 to -300): Should win ~60%+
   Underdogs (+150 to +300): Should win ~35%+
   ```

2. **Performance by Sport/Market**
   - Maybe you're great at NBA totals
   - But terrible at NFL spreads
   - Double down on strengths

3. **Model Calibration**
   - When you predict 60%, do you win 60% of the time?
   - Perfect calibration = predictions match reality
   - Track with calibration curve

## Implementation Roadmap

### Phase 1 (Week 1-2): Core Infrastructure
- [ ] Implement Kelly Calculator
- [ ] Add EV calculation to all bets
- [ ] Create bet tracking schema
- [ ] Build performance dashboard

### Phase 2 (Week 3-4): Model Development
- [ ] Build Elo rating system
- [ ] Implement Poisson models
- [ ] Create simple regression models
- [ ] Ensemble weighting

### Phase 3 (Week 5-6): User Features
- [ ] Unit size recommendations
- [ ] "Bet Grading" (S/A/B/C tiers)
- [ ] ROI and CLV tracking
- [ ] Performance charts

### Phase 4 (Week 7-8): Advanced
- [ ] Closing line tracking
- [ ] Model calibration monitoring
- [ ] Situational analysis
- [ ] Live betting alerts

### Phase 5 (Ongoing): Optimization
- [ ] Continuous model retraining
- [ ] A/B testing model variations
- [ ] User feedback integration
- [ ] Market efficiency detection

## Key Insights from Research

### What Separates Winning Bettors

1. **Line Shopping** (2-3% edge on average)
   - Best odds across 5+ books
   - Can turn -EV bet into +EV

2. **Specialization**
   - Focus on 1-2 sports/markets
   - Deep expertise beats broad mediocrity

3. **Discipline**
   - Stick to Kelly sizing
   - Don't chase losses
   - Take breaks after big wins/losses

4. **Continuous Learning**
   - Markets adapt quickly
   - What worked last year may not work now
   - Track, analyze, improve

### What Doesn't Work

1. **Martingale systems** - Guaranteed ruin eventually
2. **Betting on favorites only** - Juice kills you
3. **Tailing "hot" cappers** - Regression to mean
4. **Betting without tracking** - Can't improve blind
5. **Full Kelly** - Too aggressive, high ruin risk

## Math Behind Common Misconceptions

### "You need 53% win rate to profit"

**False!** This is only true for -110 odds.

At +100 (even money):
- Break-even = 50%
- 51% win rate = +2% ROI

At +150:
- Break-even = 40%
- 45% win rate = +12.5% ROI

At -150:
- Break-even = 60%
- 62% win rate = +3.3% ROI

**Lesson:** Underdogs offer better ROI potential than favorites.

### "Parlays are always -EV"

**Mostly true, BUT:**

If you can find +EV legs, parlays preserve that edge:

```
Leg 1: 55% true prob at +100 (50% implied) = +10% EV
Leg 2: 60% true prob at +100 (50% implied) = +20% EV

Combined: 33% chance to hit 4x payout = +32% EV
```

**However:**
- Finding multiple +EV legs is very difficult
- Variance is extremely high
- One bad leg ruins the entire bet
- Books often limit parlay payouts

**Recommendation:** Stick to 2-3 leg parlays maximum if you use them.

### "Past performance predicts future results"

**Partially true:**

✅ Good: Using 10+ game samples for team stats
❌ Bad: "They're 5-0 ATS recently" (tiny sample)

**Proper approach:**
- Use full season data (minimum)
- Adjust for opponent strength
- Weight recent games slightly higher (not exclusively)
- Understand regression to mean

## Conclusion

**The Reality of Professional Sports Betting:**

1. **Modest Expected Returns**
   - 3-5% ROI is excellent
   - 8%+ is world-class
   - Anyone claiming 20%+ is lying or lucky

2. **High Variance**
   - 10-bet losing streaks are normal
   - Even with 55% win rate: 8.5% chance of 10-loss streak
   - Bankroll management is everything

3. **Continuous Work**
   - Markets are efficient
   - Edges are small and fleeting
   - Requires constant research and adaptation

4. **It's Possible**
   - Kelly Criterion works
   - CLV is predictive
   - Proper models beat the closing line
   - Discipline + Math = Long-term profit

**Our Advantage:**
- Automated odds aggregation
- Advanced analytics
- Bankroll management tools
- Performance tracking
- Continuous improvement

With proper implementation of these algorithms, M.R. B.A.L.L.S. can be a genuine edge in sports betting. Not a guarantee of winning, but a systematic, mathematical approach that tilts the odds in your favor over time.
