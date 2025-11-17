/**
 * API endpoint that serves playlists.json dynamically by scanning DreamHost FTP
 * This ensures playlists always reflect the current state of files on DreamHost
 */

import type { APIRoute } from 'astro';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';

/**
 * Scan DreamHost FTP directory for music files
 */
async function scanDreamHostFTP(): Promise<any> {
  const ftpHost = import.meta.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
  const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
  const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
  const basePath = import.meta.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
  const useSFTP = import.meta.env.DREAMHOST_USE_SFTP === 'true';

  if (!ftpUser || !ftpPassword) {
    throw new Error('FTP credentials not configured');
  }

  const playlists: any[] = [];

  if (useSFTP) {
    // Use SFTP
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
    } finally {
      await client.end();
    }
  } else {
    // Use FTP
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
    } finally {
      client.close();
    }
  }

  return { playlists };
}

/**
 * API route handler - serves playlists.json dynamically
 */
export const GET: APIRoute = async () => {
  try {
    const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
    const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
    
    if (ftpUser && ftpPassword) {
      const playlistsData = await scanDreamHostFTP();
      return new Response(
        JSON.stringify(playlistsData),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60', // Cache for 1 minute
          },
        }
      );
    } else {
      // Fallback: return empty playlists if FTP not configured
      return new Response(
        JSON.stringify({ playlists: [] }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Error fetching playlists:', error);
    return new Response(
      JSON.stringify({ playlists: [], error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

