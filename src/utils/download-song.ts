/**
 * Download service for YouTube/Spotify songs
 * Uses yt-dlp for YouTube URLs and spotify-dl for Spotify URLs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DEFAULT_AUDIO_QUALITY, DEFAULT_MAX_FILE_SIZE, DOWNLOAD_TIMEOUT, ERROR_MESSAGES } from '../constants';

const execAsync = promisify(exec);

/**
 * Check if URL is a YouTube URL
 */
function isYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

/**
 * Extract clean YouTube video URL (remove playlist parameters)
 */
function cleanYouTubeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Keep only the video ID parameter, remove list, index, start_radio, etc.
    const videoId = urlObj.searchParams.get('v');
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    // Handle youtu.be short URLs
    if (urlObj.hostname.includes('youtu.be')) {
      const videoId = urlObj.pathname.slice(1);
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Check if URL is a Spotify URL
 */
function isSpotifyUrl(url: string): boolean {
  return /^(https?:\/\/)?(open\.)?spotify\.com\/.+/.test(url);
}

interface DownloadResult {
  filePath: string;
  fileName: string;
  title?: string;
}

/**
 * Download a song from YouTube or Spotify URL using spotify-dl
 * Requires Python 3.7+ and spotify-dl installed
 * Also requires ffmpeg for MP3 conversion
 */
export async function downloadSong(
  url: string,
  spotifyClientId?: string,
  spotifyClientSecret?: string
): Promise<DownloadResult> {
  // Create temporary directory for download
  const tempDir = join(tmpdir(), `spotify-dl-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    // Set up environment variables for spotify-dl
    const env = {
      ...process.env,
      ...(spotifyClientId && { SPOTIPY_CLIENT_ID: spotifyClientId }),
      ...(spotifyClientSecret && { SPOTIPY_CLIENT_SECRET: spotifyClientSecret }),
    };

    // Build spotify-dl command
    // For single song, spotify-dl can handle both YouTube and Spotify URLs
    const command = `spotify_dl -l "${url}" -o "${tempDir}"`;

    console.log(`Executing: ${command}`);

    // Execute spotify-dl
    const { stdout, stderr } = await execAsync(command, {
      env,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log('spotify-dl stdout:', stdout);
    if (stderr) {
      console.warn('spotify-dl stderr:', stderr);
    }

    // Find the downloaded MP3 file
    const fs = await import('fs/promises');
    const files = await fs.readdir(tempDir);
    const mp3File = files.find((file) => file.endsWith('.mp3'));

    if (!mp3File) {
      throw new Error('No MP3 file found after download');
    }

    const filePath = join(tempDir, mp3File);

    // Read the file
    const fileBuffer = await fs.readFile(filePath);

    // Clean up temp directory
    await unlink(filePath);

    // Return file data
    return {
      filePath: filePath,
      fileName: sanitizeFileName(mp3File),
      title: mp3File.replace('.mp3', ''),
    };
  } catch (error: any) {
    // Clean up on error
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(join(tempDir, file)).catch(() => { });
      }
      await fs.rmdir(tempDir).catch(() => { });
    } catch { }

    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Download song and return as buffer
 * Max file size: 50MB (configurable)
 */
/**
 * Download song and return as file path
 * Max file size: 50MB (configurable)
 */
export async function downloadSongAsFile(
  url: string,
  spotifyClientId?: string,
  spotifyClientSecret?: string,
  maxFileSize: number = DEFAULT_MAX_FILE_SIZE
): Promise<{ filePath: string; fileName: string; title?: string }> {
  const tempDir = join(tmpdir(), `song-dl-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    let command: string;
    let env: Record<string, string> = { ...process.env };

    // Use yt-dlp for YouTube URLs, spotify-dl for Spotify URLs
    if (isYouTubeUrl(url)) {
      console.log(`[${new Date().toISOString()}] Detected YouTube URL, using yt-dlp`);
      // Clean the URL to remove playlist parameters
      const cleanUrl = cleanYouTubeUrl(url);
      console.log(`[${new Date().toISOString()}] Cleaned URL: ${cleanUrl} (original had playlist params)`);
      // Use yt-dlp for YouTube - extract audio as MP3, optimized for web streaming
      // --no-playlist ensures we only download the single video, not the entire playlist
      // --audio-quality 5 = ~128kbps (good for web streaming, smaller file size)
      const audioQuality = process.env.AUDIO_QUALITY || DEFAULT_AUDIO_QUALITY;
      console.log(`[${new Date().toISOString()}] Using audio quality: ${audioQuality} (~128kbps for web streaming)`);
      command = `yt-dlp --no-playlist --verbose -x --audio-format mp3 --audio-quality ${audioQuality} --progress --newline -o "${tempDir}/%(title)s.%(ext)s" "${cleanUrl}"`;
    } else if (isSpotifyUrl(url)) {
      console.log(`[${new Date().toISOString()}] Detected Spotify URL, using spotify-dl`);
      // Use spotify-dl for Spotify URLs
      env = {
        ...env,
        ...(spotifyClientId && { SPOTIPY_CLIENT_ID: spotifyClientId }),
        ...(spotifyClientSecret && { SPOTIPY_CLIENT_SECRET: spotifyClientSecret }),
      };
      command = `spotify_dl -l "${url}" -o "${tempDir}"`;
    } else {
      throw new Error('Unsupported URL type. Please provide a YouTube or Spotify link.');
    }

    console.log(`[${new Date().toISOString()}] Executing command: ${command}`);
    console.log(`[${new Date().toISOString()}] Temp directory: ${tempDir}`);

    // Execute download command with timeout (5 minutes)
    console.log(`[${new Date().toISOString()}] Starting download execution (timeout: 5 minutes)...`);

    // Use a promise wrapper to stream output in real-time
    let stdout = '';
    let stderr = '';

    const childProcess = exec(command, {
      env,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer (increased for verbose output)
    });

    // Stream stdout and stderr in real-time
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log each line
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`[${new Date().toISOString()}] [stdout] ${line.trim()}`);
        }
      });
    });

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // yt-dlp sends progress to stderr
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`[${new Date().toISOString()}] [stderr] ${line.trim()}`);
        }
      });
    });

    // Wait for completion with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(ERROR_MESSAGES.DOWNLOAD_TIMEOUT));
      }, DOWNLOAD_TIMEOUT);

      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log(`[${new Date().toISOString()}] Download completed`);

    // Find the downloaded MP3 file (recursively search subdirectories)
    console.log(`[${new Date().toISOString()}] Looking for downloaded MP3 file in: ${tempDir}`);
    const fs = await import('fs/promises');
    const path = await import('path');

    /**
     * Recursively search for MP3 files in directory and subdirectories
     */
    async function findMp3File(dir: string, depth: number = 0): Promise<string | null> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          try {
            if (entry.isDirectory()) {
              // Recursively search subdirectories
              const found = await findMp3File(fullPath, depth + 1);
              if (found) return found;
            } else if (entry.isFile() && entry.name.endsWith('.mp3')) {
              // Found MP3 file
              return fullPath;
            }
          } catch (err: any) {
            console.warn(`[${new Date().toISOString()}] Error processing entry ${entry.name}:`, err.message);
          }
        }
      } catch (err: any) {
        console.warn(`[${new Date().toISOString()}] Error reading directory ${dir}:`, err.message);
      }

      return null;
    }

    // Give a delay to ensure file system is synced and conversion is complete
    let mp3FilePath: string | null = null;
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      mp3FilePath = await findMp3File(tempDir);
      if (mp3FilePath) {
        break;
      }
    }

    if (!mp3FilePath) {
      throw new Error('No MP3 file found after download. Please check the URL is valid.');
    }

    console.log(`[${new Date().toISOString()}] Found MP3 file: ${mp3FilePath}`);

    const filePath = mp3FilePath;
    const fileName = path.basename(mp3FilePath);

    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > maxFileSize) {
      await fs.unlink(filePath).catch(() => { });
      throw new Error(`File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
    }

    if (stats.size === 0) {
      await fs.unlink(filePath).catch(() => { });
      throw new Error('Downloaded file is empty. Please try again.');
    }

    // Return file path instead of buffer
    // Note: Caller is responsible for cleaning up the file and tempDir
    return {
      filePath,
      fileName: sanitizeFileName(fileName),
      title: fileName.replace('.mp3', ''),
    };
  } catch (error: any) {
    // Clean up on error
    try {
      const fs = await import('fs/promises');
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
    } catch { }

    // Provide user-friendly error messages
    const errorMessage = error.message || String(error);

    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ENOTFOUND')) {
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      throw new Error(ERROR_MESSAGES.DOWNLOAD_TIMEOUT);
    }
    if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
      throw new Error(ERROR_MESSAGES.SERVICE_UNAVAILABLE);
    }
    if (errorMessage.includes('No MP3 file found') || errorMessage.includes('Download failed')) {
      throw new Error(ERROR_MESSAGES.DOWNLOAD_FAILED);
    }

    // Re-throw with original message if no specific handler matched
    throw error;
  }
}

/**
 * Sanitize filename to remove special characters
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255); // Limit length
}

