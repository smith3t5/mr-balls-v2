# 🏈 M.R. B.A.L.L.S. 2.0

**Machine-Randomized Bet-Assisted Leg-Lock System** - Next Generation

An intelligent, exclusive sports betting analytics platform with NFC authentication, smart pick generation, and social features for tracking performance.

---

## 🎯 What's New in V2

### ✨ Core Features
- **Smart Analytics Engine**: Data-driven bet selection with edge detection
- **User Profiles**: Track your bets, stats, ROI, and sharp score
- **Leaderboards**: Compete with the boys
- **Real-time Odds**: Cached for performance (10-60 min TTL)
- **Professional UI**: Clean, modern design with Inter font
- **Free Hosting**: 100% on Cloudflare's free tier
- **NFC Authentication**: Exclusive access via NFC tags

### 🧠 Intelligence Factors
- **Line Value Analysis**: Compare against market consensus
- **Edge Detection**: Identify positive expected value bets
- **Market Analysis**: H2H, spreads, and totals coverage
- **Weather Impact**: Wind, rain, temperature effects (coming soon)
- **Situational Analysis**: Thursday night games, back-to-backs, etc.
- **Smart Caching**: Aggressive API call reduction

---

## 🏗️ Architecture

```
Frontend: Next.js 15 + React 19 + Tailwind CSS + Inter Font
Backend: Cloudflare Pages Functions (Edge Runtime)
Database: Cloudflare D1 (SQLite at the edge)
APIs: The Odds API (with smart caching)
Deployment: GitHub → Cloudflare Pages (auto-deploy)
```

### Free Tier Limits (All Generous for Personal Use)
- ✅ Cloudflare Pages: Unlimited requests, 500 builds/month
- ✅ Cloudflare D1: 5GB storage, 100k reads/day, 50k writes/day
- ✅ The Odds API: 500 requests/month free tier
- ✅ Smart caching reduces API calls by 80-90%

### API Call Optimization
- **Odds data**: Cached 10 minutes (volatile markets)
- **Game schedules**: Cached 1 hour (stable data)
- **Markets**: Limited to h2h, spreads, totals (no props yet)
- **Expected usage**: 5 users = ~450-750 calls/month (within free tier)

---

## 📦 Project Structure

```
mr-balls-v2/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (Edge Runtime)
│   │   ├── auth/                 # NFC authentication
│   │   ├── bets/                 # Bet management
│   │   ├── analytics/            # Smart picks generation
│   │   └── users/                # User management
│   └── (app)/                    # Protected app pages
│       ├── dashboard/            # User dashboard
│       ├── generator/            # Parlay generator
│       ├── portfolio/            # Bet history
│       └── leaderboard/          # Rankings
├── components/                   # React components
├── lib/                          # Core utilities
│   ├── db.ts                     # D1 database layer
│   ├── odds-api-client.ts        # Odds API with caching
│   ├── analytics-engine.ts       # Smart bet selection
│   └── auth.ts                   # NFC authentication
├── types/                        # TypeScript definitions
├── migrations/                   # D1 database migrations
├── wrangler.toml                 # Cloudflare configuration
└── package.json                  # Build scripts
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account (free)
- GitHub account (for auto-deploy)
- The Odds API key (free tier: 500 req/month)

### Step 1: Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/mr-balls-v2.git
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
# Run migrations on remote database
npx wrangler d1 migrations apply mr-balls-db --remote
```

### Step 4: Deploy to Cloudflare Pages

1. **Push to GitHub**:
```bash
git add .
git commit -m "Initial setup"
git push origin main
```

2. **Connect to Cloudflare Pages**:
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click "Create application" → "Pages" → "Connect to Git"
   - Select your GitHub repository
   - Configure build settings:
     - **Framework preset**: None
     - **Build command**: `npm run pages:build`
     - **Build output directory**: `.vercel/output/static`
     - **Root directory**: `/`

