/**
 * Message handler
 */

import { sendMessage, isValidSongUrl, isAdmin, createInlineKeyboard } from '../../utils/telegram-bot';
import { checkRateLimit, getResetTime } from '../../utils/rate-limiter';
import { RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW, ERROR_MESSAGES } from '../../constants';
import { sessionManager } from '../session/session';
import { processSongSubmission } from '../services/song-processor';
import { handleStartCommand } from '../commands/start';
import { showPlaylists } from '../services/playlist-service';
import { handleHelpCommand } from '../commands/help';
import { handleAboutCommand } from '../commands/about';
import { logBotActivity } from '../utils/logger';

export interface MessageHandlerConfig {
  botToken: string;
}

export async function handleMessage(
  config: MessageHandlerConfig,
  message: any
): Promise<void> {
  const { botToken } = config;
  const chatId = message.chat.id;
  const text = message.text?.trim();
  const userId = message.from?.id;
  const username = message.from?.username;

  if (!text) return;

  // Check if this is a command (should not be rate limited)
  const isCommand = text.startsWith('/start') || text.startsWith('/playlists') ||
    text.startsWith('/help') || text.startsWith('/about') || text.startsWith('/add');

  // Only check rate limit for non-command messages
  if (!isCommand) {
    const userIdStr = chatId.toString();
    if (!checkRateLimit(userIdStr, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
      const resetTime = getResetTime(userIdStr);
      const waitSeconds = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;

      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'RATE_LIMIT_EXCEEDED',
        details: { waitSeconds, message: text.substring(0, 50) },
        status: 'info',
      });

      await sendMessage(botToken, chatId, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED.replace('{seconds}', waitSeconds.toString()));
      return;
    }
  }

  // Handle commands first - they should cancel any active session
  if (text.startsWith('/start')) {
    // Cancel any active session when using /start
    sessionManager.delete(chatId);
    await handleStartCommand({
      botToken,
      chatId,
      username,
      userId,
    });
    return;
  }

  if (text.startsWith('/playlists')) {
    // Cancel any active session when using /playlists
    sessionManager.delete(chatId);
    const isAdminUser = userId ? isAdmin(userId) : false;

    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'COMMAND_PLAYLISTS',
      details: { isAdmin: isAdminUser },
      status: 'info',
    });

    await showPlaylists({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, undefined, false);
    return;
  }

  if (text.startsWith('/help')) {
    // Cancel any active session when using /help
    sessionManager.delete(chatId);
    await handleHelpCommand({
      botToken,
      chatId,
      userId,
      username,
    });
    return;
  }

  if (text.startsWith('/about')) {
    // Cancel any active session when using /about
    sessionManager.delete(chatId);
    await handleAboutCommand({
      botToken,
      chatId,
      userId,
      username,
    });
    return;
  }

  if (text.startsWith('/add')) {
    // Cancel any active session when using /add
    sessionManager.delete(chatId);
    sessionManager.set(chatId, { type: 'waiting_for_url' });

    // Add cancel button
    const cancelButtons = createInlineKeyboard([
      [{ text: '❌ Cancel', callback_data: 'cancel_add_song' }]
    ]);

    await sendMessage(botToken, chatId, '📎 Please share a YouTube or Spotify link to the song you want to add to the community playlist.', cancelButtons);
    return;
  }

  // Handle session-based flows (waiting for URL)
  const session = sessionManager.get(chatId);
  if (session && session.type === 'waiting_for_url') {
    if (isValidSongUrl(text)) {
      try {
        new URL(text);
      } catch {
        await sendMessage(botToken, chatId, '❌ Invalid URL format. Please share a valid YouTube or Spotify link.');
        return;
      }
      const playlistName = session.playlistName;
      processSongSubmission({
        botToken,
        chatId,
        userId,
        username,
      }, text, playlistName).catch((error) => {
        console.error('Background processing error:', error);
      });
    } else {
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'INVALID_URL_SUBMITTED',
        details: { url: text.substring(0, 100) },
        status: 'info',
      });

      await sendMessage(botToken, chatId, ERROR_MESSAGES.INVALID_URL + '\n\n' +
        'Examples:\n' +
        '• https://www.youtube.com/watch?v=...\n' +
        '• https://youtu.be/...\n' +
        '• https://open.spotify.com/track/...\n' +
        '• https://open.spotify.com/album/...');
    }
    return;
  }

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'MESSAGE_RECEIVED',
    details: { text: text.substring(0, 100) },
    status: 'info',
  });

  await sendMessage(botToken, chatId, '👋 Use /start to see available options!');
}


