# Pirate Radio

A fun interactive CD player project showcasing the sounds of Neuko, featuring a retro Walkman interface inspired by the original site's cool CRT UI.

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Start both Astro dev server and Telegram bot (unified)
npm run dev

# Or run individually:
npm run dev:astro  # Just the Astro dev server
npm run dev:bot    # Just the Telegram bot (polling mode)
```

### Available Scripts

- `npm run dev` - Start both Astro dev server and Telegram bot concurrently
- `npm run dev:astro` - Start only the Astro dev server
- `npm run dev:bot` - Start only the Telegram bot (local polling mode)
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test-bot` - Test Telegram bot in polling mode (alias for dev:bot)

## Deployment

### Vercel Deployment

1. **Set Environment Variables** in Vercel dashboard:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
   - `TELEGRAM_WEBHOOK_SECRET` - Optional webhook secret for security
   - `SPOTIPY_CLIENT_ID` - Spotify API client ID
   - `SPOTIPY_CLIENT_SECRET` - Spotify API client secret
   - `DREAMHOST_FTP_HOST` - FTP host (e.g., files.bloc.rocks)
   - `DREAMHOST_FTP_USER` - FTP username
   - `DREAMHOST_FTP_PASSWORD` - FTP password
   - `DREAMHOST_FTP_PATH` - Remote path for music files
   - `PUBLIC_SITE_URL` - Your Vercel deployment URL: `https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app`
   - `MAX_FILE_SIZE` - Optional, default 52428800 (50MB)

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Set Telegram Webhook** after deployment:
   ```bash
   # Easy way - using the script (make sure TELEGRAM_BOT_TOKEN is in .env)
   npm run setup-webhook https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app
   
   # Or manually with curl
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://neuko-walkman-git-dev-jerrys-projects-56fec7b3.vercel.app/api/telegram-webhook",
       "secret_token": "your-secret-token-here"
     }'
   ```

See [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md) for detailed setup instructions.
