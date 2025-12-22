# 🚀 Quick Setup Guide

## What We've Built So Far

### ✅ Complete
1. **Project Structure**: Full Next.js + Cloudflare setup
2. **Database Schema**: Comprehensive D1 schema for users, bets, analytics
3. **Type System**: Full TypeScript definitions
4. **Database Layer**: CRUD operations for all entities
5. **Auth System**: NFC authentication with session management
6. **Analytics Engine**: Smart bet selection with multi-factor analysis

### 🏗️ Architecture Highlights

**Analytics Engine Features**:
- Line value calculation (vs market consensus)
- Sharp money analysis (Pinnacle vs DraftKings)
- Weather impact scoring
- Situational factors (Thursday night, back-to-backs)
- Key number analysis (NFL 3/7, NBA 2/3)
- Confidence scoring (0-10 scale)

**Smart Caching**:
- API responses cached to stay under free tier limits
- Configurable TTL per data type
- Automatic expiration

**Database Optimizations**:
- Indexed queries for performance
- Denormalized stats for fast leaderboards
- Cached aggregations

---

## Next Steps to Complete

### 1. API Routes (1-2 hours)
Create endpoints in `/app/api/`:

**Priority Routes**:
- `POST /api/auth/nfc` - NFC authentication
- `GET /api/auth/session` - Session validation
- `POST /api/analytics/generate` - Generate smart parlay
- `GET /api/bets/[id]` - Get bet by ID
- `POST /api/bets` - Create new bet
- `GET /api/users/me` - Get current user
- `GET /api/leaderboard` - Get rankings

### 2. UI Components (2-3 hours)
Build core components:

**Dashboard**:
- Stats cards (record, ROI, streak)
- Active bets list
- Today's sharp plays
- Mini leaderboard

**Generator**:
- Criteria form (sports, legs, edge)
- Generated parlay display
- Leg locking interface
- Confidence visualizations

**Portfolio**:
- Bet history table
- Filters (status, date range)
- Performance charts

### 3. Data Integration (1-2 hours)
Connect external APIs:

**The Odds API**:
- Fetch games endpoint
- Parse bookmaker data
- Transform to internal format

**Weather.gov**:
- Location to coordinates mapping
- Weather forecast parsing
- Cache aggressively (1hr TTL)

### 4. Testing & Polish (1-2 hours)
- Test analytics engine with real data
- Verify caching works
- Test NFC auth flow
- Mobile responsive check

---

## Development Workflow

### Day 1: API Routes
```bash
# Create API route structure
mkdir -p app/api/{auth,bets,analytics,users,leaderboard}

# Test each endpoint with curl
curl -X POST http://localhost:3000/api/auth/nfc \
  -H "Content-Type: application/json" \
  -d '{"nfc_tag_id": "your-tag"}'
```

### Day 2: UI Components
```bash
# Install UI component library (optional)
npm install @radix-ui/react-dialog @radix-ui/react-tabs

# Build components incrementally
# Start with Dashboard → Generator → Portfolio
```

### Day 3: Integration & Testing
```bash
# Test with real Odds API data
# npm run dev and generate actual parlays
# Verify caching logs in console

# Deploy to Cloudflare Pages
npm run pages:deploy
```

---

## Quick Start (Skip to Working App)

Want to see it working NOW? Here's the fastest path:

### 1. Setup (5 minutes)
```bash
cd mr-balls-v2
npm install
npx wrangler login
npx wrangler d1 create mr-balls-db
# Copy database_id to wrangler.toml
npm run db:migrate
```

### 2. Secrets (2 minutes)
```bash
npx wrangler secret put ODDS_API_KEY
# Paste your key

npx wrangler secret put NFC_TAG_SECRET
# Enter: test-secret-123

npx wrangler secret put SESSION_SECRET
# Enter: random-string-456
```

### 3. Test Locally (2 minutes)
```bash
npm run dev
# Visit http://localhost:3000
```

### 4. Deploy (3 minutes)
```bash
npm run pages:build
npm run pages:deploy
# Visit your live site!
```

