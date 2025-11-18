/**
 * Telegram Bot Webhook Handler
 * Handles incoming messages and callback queries from Telegram
 * 
 * ⚠️  LOCAL ONLY - This file is excluded from Vercel deployment
 * The Telegram bot runs locally using polling mode (see scripts/test-bot-local.ts)
 * This webhook handler is kept for reference but should NOT be deployed to Vercel
 * 
 * To run the bot locally: npm run bot:local
 */

import type { APIRoute } from 'astro';
import {
  sendMessage,
  sendPhoto,
  answerCallbackQuery,
  editMessageText,
  deleteMessage,
  createInlineKeyboard,
  isValidSongUrl,
  isAdmin,
  fetchPlaylists,
  validatePlaylistName,
  type TelegramUpdate,
} from '../../utils/telegram-bot';
import { downloadSongAsBuffer } from '../../utils/download-song';
import { uploadToDreamhost, deleteFromDreamhost } from '../../utils/upload-to-dreamhost';
import { checkRateLimit, getRemainingRequests, getResetTime } from '../../utils/rate-limiter';

// User session state interface
interface UserSession {
  type: 'waiting_for_url' | 'selecting_playlist_for_add' | 'selecting_playlist_for_delete' | 'selecting_song_to_delete';
  playlistName?: string;
  messageId?: number;
}

// User session state (in production, use a database or Redis)
const userSessions = new Map<number, UserSession>();

// Rate limiting: 5 requests per user per minute
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Process song download and upload
 */
async function processSongSubmission(
  botToken: string,
  chatId: number,
  url: string,
  playlistName?: string
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

    // Validate playlist name if provided
    if (playlistName && !validatePlaylistName(playlistName)) {
      throw new Error('Invalid playlist name');
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

    // Determine upload path
    const ftpHost = import.meta.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
    const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
    const basePath = import.meta.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
    const useSFTP = import.meta.env.DREAMHOST_USE_SFTP === 'true';
    
    // Use provided playlist name or default to 'community'
    const targetPlaylist = playlistName || 'community';
    const ftpPath = `${basePath}/${targetPlaylist}`;

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
    const playlistDisplay = playlistName || 'community';
    await sendMessage(
      botToken,
      chatId,
      `✅ Success! Your song "${title || fileName}" has been added to the "${playlistDisplay}" playlist.\n\nIt will be available on the site shortly.`
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
    } else if (errorMessage.includes('FTP') || errorMessage.includes('SFTP')) {
      errorMessage = 'Failed to upload the song. Please contact support if this persists.';
    } else if (errorMessage.includes('Invalid playlist')) {
      errorMessage = 'Invalid playlist name. Please try again.';
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
 * Show list of playlists
 */
async function showPlaylists(
  botToken: string,
  chatId: number,
  messageId?: number,
  isAdminUser: boolean = false,
  deletePrevious: boolean = true
): Promise<void> {
  try {
    // Delete previous message if requested
    if (deletePrevious && messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors - message might already be deleted or not exist
      }
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const playlists = await fetchPlaylists(siteUrl);
    
    if (playlists.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        '📋 No playlists found.'
      );
      return;
    }

    // Create buttons for each playlist
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    
    // Add playlist buttons (max 100 buttons per keyboard)
    const maxButtons = Math.min(playlists.length, 50); // Leave room for navigation
    for (let i = 0; i < maxButtons; i++) {
      const playlist = playlists[i];
      const trackCount = playlist.tracks?.length || 0;
      // Encode playlist name to handle spaces and special characters
      const encodedPlaylistName = encodeURIComponent(playlist.name);
      buttons.push([{
        text: `📁 ${playlist.name} (${trackCount} tracks)`,
        callback_data: `playlist_${encodedPlaylistName}`
      }]);
    }

    // Add navigation buttons
    buttons.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);

    const keyboard = createInlineKeyboard(buttons);
    const text = '📋 Select a playlist to view songs:';

    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error: any) {
    console.error('Error showing playlists:', error);
    await sendMessage(
      botToken,
      chatId,
      '❌ Error loading playlists. Please try again later.'
    );
  }
}

/**
 * Show songs in a playlist
 */
async function showPlaylistSongs(
  botToken: string,
  chatId: number,
  playlistName: string,
  messageId?: number,
  isAdminUser: boolean = false,
  deletePrevious: boolean = true
): Promise<void> {
  try {
    // Delete previous message if requested
    if (deletePrevious && messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors - message might already be deleted or not exist
      }
    }

    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const playlists = await fetchPlaylists(siteUrl);
    const playlist = playlists.find(p => p.name === playlistName);

    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        `📁 Playlist "${playlistName}" is empty.`
      );
      return;
    }

    const tracks = playlist.tracks;
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    
    // Add song buttons (Telegram limit: 100 buttons)
    const maxButtons = Math.min(tracks.length, 50); // Leave room for navigation
    for (let i = 0; i < maxButtons; i++) {
      const track = tracks[i];
      const displayName = track.trackName.length > 30 
        ? track.trackName.substring(0, 27) + '...' 
        : track.trackName;
      
      // Use track index instead of filename to avoid exceeding Telegram's 64-byte callback_data limit
      // Encode playlist name to handle spaces and special characters
      const encodedPlaylistName = encodeURIComponent(playlistName);
      if (isAdminUser) {
        // Admin can delete songs - show with delete indicator
        // Format: delete_song_<encodedPlaylistName>_<trackIndex>
        buttons.push([{
          text: `🗑️ ${displayName}`,
          callback_data: `delete_song_${encodedPlaylistName}_${i}`
        }]);
      } else {
        // Regular users just see songs
        buttons.push([{
          text: `🎵 ${displayName}`,
          callback_data: `view_song_${encodedPlaylistName}_${i}`
        }]);
      }
    }

    // Add navigation buttons
    buttons.push([{ text: '⬅️ Back to Playlists', callback_data: 'back_to_playlists' }]);

    const keyboard = createInlineKeyboard(buttons);
    const text = `📁 **${playlistName}**\n\n🎵 ${tracks.length} track${tracks.length !== 1 ? 's' : ''}\n\n${isAdminUser ? 'Tap a song to delete it.' : 'Tap a song to view details.'}`;

    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error: any) {
    console.error('Error showing playlist songs:', error);
    await sendMessage(
      botToken,
      chatId,
      '❌ Error loading playlist songs. Please try again later.'
    );
  }
}