3. **Set Environment Variables** in Cloudflare Pages Settings:
   - `ODDS_API_KEY` - Get from https://the-odds-api.com/
   - `NFC_TAG_SECRET` - Any random secure string (e.g., `fortheboys2025`)
   - `SESSION_SECRET` - Random base64 string (generate with `openssl rand -base64 32`)
   - `CRON_SECRET` - Random base64 string (for future cron jobs)
   - `ENVIRONMENT` - Set to `production`

4. **Deploy**: Push to main branch triggers automatic deployment

Your app will be live at `https://your-project.pages.dev`

### Step 5: Local Development

```bash
# Run Next.js dev server with Cloudflare Pages adapter
npm run dev

# Or test with Cloudflare Pages locally
npm run pages:dev
```

Visit `http://localhost:3000`

---

## 🎮 Usage

### For Users

1. **First Time Setup**:
   - Visit the app URL
   - Scan your NFC tag (admin must configure your tag ID)
   - Create your username
   - You're in!

2. **Generate Smart Parlay**:
   - Go to Generator
   - Select sports (NFL, NBA, etc.)
   - Choose number of legs (2-5)
   - Set minimum edge (2%+ recommended)
   - Click "Generate Parlay"
   - Lock legs you want to keep
   - Regenerate unlocked legs for more options

3. **Track Performance**:
   - Save parlays to your portfolio
   - Mark as won/lost when settled
   - Watch your stats update automatically
   - Compete on the leaderboard

### For Admins

**Add New User:**
```bash
npx wrangler d1 execute mr-balls-db --remote --command "
INSERT INTO users (id, username, nfc_tag_id, created_at, state_code)
VALUES ('$(uuidgen)', 'BigTuna', 'user-nfc-tag-id', $(date +%s)000, 'MA')
"
```

**View Leaderboard:**
```bash
npx wrangler d1 execute mr-balls-db --remote --command "
SELECT username, wins, losses, units_profit, sharp_score
FROM users
ORDER BY units_profit DESC
LIMIT 10
"
```

**Check API Cache Status:**
```bash
npx wrangler d1 execute mr-balls-db --remote --command "
SELECT key, expires_at FROM api_cache ORDER BY expires_at DESC LIMIT 10
"
```

---

## 🔧 Scripts

```bash
npm run dev              # Next.js development server
npm run build            # Standard Next.js build
npm run pages:build      # Build for Cloudflare Pages (creates .vercel/output/static)
npm run pages:deploy     # Deploy directly to Cloudflare Pages
npm run pages:dev        # Local Cloudflare Pages development
npm run db:migrate       # Apply migrations to remote database
npm run db:local         # Apply migrations to local database
npm run db:studio        # Open D1 console
```

---

## 📊 Database Schema Highlights

- **users**: Profile, stats, sharp score, state code for geo-restrictions
- **sessions**: NFC-based authentication sessions
- **bets**: Parlay bets with analytics metadata
- **bet_legs**: Individual picks with edge/confidence scores
- **sharp_plays**: Auto-generated high-value plays (cron job)
- **line_history**: Odds movement tracking
- **api_cache**: Aggressive caching for rate limit management
- **leaderboard_cache**: Pre-computed rankings

See `migrations/0001_init.sql` and `migrations/0002_add_user_location.sql` for full schema.

---

## 🎨 Customization

### Adjust Cache TTL

Edit `lib/odds-api-client.ts`:
```typescript
// Line 52: Volatile odds data
await this.db.setCache(cacheKey, games, 600);  // 10 minutes

// Line 100: Stable game schedule
await this.db.setCache(cacheKey, games, 3600); // 1 hour
```

### Modify Edge Detection

Edit `lib/analytics-engine.ts` → `calculateEdge()`:
```typescript
// Adjust how aggressive edge detection is
const minEdgeThreshold = 0.02; // 2% minimum
```

### Add New Sports

1. Add sport key to `types/index.ts` Sport union type
2. Update UI filters in generator
3. Test with mock data

---

## 📈 Roadmap

### Phase 1: Core Platform ✅
- ✅ Next.js 15 + React 19 setup
- ✅ Cloudflare Pages deployment
- ✅ D1 database with migrations
- ✅ NFC authentication system
- ✅ Smart parlay generator
- ✅ Edge detection algorithm
- ✅ User stats tracking
- ✅ Leaderboard system
- ✅ GitHub auto-deploy

