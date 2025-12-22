# 🏈 M.R. B.A.L.L.S. 2.0

**Machine-Randomized Bet-Assisted Leg-Lock System** - Next Generation

An intelligent, exclusive sports betting analytics platform with NFC authentication, smart pick generation, and social features for tracking performance.

---

## 🎯 What's New in V2

### ✨ Core Features
- **Smart Analytics Engine**: Data-driven bet selection replacing pure randomness
- **User Profiles**: Track your bets, stats, ROI, and sharp score
- **Leaderboards**: Compete with the boys
- **Real-time Insights**: Sharp plays, line movements, weather alerts
- **Professional UI**: Clean, mobile-first design
- **Free Hosting**: 100% on Cloudflare's free tier

### 🧠 Intelligence Factors
- **Line Value Analysis**: Compare against market consensus
- **Sharp Money Tracking**: Pinnacle vs DraftKings analysis
- **Weather Impact**: Wind, rain, temperature effects
- **Situational Analysis**: Thursday night games, back-to-backs, etc.
- **Key Numbers**: Landing on NFL 3/7, NBA 2/3
- **Trend Analysis**: Historical performance patterns

---

## 🏗️ Architecture

```
Frontend: Next.js 15 + React 19 + Tailwind CSS
Backend: Cloudflare Workers + Pages
Database: Cloudflare D1 (SQLite)
Storage: Cloudflare R2
APIs: The Odds API, Weather.gov, ESPN (unofficial)
```

### Free Tier Limits (All Generous for Personal Use)
- ✅ Cloudflare Pages: Unlimited requests
- ✅ Cloudflare Workers: 100k requests/day
- ✅ Cloudflare D1: 5GB storage, 5M reads/day
- ✅ The Odds API: 500 requests/month (cached heavily)
- ✅ Weather.gov: Unlimited

---

## 📦 Project Structure

```
mr-balls-v2/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── bets/                 # Bet CRUD
│   │   ├── analytics/            # Smart picks generation
│   │   └── users/                # User management
│   └── (app)/                    # Protected app pages
│       ├── dashboard/            # User dashboard
│       ├── generator/            # Parlay generator
│       ├── portfolio/            # Bet history
│       └── leaderboard/          # Rankings
├── components/                   # React components
│   ├── ui/                       # Base UI components
│   └── features/                 # Feature-specific components
├── lib/                          # Core utilities
│   ├── db.ts                     # Database layer
│   ├── auth.ts                   # Authentication
│   └── analytics-engine.ts       # Smart bet selection
├── types/                        # TypeScript definitions
├── migrations/                   # D1 database migrations
└── public/                       # Static assets
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account (free)
- The Odds API key (free tier: 500 req/month)

### Step 1: Install Dependencies

```bash
cd mr-balls-v2
npm install
```

### Step 2: Create Cloudflare D1 Database

```bash
# Login to Cloudflare (one-time)
npx wrangler login

# Create database
npx wrangler d1 create mr-balls-db

# Copy the database ID from output and update wrangler.toml
```

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "mr-balls-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Paste here
```

### Step 3: Run Migrations

```bash
npm run db:migrate
```

### Step 4: Set Up Secrets

```bash
# Your Odds API key (get from https://the-odds-api.com/)
npx wrangler secret put ODDS_API_KEY
# Paste your key when prompted

# NFC tag secret (any random string)
npx wrangler secret put NFC_TAG_SECRET
# Enter a random string like: "your-secret-tag-2024"

# Session secret for auth (random string)
npx wrangler secret put SESSION_SECRET
# Enter a random secure string
```

### Step 5: Local Development

```bash
# Run Next.js dev server
npm run dev

# In another terminal, run local Cloudflare Workers
npm run pages:dev
```

Visit `http://localhost:3000`

### Step 6: Deploy to Production

```bash
# Build and deploy to Cloudflare Pages
npm run pages:build
npm run pages:deploy
```

Your app will be live at `https://mr-balls-v2.pages.dev`

---

## 🎮 Usage

### For Users

1. **First Time Setup**:
   - Scan your NFC tag at `/enter?tag=YOUR_SECRET`
   - Create your username
   - You're in!

2. **Generate Smart Parlay**:
   - Go to Generator
   - Select sports, number of legs
   - Set minimum edge (2%+ recommended)
   - Click "Find Sharp Plays"
   - Lock legs you want to keep
   - Regenerate unlocked legs

3. **Track Performance**:
   - Save parlays to your portfolio
   - Mark as won/lost when settled
   - Watch your stats update
   - Compete on leaderboard

### For Admins

**Add New User:**
```bash
# Option 1: Via NFC tag (automatic on first scan)
# Option 2: Manual database insert
npx wrangler d1 execute mr-balls-db --command "
INSERT INTO users (id, username, nfc_tag_id, created_at)
VALUES ('uuid-here', 'BigTuna', 'nfc-tag-id', $(date +%s)000)
"
```

**View Leaderboard:**
```bash
npx wrangler d1 execute mr-balls-db --command "
SELECT username, wins, losses, units_profit, sharp_score
FROM users
ORDER BY units_profit DESC
LIMIT 10
"
```

