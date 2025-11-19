/**
 * Callback query handler
 */

import { answerCallbackQuery, sendMessage, deleteMessage, isAdmin, fetchPlaylists, validatePlaylistName } from '../../utils/telegram-bot';
import { DEFAULT_SITE_URL } from '../../constants';
import { sessionManager } from '../session/session';
import { handleStartCommand } from '../commands/start';
import { showPlaylists, showPlaylistSongs } from '../services/playlist-service';
import { processSongSubmission } from '../services/song-processor';
import { deleteSong } from '../services/song-deletion';
import { logBotActivity } from '../utils/logger';

export interface CallbackHandlerConfig {
  botToken: string;
}

async function showRestrictedAccess(
  botToken: string,
  chatId: number,
  messageId?: number,
  userId?: number,
  username?: string
): Promise<void> {
  if (messageId) {
    try {
      await deleteMessage(botToken, chatId, messageId);
    } catch (error) {
      // Ignore errors
    }
  }

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'ADMIN_ACCESS',
    details: { menu: 'restricted_access' },
    status: 'info',
  });

  const { createInlineKeyboard } = await import('../../utils/telegram-bot');
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '➕ Add Song to Any Playlist', callback_data: 'add_song_admin' }],
    [{ text: '🗑️ Delete Song', callback_data: 'delete_song_menu' }],
    [{ text: '⬅️ Back to Main Menu', callback_data: 'back_to_main' }],
  ];

  const keyboard = createInlineKeyboard(buttons);
  const text = '🔒 **Restricted Access**\n\nAdmin-only features:';

  await sendMessage(botToken, chatId, text, keyboard);
}