---

## Estimated Timeline

**MVP (Basic Functionality)**:
- API Routes: 4 hours
- Basic UI: 6 hours
- Testing: 2 hours
- **Total**: ~12 hours

**Full Featured**:
- Advanced UI: +8 hours
- Social features: +4 hours
- Polish & optimization: +4 hours
- **Total**: ~28 hours

**Working Solo**: 3-4 full days
**With Help**: 1-2 weekends

---

## Cost Breakdown (Monthly)

### Free Tier (Current Setup)
- Cloudflare Pages: $0 ✅
- Cloudflare Workers: $0 (under 100k req/day) ✅
- Cloudflare D1: $0 (under 5GB/5M reads) ✅
- Cloudflare R2: $0 (under 10GB) ✅
- The Odds API: $0 (500 req/month) ✅
- Weather.gov: $0 ✅

**Monthly Total**: $0.00 🎉

### If You Outgrow Free Tier
- The Odds API ($99/mo for unlimited): $99
- Cloudflare Workers Paid: $5/mo
- Cloudflare D1 (if >5M reads): ~$5/mo

**Paid Total**: ~$109/mo

### Scaling Estimate
- 50 users, 10 bets/day each = 500 bets/day
- API calls: ~50/day (with caching)
- D1 reads: ~10k/day
- **Still free** ✅

---

## Pro Tips

### Maximize Free Tier

1. **Aggressive Caching**:
```typescript
// Cache odds for 10 minutes (only 144 calls/day)
await db.setCache('odds_nfl', data, 600);

// Cache weather for 1 hour (only 24 calls/day)
await db.setCache('weather_game_123', data, 3600);
```

2. **Batch Requests**:
```typescript
// Instead of 5 requests for 5 sports
// Make 1 request for all 5 sports
const allOdds = await oddsApi.getBulk(['nfl', 'nba', 'nhl', 'ncaaf', 'ncaab']);
```

3. **Smart Polling**:
```typescript
// Only fetch odds when user is actively generating
// Not on every page load
if (userAction === 'generate') {
  const odds = await fetchOdds();
}
```

### Monitor Usage

Create admin dashboard showing:
- API calls today
- Cache hit rate
- D1 reads/writes
- Active users

```sql
-- Check API usage
SELECT
  substr(key, 1, 20) as api,
  COUNT(*) as calls_today
FROM api_cache
WHERE expires_at > unixepoch('now', '-1 day') * 1000
GROUP BY substr(key, 1, 20);
```

---

## Common Issues & Solutions

### "Database not found"
```bash
# Recreate and migrate
npx wrangler d1 create mr-balls-db
npm run db:migrate
```

### "Secret not set"
```bash
# List secrets
npx wrangler secret list

# Set missing secret
npx wrangler secret put SECRET_NAME
```

### "Module not found"
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### "API rate limit exceeded"
```bash
# Check cache in database
npx wrangler d1 execute mr-balls-db --command "SELECT COUNT(*) FROM api_cache"

# Clear if needed
npx wrangler d1 execute mr-balls-db --command "DELETE FROM api_cache WHERE expires_at < $(date +%s)000"
```

---

## What's Already Working

You can immediately:
1. ✅ Create database with migrations
2. ✅ Store users and bets
3. ✅ Run analytics engine on mock data
4. ✅ Calculate edge scores
5. ✅ Generate smart parlays
6. ✅ Cache API responses

What needs API routes:
1. ⏳ Expose analytics via HTTP
2. ⏳ Handle auth flow
3. ⏳ CRUD operations

What needs UI:
1. ⏳ Forms and displays
2. ⏳ Charts and visualizations
3. ⏳ Real-time updates

---

## Want Me to Continue?

I can build next:

**Option A**: Core API routes (auth + generator)
**Option B**: Basic UI (dashboard + generator page)
**Option C**: Data integrations (Odds API + Weather)
**Option D**: Full working demo with mock data

Which would be most helpful?
