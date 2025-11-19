/**
 * Song processing service
 * Handles download and upload of songs
 */

import { downloadSongAsFile } from '../../utils/download-song';
import { uploadToDreamhost } from '../../utils/upload-to-dreamhost';
import { validatePlaylistName } from '../../utils/telegram-bot';
import { COMMUNITY_PLAYLIST, DEFAULT_FTP_HOST, DEFAULT_FTP_PATH, DEFAULT_SITE_URL } from '../../constants';
import { logBotActivity } from '../utils/logger';

export interface SongProcessorConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
}

export async function processSongSubmission(
  config: SongProcessorConfig,
  url: string,
  playlistName?: string
): Promise<void> {
  const { botToken, chatId, userId, username } = config;
  const targetPlaylist = playlistName || COMMUNITY_PLAYLIST;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'SONG_SUBMISSION_STARTED',
    details: { url, playlist: targetPlaylist },
    status: 'info',
  });

  let tempFilePath: string | undefined;

  try {
    // Send initial processing message
    const { sendMessage } = await import('../../utils/telegram-bot');
    await sendMessage(botToken, chatId, '🎵 Processing your song... This may take a minute.');

    // Download the song
    const spotifyClientId = process.env.SPOTIPY_CLIENT_ID;
    const spotifyClientSecret = process.env.SPOTIPY_CLIENT_SECRET;
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800');

    const { filePath, fileName, title } = await downloadSongAsFile(
      url,
      spotifyClientId,
      spotifyClientSecret,
      maxFileSize
    );
    tempFilePath = filePath;

    // Validate playlist name if provided
    if (playlistName && !validatePlaylistName(playlistName)) {
      throw new Error('Invalid playlist name');
    }

    // Upload to Dreamhost
    const ftpHost = process.env.DREAMHOST_FTP_HOST || DEFAULT_FTP_HOST;
    const ftpUser = process.env.DREAMHOST_FTP_USER;
    const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
    const basePath = process.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || DEFAULT_FTP_PATH;
    const useSFTP = process.env.DREAMHOST_USE_SFTP === 'true';
    const ftpPath = `${basePath}/${targetPlaylist}`;

    if (!ftpUser || !ftpPassword) {
      throw new Error('FTP credentials not configured');
    }

    // Upload using the file path (streams internally)
    await uploadToDreamhost(filePath, fileName, {
      host: ftpHost,
      user: ftpUser,
      password: ftpPassword,
      remotePath: ftpPath,
      useSFTP: useSFTP,
    });

    // Also save a local copy for localhost testing
    const fs = await import('fs/promises');
    const path = await import('path');
    const localCommunityDir = path.join(process.cwd(), 'public', 'music', COMMUNITY_PLAYLIST);
    await fs.mkdir(localCommunityDir, { recursive: true });
    const localFilePath = path.join(localCommunityDir, fileName);

    // Copy file instead of writing buffer
    await fs.copyFile(filePath, localFilePath);

    // Regenerate playlists locally
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('npm run generate-playlists');
    } catch (error) {
      console.error('Failed to regenerate playlists locally:', error);
    }

    // Trigger playlist update (if site URL is configured)
    const siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;
    if (siteUrl) {
      try {
        await fetch(`${siteUrl}/api/update-playlists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Failed to update playlists:', error);
      }
    }

    // Send success message
    const playlistDisplay = playlistName || COMMUNITY_PLAYLIST;
    await sendMessage(
      botToken,
      chatId,
      `✅ Success! Your song "${title || fileName}" has been added to the "${playlistDisplay}" playlist.\n\nIt will be available on the site shortly.`
    );

    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'SONG_SUBMISSION_SUCCESS',
      details: {
        fileName,
        title: title || fileName,
        playlist: playlistDisplay,
        // fileSizeMB: Math.round(buffer.length / 1024 / 1024), // Buffer no longer available
      },
      status: 'success',
    });
  } catch (error: any) {
    const { ERROR_MESSAGES } = await import('../../constants');
    let errorMessage = error.message || 'An unknown error occurred';

    // Handle network/fetch errors
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ENOTFOUND')) {
      errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else if (errorMessage.includes('File too large')) {
      errorMessage = ERROR_MESSAGES.FILE_TOO_LARGE;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorMessage = ERROR_MESSAGES.DOWNLOAD_TIMEOUT;
    } else if (errorMessage.includes('No MP3 file found') || errorMessage.includes('Download failed')) {
      errorMessage = ERROR_MESSAGES.DOWNLOAD_FAILED;
    } else if (errorMessage.includes('FTP') || errorMessage.includes('SFTP')) {
      errorMessage = ERROR_MESSAGES.FTP_ERROR;
    } else if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
      errorMessage = ERROR_MESSAGES.SERVICE_UNAVAILABLE;
    }

    const { sendMessage } = await import('../../utils/telegram-bot');
    await sendMessage(
      botToken,
      chatId,
      `❌ Error: ${errorMessage}\n\nPlease make sure you're sharing a valid YouTube or Spotify link.`
    );

    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'SONG_SUBMISSION_FAILED',
      details: { url, playlist: targetPlaylist, errorMessage },
      status: 'error',
      error: error.stack || error.message,
    });

    throw error;
  } finally {
    // Clean up temp file and directory
    if (tempFilePath) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const tempDir = path.dirname(tempFilePath);
        // Remove the temp directory and all its contents
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
  }
}

