# M.R. B.A.L.L.S. v2.0 Deployment Guide

## Overview

Once deployed to Cloudflare Pages, you can **share the link with your friends and it will work immediately**. They just need to scan their NFC tags to authenticate.

## Quick Start Deployment

### 1. Push to GitHub (if not already done)

```bash
git init
git add .
git commit -m "Initial M.R. B.A.L.L.S. v2.0 deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mr-balls-v2.git
git push -u origin main
```

### 2. Deploy to Cloudflare Pages

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages**
3. Click **Create Application** → **Pages** → **Connect to Git**
4. Select your repository: `mr-balls-v2`
5. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages@1`
   - **Build output directory**: `.vercel/output/static`
6. Click **Save and Deploy**

#### Option B: Via Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy .vercel/output/static --project-name mr-balls-v2
```

### 3. Set Up Environment Variables

In Cloudflare Dashboard → Your Pages Project → Settings → Environment Variables:

```bash
# Required
ODDS_API_KEY=ff9a8a23c60b12443abca977ec686d1a
NFC_TAG_SECRET=fortheboys2025
SESSION_SECRET=mNPztTeyvyYaPL+2kSaMZSBZn3SBFuYkM14MpoaJAa4=

# For cron job (Sharp Play of the Day)
CRON_SECRET=your-secure-random-secret-here
```

**To generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Set Up D1 Database

```bash
# Create the database (if not already created)
wrangler d1 create mr-balls-db

# Run migrations
wrangler d1 execute mr-balls-db --file=./migrations/0001_init.sql
wrangler d1 execute mr-balls-db --file=./migrations/0002_add_user_location.sql
```

### 5. Enable Cron Triggers

The cron trigger is already configured in `wrangler.toml`:
```toml
[triggers]
crons = ["0 0 * * *"]  # Runs at midnight UTC daily
```

This will automatically generate the Sharp Play of the Day every day at midnight.

**To manually trigger (for testing):**
```bash
curl -X POST https://your-site.pages.dev/api/sharp-play/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Sharing with Friends

### Your Site Will Be Live At:
```
https://mr-balls-v2.pages.dev
```

Or your custom domain if you set one up.

### How Friends Access It:

1. **Send them the link**: Just share `https://your-site.pages.dev`
2. **NFC Tag Authentication**: They scan their NFC tag to log in
3. **Create Username**: First-time users create a username
4. **Start Betting**: They can immediately generate parlays, place bets, compete on leaderboard

### No Installation Required

- ✅ Works on any device with a browser
- ✅ No app to download
- ✅ NFC tags handle authentication
- ✅ All data stored in Cloudflare D1
- ✅ Runs on Cloudflare's global edge network (super fast)

## Custom Domain (Optional)

To use your own domain (e.g., `mrballs.com`):

1. Go to your Cloudflare Pages project
2. Navigate to **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain
5. Cloudflare will automatically configure DNS

## NFC Tags Setup

Each friend needs an NFC tag:

1. **Buy NFC Tags**: Get NTAG215 tags on Amazon (~$0.50 each)
2. **Write Tag ID**: Use NFC Tools app (iOS/Android)
3. **Write a unique text value** to each tag (e.g., "tyler_tag_001", "mike_tag_002")
4. **Give tags to friends**: They scan to authenticate

### Optional: Enhanced Security

If you want to require a secret on NFC tags:
- Set `NFC_TAG_SECRET` in environment variables
- All tags must contain this secret to authenticate
- More secure but less convenient

## Monitoring & Logs

### View Logs
```bash
wrangler pages deployment tail
```

### Check Sharp Play Generation
Visit: `https://your-site.pages.dev/api/sharp-play/daily`

Should return:
```json
{
  "success": true,
  "sharp_play": { ... }
}
```

## Troubleshooting

### Issue: "No sharp play available yet"
**Solution**: Manually trigger generation:
```bash
curl -X POST https://your-site.pages.dev/api/sharp-play/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Issue: "Failed to fetch odds"
**Solution**: Check your Odds API key is correct and has credits

### Issue: Database errors
**Solution**: Make sure migrations ran successfully:
```bash
wrangler d1 execute mr-balls-db --command "SELECT * FROM users LIMIT 1"
```

### Issue: Authentication not working
**Solution**: Clear cookies and try again, or check SESSION_SECRET is set

## Cost Estimate

With Cloudflare's free tier:
- ✅ **Hosting**: FREE (100,000 requests/day)
- ✅ **D1 Database**: FREE (5GB storage, 5 million reads/day)
- ✅ **Cron Triggers**: FREE (included)
- 💰 **Odds API**: ~$10-30/month (depending on usage)

**Total**: $10-30/month for your entire friend group!

## Updates & Maintenance

To deploy updates:
```bash
git add .
git commit -m "Update description"
git push
```

Cloudflare will automatically rebuild and deploy.

## Advanced: Analytics

To track usage, add Cloudflare Analytics:
1. Go to Analytics → Web Analytics
2. Add your site
3. Copy the beacon script
4. Add to `app/layout.tsx`

## Security Notes

- All API keys are stored as environment variables (not in code)
- Sessions expire after 10 minutes of inactivity
- NFC tags can be optionally secret-protected
- HTTPS enforced automatically by Cloudflare
- Database is isolated per user

## Support

If you run into issues:
1. Check Cloudflare Pages logs
2. Review `wrangler.toml` configuration
3. Verify environment variables are set
4. Test API endpoints directly

---

## Summary

**Yes, once deployed you can just share the link!**

Your friends:
- Visit the URL
- Scan their NFC tag
- Create a username (first time only)
- Start using the app immediately

No installation, no app stores, no complex setup. Just a URL and NFC tags. 🎲🏈⚾🏀
