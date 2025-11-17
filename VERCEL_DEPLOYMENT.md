# Vercel Deployment Guide

## ⚠️ Important: Deployment Protection

If your Vercel deployment shows "Authentication Required", you need to **disable deployment protection** or configure it to allow public access to API routes.

**To fix:**
1. Go to Vercel Dashboard → Your Project → **Settings** → **Deployment Protection**
2. Either:
   - **Disable protection** for preview deployments, OR
   - **Allow public access** to `/api/*` routes
3. Redeploy after making changes

**Alternative:** Deploy to **production** (not preview) - production deployments are usually public by default.

## How the Telegram Bot Works on Vercel

**Important:** The bot runs automatically on Vercel via **webhook**, not polling. You don't need to run it locally or as a separate process.

### How It Works

1. **Local Development (Polling Mode):**
   - Run `npm run dev` or `npm run dev:bot`
   - Bot continuously polls Telegram for new messages
   - Good for testing and development

2. **Vercel Production (Webhook Mode):**
   - Bot is deployed as an API route: `/api/telegram-webhook`
   - Telegram sends updates directly to your Vercel URL
   - No separate process needed - it's serverless!

## Setup Steps

### 1. Deploy to Vercel

```bash
# If not already deployed
vercel --prod
```

### 2. Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables:

**Required:**
- `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- `SPOTIPY_CLIENT_ID` - Spotify API client ID
- `SPOTIPY_CLIENT_SECRET` - Spotify API client secret
- `DREAMHOST_FTP_HOST` - FTP host (e.g., files.bloc.rocks)
- `DREAMHOST_FTP_USER` - FTP username
- `DREAMHOST_FTP_PASSWORD` - FTP password
- `DREAMHOST_FTP_PATH` - Remote path (e.g., /public/music/community)
- `PUBLIC_SITE_URL` - Your Vercel URL: `https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app`

**Optional:**
- `TELEGRAM_WEBHOOK_SECRET` - Secret token for webhook security (recommended)
- `MAX_FILE_SIZE` - Max file size in bytes (default: 52428800 = 50MB)
- `DREAMHOST_USE_SFTP` - Set to "true" if using SFTP instead of FTP

### 3. Set Up Telegram Webhook

After deployment, configure Telegram to send updates to your Vercel URL:

**Your Vercel URL:** `https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app`

**Option A: Using the script (easiest)**
```bash
# Make sure TELEGRAM_BOT_TOKEN is in your .env file
npm run setup-webhook https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app [your-webhook-secret]
```

**Option B: Using curl manually**
```bash
# Without secret token
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app/api/telegram-webhook"}'

# With secret token (recommended)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app/api/telegram-webhook",
    "secret_token": "your-webhook-secret-here"
  }'
```

### 4. Verify Webhook is Working

```bash
# Check webhook status
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

You should see:
- `"url": "https://your-app.vercel.app/api/telegram-webhook"`
- `"pending_update_count": 0` (or a small number)

### 5. Test the Bot

1. Open Telegram and find your bot
2. Send `/start` to the bot
3. You should receive a welcome message with the photo
4. Click "Add New Song" and test adding a song

## Troubleshooting

### Bot doesn't respond

1. **Check webhook is set:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

2. **Check Vercel logs:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the latest deployment → Functions tab
   - Check for errors in `/api/telegram-webhook`

3. **Verify environment variables:**
   - Make sure all required env vars are set in Vercel
   - Redeploy after adding new env vars

4. **Test the endpoint manually:**
   ```bash
   # This should return an error about missing update, but confirms endpoint works
   curl -X POST https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app/api/telegram-webhook \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

### Webhook returns 401 Unauthorized

- Make sure `TELEGRAM_WEBHOOK_SECRET` in Vercel matches the secret token you set in the webhook
- Or remove the secret token from both places if you don't want to use it

### Bot responds but song upload fails

- Check FTP credentials in Vercel environment variables
- Verify the FTP path exists and is writable
- Check Vercel function logs for detailed error messages

## Local Testing vs Production

| Feature | Local (`npm run dev:bot`) | Vercel (Webhook) |
|---------|-------------------------|------------------|
| Mode | Polling (checks for messages) | Webhook (receives messages) |
| Process | Continuous running process | Serverless function |
| Setup | Just run the command | Set webhook URL |
| Use Case | Development & testing | Production |

## Important Notes

- **You don't need to run the bot locally** for production - it works automatically on Vercel
- The webhook endpoint is at: `https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app/api/telegram-webhook`
- After setting the webhook, Telegram will send ALL bot messages to your Vercel deployment
- If you want to test locally while webhook is active, you'll need to delete the webhook first:
  ```bash
  curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
  ```

