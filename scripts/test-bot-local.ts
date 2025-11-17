/**
 * Local testing script for Telegram bot using polling
 * Run with: npx tsx scripts/test-bot-local.ts
 * or: node --loader ts-node/esm scripts/test-bot-local.ts
 */

import {
  sendMessage,
  answerCallbackQuery,
  createInlineKeyboard,
  isValidSongUrl,
} from '../src/utils/telegram-bot';
import { downloadSongAsBuffer } from '../src/utils/download-song';
import { uploadToDreamhost } from '../src/utils/upload-to-dreamhost';
import { checkRateLimit, getResetTime } from '../src/utils/rate-limiter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000;

// User session state
const userSessions = new Map<number, 'waiting_for_url'>();
let lastUpdateId = 0;

/**
 * Get updates from Telegram
 */
async function getUpdates(): Promise<any[]> {
  const url = `${TELEGRAM_API_URL}${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching updates:', error);
    return [];
  }
}

/**
 * Process song download and upload
 */
async function processSongSubmission(chatId: number, url: string): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Starting song submission for chat ${chatId}, URL: ${url}`);
    
    // Check rate limit
    const userId = chatId.toString();
    if (!checkRateLimit(userId, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
      const resetTime = getResetTime(userId);
      const waitSeconds = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
      console.log(`[${new Date().toISOString()}] Rate limit exceeded for user ${userId}`);
      await sendMessage(
        botToken,
        chatId,
        `⏳ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`
      );
      return;
    }

    // Send initial processing message
    console.log(`[${new Date().toISOString()}] Sending processing message to chat ${chatId}`);
    await sendMessage(
      botToken,
      chatId,
      '🎵 Processing your song... This may take a minute.'
    );

    // Download the song
    const spotifyClientId = process.env.SPOTIPY_CLIENT_ID;
    const spotifyClientSecret = process.env.SPOTIPY_CLIENT_SECRET;
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800');
    
    console.log(`[${new Date().toISOString()}] Starting download from: ${url}`);
    console.log(`[${new Date().toISOString()}] Spotify Client ID: ${spotifyClientId ? 'Set' : 'NOT SET'}`);
    console.log(`[${new Date().toISOString()}] Spotify Client Secret: ${spotifyClientSecret ? 'Set' : 'NOT SET'}`);
    
    const { buffer, fileName, title } = await downloadSongAsBuffer(
      url,
      spotifyClientId,
      spotifyClientSecret,
      maxFileSize
    );

    console.log(`[${new Date().toISOString()}] Download complete: ${fileName} (${Math.round(buffer.length / 1024 / 1024)}MB)`);

    // Upload to Dreamhost
    const ftpHost = process.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = process.env.DREAMHOST_FTP_USER;
    const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
    const ftpPath = process.env.DREAMHOST_FTP_PATH || '/public/music/community';

    if (!ftpUser || !ftpPassword) {
      throw new Error('FTP credentials not configured');
    }

    console.log(`[${new Date().toISOString()}] Uploading to Dreamhost...`);
    console.log(`[${new Date().toISOString()}] FTP Host: ${ftpHost}`);
    console.log(`[${new Date().toISOString()}] FTP User: ${ftpUser ? 'Set' : 'NOT SET'}`);
    console.log(`[${new Date().toISOString()}] FTP Path: ${ftpPath}`);
    
    // Check if SFTP should be used (Dreamhost often uses SFTP)
    const useSFTP = process.env.DREAMHOST_USE_SFTP === 'true';
    
    await uploadToDreamhost(buffer, fileName, {
      host: ftpHost,
      user: ftpUser,
      password: ftpPassword,
      remotePath: ftpPath,
      useSFTP: useSFTP,
    });

    console.log(`[${new Date().toISOString()}] Upload complete!`);

    // Also save a local copy for localhost testing
    const fs = await import('fs/promises');
    const path = await import('path');
    const localCommunityDir = path.join(process.cwd(), 'public', 'music', 'community');
    await fs.mkdir(localCommunityDir, { recursive: true });
    const localFilePath = path.join(localCommunityDir, fileName);
    await fs.writeFile(localFilePath, buffer);
    console.log(`[${new Date().toISOString()}] Saved local copy to: ${localFilePath}`);

    // Regenerate playlists locally
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('npm run generate-playlists');
      console.log(`[${new Date().toISOString()}] Regenerated playlists locally`);
    } catch (error) {
      console.error('Failed to regenerate playlists locally:', error);
    }

    // Trigger playlist update (if site URL is configured)
    const siteUrl = process.env.PUBLIC_SITE_URL;
    if (siteUrl) {
      try {
        await fetch(`${siteUrl}/api/update-playlists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('Playlist update triggered');
      } catch (error) {
        console.error('Failed to update playlists:', error);
      }
    }

    // Send success message
    console.log(`[${new Date().toISOString()}] Sending success message to chat ${chatId}`);
    await sendMessage(
      botToken,
      chatId,
      `✅ Success! Your song "${title || fileName}" has been added to the community playlist.\n\nIt will be available on the site shortly.`
    );

    // Clear session
    userSessions.delete(chatId);
    console.log(`[${new Date().toISOString()}] Song submission completed successfully`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error processing song:`, error);
    console.error(`[${new Date().toISOString()}] Error stack:`, error.stack);
    
    let errorMessage = error.message || 'An unknown error occurred';
    
    if (errorMessage.includes('File too large')) {
      errorMessage = 'The song file is too large. Please try a shorter song or a different link.';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'The download timed out. Please try again in a few moments.';
    } else if (errorMessage.includes('No MP3 file found')) {
      errorMessage = 'Could not download the song. Please check that the URL is valid and the song is available.';
    } else if (errorMessage.includes('FTP')) {
      errorMessage = 'Failed to upload the song. Please contact support if this persists.';
    }
    
    await sendMessage(
      botToken,
      chatId,
      `❌ Error: ${errorMessage}\n\nPlease make sure you're sharing a valid YouTube or Spotify link.`
    );
    userSessions.delete(chatId);
  }
}

