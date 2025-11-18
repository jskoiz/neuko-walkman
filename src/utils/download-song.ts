/**
 * Download service for YouTube/Spotify songs
 * Uses yt-dlp for YouTube URLs and spotify-dl for Spotify URLs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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
        await fs.unlink(join(tempDir, file)).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
    } catch {}

    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Download song and return as buffer
 * Max file size: 50MB (configurable)
 */
export async function downloadSongAsBuffer(
  url: string,
  spotifyClientId?: string,
  spotifyClientSecret?: string,
  maxFileSize: number = 50 * 1024 * 1024 // 50MB default
): Promise<{ buffer: Buffer; fileName: string; title?: string }> {
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
      // Quality options: 0=best (~320kbps), 2=~192kbps, 5=~128kbps, 7=~96kbps, 9=~64kbps
      // Default to 5 (128kbps) - good balance of quality and file size for web streaming
      // This reduces file size significantly (from ~7MB to ~2-3MB for a 3-4 min song)
      const audioQuality = process.env.AUDIO_QUALITY || '5';
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
        reject(new Error('Download timed out after 5 minutes'));
      }, 5 * 60 * 1000);

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
    console.log(`[${new Date().toISOString()}] stdout:`, stdout);
    if (stderr) {
      console.warn(`[${new Date().toISOString()}] stderr:`, stderr);
    }

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
        console.log(`[${new Date().toISOString()}] Searching in ${dir} (depth ${depth}), found ${entries.length} entries`);
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          try {
            if (entry.isDirectory()) {
              // Recursively search subdirectories
              console.log(`[${new Date().toISOString()}] Entering subdirectory: ${entry.name}`);
              const found = await findMp3File(fullPath, depth + 1);
              if (found) return found;
            } else if (entry.isFile() && entry.name.endsWith('.mp3')) {
              // Found MP3 file
              console.log(`[${new Date().toISOString()}] Found MP3 file: ${fullPath}`);
              return fullPath;
            } else {
              console.log(`[${new Date().toISOString()}] Found file (not MP3): ${entry.name}`);
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
    // spotify-dl converts m4a to mp3, which can take a moment
    let mp3FilePath: string | null = null;
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[${new Date().toISOString()}] Retry attempt ${attempt}/${maxRetries} to find MP3 file...`);
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
      // List all files recursively for debugging
      async function listAllFiles(dir: string, prefix: string = ''): Promise<string[]> {
        const files: string[] = [];
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              files.push(...await listAllFiles(fullPath, `${prefix}${entry.name}/`));
            } else {
              files.push(`${prefix}${entry.name}`);
            }
          }
        } catch {}
        return files;
      }
      
      const allFiles = await listAllFiles(tempDir);
      console.error(`[${new Date().toISOString()}] No MP3 file found. Available files:`, allFiles);
      throw new Error('No MP3 file found after download. Please check the URL is valid.');
    }
    
    console.log(`[${new Date().toISOString()}] Found MP3 file: ${mp3FilePath}`);

    const filePath = mp3FilePath;
    const fileName = path.basename(mp3FilePath);
    
    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > maxFileSize) {
      await fs.unlink(filePath).catch(() => {});
      throw new Error(`File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
    }

    if (stats.size === 0) {
      await fs.unlink(filePath).catch(() => {});
      throw new Error('Downloaded file is empty. Please try again.');
    }
    
    // Read the file
    const buffer = await fs.readFile(filePath);

    // Clean up - remove the file and recursively remove empty directories
    await fs.unlink(filePath).catch(() => {});
    
    // Recursively clean up empty directories
    async function cleanupEmptyDirs(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir);
        if (entries.length === 0) {
          await fs.rmdir(dir).catch(() => {});
          // Try to remove parent directory if it's also empty
          const parentDir = path.dirname(dir);
          if (parentDir !== tempDir && parentDir !== dir) {
            await cleanupEmptyDirs(parentDir);
          }
        }
      } catch {}
    }
    
    // Clean up the directory structure
    const fileDir = path.dirname(filePath);
    if (fileDir !== tempDir) {
      await cleanupEmptyDirs(fileDir);
    }
    await fs.rmdir(tempDir).catch(() => {});

    return {
      buffer,
      fileName: sanitizeFileName(fileName),
      title: fileName.replace('.mp3', ''),
    };
  } catch (error: any) {
    // Clean up on error
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(tempDir).catch(() => []);
      for (const file of files) {
        await fs.unlink(join(tempDir, file)).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
    } catch {}

    // Provide user-friendly error messages
    if (error.message.includes('timeout')) {
      throw new Error('Download timed out. The song may be too long or the service is busy. Please try again.');
    }
    if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
      throw new Error('spotify-dl is not installed or not in PATH. Please contact the administrator.');
    }
    
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