/**
 * Delete a song from a playlist
 */
async function deleteSong(
  botToken: string,
  chatId: number,
  playlistName: string,
  fileName: string
): Promise<void> {
  try {
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    // Sanitize filename
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    await sendMessage(
      botToken,
      chatId,
      '🗑️ Deleting song...'
    );

    const ftpHost = import.meta.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
    const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
    const basePath = import.meta.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
    const useSFTP = import.meta.env.DREAMHOST_USE_SFTP === 'true';
    const ftpPath = `${basePath}/${playlistName}`;

    if (!ftpUser || !ftpPassword) {
      throw new Error('FTP credentials not configured');
    }

    await deleteFromDreamhost(sanitizedFileName, {
      host: ftpHost,
      user: ftpUser,
      password: ftpPassword,
      remotePath: ftpPath,
      useSFTP: useSFTP,
    });

    // Also delete local copy if it exists (for local development)
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const localFilePath = path.join(process.cwd(), 'public', 'music', playlistName, sanitizedFileName);
      try {
        await fs.unlink(localFilePath);
        console.log(`Deleted local file: ${localFilePath}`);
      } catch (localError: any) {
        // File might not exist locally, which is fine
        if (localError.code !== 'ENOENT') {
          console.warn('Failed to delete local file:', localError);
        }
      }
    } catch (error) {
      console.warn('Failed to delete local file:', error);
    }

    // Wait a moment for FTP server to fully process the deletion
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Trigger playlist update
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    try {
      const updateResponse = await fetch(`${siteUrl}/api/update-playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!updateResponse.ok) {
        console.error('Playlist update returned non-OK status:', updateResponse.status);
      }
    } catch (error) {
      console.error('Failed to update playlists:', error);
    }

    await sendMessage(
      botToken,
      chatId,
      `✅ Song deleted from "${playlistName}" playlist.`
    );

    // Clear session
    userSessions.delete(chatId);
  } catch (error: any) {
    console.error('Error deleting song:', error);
    let errorMessage = error.message || 'An unknown error occurred';
    
    if (errorMessage.includes('not found')) {
      errorMessage = 'Song not found on server.';
    } else if (errorMessage.includes('FTP') || errorMessage.includes('SFTP')) {
      errorMessage = 'Failed to delete the song. Please contact support if this persists.';
    }
    
    await sendMessage(
      botToken,
      chatId,
      `❌ Error: ${errorMessage}`
    );
    userSessions.delete(chatId);
  }
}

/**
 * Show restricted access menu (admin only)
 */
async function showRestrictedAccess(
  botToken: string,
  chatId: number,
  messageId?: number
): Promise<void> {
  // Delete previous message if provided
  if (messageId) {
    try {
      await deleteMessage(botToken, chatId, messageId);
    } catch (error) {
      // Ignore errors
    }
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '➕ Add Song to Any Playlist', callback_data: 'add_song_admin' }],
    [{ text: '🗑️ Delete Song', callback_data: 'delete_song_menu' }],
    [{ text: '⬅️ Back to Main Menu', callback_data: 'back_to_main' }],
  ];

  const keyboard = createInlineKeyboard(buttons);
  const text = '🔒 **Restricted Access**\n\nAdmin-only features:';

  await sendMessage(botToken, chatId, text, keyboard);
}

/**
 * Handle /start command
 */
async function handleStartCommand(
  botToken: string,
  chatId: number,
  messageId?: number,
  username?: string,
  userId?: number
): Promise<void> {
  const isAdminUser = userId ? isAdmin(userId) : false;
  
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '➕ Add Song to Community', callback_data: 'add_song' }],
    [{ text: '📋 View Playlists', callback_data: 'view_playlists' }],
  ];

  // Add restricted access option (admin only)
  if (isAdminUser) {
    buttons.push([{ text: '🔒 Restricted Access', callback_data: 'restricted_access' }]);
  }

  const keyboard = createInlineKeyboard(buttons);

  // Get username or use "Operative" as fallback
  const displayName = username ? `@${username}` : 'Operative';
  
  const welcomeText = `Greetings Operative ${displayName}\n\n` +
    `Share your favorite songs with the community.\n\n` +
    `You can listen to all the Neuko sounds at https://bloc.rocks`;

  // Photo URL - can be set via env var or defaults to bloc.rocks
  const photoUrl = import.meta.env.TELEGRAM_WELCOME_PHOTO_URL || 
    (import.meta.env.PUBLIC_SITE_URL 
      ? `${import.meta.env.PUBLIC_SITE_URL}/vending-machines.jpg`
      : 'https://bloc.rocks/vending-machines.jpg');

  // Delete previous message if provided (for navigation)
  if (messageId) {
    try {
      await deleteMessage(botToken, chatId, messageId);
    } catch (error) {
      // Ignore errors - might be a photo message which can't be deleted
    }
  }

  await sendPhoto(botToken, chatId, photoUrl, welcomeText, keyboard);
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
  const userId = callbackQuery.from?.id;

  if (!chatId) return;

  await answerCallbackQuery(botToken, callbackQuery.id);

  const isAdminUser = userId ? isAdmin(userId) : false;

  // Main menu actions
  if (data === 'add_song') {
    // Delete previous message
    if (messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors
      }
    }
    userSessions.set(chatId, { type: 'waiting_for_url' });
    await sendMessage(
      botToken,
      chatId,
      '📎 Please share a YouTube or Spotify link to the song you want to add to the community playlist.'
    );
    return;
  }

  if (data === 'view_playlists') {
    await showPlaylists(botToken, chatId, messageId, isAdminUser, true);
    return;
  }

  if (data === 'back_to_main') {
    const username = callbackQuery.from?.username;
    await handleStartCommand(botToken, chatId, messageId, username, userId);
    return;
  }

  if (data === 'back_to_playlists') {
    await showPlaylists(botToken, chatId, messageId, isAdminUser, true);
    return;
  }

  // Restricted access menu
  if (data === 'restricted_access') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to access this area.');
      return;
    }
    await showRestrictedAccess(botToken, chatId, messageId);
    return;
  }

  // Admin-only actions
  if (data === 'add_song_admin') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists(botToken, chatId, messageId, isAdminUser, true);
    userSessions.set(chatId, { type: 'selecting_playlist_for_add', messageId });
    return;
  }

  if (data === 'delete_song_menu') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists(botToken, chatId, messageId, isAdminUser, true);
    userSessions.set(chatId, { type: 'selecting_playlist_for_delete', messageId });
    return;
  }

  // Playlist selection
  if (data.startsWith('playlist_')) {
    const encodedName = data.replace('playlist_', '');
    const playlistName = decodeURIComponent(encodedName);
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }
    
    // Check if user is in a special state (admin adding/deleting)
    const session = userSessions.get(chatId);
    
    if (session?.type === 'selecting_playlist_for_add') {
      // Admin is selecting playlist to add song to
      // Delete previous message
      if (messageId) {
        try {
          await deleteMessage(botToken, chatId, messageId);
        } catch (error) {
          // Ignore errors
        }
      }
      userSessions.set(chatId, { type: 'waiting_for_url', playlistName });
      await sendMessage(
        botToken,
        chatId,
        `📎 Please share a YouTube or Spotify link to add to the "${playlistName}" playlist.`
      );
      return;
    }
    
    if (session?.type === 'selecting_playlist_for_delete') {
      // Admin is selecting playlist to delete from
      await showPlaylistSongs(botToken, chatId, playlistName, messageId, isAdminUser, true);
      userSessions.set(chatId, { type: 'selecting_song_to_delete', playlistName, messageId });
      return;
    }
    
    // Normal playlist viewing
    await showPlaylistSongs(botToken, chatId, playlistName, messageId, isAdminUser, true);
    return;
  }

  // Admin: Add song to playlist
  if (data.startsWith('add_to_playlist_')) {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    const playlistName = data.replace('add_to_playlist_', '');
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }
    userSessions.set(chatId, { type: 'waiting_for_url', playlistName });
    await sendMessage(
      botToken,
      chatId,
      `📎 Please share a YouTube or Spotify link to add to the "${playlistName}" playlist.`
    );
    return;
  }

  // Admin: Delete song from playlist
  if (data.startsWith('delete_from_playlist_')) {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    const playlistName = data.replace('delete_from_playlist_', '');
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }
    await showPlaylistSongs(botToken, chatId, playlistName, messageId, isAdminUser);
    userSessions.set(chatId, { type: 'selecting_song_to_delete', playlistName, messageId });
    return;
  }

  // Admin: Confirm song deletion
  if (data.startsWith('delete_song_')) {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    // Format: delete_song_<encodedPlaylistName>_<trackIndex>
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
    
    // Fetch playlist to get track info
    try {
      const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);
      
      if (!playlist || !playlist.tracks || !playlist.tracks[trackIndex]) {
        await sendMessage(botToken, chatId, '❌ Song not found.');
        return;
      }
      
      const track = playlist.tracks[trackIndex];
      const fileName = track.fileName.split('/').pop() || '';
      await deleteSong(botToken, chatId, playlistName, fileName);
    } catch (error) {
      console.error('Error getting track info:', error);
      await sendMessage(botToken, chatId, '❌ Error deleting song.');
    }
    return;
  }

  // View song (non-admin)
  if (data.startsWith('view_song_')) {
    const payload = data.replace('view_song_', '');
    const lastUnderscoreIndex = payload.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      return;
    }
    
    const songIndex = parseInt(payload.substring(lastUnderscoreIndex + 1), 10);
    const encodedPlaylistName = payload.substring(0, lastUnderscoreIndex);
    const playlistName = decodeURIComponent(encodedPlaylistName);
    
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    try {
      const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);
      
      if (playlist && playlist.tracks && playlist.tracks[songIndex]) {
        const track = playlist.tracks[songIndex];
        await sendMessage(
          botToken,
          chatId,
          `🎵 **${track.trackName}**\n\n📁 Playlist: ${playlistName}\n🎵 Track #${track.trackNumber}`
        );
      }
    } catch (error) {
      console.error('Error viewing song:', error);
    }
    return;
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
  const userId = message.from?.id;

  if (!text) return;

  // Check rate limit for all messages
  const userIdStr = chatId.toString();
  if (!checkRateLimit(userIdStr, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
    const resetTime = getResetTime(userIdStr);
    const waitSeconds = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
    await sendMessage(
      botToken,
      chatId,
      `⏳ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`
    );
    return;
  }

  // Check session state
  const session = userSessions.get(chatId);
  
  if (session && session.type === 'waiting_for_url') {
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
      
      // Process the song asynchronously with playlist name if provided
      const playlistName = session.playlistName;
      processSongSubmission(botToken, chatId, text, playlistName).catch((error) => {
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
    await handleStartCommand(botToken, chatId, undefined, username, userId);
    return;
  }

  // Handle /playlists command
  if (text.startsWith('/playlists')) {
    const isAdminUser = userId ? isAdmin(userId) : false;
    await showPlaylists(botToken, chatId, undefined, isAdminUser);
    return;
  }

  // Default response
  await sendMessage(
    botToken,
    chatId,
    '👋 Use /start to see available options!'
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
    // ⚠️  LOCAL ONLY - This webhook handler should not be deployed to Vercel
    // The Telegram bot runs locally using polling mode (see scripts/test-bot-local.ts)
    // This endpoint is kept for reference but is excluded from deployment via .vercelignore
    
    // Reject all webhook requests - bot should only run locally
    console.log('Webhook rejected: Telegram bot is local-only. Use npm run bot:local for local development.');
    return new Response(
      JSON.stringify({ 
        error: 'Webhook disabled - Telegram bot is local-only',
        message: 'This endpoint is excluded from Vercel deployment. Use npm run bot:local for local development.'
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // NOTE: The code below is kept for reference but is never executed.
    // This file is excluded from Vercel deployment via .vercelignore
    // The bot runs locally using polling mode (see scripts/test-bot-local.ts)
    /*
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
    */
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};