/**
 * Handle /start command
 */
async function handleStartCommand(chatId: number): Promise<void> {
  const keyboard = createInlineKeyboard([
    [{ text: '➕ Add New Song', callback_data: 'add_song' }],
  ]);

  const welcomeText = `🎵 <b>Welcome to the Community Playlist Bot!</b>\n\n` +
    `Share your favorite songs with the community.\n\n` +
    `Click the button below to add a song:`;

  await sendMessage(botToken, chatId, welcomeText, keyboard);
}

/**
 * Handle callback queries (button clicks)
 */
async function handleCallbackQuery(callbackQuery: any): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;

  if (!chatId) return;

  await answerCallbackQuery(botToken, callbackQuery.id);

  if (data === 'add_song') {
    userSessions.set(chatId, 'waiting_for_url');
    await sendMessage(
      botToken,
      chatId,
      '📎 Please share a YouTube or Spotify link to the song you want to add.'
    );
  }
}

/**
 * Handle regular messages
 */
async function handleMessage(message: any): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();

  if (!text) return;

  // Check rate limit
  const userId = chatId.toString();
  if (!checkRateLimit(userId, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
    const resetTime = getResetTime(userId);
    const waitSeconds = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
    await sendMessage(
      botToken,
      chatId,
      `⏳ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`
    );
    return;
  }

  // Check if user is waiting for URL
  if (userSessions.get(chatId) === 'waiting_for_url') {
    if (isValidSongUrl(text)) {
      try {
        new URL(text);
      } catch {
        await sendMessage(
          botToken,
          chatId,
          '❌ Invalid URL format. Please share a valid YouTube or Spotify link.'
        );
        return;
      }
      
      // Process the song asynchronously
      processSongSubmission(chatId, text).catch((error) => {
        console.error('Background processing error:', error);
      });
    } else {
      await sendMessage(
        botToken,
        chatId,
        '❌ Invalid URL. Please share a valid YouTube or Spotify link.\n\n' +
        'Examples:\n' +
        '• https://www.youtube.com/watch?v=...\n' +
        '• https://youtu.be/...\n' +
        '• https://open.spotify.com/track/...\n' +
        '• https://open.spotify.com/album/...'
      );
    }
    return;
  }

  // Handle /start command
  if (text.startsWith('/start')) {
    await handleStartCommand(chatId);
    return;
  }

  // Default response
  await sendMessage(
    botToken,
    chatId,
    '👋 Use /start to begin adding songs to the community playlist!'
  );
}

/**
 * Main polling loop
 */
async function main() {
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in environment variables');
    process.exit(1);
  }

  console.log('🤖 Telegram Bot Local Testing');
  console.log('📡 Starting polling...');
  console.log('💡 Send /start to your bot to begin testing');
  console.log('');

  // Test bot token
  try {
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/getMe`);
    const data = await response.json();
    if (data.ok) {
      console.log(`✅ Bot connected: @${data.result.username}`);
    } else {
      console.error('❌ Invalid bot token');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to connect to Telegram:', error);
    process.exit(1);
  }

  // Polling loop
  while (true) {
    try {
      const updates = await getUpdates();
      
      for (const update of updates) {
        lastUpdateId = update.update_id;

        // Handle callback queries
        if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
          continue;
        }

        // Handle messages
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    } catch (error) {
      console.error('Error in polling loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }
}

// Run the bot
main().catch(console.error);

