# Vercel Deployment Guide

This guide covers deploying the Pirate Radio website to Vercel. The Telegram bot runs locally and is **not** deployed to Vercel.

## Important: Deployment Protection

If your Vercel deployment shows "Authentication Required", you need to **disable deployment protection** or configure it to allow public access to API routes.

**To fix:**
1. Go to Vercel Dashboard → Your Project → **Settings** → **Deployment Protection**
2. Either:
   - **Disable protection** for preview deployments, OR
   - **Allow public access** to `/api/*` routes
3. Redeploy after making changes

**Alternative:** Deploy to **production** (not preview) - production deployments are usually public by default.

## Setup Steps

### 1. Deploy to Vercel

```bash
# If not already deployed
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

### 2. Set Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables:

**Required:**
- `DREAMHOST_FTP_HOST` - FTP host (e.g., `files.bloc.rocks`)
- `DREAMHOST_FTP_USER` - FTP username
- `DREAMHOST_FTP_PASSWORD` - FTP password
- `DREAMHOST_FTP_PATH` - Remote path (e.g., `/public/music`)
- `PUBLIC_SITE_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

**Optional:**
- `SPOTIPY_CLIENT_ID` - Spotify API client ID (if using Spotify features)
- `SPOTIPY_CLIENT_SECRET` - Spotify API secret (if using Spotify features)
- `MAX_FILE_SIZE` - Max file size in bytes (default: `52428800` = 50MB)
- `DREAMHOST_USE_SFTP` - Set to `"true"` if using SFTP instead of FTP
- `PLAYLIST_UPDATE_TOKEN` - Optional auth token for securing playlist update endpoint

**Note:** Telegram bot environment variables (`TELEGRAM_BOT_TOKEN`, etc.) are **not** needed in Vercel since the bot runs locally.

### 3. Verify Deployment

After deployment:

1. Visit your Vercel URL
2. Check that the website loads correctly
3. Verify playlists are loading from FTP
4. Test API endpoints:
   ```bash
   curl https://your-app.vercel.app/api/playlists.json
   ```

## How It Works

### Website Deployment

- **Astro Site**: Deployed as a serverless application
- **API Routes**: `/api/playlists.json` and `/api/update-playlists` run as serverless functions
- **Dynamic Playlists**: API endpoints scan DreamHost FTP to generate playlists on-the-fly
- **No Build-Time Playlists**: Playlists are always fetched dynamically from FTP

### Telegram Bot (Local Only)

The Telegram bot is **not** deployed to Vercel:

- Runs locally using polling mode (`npm run bot:local`)
- Automatically deletes webhooks to enable polling
- Handles song submissions and uploads to DreamHost FTP
- Triggers playlist updates via API endpoint

See [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md) for bot setup instructions.

## Troubleshooting

### Website doesn't load playlists

1. **Check Environment Variables:**
   - Verify FTP credentials are set in Vercel dashboard
   - Ensure `PUBLIC_SITE_URL` matches your Vercel URL
   - Redeploy after adding/updating environment variables

2. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the latest deployment → Functions tab
   - Check for errors in `/api/playlists.json`

3. **Test API Endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/playlists.json
   ```
   Should return JSON with playlists array.

### FTP Connection Errors

- Verify FTP credentials are correct in Vercel environment variables
- Check that `DREAMHOST_FTP_PATH` exists and is accessible
- Ensure firewall allows FTP/SFTP connections
- Try setting `DREAMHOST_USE_SFTP=true` if FTP fails

### Playlists are empty

- Verify music files exist on DreamHost FTP
- Check that directory structure matches expected format (folders = playlists)
- Ensure audio files have supported extensions (mp3, wav, ogg, m4a, aac, flac)
- Check Vercel function logs for scanning errors

### API endpoint returns 500 error

- Check Vercel function logs for detailed error messages
- Verify all required environment variables are set
- Ensure FTP credentials are correct
- Check that FTP server is accessible from Vercel's network

## Environment Variables Reference

| Variable | Required | Description |
|---------|----------|-------------|
| `DREAMHOST_FTP_HOST` | Yes | FTP/SFTP hostname |
| `DREAMHOST_FTP_USER` | Yes | FTP username |
| `DREAMHOST_FTP_PASSWORD` | Yes | FTP password |
| `DREAMHOST_FTP_PATH` | Yes | Base path for music files |
| `PUBLIC_SITE_URL` | Yes | Your Vercel deployment URL |
| `DREAMHOST_USE_SFTP` | No | Set to `"true"` for SFTP |
| `SPOTIPY_CLIENT_ID` | No | Spotify API client ID |
| `SPOTIPY_CLIENT_SECRET` | No | Spotify API secret |
| `MAX_FILE_SIZE` | No | Max file size in bytes (default: 52428800) |
| `PLAYLIST_UPDATE_TOKEN` | No | Auth token for playlist updates |

## Deployment Workflow

1. **Push to Repository**: Changes trigger automatic deployment
2. **Vercel Build**: Runs `npm run build` (which generates playlists)
3. **Deploy**: Serverless functions and static assets are deployed
4. **Runtime**: API endpoints scan FTP dynamically on each request

## Important Notes

- **No Static Playlists**: Playlists are always generated dynamically from FTP
- **No Bot Deployment**: Telegram bot runs locally, not on Vercel
- **API Routes**: `/api/playlists.json` scans FTP on every request (no caching)
- **Environment Variables**: Must be set in Vercel dashboard, not just `.env` file
- **Redeploy Required**: After adding/updating environment variables, redeploy the project

## Next Steps

After successful deployment:

1. Verify website loads and playlists display correctly
2. Set up Telegram bot locally (see [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md))
3. Test song submission via Telegram bot
4. Verify songs appear on website after upload
