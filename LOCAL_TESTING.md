# Local Testing Guide

## ⚠️ Important: Telegram Bot is Local-Only

**The Telegram bot runs locally only and is NOT deployed to Vercel.**

- The webhook handler (`src/pages/api/telegram-webhook.ts`) is excluded from Vercel deployment
- The bot uses polling mode when running locally (see `scripts/test-bot-local.ts`)
- This prevents conflicts between local testing and Vercel deployments
- Double messages were caused by both local and Vercel instances running simultaneously

## Prerequisites

Before testing locally, make sure you have:

1. **Python 3.7+** installed
2. **spotify-dl** installed: `pip3 install spotify_dl`
3. **ffmpeg** installed (for MP3 conversion)
4. **.env file** configured with all required variables

## Quick Start

1. **Verify prerequisites:**
   ```bash
   # Check Python
   python3 --version
   
   # Check spotify-dl
   spotify_dl -h
   
   # Check ffmpeg
   ffmpeg -version
   ```

2. **Make sure your .env file is set up:**
   ```bash
   # Copy the example file if you haven't already
   cp .env.example .env
   
   # Edit .env with your actual values
   nano .env  # or use your preferred editor
   ```

3. **Start the bot in polling mode:**
   ```bash
   npm run bot:local
   # or
   npm run test-bot
   ```
   
   **Note:** The bot will automatically delete any active webhooks to enable polling mode.

4. **Test the bot:**
   - Open Telegram and find your bot: `@thebloc_bot`
   - Send `/start` to the bot
   - Click "Add New Song" button
   - Share a YouTube or Spotify link

## Testing Checklist

- [ ] Bot responds to `/start` command
- [ ] "Add New Song" button appears and works
- [ ] Bot prompts for URL after clicking button
- [ ] Valid YouTube URL is accepted
- [ ] Valid Spotify URL is accepted
- [ ] Invalid URL shows error message
- [ ] Song downloads successfully
- [ ] Song uploads to Dreamhost FTP
- [ ] Success message is sent to user

## Troubleshooting

### "spotify-dl not found"
```bash
pip3 install spotify_dl
# Verify installation
spotify_dl -h
```

### "ffmpeg not found"
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

### "TELEGRAM_BOT_TOKEN not set"
- Make sure you have a `.env` file in the project root
- Check that `TELEGRAM_BOT_TOKEN` is set in the `.env` file
- Restart the bot script

### "FTP connection failed"
- Verify FTP credentials in `.env`
- Check that `DREAMHOST_FTP_PATH` is correct
- Test FTP connection manually:
  ```bash
  ftp files.bloc.rocks
  ```

### Bot doesn't respond
- Make sure the bot script is running
- Check console for error messages
- Verify bot token is correct
- Try sending `/start` again

## Testing with Sample URLs

**YouTube:**
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`

**Spotify:**
- `https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC`
- `https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX`

## Stopping the Bot

Press `Ctrl+C` in the terminal where the bot is running.

## Next Steps

After successful local testing:
1. Deploy the website to Vercel (the Telegram bot stays local-only)
2. The bot will continue running locally using polling mode
3. If you want to deploy the bot elsewhere in the future, you can use the webhook handler as a reference

## Why Local-Only?

The Telegram bot is kept local-only to:
- Prevent conflicts between local testing and Vercel deployments
- Avoid double messages from multiple instances
- Simplify the deployment process
- Keep bot functionality separate from the website deployment

If you need to deploy the bot to a server in the future, you can:
1. Use the webhook handler code as a reference
2. Deploy to a separate service (not Vercel)
3. Set up the webhook using `scripts/setup-webhook.sh`

