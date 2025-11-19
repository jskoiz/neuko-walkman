/**
 * Unified playlist generator with strategy pattern
 * Abstracts the scanning logic (local filesystem vs FTP) and shares core playlist building logic
 */

import type { Playlist, PlaylistTrack, ScanResult } from './ftp-scanner';
import { SUPPORTED_AUDIO_FORMATS, SUPPORTED_AUDIO_EXTENSIONS, MUSIC_DIR, DEFAULT_PLAYLIST } from '../constants';

/**
 * Strategy interface for scanning music files
 */
export interface ScanStrategy {
  /**
   * List directories in the base path
   */
  listDirectories(basePath: string): Promise<string[]>;
  
  /**
   * List audio files in a directory
   */
  listAudioFiles(directoryPath: string): Promise<string[]>;
  
  /**
   * Check if a path exists
   */
  pathExists(path: string): Promise<boolean>;
}

/**
 * Build playlist structure from directory and file data
 */
function buildPlaylistStructure(
  directories: string[],
  getAudioFiles: (dir: string) => Promise<string[]>,
  getFileName: (filePath: string) => string,
  getRelativePath: (dir: string, fileName: string) => string
): Promise<Playlist[]> {
  const playlists: Playlist[] = [];

  return Promise.all(
    directories.map(async (dirName, index) => {
      const audioFiles = await getAudioFiles(dirName);
      
      if (audioFiles.length === 0) {
        return null;
      }

      const tracks: PlaylistTrack[] = audioFiles.map((filePath, trackIndex) => {
        const fileName = getFileName(filePath);
        const trackName = fileName.replace(/\.[^/.]+$/, '');
        const relativePath = getRelativePath(dirName, fileName);
        
        return {
          trackNumber: trackIndex + 1,
          trackName: trackName,
          fileName: `${MUSIC_DIR}/${relativePath}`,
          duration: '0:00',
          playlistName: dirName,
          playlistIndex: index + 1,
          playlistTotal: directories.length,
          playlistPath: `${MUSIC_DIR}/${dirName}`,
        };
      });

      return {
        name: dirName,
        path: `${MUSIC_DIR}/${dirName}`,
        index: index + 1,
        total: directories.length,
        tracks: tracks,
      };
    })
  ).then(results => results.filter((p): p is Playlist => p !== null));
}

/**
 * Generate playlists using a scan strategy
 */
export async function generatePlaylists(strategy: ScanStrategy, basePath: string): Promise<ScanResult> {
  // Check if base path exists
  const exists = await strategy.pathExists(basePath);
  if (!exists) {
    return { playlists: [] };
  }

  // Get all directories (playlists)
  const directories = await strategy.listDirectories(basePath);
  
  if (directories.length === 0) {
    return { playlists: [] };
  }

  // Build playlist structure
  const playlists = await buildPlaylistStructure(
    directories,
    async (dirName) => {
      const dirPath = `${basePath}/${dirName}`;
      return await strategy.listAudioFiles(dirPath);
    },
    (filePath) => {
      // Extract filename from path
      const parts = filePath.split(/[/\\]/);
      return parts[parts.length - 1];
    },
    (dirName, fileName) => {
      return `${dirName}/${fileName}`;
    }
  );

  return { playlists };
}

/**
 * Check if a file is an audio file based on extension
 */
export function isAudioFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  
  // Check both with and without dot
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any) || 
         SUPPORTED_AUDIO_FORMATS.includes(`.${ext}` as any);
}

/**
 * Filter audio files from a list of files
 */
export function filterAudioFiles(files: string[]): string[] {
  return files.filter(file => isAudioFile(file));
}


