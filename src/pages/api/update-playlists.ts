/**
 * API endpoint to regenerate playlists.json
 * Called after a new song is added to update the playlist configuration
 */

import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
 * Regenerate playlists by running the generate-playlists script
 */
async function regeneratePlaylists(): Promise<void> {
  const rootDir = getRootDir();
  
  try {
    // Run the generate-playlists script
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
 * API route handler
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

