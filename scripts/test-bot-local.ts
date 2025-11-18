/**
 * Local testing script for Telegram bot using polling
 * Run with: npx tsx scripts/test-bot-local.ts
 * or: node --loader ts-node/esm scripts/test-bot-local.ts
 */

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
} from '../src/utils/telegram-bot';
import { downloadSongAsBuffer } from '../src/utils/download-song';
import { uploadToDreamhost, deleteFromDreamhost } from '../src/utils/upload-to-dreamhost';
import { checkRateLimit, getResetTime } from '../src/utils/rate-limiter';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Load environment variables
dotenv.config();

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000;

// User session state interface
interface UserSession {
  type: 'waiting_for_url' | 'selecting_playlist_for_add' | 'selecting_playlist_for_delete' | 'selecting_song_to_delete';
  playlistName?: string;
  messageId?: number;
}

// User session state
const userSessions = new Map<number, UserSession>();
let lastUpdateId = 0;

/**
 * Check if webhook is set
 */
async function checkWebhook(): Promise<{ url?: string; pending_update_count?: number } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/getWebhookInfo`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.ok && data.result.url && data.result.url !== '') {
      return data.result;
    }
    return null;
  } catch (error: any) {
    // Only log non-network errors or provide a brief message for network issues
    if (error.name === 'AbortError') {
      console.log('[bot] Webhook check timed out (assuming no webhook)');
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      // Transient network errors - silently assume no webhook
      return null;
    } else {
      console.error('[bot] Error checking webhook:', error.message || error);
    }
    return null;
  }
}

/**
 * Verify webhook is actually deleted
 */
async function verifyWebhookDeleted(maxAttempts: number = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const webhookInfo = await checkWebhook();
    if (!webhookInfo || !webhookInfo.url) {
      return true; // Webhook is deleted
    }
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
  }
  return false; // Webhook still exists after all attempts
}

/**
 * Delete webhook to enable polling
 */
async function deleteWebhook(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/deleteWebhook`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return data.ok === true;
  } catch (error: any) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      // Transient network error - assume deletion failed
      return false;
    }
    console.error('[bot] Error deleting webhook:', error.message || error);
    return false;
  }
}

/**
 * Get updates from Telegram
 */
async function getUpdates(): Promise<any[]> {
  const url = `${TELEGRAM_API_URL}${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (long polling)
    
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 409 || errorText.includes('Conflict')) {
        throw new Error('CONFLICT: Webhook is active. Please delete webhook first or use webhook mode.');
      }
      throw new Error(`Telegram API error: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }
    return data.result || [];
  } catch (error: any) {
    // Re-throw conflict errors so they can be handled by the polling loop
    if (error.message && error.message.includes('CONFLICT')) {
      throw error;
    }
    // Handle network errors gracefully
    if (error.name === 'AbortError') {
      // Timeout is expected for long polling - return empty array
      return [];
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      // Transient network errors - return empty array and retry
      return [];
    }
    // For other errors, log and return empty array
    console.error('[bot] Error fetching updates:', error.message || error);
    return [];
  }
}

/**
 * Process song download and upload
 */
