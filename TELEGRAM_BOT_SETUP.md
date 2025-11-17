# Telegram Bot Setup Guide

This guide explains how to set up and configure the Telegram bot for the community playlist feature.

## Prerequisites

1. **Python 3.7+** - Required for spotify-dl
2. **ffmpeg** - Required for MP3 conversion
3. **spotify-dl** - Python package for downloading songs
4. **Spotify Developer Account** - For Spotify API credentials

## Installation Steps

### 1. Install Python Dependencies

```bash
pip3 install spotify_dl
```

### 2. Install ffmpeg

**Linux:**
```bash
sudo apt-get install -y libav-tools
# or
sudo apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download FFMPEG pre-built binaries from [here](https://ffmpeg.org/download.html) and add to PATH.

### 3. Set Up Spotify Developer Account

1. Go to [Spotify Developer Console](https://developer.spotify.com/console/)
2. Click "Create an App"
3. Fill in app name and description
4. Note your **Client ID** and **Client Secret**

### 4. Configure Environment Variables

Add the following environment variables to your Vercel project (or `.env` file for local development):

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_WEBHOOK_SECRET=your-secret-token-here  # Optional but recommended

# Spotify API
SPOTIPY_CLIENT_ID=your-spotify-client-id
SPOTIPY_CLIENT_SECRET=your-spotify-client-secret

# Dreamhost FTP
DREAMHOST_FTP_HOST=files.bloc.rocks
DREAMHOST_FTP_USER=your-ftp-username
DREAMHOST_FTP_PASSWORD=your-ftp-password
DREAMHOST_FTP_PATH=/path/to/public/music/community

# Optional Configuration
MAX_FILE_SIZE=52428800  # 50MB in bytes (default)
PUBLIC_SITE_URL=https://your-site.vercel.app  # For playlist updates
PLAYLIST_UPDATE_TOKEN=optional-auth-token  # For securing playlist update endpoint
```

### 5. Set Up Telegram Webhook

After deploying to Vercel, set the webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-site.vercel.app/api/telegram-webhook"}'
```

To set a webhook secret (recommended):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-site.vercel.app/api/telegram-webhook",
    "secret_token": "your-secret-token-here"
  }'
```

### 6. Verify Webhook

Check webhook status:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## Usage

1. Users send `/start` to the bot
2. Bot responds with an "Add New Song" button
3. User clicks button and shares a YouTube or Spotify link
4. Bot downloads the song, uploads to Dreamhost, updates playlists, and confirms

## Security Features

- **Rate Limiting**: 5 requests per user per minute
- **File Size Limits**: Configurable (default 50MB)
- **Filename Sanitization**: Prevents path traversal and special characters
- **Webhook Secret**: Optional validation for webhook requests
- **URL Validation**: Strict validation of YouTube/Spotify URLs

## Troubleshooting

### spotify-dl not found
- Ensure Python 3.7+ is installed
- Install spotify-dl: `pip3 install spotify_dl`
- Verify it's in PATH: `which spotify_dl` or `spotify_dl -h`

### ffmpeg not found
- Install ffmpeg (see Installation Steps above)
- Verify installation: `ffmpeg -version`

### FTP Connection Issues
- Verify FTP credentials are correct
- Check that the remote path exists
- Ensure firewall allows FTP connections

### Download Failures
- Check that the URL is valid and accessible
- Verify Spotify API credentials are set correctly
- Check server logs for detailed error messages

## API Endpoints

### POST /api/telegram-webhook
Main webhook endpoint for Telegram bot messages.

### POST /api/update-playlists
Regenerates playlists.json after a new song is added.
Optional: Include `Authorization: Bearer <PLAYLIST_UPDATE_TOKEN>` header.

## Notes

- Songs are downloaded to temporary storage, then uploaded to Dreamhost
- Playlists are automatically regenerated after each song addition
- The bot responds immediately to Telegram (within 3 seconds) and processes downloads asynchronously
- Rate limiting prevents abuse and ensures fair usage

