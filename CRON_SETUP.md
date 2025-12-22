# Cron Job Setup for Sharp Play of the Day

To automatically generate the Sharp Play of the Day at midnight UTC, you need to set up a Cloudflare Workers Cron Trigger.

## Option 1: Using wrangler.toml

Add the following to your `wrangler.toml` file:

```toml
[triggers]
crons = ["0 0 * * *"]  # Runs at midnight UTC daily
```

Then create a `_worker.js` file with:

```javascript
export default {
  async scheduled(event, env, ctx) {
    // Generate daily sharp play
    const response = await fetch('https://your-domain.com/api/sharp-play/daily', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
      },
    });

    console.log('Sharp play generated:', await response.text());
  },
};
```

## Option 2: Using Cloudflare Dashboard

1. Go to your Cloudflare Pages project
2. Navigate to Settings > Functions > Cron Triggers
3. Add a new cron trigger:
   - Schedule: `0 0 * * *` (midnight UTC)
   - Target URL: `/api/sharp-play/daily`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

## Option 3: External Service (Cron-job.org, EasyCron, etc.)

Set up a cron job to POST to:
```
https://your-domain.com/api/sharp-play/daily
```

With header:
```
Authorization: Bearer YOUR_CRON_SECRET
```

## Environment Variable

Make sure to set the `CRON_SECRET` environment variable in your Cloudflare Pages settings:

```bash
# Generate a secure secret
CRON_SECRET=your-secure-random-secret-here
```

This prevents unauthorized generation of sharp plays.

## Manual Generation

To manually trigger sharp play generation (for testing):

```bash
curl -X POST https://your-domain.com/api/sharp-play/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Notes

- Sharp plays expire after 24 hours or when the game starts (whichever is sooner)
- The system automatically finds the bet with highest edge + confidence
- All users see the same sharp play for the day
- Only one sharp play is generated per day (cached)
