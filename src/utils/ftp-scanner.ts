/**
 * Shared FTP/SFTP scanner utility for DreamHost
 * Scans remote FTP directory for music files and generates playlist structure
 * Uses unified playlist generator with FTP strategy
 */

import { DEFAULT_FTP_HOST, DEFAULT_FTP_PATH } from '../constants';
import { generatePlaylists } from './playlist-generator';
import { FTPStrategy } from './strategies/ftp-strategy';

export interface FTPConfig {
  host?: string;
  user?: string;
  password?: string;
  basePath?: string;
  useSFTP?: boolean;
}

export interface PlaylistTrack {
  trackNumber: number;
  trackName: string;
  fileName: string;
  duration: string;
  playlistName: string;
  playlistIndex: number;
  playlistTotal: number;
  playlistPath: string;
}

export interface Playlist {
  name: string;
  path: string;
  index: number;
  total: number;
  tracks: PlaylistTrack[];
}

export interface ScanResult {
  playlists: Playlist[];
}

/**
 * Scan DreamHost FTP directory for music files
 * @param config Optional FTP configuration (defaults to environment variables)
 * @returns Playlist data structure
 */
export async function scanDreamHostFTP(config?: FTPConfig): Promise<ScanResult> {
  const ftpHost = config?.host || import.meta.env.DREAMHOST_FTP_HOST || DEFAULT_FTP_HOST;
  const ftpUser = config?.user || import.meta.env.DREAMHOST_FTP_USER;
  const ftpPassword = config?.password || import.meta.env.DREAMHOST_FTP_PASSWORD;

  // Handle basePath - some callers strip the last segment, some don't
  let basePath = config?.basePath || import.meta.env.DREAMHOST_FTP_PATH || DEFAULT_FTP_PATH;
  // If basePath ends with a specific playlist folder, strip it to get the parent directory
  if (!config?.basePath && import.meta.env.DREAMHOST_FTP_PATH) {
    basePath = import.meta.env.DREAMHOST_FTP_PATH.replace(/\/[^/]+$/, '') || DEFAULT_FTP_PATH;
  }

  const useSFTP = config?.useSFTP ?? (import.meta.env.DREAMHOST_USE_SFTP === 'true');

  if (!ftpUser || !ftpPassword) {
    throw new Error('FTP credentials not configured');
  }

  // Create FTP strategy
  const strategy = new FTPStrategy({
    host: ftpHost,
    user: ftpUser,
    password: ftpPassword,
    useSFTP: useSFTP,
  });

  // Try SFTP first (or if useSFTP is set), fallback to FTP if SFTP fails
  if (useSFTP) {
    try {
      await strategy.connect();
      return await generatePlaylists(strategy, basePath);
    } catch (error: any) {
      console.warn('SFTP scan failed, trying FTP fallback:', error.message);
      await strategy.disconnect(); // Ensure clean disconnect before retry

      try {
        // Retry with FTP
        const ftpStrategy = new FTPStrategy({
          host: ftpHost,
          user: ftpUser,
          password: ftpPassword,
          useSFTP: false,
        });
        await ftpStrategy.connect();
        try {
          return await generatePlaylists(ftpStrategy, basePath);
        } finally {
          await ftpStrategy.disconnect();
        }
      } catch (ftpError: any) {
        throw new Error(`Both SFTP and FTP failed. SFTP: ${error.message}, FTP: ${ftpError.message}`);
      }
    } finally {
      await strategy.disconnect();
    }
  } else {
    // Try FTP first, fallback to SFTP if FTP fails
    try {
      await strategy.connect();
      return await generatePlaylists(strategy, basePath);
    } catch (error: any) {
      console.warn('FTP scan failed, trying SFTP fallback:', error.message);
      await strategy.disconnect(); // Ensure clean disconnect before retry

      try {
        // Retry with SFTP
        const sftpStrategy = new FTPStrategy({
          host: ftpHost,
          user: ftpUser,
          password: ftpPassword,
          useSFTP: true,
        });
        await sftpStrategy.connect();
        try {
          return await generatePlaylists(sftpStrategy, basePath);
        } finally {
          await sftpStrategy.disconnect();
        }
      } catch (sftpError: any) {
        throw new Error(`Both FTP and SFTP failed. FTP: ${error.message}, SFTP: ${sftpError.message}`);
      }
    } finally {
      await strategy.disconnect();
    }
  }
}

