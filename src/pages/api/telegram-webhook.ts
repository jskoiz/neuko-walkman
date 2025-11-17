/**
 * Telegram Bot Webhook Handler
 * Handles incoming messages and callback queries from Telegram
 */

import type { APIRoute } from 'astro';
import {
  sendMessage,
  sendPhoto,
  answerCallbackQuery,
  editMessageText,
  createInlineKeyboard,
  isValidSongUrl,
  type TelegramUpdate,
} from '../../utils/telegram-bot';
import { downloadSongAsBuffer } from '../../utils/download-song';
import { uploadToDreamhost } from '../../utils/upload-to-dreamhost';
import { checkRateLimit, getRemainingRequests, getResetTime } from '../../utils/rate-limiter';

// User session state (in production, use a database or Redis)
const userSessions = new Map<number, 'waiting_for_url'>();

// Rate limiting: 5 requests per user per minute
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Process song download and upload
 */
async function processSongSubmission(
  botToken: string,
  chatId: number,
  url: string
): Promise<void> {
  try {
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

    // Send initial processing message
    await sendMessage(
      botToken,
      chatId,
      '🎵 Processing your song... This may take a minute.'
    );

    // Download the song (max 50MB)
    const spotifyClientId = import.meta.env.SPOTIPY_CLIENT_ID;
    const spotifyClientSecret = import.meta.env.SPOTIPY_CLIENT_SECRET;
    const maxFileSize = parseInt(import.meta.env.MAX_FILE_SIZE || '52428800'); // 50MB default
    
    const { buffer, fileName, title } = await downloadSongAsBuffer(
      url,
      spotifyClientId,
      spotifyClientSecret,
      maxFileSize
    );

    // Upload to Dreamhost
    const ftpHost = import.meta.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
    const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
    const ftpPath = import.meta.env.DREAMHOST_FTP_PATH || '/public/music/community';
    const useSFTP = import.meta.env.DREAMHOST_USE_SFTP === 'true';

    if (!ftpUser || !ftpPassword) {
      throw new Error('FTP credentials not configured');
    }

    await uploadToDreamhost(buffer, fileName, {
      host: ftpHost,
      user: ftpUser,
      password: ftpPassword,
      remotePath: ftpPath,
      useSFTP: useSFTP,
    });

    // Trigger playlist update (call internal API)
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    try {
      await fetch(`${siteUrl}/api/update-playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to update playlists:', error);
      // Continue anyway, playlists will update on next build
    }

    // Send success message
    await sendMessage(
      botToken,
      chatId,
      `✅ Success! Your song "${title || fileName}" has been added to the community playlist.\n\nIt will be available on the site shortly.`
    );

    // Clear session
    userSessions.delete(chatId);
  } catch (error: any) {
    console.error('Error processing song:', error);
    
    // Provide user-friendly error messages
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
async function handleStartCommand(
  botToken: string,
  chatId: number,
  messageId?: number,
  username?: string
): Promise<void> {
  const keyboard = createInlineKeyboard([
    [{ text: '➕ Add New Song', callback_data: 'add_song' }],
  ]);

  // Get username or use "Operative" as fallback
  const displayName = username ? `@${username}` : 'Operative';
  
  const welcomeText = `Greetings Operative ${displayName}\n\n` +
    `Share your favorite songs with the community.\n\n` +
    `Click the button below to add a song:\n\n` +
    `You can listen to all the Neuko sounds at <a href="https://bloc.rocks">https://bloc.rocks</a>`;

  // Photo URL - can be set via env var or defaults to bloc.rocks
  // Image is available at /vending-machines.jpg
  // Or set TELEGRAM_WELCOME_PHOTO_URL env var to use a custom URL
  const photoUrl = import.meta.env.TELEGRAM_WELCOME_PHOTO_URL || 
    (import.meta.env.PUBLIC_SITE_URL 
      ? `${import.meta.env.PUBLIC_SITE_URL}/vending-machines.jpg`
      : 'https://bloc.rocks/vending-machines.jpg');

  if (messageId) {
    // Can't edit photo messages, so send new message
    await sendPhoto(botToken, chatId, photoUrl, welcomeText, keyboard);
  } else {
    await sendPhoto(botToken, chatId, photoUrl, welcomeText, keyboard);
  }
}

/**
 * Handle callback queries (button clicks)
 */
async function handleCallbackQuery(
  botToken: string,
  callbackQuery: any
): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
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
async function handleMessage(
  botToken: string,
  message: any
): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();

  if (!text) return;

  // Check rate limit for all messages
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
      // Validate URL format more strictly
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
      processSongSubmission(botToken, chatId, text).catch((error) => {
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
    const username = message.from?.username;
    await handleStartCommand(botToken, chatId, undefined, username);
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
 * GET handler - returns info about the webhook endpoint
 */
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Telegram webhook endpoint is active. Use POST to send updates.',
      endpoint: '/api/telegram-webhook',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};

/**
 * Main webhook handler
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return new Response('Bot token not configured', { status: 500 });
    }

    // Verify webhook secret if configured
    const webhookSecret = import.meta.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secret !== webhookSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const update: TelegramUpdate = await request.json();

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(botToken, update.callback_query);
      return new Response('OK', { status: 200 });
    }

    // Handle messages
    if (update.message) {
      // Respond immediately to Telegram (within 3 seconds)
      const response = new Response('OK', { status: 200 });
      
      // Process message asynchronously
      handleMessage(botToken, update.message).catch((error) => {
        console.error('Error handling message:', error);
      });

      return response;
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};

