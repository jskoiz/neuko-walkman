# Telegram Bot Setup Guide

This guide explains how to set up and configure the Telegram bot for the community playlist feature.

## Important: Bot is Local-Only

⚠️ **The Telegram bot runs locally only and is NOT deployed to Vercel.**

- The bot uses **polling mode** when running locally (see `scripts/test-bot-local.ts`)
- This prevents conflicts between local testing and Vercel deployments
- Double messages were caused by both local and Vercel instances running simultaneously
- The bot automatically deletes any active webhooks to enable polling mode

## Prerequisites

Before setting up the bot, ensure you have:

1. **Python 3.7+** - Required for spotify-dl
2. **ffmpeg** - Required for MP3 conversion
3. **spotify-dl** - Python package for downloading songs
4. **Spotify Developer Account** - For Spotify API credentials

### Verify Prerequisites

```bash
# Check Python
python3 --version

# Check spotify-dl
spotify_dl -h

# Check ffmpeg
ffmpeg -version
```

## Installation Steps

### 1. Install Python Dependencies

```bash
pip3 install spotify_dl
```

### 2. Install ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install -y ffmpeg
# or
sudo apt-get install -y libav-tools
```

**Windows:**
Download FFMPEG pre-built binaries from [here](https://ffmpeg.org/download.html) and add to PATH.

### 3. Set Up Spotify Developer Account

1. Go to [Spotify Developer Console](https://developer.spotify.com/console/)
2. Click "Create an App"
3. Fill in app name and description
4. Note your **Client ID** and **Client Secret**

### 4. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Telegram Bot (Required)
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_ADMIN_IDS=123456789,987654321  # Comma-separated admin user IDs

# Spotify API (Required for Spotify downloads)
SPOTIPY_CLIENT_ID=your-spotify-client-id
SPOTIPY_CLIENT_SECRET=your-spotify-client-secret

# Dreamhost FTP (Required)
DREAMHOST_FTP_HOST=files.bloc.rocks
DREAMHOST_FTP_USER=your-ftp-username
DREAMHOST_FTP_PASSWORD=your-ftp-password
DREAMHOST_FTP_PATH=/public/music/community
DREAMHOST_USE_SFTP=false  # Set to "true" for SFTP

# Optional Configuration
MAX_FILE_SIZE=52428800  # 50MB in bytes (default)
PUBLIC_SITE_URL=https://your-site.vercel.app  # For playlist updates
PLAYLIST_UPDATE_TOKEN=optional-auth-token  # For securing playlist update endpoint
```

**Note:** These environment variables are only needed locally. The Telegram bot is not deployed to Vercel.

## Running the Bot

### Quick Start

```bash
# Run bot locally (automatically deletes webhook if needed)
npm run bot:local
```

The bot will:
- Automatically check for and delete any active webhooks
- Start polling Telegram for updates
- Run continuously until stopped (Ctrl+C)
- Handle all bot interactions locally

### Testing Checklist

When testing the bot, verify:

- [ ] Bot responds to `/start` command
- [ ] "Add Song to Community" button appears and works
- [ ] Bot prompts for URL after clicking button
- [ ] Valid YouTube URL is accepted
- [ ] Valid Spotify URL is accepted
- [ ] Invalid URL shows error message
- [ ] Song downloads successfully
- [ ] Song uploads to Dreamhost FTP
- [ ] Success message is sent to user
- [ ] Playlists update automatically

## Usage

1. Users send `/start` to the bot
2. Bot responds with welcome message and photo
3. User clicks "Add Song to Community" button
4. User shares a YouTube or Spotify link
5. Bot downloads the song, uploads to Dreamhost, updates playlists, and confirms

### Supported URL Formats

**YouTube:**
- `https://www.youtube.com/watch?v=...`
- `https://youtu.be/...`

**Spotify:**
- `https://open.spotify.com/track/...`
- `https://open.spotify.com/album/...`

## Security Features

- **Rate Limiting**: 5 requests per user per minute
- **File Size Limits**: Configurable (default 50MB)
- **Filename Sanitization**: Prevents path traversal and special characters
- **URL Validation**: Strict validation of YouTube/Spotify URLs
- **Admin Controls**: Admin users can add songs to any playlist and delete songs

## Troubleshooting

### Bot doesn't start

**"TELEGRAM_BOT_TOKEN not set"**
- Make sure you have a `.env` file in the project root
- Check that `TELEGRAM_BOT_TOKEN` is set in the `.env` file
- Restart the bot script

**"Invalid bot token"**
- Verify your bot token is correct
- Get a new token from [@BotFather](https://t.me/BotFather) if needed

### Bot doesn't respond

- Make sure the bot script is running (`npm run bot:local`)
- Check console for error messages
- Verify bot token is correct
- Try sending `/start` again
- Check that webhook was deleted (bot will do this automatically)

### spotify-dl not found

```bash
pip3 install spotify_dl
# Verify installation
spotify_dl -h
```

### ffmpeg not found

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
# or
sudo apt-get install libav-tools
```

### FTP Connection Issues

- Verify FTP credentials in `.env` file
- Check that `DREAMHOST_FTP_PATH` is correct
- Test FTP connection manually:
  ```bash
  ftp files.bloc.rocks
  ```
- Ensure firewall allows FTP connections

### Download Failures

- Check that the URL is valid and accessible
- Verify Spotify API credentials are set correctly in `.env`
- Check console logs for detailed error messages
- Ensure the song file size is under the limit (default 50MB)

### Webhook Conflicts

If you see "CONFLICT: Webhook is active" errors:

- The bot will automatically try to delete the webhook
- If automatic deletion fails, manually delete it:
  ```bash
  npm run delete-webhook
  # or
  curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
  ```
- Then restart the bot: `npm run bot:local`

## Testing with Sample URLs

**YouTube:**
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`

**Spotify:**
- `https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC`
- `https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX`

## Stopping the Bot

Press `Ctrl+C` in the terminal where the bot is running.

## Why Local-Only?

The Telegram bot is kept local-only to:
- Prevent conflicts between local testing and Vercel deployments
- Avoid double messages from multiple instances
- Simplify the deployment process
- Keep bot functionality separate from the website deployment

## Admin Features

Admin users (IDs set in `TELEGRAM_ADMIN_IDS`) have access to:

- **Restricted Access Menu**: Additional admin-only options
- **Add Song to Any Playlist**: Choose which playlist to add songs to
- **Delete Songs**: Remove songs from playlists

To use admin features:
1. Set your Telegram user ID in `TELEGRAM_ADMIN_IDS` environment variable
2. Restart the bot
3. Send `/start` to see the "Restricted Access" option

## Notes

- Songs are downloaded to temporary storage, then uploaded to Dreamhost
- Playlists are automatically regenerated after each song addition
- The bot processes downloads asynchronously
- Rate limiting prevents abuse and ensures fair usage
- Local copies of songs are saved to `public/music/community/` for local testing

## Next Steps

After successful local testing:
1. Deploy the website to Vercel (the Telegram bot stays local-only)
2. The bot will continue running locally using polling mode
3. Users can interact with the bot via Telegram
4. Songs submitted via bot will appear on the website