### Phase 2: Enhanced Analytics 🚧
- ⏳ Sharp Play of the Day (cron job)
- ⏳ Line movement tracking
- ⏳ Weather integration
- ⏳ Notification system
- 🔜 **Player props support** (high priority)
- 🔜 Multi-bookmaker comparison
- 🔜 Historical trends analysis

### Phase 3: Social Features 🔮
- 🔮 Bet tailing (copy other users' bets)
- 🔮 Group chat
- 🔮 Challenge system
- 🔮 Achievement badges
- 🔮 Weekly contests

### Phase 4: Advanced Features 🔮
- 🔮 Machine learning models for edge detection
- 🔮 Live bet tracking with push notifications
- 🔮 Cash-out optimizer
- 🔮 Mobile app (React Native)
- 🔮 Same-game parlay builder
- 🔮 Arbitrage opportunity scanner

---

## 🐛 Troubleshooting

**"Application error" on load:**
- Check browser console for specific error
- Verify environment variables are set in Cloudflare Pages
- Ensure database migrations have been run (`npm run db:migrate`)

**Build fails with "recursive invocation":**
- Ensure build command is `npm run pages:build` not `npm run build`
- Check `wrangler.toml` has `pages_build_output_dir = ".vercel/output/static"`

**"No such column: state_code" error:**
- Run migration: `npx wrangler d1 execute mr-balls-db --remote --command "ALTER TABLE users ADD COLUMN state_code TEXT"`

**Parlay generation fails:**
- Check Odds API key is valid
- Verify API hasn't hit rate limit (500/month free)
- Check cache with `SELECT COUNT(*) FROM api_cache`

**Font looks wrong:**
- Clear browser cache
- Verify `app/layout.tsx` imports Inter font
- Check Cloudflare deployment succeeded

---

## 💡 Tips for Staying Free

### 1. Optimize API Usage
```typescript
// Only fetch sports actively being used
// Limit to 1-2 bookmakers if needed
// Cache aggressively (10-60 min)
```

### 2. Monitor Usage
Check Cloudflare Dashboard regularly:
- D1 read/write counts
- Pages function invocations
- Build minutes used

### 3. Smart Fetching Strategy
- Don't fetch all sports at once
- Use selective sport queries
- Leverage cache before making API calls
- Consider limiting to next 48 hours of games if hitting limits

### 4. Future Optimization Ideas
- Limit bookmakers to DraftKings + FanDuel only (~70% reduction)
- Implement longer cache for games 5+ days out
- Add usage dashboard to monitor API quota

---

## 🔐 Security Notes

### NFC Authentication
- NFC tag IDs stored as-is (consider hashing in production)
- Sessions expire after 10 minutes of inactivity
- State codes for geo-restriction compliance

### Best Practices
- Keep all secrets truly secret (use Cloudflare environment variables)
- HTTPS enforced automatically by Cloudflare
- Regularly rotate session secrets
- Monitor for unusual activity in D1 logs

### Secrets Management
All secrets must be configured in **Cloudflare Pages Dashboard** → **Settings** → **Environment variables**:
- Never commit secrets to git
- Use strong random strings (32+ characters)
- Rotate secrets periodically

---

## 🤝 Contributing (For the Boys)

Want to add a feature?

1. Create a new branch: `git checkout -b feature/your-idea`
2. Make changes locally
3. Test thoroughly
4. Push and create PR
5. Get reviewed by the crew
6. Auto-deploys on merge to main

---

## 📜 License

Private - For the Boys Only™

---

## 🙏 Credits

Built with:
- Next.js 15 & React 19
- Cloudflare (Pages, Workers, D1)
- The Odds API
- Tailwind CSS
- TypeScript
- A healthy dose of degeneracy

---

**Remember**: This is for entertainment purposes. Bet responsibly. Don't chase losses. Never bet what you can't afford to lose. Must be 21+ and in a legal jurisdiction.

---

Made with 💸 by the boys, for the boys
