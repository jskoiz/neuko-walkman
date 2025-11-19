/**
 * Song deletion service
 */

import { sendMessage, validatePlaylistName } from '../../utils/telegram-bot';
import { deleteFromDreamhost } from '../../utils/upload-to-dreamhost';
import { DEFAULT_FTP_HOST, DEFAULT_FTP_PATH } from '../../constants';
import { logBotActivity } from '../utils/logger';

export interface SongDeletionConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
}

export async function deleteSong(
  config: SongDeletionConfig,
  playlistName: string,
  fileName: string
): Promise<void> {
  const { botToken, chatId, userId, username } = config;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'SONG_DELETION_STARTED',
    details: { fileName, playlist: playlistName },
    status: 'info',
  });

  try {
    if (!validatePlaylistName(playlistName)) {
      await sendMessage(botToken, chatId, '❌ Invalid playlist name.');
      logBotActivity({
        timestamp: new Date().toISOString(),
        userId,
        username,
        chatId,
        action: 'SONG_DELETION_FAILED',
        details: { fileName, playlist: playlistName, reason: 'Invalid playlist name' },
        status: 'error',
      });
      return;
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    await sendMessage(botToken, chatId, '🗑️ Deleting song...');

    const ftpHost = process.env.DREAMHOST_FTP_HOST || DEFAULT_FTP_HOST;
    const ftpUser = process.env.DREAMHOST_FTP_USER;
    const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
    const basePath = process.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || DEFAULT_FTP_PATH;
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

    // Also delete local copy if it exists
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const localFilePath = path.join(process.cwd(), 'public', 'music', playlistName, sanitizedFileName);
      try {
        await fs.unlink(localFilePath);
      } catch (localError: any) {
        if (localError.code !== 'ENOENT') {
          console.warn(`Failed to delete local file:`, localError);
        }
      }
    } catch (error) {
      // Ignore local file deletion errors
    }

    // Wait for FTP server to process deletion
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Regenerate playlists locally
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('npm run generate-playlists');
    } catch (error) {
      console.error('Failed to regenerate playlists locally:', error);
    }

    await sendMessage(botToken, chatId, `✅ Song deleted from "${playlistName}" playlist.`);
    
    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'SONG_DELETION_SUCCESS',
      details: { fileName, playlist: playlistName },
      status: 'success',
    });
  } catch (error: any) {
    let errorMessage = error.message || 'An unknown error occurred';
    if (errorMessage.includes('not found')) {
      errorMessage = 'Song not found on server.';
    } else if (errorMessage.includes('FTP') || errorMessage.includes('SFTP')) {
      errorMessage = 'Failed to delete the song. Please contact support if this persists.';
    }
    await sendMessage(botToken, chatId, `❌ Error: ${errorMessage}`);
    
    logBotActivity({
      timestamp: new Date().toISOString(),
      userId,
      username,
      chatId,
      action: 'SONG_DELETION_FAILED',
      details: { fileName, playlist: playlistName, errorMessage },
      status: 'error',
      error: error.stack || error.message,
    });
  }
}


