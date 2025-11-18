/**
 * Shared FTP/SFTP scanner utility for DreamHost
 * Scans remote FTP directory for music files and generates playlist structure
 */

import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';

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
  const ftpHost = config?.host || import.meta.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
  const ftpUser = config?.user || import.meta.env.DREAMHOST_FTP_USER;
  const ftpPassword = config?.password || import.meta.env.DREAMHOST_FTP_PASSWORD;
  
  // Handle basePath - some callers strip the last segment, some don't
  let basePath = config?.basePath || import.meta.env.DREAMHOST_FTP_PATH || '/public/music';
  // If basePath ends with a specific playlist folder, strip it to get the parent directory
  if (!config?.basePath && import.meta.env.DREAMHOST_FTP_PATH) {
    basePath = import.meta.env.DREAMHOST_FTP_PATH.replace(/\/[^/]+$/, '') || '/public/music';
  }
  
  const useSFTP = config?.useSFTP ?? (import.meta.env.DREAMHOST_USE_SFTP === 'true');

  if (!ftpUser || !ftpPassword) {
    throw new Error('FTP credentials not configured');
  }

  const playlists: Playlist[] = [];

  // Helper function to scan using SFTP
  async function scanWithSFTP(): Promise<Playlist[]> {
    const client = new SftpClient();
    try {
      await client.connect({
        host: ftpHost,
        username: ftpUser,
        password: ftpPassword,
        port: 22,
      });

      const directories = await client.list(basePath);
      const playlistDirs = directories.filter((item: any) => item.type === 'd' && item.name !== '.' && item.name !== '..');

      for (let index = 0; index < playlistDirs.length; index++) {
        const dir = playlistDirs[index];
        const playlistPath = `${basePath}/${dir.name}`;
        const files = await client.list(playlistPath);
        const audioFiles = files.filter((file: any) => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          return file.type === '-' && ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
        });

        if (audioFiles.length > 0) {
          const tracks = audioFiles.map((file: any, trackIndex: number) => {
            const trackName = file.name.replace(/\.[^/.]+$/, '');
            return {
              trackNumber: trackIndex + 1,
              trackName: trackName,
              fileName: `/music/${dir.name}/${file.name}`,
              duration: '0:00',
              playlistName: dir.name,
              playlistIndex: index + 1,
              playlistTotal: playlistDirs.length,
              playlistPath: `/music/${dir.name}`,
            };
          });

          playlists.push({
            name: dir.name,
            path: `/music/${dir.name}`,
            index: index + 1,
            total: playlistDirs.length,
            tracks: tracks,
          });
        }
      }
      return playlists;
    } finally {
      await client.end();
    }
  }

  // Helper function to scan using FTP
  async function scanWithFTP(): Promise<Playlist[]> {
    const client = new Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        secure: false,
        timeout: 30000,
      });

      const directories = await client.list(basePath);
      const playlistDirs = directories.filter((item: any) => item.isDirectory && item.name !== '.' && item.name !== '..');

      for (let index = 0; index < playlistDirs.length; index++) {
        const dir = playlistDirs[index];
        const playlistPath = `${basePath}/${dir.name}`;
        const files = await client.list(playlistPath);
        const audioFiles = files.filter((file: any) => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          return !file.isDirectory && ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
        });

        if (audioFiles.length > 0) {
          const tracks = audioFiles.map((file: any, trackIndex: number) => {
            const trackName = file.name.replace(/\.[^/.]+$/, '');
            return {
              trackNumber: trackIndex + 1,
              trackName: trackName,
              fileName: `/music/${dir.name}/${file.name}`,
              duration: '0:00',
              playlistName: dir.name,
              playlistIndex: index + 1,
              playlistTotal: playlistDirs.length,
              playlistPath: `/music/${dir.name}`,
            };
          });

          playlists.push({
            name: dir.name,
            path: `/music/${dir.name}`,
            index: index + 1,
            total: playlistDirs.length,
            tracks: tracks,
          });
        }
      }
      return playlists;
    } finally {
      client.close();
    }
  }

  // Try SFTP first (or if useSFTP is set), fallback to FTP if SFTP fails
  if (useSFTP) {
    try {
      return { playlists: await scanWithSFTP() };
    } catch (error: any) {
      console.warn('SFTP scan failed, trying FTP fallback:', error.message);
      try {
        return { playlists: await scanWithFTP() };
      } catch (ftpError: any) {
        throw new Error(`Both SFTP and FTP failed. SFTP: ${error.message}, FTP: ${ftpError.message}`);
      }
    }
  } else {
    // Try FTP first, fallback to SFTP if FTP fails
    try {
      return { playlists: await scanWithFTP() };
    } catch (error: any) {
      console.warn('FTP scan failed, trying SFTP fallback:', error.message);
      try {
        return { playlists: await scanWithSFTP() };
      } catch (sftpError: any) {
        throw new Error(`Both FTP and SFTP failed. FTP: ${error.message}, SFTP: ${sftpError.message}`);
      }
    }
  }
}

