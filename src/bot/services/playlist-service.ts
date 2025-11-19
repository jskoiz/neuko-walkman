/**
 * Playlist service
 * Handles displaying playlists and songs
 */

import { sendMessage, deleteMessage, createInlineKeyboard, fetchPlaylists, validatePlaylistName, isAdmin } from '../../utils/telegram-bot';
import { MAX_BUTTONS_PER_MESSAGE, MAX_TRACK_NAME_LENGTH, TRACK_NAME_TRUNCATE_LENGTH, DEFAULT_SITE_URL } from '../../constants';
import { logBotActivity } from '../utils/logger';

export interface PlaylistServiceConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
  isAdminUser?: boolean;
}

export async function showPlaylists(
  config: PlaylistServiceConfig,
  messageId?: number,
  deletePrevious: boolean = true
): Promise<void> {
  const { botToken, chatId, userId, username, isAdminUser = false } = config;

  try {
    // Delete previous message if requested
    if (deletePrevious && messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors - message might already be deleted or not exist
      }
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
    const playlists = await fetchPlaylists(siteUrl);

    if (playlists.length === 0) {
      await sendMessage(botToken, chatId, '📋 No playlists found.');
      return;
    }

    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'VIEW_PLAYLISTS',
      details: { playlistCount: playlists.length, isAdmin: isAdminUser },
      status: 'info',
    });

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    const maxButtons = Math.min(playlists.length, MAX_BUTTONS_PER_MESSAGE);
    for (let i = 0; i < maxButtons; i++) {
      const playlist = playlists[i];
      const trackCount = playlist.tracks?.length || 0;
      const encodedPlaylistName = encodeURIComponent(playlist.name);
      buttons.push([{
        text: `📁 ${playlist.name} (${trackCount} tracks)`,
        callback_data: `playlist_${encodedPlaylistName}`
      }]);
    }

    buttons.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);
    const keyboard = createInlineKeyboard(buttons);
    const text = '📋 Select a playlist to view songs:';

    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error: any) {
    console.error('Error showing playlists:', error);
    await sendMessage(botToken, chatId, '❌ Error loading playlists. Please try again later.');
  }
}

export async function showPlaylistSongs(
  config: PlaylistServiceConfig,
  playlistName: string,
  messageId?: number,
  deletePrevious: boolean = true
): Promise<void> {
  const { botToken, chatId, userId, username, isAdminUser = false } = config;

  try {
    // Delete previous message if requested
    if (deletePrevious && messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors
      }
    }

    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
    const playlists = await fetchPlaylists(siteUrl);
    const playlist = playlists.find(p => p.name === playlistName);

    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      await sendMessage(botToken, chatId, `📁 Playlist "${playlistName}" is empty.`);
      return;
    }

    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'VIEW_PLAYLIST_SONGS',
      details: { playlist: playlistName, trackCount: playlist.tracks.length, isAdmin: isAdminUser },
      status: 'info',
    });

    const tracks = playlist.tracks;
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    const maxButtons = Math.min(tracks.length, MAX_BUTTONS_PER_MESSAGE);
    for (let i = 0; i < maxButtons; i++) {
      const track = tracks[i];
      const displayName = track.trackName.length > MAX_TRACK_NAME_LENGTH
        ? track.trackName.substring(0, TRACK_NAME_TRUNCATE_LENGTH) + '...'
        : track.trackName;

      const encodedPlaylistName = encodeURIComponent(playlistName);
      if (isAdminUser) {
        buttons.push([{
          text: `🗑️ ${displayName}`,
          callback_data: `delete_song_${encodedPlaylistName}_${i}`
        }]);
      } else {
        buttons.push([{
          text: `🎵 ${displayName}`,
          callback_data: `view_song_${encodedPlaylistName}_${i}`
        }]);
      }
    }

    buttons.push([{ text: '⬅️ Back to Playlists', callback_data: 'back_to_playlists' }]);
    const keyboard = createInlineKeyboard(buttons);
    const text = `📁 **${playlistName}**\n\n🎵 ${tracks.length} track${tracks.length !== 1 ? 's' : ''}\n\n${isAdminUser ? 'Tap a song to delete it.' : 'Tap a song to view details.'}`;

    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error: any) {
    console.error('Error showing playlist songs:', error);
    await sendMessage(botToken, chatId, '❌ Error loading playlist songs. Please try again later.');
  }
}

