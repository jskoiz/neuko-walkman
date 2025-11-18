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
- `npm run bot:local` - Run Telegram bot locally (polling mode, auto-deletes webhook)
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test-bot` - Test Telegram bot in polling mode (alias for dev:bot)
- `npm run setup-webhook` - Set webhook (for future deployment elsewhere, not Vercel)
- `npm run delete-webhook` - Delete webhook (for local development)

## Deployment

### Vercel Deployment

⚠️ **Important:** The Telegram bot is **local-only** and is NOT deployed to Vercel. This prevents conflicts and double messages.

1. **Set Environment Variables** in Vercel dashboard (for website only):
   - `SPOTIPY_CLIENT_ID` - Spotify API client ID (if needed for website features)
   - `SPOTIPY_CLIENT_SECRET` - Spotify API secret (if needed for website features)
   - `DREAMHOST_FTP_HOST` - FTP host (e.g., files.bloc.rocks)
   - `DREAMHOST_FTP_USER` - FTP username
   - `DREAMHOST_FTP_PASSWORD` - FTP password
   - `DREAMHOST_FTP_PATH` - Remote path for music files
   - `PUBLIC_SITE_URL` - Your Vercel deployment URL
   - `MAX_FILE_SIZE` - Optional, default 52428800 (50MB)

   **Note:** Telegram bot environment variables (`TELEGRAM_BOT_TOKEN`, etc.) are only needed locally, not in Vercel.

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

### Telegram Bot (Local Only)

**The Telegram bot runs locally only** using polling mode. It is excluded from Vercel deployment to prevent conflicts.

```bash
# Run bot locally (automatically deletes webhook if needed)
npm run bot:local

# Or delete webhook manually first
npm run delete-webhook
npm run bot:local
```

The bot will:
- Automatically delete any active webhooks to enable polling mode
- Run continuously until stopped (Ctrl+C)
- Handle all bot interactions locally

See [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md) for detailed setup instructions.
