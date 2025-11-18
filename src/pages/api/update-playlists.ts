/**
 * API endpoint to regenerate playlists.json
 * Called after a new song is added to update the playlist configuration
 * 
 * This endpoint scans DreamHost FTP to generate playlists from the actual remote files
 */

import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scanDreamHostFTP } from '../../utils/ftp-scanner';

const execAsync = promisify(exec);

/**
 * Get the project root directory
 */
function getRootDir(): string {
  // In Vercel/serverless, we need to use process.cwd()
  // In development, we can use import.meta.url
  try {
    if (typeof process !== 'undefined' && process.cwd) {
      return process.cwd();
    }
    const __filename = fileURLToPath(import.meta.url);
    return join(dirname(__filename), '../../../../');
  } catch {
    // Fallback to current working directory
    return process.cwd();
  }
}

/**
 * Regenerate playlists by scanning DreamHost FTP or running local script
 */
async function regeneratePlaylists(): Promise<void> {
  const rootDir = getRootDir();
  
  // Try to scan DreamHost FTP first (for production)
  const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
  const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
  
  if (ftpUser && ftpPassword) {
    try {
      console.log('Scanning DreamHost FTP for music files...');
      const playlistsData = await scanDreamHostFTP({
        basePath: import.meta.env.DREAMHOST_FTP_PATH || '/public/music',
      });
      
      // Write to src/config/playlists.json
      const configPath = join(rootDir, 'src/config/playlists.json');
      await writeFile(configPath, JSON.stringify(playlistsData, null, 2), 'utf-8');
      console.log(`Generated playlists.json with ${playlistsData.playlists.length} playlist(s) from DreamHost`);
      return;
    } catch (error: any) {
      console.warn('Failed to scan DreamHost FTP, falling back to local scan:', error.message);
    }
  }
  
  // Fallback: Run the generate-playlists script (for local development)
  try {
    const { stdout, stderr } = await execAsync('npm run generate-playlists', {
      cwd: rootDir,
    });
    
    if (stderr) {
      console.warn('generate-playlists stderr:', stderr);
    }
    
    console.log('generate-playlists stdout:', stdout);
  } catch (error: any) {
    throw new Error(`Failed to regenerate playlists: ${error.message}`);
  }
}

/**
 * Copy playlists.json from src/config to public directory
 */
async function copyPlaylistsToPublic(): Promise<void> {
  const rootDir = getRootDir();
  
  try {
    const srcConfigPath = join(rootDir, 'src/config/playlists.json');
    const publicPath = join(rootDir, 'public/playlists.json');
    
    const playlistsData = await readFile(srcConfigPath, 'utf-8');
    await writeFile(publicPath, playlistsData, 'utf-8');
    
    console.log('Copied playlists.json to public directory');
  } catch (error: any) {
    throw new Error(`Failed to copy playlists.json: ${error.message}`);
  }
}

/**
 * GET endpoint - returns current playlists by scanning DreamHost FTP
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
            'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache - always fetch fresh data
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    } else {
      // Fallback: try to read from config file
      const rootDir = getRootDir();
      try {
        const configPath = join(rootDir, 'src/config/playlists.json');
        const playlistsData = await readFile(configPath, 'utf-8');
        return new Response(playlistsData, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache - always fetch fresh data
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ playlists: [], error: 'No playlists available' }),
          {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
      }
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

/**
 * POST endpoint - regenerates playlists and updates files
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Optional: Add authentication/authorization here
    const authToken = import.meta.env.PLAYLIST_UPDATE_TOKEN;
    if (authToken) {
      const providedToken = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (providedToken !== authToken) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Regenerate playlists
    await regeneratePlaylists();
    
    // Copy to public directory
    await copyPlaylistsToPublic();

    return new Response(
      JSON.stringify({ success: true, message: 'Playlists updated successfully' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error updating playlists:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