export async function handleCallbackQuery(
  config: CallbackHandlerConfig,
  callbackQuery: any
): Promise<void> {
  const { botToken } = config;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from?.id;
  const username = callbackQuery.from?.username;

  if (!chatId) return;

  await answerCallbackQuery(botToken, callbackQuery.id);
  const isAdminUser = userId ? isAdmin(userId) : false;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'BUTTON_CLICK',
    details: { button: data, isAdmin: isAdminUser },
    status: 'info',
  });

  if (data === 'add_song') {
    if (messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors
      }
    }
    sessionManager.set(chatId, { type: 'waiting_for_url' });
    
    // Add cancel button
    const { createInlineKeyboard } = await import('../../utils/telegram-bot');
    const cancelButtons = createInlineKeyboard([
      [{ text: '❌ Cancel', callback_data: 'cancel_add_song' }]
    ]);
    
    await sendMessage(botToken, chatId, '📎 Please share a YouTube or Spotify link to the song you want to add to the community playlist.', cancelButtons);
    return;
  }

  if (data === 'cancel_add_song') {
    // Delete the "waiting for URL" message if it exists
    if (messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors - message might already be deleted
      }
    }
    
    sessionManager.delete(chatId);
    await handleStartCommand({
      botToken,
      chatId,
      username,
      userId,
    });
    return;
  }

  if (data === 'view_playlists') {
    await showPlaylists({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, messageId, true);
    return;
  }

  if (data === 'back_to_main') {
    await handleStartCommand({
      botToken,
      chatId,
      username,
      userId,
      messageId,
    });
    return;
  }

  if (data === 'back_to_playlists') {
    await showPlaylists({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, messageId, true);
    return;
  }

  if (data === 'restricted_access') {
    if (!isAdminUser) {
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: { attemptedAction: 'restricted_access' },
        status: 'error',
      });
      await sendMessage(botToken, chatId, '❌ You do not have permission to access this area.');
      return;
    }
    await showRestrictedAccess(botToken, chatId, messageId, userId, username);
    return;
  }

  if (data === 'add_song_admin') {
    if (!isAdminUser) {
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: { attemptedAction: 'add_song_admin' },
        status: 'error',
      });
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, messageId, true);
    sessionManager.set(chatId, { type: 'selecting_playlist_for_add', messageId });
    return;
  }

  if (data === 'delete_song_menu') {
    if (!isAdminUser) {
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: { attemptedAction: 'delete_song_menu' },
        status: 'error',
      });
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, messageId, true);
    sessionManager.set(chatId, { type: 'selecting_playlist_for_delete', messageId });
    return;
  }

  if (data.startsWith('playlist_')) {
    const encodedName = data.replace('playlist_', '');
    const playlistName = decodeURIComponent(encodedName);
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    const session = sessionManager.get(chatId);
    if (session?.type === 'selecting_playlist_for_add') {
      if (messageId) {
        try {
          await deleteMessage(botToken, chatId, messageId);
        } catch (error) {
          // Ignore errors
        }
      }
      sessionManager.set(chatId, { type: 'waiting_for_url', playlistName });
      
      // Add cancel button
      const { createInlineKeyboard } = await import('../../utils/telegram-bot');
      const cancelButtons = createInlineKeyboard([
        [{ text: '❌ Cancel', callback_data: 'cancel_add_song' }]
      ]);
      
      await sendMessage(botToken, chatId, `📎 Please share a YouTube or Spotify link to add to the "${playlistName}" playlist.`, cancelButtons);
      return;
    }

    if (session?.type === 'selecting_playlist_for_delete') {
      await showPlaylistSongs({
        botToken,
        chatId,
        userId,
        username,
        isAdminUser,
      }, playlistName, messageId, true);
      sessionManager.set(chatId, { type: 'selecting_song_to_delete', playlistName, messageId });
      return;
    }

    await showPlaylistSongs({
      botToken,
      chatId,
      userId,
      username,
      isAdminUser,
    }, playlistName, messageId, true);
    return;
  }

  if (data.startsWith('delete_song_')) {
    if (!isAdminUser) {
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        details: { attemptedAction: 'delete_song' },
        status: 'error',
      });
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    const payload = data.replace('delete_song_', '');
    const lastUnderscoreIndex = payload.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      await sendMessage(botToken, chatId, '❌ Invalid delete request.');
      return;
    }

    const trackIndex = parseInt(payload.substring(lastUnderscoreIndex + 1), 10);
    const encodedPlaylistName = payload.substring(0, lastUnderscoreIndex);
    const playlistName = decodeURIComponent(encodedPlaylistName);

    if (!validatePlaylistName(playlistName) || isNaN(trackIndex)) {
      await sendMessage(botToken, chatId, '❌ Invalid delete request.');
      return;
    }

    try {
      const siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);

      if (!playlist || !playlist.tracks || !playlist.tracks[trackIndex]) {
        await sendMessage(botToken, chatId, '❌ Song not found.');
        return;
      }

      const track = playlist.tracks[trackIndex];
      const fileName = track.fileName.split('/').pop() || '';
      await deleteSong({
        botToken,
        chatId,
        userId,
        username,
      }, playlistName, fileName);
      sessionManager.delete(chatId);
    } catch (error) {
      console.error('Error getting track info:', error);
      await sendMessage(botToken, chatId, '❌ Error deleting song.');
    }
    return;
  }

  if (data.startsWith('view_song_')) {
    const payload = data.replace('view_song_', '');
    const lastUnderscoreIndex = payload.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) return;

    const songIndex = parseInt(payload.substring(lastUnderscoreIndex + 1), 10);
    const encodedPlaylistName = payload.substring(0, lastUnderscoreIndex);
    const playlistName = decodeURIComponent(encodedPlaylistName);
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }
    try {
      const siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);
      if (playlist && playlist.tracks && playlist.tracks[songIndex]) {
        const track = playlist.tracks[songIndex];

        logBotActivity({
          timestamp: new Date().toISOString(),
          userId,
          username,
          chatId,
          action: 'VIEW_SONG',
          details: { playlist: playlistName, trackName: track.trackName, trackIndex: songIndex },
          status: 'info',
        });

        await sendMessage(botToken, chatId, `🎵 **${track.trackName}**\n\n📁 Playlist: ${playlistName}\n🎵 Track #${track.trackNumber}`);
      }
    } catch (error) {
      console.error('Error viewing song:', error);
    }
    return;
  }
}