---

## 🧪 Testing the Analytics Engine

Create a test script:

```typescript
// test-analytics.ts
import { AnalyticsEngine } from './lib/analytics-engine';

const engine = new AnalyticsEngine();

const mockGame = {
  id: 'test-game-1',
  sport: 'americanfootball_nfl',
  commence_time: Date.now() + 86400000,
  home_team: 'Patriots',
  away_team: 'Jets',
  weather: { wind_speed: 25, precipitation: 0, temperature: 35, conditions: 'Clear' },
  bookmakers: [
    {
      key: 'draftkings',
      title: 'DraftKings',
      markets: [
        {
          key: 'totals',
          outcomes: [
            { name: 'Over', price: -110, point: 42.5 },
            { name: 'Under', price: -110, point: 42.5 },
          ],
        },
      ],
    },
  ],
};

const criteria = {
  sports: ['americanfootball_nfl'],
  legs: 1,
  odds_min: -500,
  odds_max: 500,
  bet_types: ['over_under'],
  extra_markets: [],
  sgp_mode: 'none',
  locked: [],
  min_edge: 0,
  mode: 'max_value',
};

// This should favor UNDER due to high winds
const result = await engine.generateSmartParlay(criteria, [mockGame]);
console.log(result);
```

---

## 🔐 Security Notes

### NFC Authentication
- NFC tag IDs are stored hashed (recommended: add bcrypt)
- Sessions expire after 10 minutes of inactivity
- Rate limiting prevents brute force

### Best Practices
- Keep `NFC_TAG_SECRET` truly secret
- Use HTTPS only (Cloudflare handles this)
- Regularly rotate session secrets
- Monitor for unusual activity

---

## 📊 Database Schema Highlights

**Users**: Profile, stats, preferences
**Bets**: Parlays with analytics
**BetLegs**: Individual picks with confidence scores
**SharpPlays**: Auto-generated value plays
**LineHistory**: Odds movement tracking
**ApiCache**: Rate limit mitigation

See `migrations/0001_initial_schema.sql` for full schema.

---

## 🎨 Customization

### Add New Sports
1. Add sport key to `types/index.ts` Sport type
2. Update analytics engine situational analysis
3. Add UI filters

### Add New Bet Types
1. Extend `Market` type in types
2. Update analytics engine scoring
3. Add to generator UI

### Modify Confidence Scoring
Edit `lib/analytics-engine.ts` → `calculateConfidenceScore()`

Adjust weights:
```typescript
const weights = {
  value: 0.35,      // Line value importance
  sharp: 0.25,      // Sharp money weight
  weather: 0.15,    // Weather impact
  situation: 0.15,  // Game situation
  trend: 0.10,      // Historical trends
};
```

---

## 📈 Roadmap

### Phase 1 (COMPLETE)
- ✅ Core infrastructure
- ✅ Database schema
- ✅ Analytics engine
- ✅ Authentication system

### Phase 2 (In Progress)
- ⏳ API routes
- ⏳ UI components
- ⏳ Data source integration
- ⏳ NFC flow

### Phase 3 (Coming Soon)
- 🔜 Real sharp money integration
- 🔜 Historical trends database
- 🔜 Notification system
- 🔜 Group chat

### Phase 4 (Future)
- 🔮 Machine learning models
- 🔮 Live bet tracking
- 🔮 Cash-out optimizer
- 🔮 Mobile app (React Native)

---

## 🐛 Troubleshooting

**Database errors**: Run `npm run db:migrate` to apply latest schema

**API rate limits**: Check cache TTL in `lib/db.ts` → `setCache()`

**Auth not working**: Verify secrets are set with `npx wrangler secret list`

**Build fails**: Ensure Node 18+, clear `.next` folder

---

## 💡 Tips for Staying Free

1. **Cache aggressively**:
   - Odds API: 300-600s TTL
   - Weather: 3600s TTL
   - Static data: 86400s TTL

2. **Smart polling**:
   - Only fetch odds for selected sports
   - Don't fetch props unless explicitly requested
   - Batch requests when possible

3. **Monitor usage**:
   ```bash
   npx wrangler d1 execute mr-balls-db --command "
   SELECT COUNT(*) as api_calls_today
   FROM api_cache
   WHERE key LIKE 'odds_%'
   AND expires_at > $(date -d 'today 00:00:00' +%s)000
   "
   ```

---

## 🤝 Contributing (For the Boys)

Want to add a feature?

1. Create a new branch: `git checkout -b feature/your-idea`
2. Make changes
3. Test locally
4. Push and create PR
5. Get reviewed by the crew

---

## 📜 License

Private - For the Boys Only™

---

## 🙏 Credits

Built with:
- Next.js
- Cloudflare (Workers, D1, Pages, R2)
- The Odds API
- Weather.gov
- A healthy dose of degeneracy

---

**Remember**: This is for entertainment purposes. Bet responsibly. Don't chase losses. Never bet what you can't afford to lose.

---

Made with 💸 by the boys, for the boys