async function processSongSubmission(chatId: number, url: string, playlistName?: string): Promise<void> {
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

    // Validate playlist name if provided
    if (playlistName && !validatePlaylistName(playlistName)) {
      throw new Error('Invalid playlist name');
    }

    // Upload to Dreamhost
    const ftpHost = process.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = process.env.DREAMHOST_FTP_USER;
    const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
    const basePath = process.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
    const useSFTP = process.env.DREAMHOST_USE_SFTP === 'true';
    
    // Use provided playlist name or default to 'community'
    const targetPlaylist = playlistName || 'community';
    const ftpPath = `${basePath}/${targetPlaylist}`;

    if (!ftpUser || !ftpPassword) {
      throw new Error('FTP credentials not configured');
    }

    console.log(`[${new Date().toISOString()}] Uploading to Dreamhost...`);
    console.log(`[${new Date().toISOString()}] FTP Host: ${ftpHost}`);
    console.log(`[${new Date().toISOString()}] FTP User: ${ftpUser ? 'Set' : 'NOT SET'}`);
    console.log(`[${new Date().toISOString()}] FTP Path: ${ftpPath}`);
    
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
    const playlistDisplay = playlistName || 'community';
    await sendMessage(
      botToken,
      chatId,
      `✅ Success! Your song "${title || fileName}" has been added to the "${playlistDisplay}" playlist.\n\nIt will be available on the site shortly.`
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
 * Show restricted access menu (admin only)
 */
async function showRestrictedAccess(chatId: number, messageId?: number): Promise<void> {
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
 * Show list of playlists
 */
async function showPlaylists(chatId: number, messageId?: number, isAdminUser: boolean = false, deletePrevious: boolean = true): Promise<void> {
  try {
    // Delete previous message if requested
    if (deletePrevious && messageId) {
      try {
        await deleteMessage(botToken, chatId, messageId);
      } catch (error) {
        // Ignore errors - message might already be deleted or not exist
      }
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const playlists = await fetchPlaylists(siteUrl);
    
    if (playlists.length === 0) {
      await sendMessage(botToken, chatId, '📋 No playlists found.');
      return;
    }

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    const maxButtons = Math.min(playlists.length, 50);
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

    buttons.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);
    const keyboard = createInlineKeyboard(buttons);
    const text = '📋 Select a playlist to view songs:';

    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error: any) {
    console.error('Error showing playlists:', error);
    await sendMessage(botToken, chatId, '❌ Error loading playlists. Please try again later.');
  }
}

/**
 * Show songs in a playlist
 */
async function showPlaylistSongs(chatId: number, playlistName: string, messageId?: number, isAdminUser: boolean = false, deletePrevious: boolean = true): Promise<void> {
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

    const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const playlists = await fetchPlaylists(siteUrl);
    const playlist = playlists.find(p => p.name === playlistName);

    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      await sendMessage(botToken, chatId, `📁 Playlist "${playlistName}" is empty.`);
      return;
    }

    const tracks = playlist.tracks;
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    const maxButtons = Math.min(tracks.length, 50);
    for (let i = 0; i < maxButtons; i++) {
      const track = tracks[i];
      const displayName = track.trackName.length > 30 
        ? track.trackName.substring(0, 27) + '...' 
        : track.trackName;
      
      // Use track index instead of filename to avoid exceeding Telegram's 64-byte callback_data limit
      // Encode playlist name to handle spaces and special characters
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

/**
 * Delete a song from a playlist
 */
async function deleteSong(chatId: number, playlistName: string, fileName: string): Promise<void> {
  try {
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    await sendMessage(botToken, chatId, '🗑️ Deleting song...');

    const ftpHost = process.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
    const ftpUser = process.env.DREAMHOST_FTP_USER;
    const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
    const basePath = process.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
    const useSFTP = process.env.DREAMHOST_USE_SFTP === 'true';
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
        console.log(`[${new Date().toISOString()}] Deleted local file: ${localFilePath}`);
      } catch (localError: any) {
        // File might not exist locally, which is fine
        if (localError.code !== 'ENOENT') {
          console.warn(`[${new Date().toISOString()}] Failed to delete local file:`, localError);
        }
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Failed to delete local file:`, error);
    }

    // Wait a moment for FTP server to fully process the deletion
    await new Promise(resolve => setTimeout(resolve, 1000));

    const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    try {
      const updateResponse = await fetch(`${siteUrl}/api/update-playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!updateResponse.ok) {
        console.error('Playlist update returned non-OK status:', updateResponse.status);
      }
    } catch (error) {
      console.error('Failed to update playlists:', error);
    }

    await sendMessage(botToken, chatId, `✅ Song deleted from "${playlistName}" playlist.`);
    userSessions.delete(chatId);
  } catch (error: any) {
    console.error('Error deleting song:', error);
    let errorMessage = error.message || 'An unknown error occurred';
    if (errorMessage.includes('not found')) {
      errorMessage = 'Song not found on server.';
    } else if (errorMessage.includes('FTP') || errorMessage.includes('SFTP')) {
      errorMessage = 'Failed to delete the song. Please contact support if this persists.';
    }
    await sendMessage(botToken, chatId, `❌ Error: ${errorMessage}`);
    userSessions.delete(chatId);
  }
}

/**
 * Handle /start command
 */
async function handleStartCommand(chatId: number, username?: string, userId?: number, messageId?: number): Promise<void> {
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
  const displayName = username ? `@${username}` : 'Operative';
  const welcomeText = `Greetings Operative ${displayName}\n\n` +
    `Share your favorite songs with the community.\n\n` +
    `You can listen to all the Neuko sounds at https://bloc.rocks`;

  // Delete previous message if provided (for navigation)
  if (messageId) {
    try {
      await deleteMessage(botToken, chatId, messageId);
    } catch (error) {
      // Ignore errors - might be a photo message which can't be deleted
    }
  }

  const photoPath = join(process.cwd(), 'public', 'vending-machines.jpg');
  let photo: string | Buffer | null = null;
  try {
    photo = await readFile(photoPath);
  } catch (error) {
    console.error('Failed to read photo file:', error);
    photo = null;
  }

  if (photo) {
    await sendPhoto(botToken, chatId, photo, welcomeText, keyboard);
  } else {
    await sendMessage(botToken, chatId, welcomeText, keyboard);
  }
}

/**
 * Handle callback queries (button clicks)
 */
async function handleCallbackQuery(callbackQuery: any): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from?.id;

  if (!chatId) return;

  await answerCallbackQuery(botToken, callbackQuery.id);
  const isAdminUser = userId ? isAdmin(userId) : false;

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
    await sendMessage(botToken, chatId, '📎 Please share a YouTube or Spotify link to the song you want to add to the community playlist.');
    return;
  }

  if (data === 'view_playlists') {
    await showPlaylists(chatId, messageId, isAdminUser, true);
    return;
  }

  if (data === 'back_to_main') {
    const username = callbackQuery.from?.username;
    await handleStartCommand(chatId, username, userId, messageId);
    return;
  }

  if (data === 'back_to_playlists') {
    await showPlaylists(chatId, messageId, isAdminUser, true);
    return;
  }

  // Restricted access menu
  if (data === 'restricted_access') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to access this area.');
      return;
    }
    await showRestrictedAccess(chatId, messageId);
    return;
  }

  if (data === 'add_song_admin') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists(chatId, messageId, isAdminUser, true);
    userSessions.set(chatId, { type: 'selecting_playlist_for_add', messageId });
    return;
  }

  if (data === 'delete_song_menu') {
    if (!isAdminUser) {
      await sendMessage(botToken, chatId, '❌ You do not have permission to perform this action.');
      return;
    }
    await showPlaylists(chatId, messageId, isAdminUser, true);
    userSessions.set(chatId, { type: 'selecting_playlist_for_delete', messageId });
    return;
  }

  if (data.startsWith('playlist_')) {
    const encodedName = data.replace('playlist_', '');
    const playlistName = decodeURIComponent(encodedName);
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      return;
    }
    
    const session = userSessions.get(chatId);
    if (session?.type === 'selecting_playlist_for_add') {
      // Delete previous message
      if (messageId) {
        try {
          await deleteMessage(botToken, chatId, messageId);
        } catch (error) {
          // Ignore errors
        }
      }
      userSessions.set(chatId, { type: 'waiting_for_url', playlistName });
      await sendMessage(botToken, chatId, `📎 Please share a YouTube or Spotify link to add to the "${playlistName}" playlist.`);
      return;
    }
    
    if (session?.type === 'selecting_playlist_for_delete') {
      await showPlaylistSongs(chatId, playlistName, messageId, isAdminUser, true);
      userSessions.set(chatId, { type: 'selecting_song_to_delete', playlistName, messageId });
      return;
    }
    
    await showPlaylistSongs(chatId, playlistName, messageId, isAdminUser, true);
    return;
  }

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
      const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);
      
      if (!playlist || !playlist.tracks || !playlist.tracks[trackIndex]) {
        await sendMessage(botToken, chatId, '❌ Song not found.');
        return;
      }
      
      const track = playlist.tracks[trackIndex];
      const fileName = track.fileName.split('/').pop() || '';
      await deleteSong(chatId, playlistName, fileName);
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
      const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
      const playlists = await fetchPlaylists(siteUrl);
      const playlist = playlists.find(p => p.name === playlistName);
      if (playlist && playlist.tracks && playlist.tracks[songIndex]) {
        const track = playlist.tracks[songIndex];
        await sendMessage(botToken, chatId, `🎵 **${track.trackName}**\n\n📁 Playlist: ${playlistName}\n🎵 Track #${track.trackNumber}`);
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
async function handleMessage(message: any): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();
  const userId = message.from?.id;

  if (!text) return;

  const userIdStr = chatId.toString();
  if (!checkRateLimit(userIdStr, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
    const resetTime = getResetTime(userIdStr);
    const waitSeconds = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
    await sendMessage(botToken, chatId, `⏳ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`);
    return;
  }

  const session = userSessions.get(chatId);
  if (session && session.type === 'waiting_for_url') {
    if (isValidSongUrl(text)) {
      try {
        new URL(text);
      } catch {
        await sendMessage(botToken, chatId, '❌ Invalid URL format. Please share a valid YouTube or Spotify link.');
        return;
      }
      const playlistName = session.playlistName;
      processSongSubmission(chatId, text, playlistName).catch((error) => {
        console.error('Background processing error:', error);
      });
    } else {
      await sendMessage(botToken, chatId, '❌ Invalid URL. Please share a valid YouTube or Spotify link.\n\n' +
        'Examples:\n' +
        '• https://www.youtube.com/watch?v=...\n' +
        '• https://youtu.be/...\n' +
        '• https://open.spotify.com/track/...\n' +
        '• https://open.spotify.com/album/...');
    }
    return;
  }

  if (text.startsWith('/start')) {
    const username = message.from?.username;
    await handleStartCommand(chatId, username, userId);
    return;
  }

  if (text.startsWith('/playlists')) {
    const isAdminUser = userId ? isAdmin(userId) : false;
    await showPlaylists(chatId, undefined, isAdminUser, false);
    return;
  }

  await sendMessage(botToken, chatId, '👋 Use /start to see available options!');
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

  // Check for active webhook and delete it to enable polling
  let webhookInfo = await checkWebhook();
  if (webhookInfo && webhookInfo.url) {
    console.log(`⚠️  Webhook detected: ${webhookInfo.url}`);
    
    // Check if webhook points to a dev/preview URL
    if (webhookInfo.url.includes('git-dev') || webhookInfo.url.includes('preview') || webhookInfo.url.includes('-dev-')) {
      console.log('⚠️  Warning: Webhook is pointing to a dev/preview URL!');
      console.log('💡 Dev/preview deployments reject webhooks automatically.');
      console.log('💡 You should only set webhooks for PRODUCTION deployments.');
    }
    
    console.log('🔄 Deleting webhook to enable polling mode...');
    
    const deleted = await deleteWebhook();
    if (deleted) {
      console.log('⏳ Verifying webhook deletion...');
      const verified = await verifyWebhookDeleted();
      if (verified) {
        console.log('✅ Webhook deleted and verified. Polling mode enabled.');
        if (webhookInfo.pending_update_count && webhookInfo.pending_update_count > 0) {
          console.log(`⚠️  Note: ${webhookInfo.pending_update_count} pending updates were lost.`);
        }
      } else {
        console.error('⚠️  Warning: Webhook deletion reported success but webhook still exists.');
        console.error('💡 This may be due to Vercel automatically re-enabling it.');
        console.error('💡 Make sure webhook is only set for PRODUCTION, not dev/preview.');
        console.error('💡 Try: npm run delete-webhook');
      }
    } else {
      console.error('❌ Failed to delete webhook. Please delete it manually:');
      console.error(`   npm run delete-webhook`);
      console.error(`   or: curl -X POST "https://api.telegram.org/bot${botToken}/deleteWebhook"`);
      process.exit(1);
    }
    console.log('');
  } else {
    console.log('✅ No webhook detected. Polling mode ready.');
    console.log('');
  }

  // Polling loop
  let conflictCount = 0;
  let consecutiveErrors = 0;
  
  while (true) {
    try {
      const updates = await getUpdates();
      conflictCount = 0; // Reset conflict count on success
      consecutiveErrors = 0; // Reset error count on success
      
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
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('CONFLICT') || errorMessage.includes('Conflict')) {
        conflictCount++;
        consecutiveErrors++;
        
        if (conflictCount >= 3) {
          console.error('\n❌ Persistent conflict error. Webhook may have been re-enabled.');
          console.error('💡 Checking current webhook status...');
          
          const currentWebhook = await checkWebhook();
          if (currentWebhook && currentWebhook.url) {
            console.error(`⚠️  Webhook is active: ${currentWebhook.url}`);
            console.error('💡 Attempting to delete webhook automatically...');
            
            const deleted = await deleteWebhook();
            if (deleted) {
              console.log('⏳ Verifying webhook deletion...');
              const verified = await verifyWebhookDeleted();
              if (verified) {
                console.log('✅ Webhook deleted and verified. Retrying polling...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                conflictCount = 0; // Reset and try again
                continue;
              } else {
                console.error('⚠️  Webhook deletion reported success but webhook still exists.');
                console.error('💡 This may be due to Vercel automatically re-enabling it.');
                console.error('💡 The webhook is likely being set by your Vercel deployment.');
                console.error('💡 Solution: Make sure webhook is only set for PRODUCTION, not dev/preview.');
                console.error('💡 Or run: npm run delete-webhook');
                // Don't exit, keep trying but with longer delay
                await new Promise(resolve => setTimeout(resolve, 10000));
                conflictCount = 0; // Reset counter but keep trying
                continue;
              }
            } else {
              console.error('❌ Failed to delete webhook automatically.');
              console.error('💡 Please delete it manually:');
              console.error(`   npm run delete-webhook`);
              console.error(`   or: curl -X POST "https://api.telegram.org/bot${botToken}/deleteWebhook"`);
              process.exit(1);
            }
          } else {
            console.error('⚠️  No webhook detected, but still getting conflicts.');
            console.error('💡 This may be a temporary Telegram API issue. Waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            conflictCount = 0; // Reset and try again
            continue;
          }
        }
        console.error(`⚠️  Conflict detected (${conflictCount}/3). Retrying...`);
      } else {
        consecutiveErrors++;
        console.error(`Error in polling loop (${consecutiveErrors}):`, errorMessage);
        
        // If we get too many consecutive errors, exit
        if (consecutiveErrors >= 10) {
          console.error('\n❌ Too many consecutive errors. Exiting.');
          process.exit(1);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }
}

// Run the bot
main().catch(console.error);

