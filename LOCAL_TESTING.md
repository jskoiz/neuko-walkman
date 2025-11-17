# Local Testing Guide

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
   npm run test-bot
   ```

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
1. Deploy to Vercel
2. Set up webhook (see TELEGRAM_BOT_SETUP.md)
3. Configure environment variables in Vercel dashboard

