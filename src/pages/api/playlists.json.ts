/**
 * API endpoint that serves playlists.json dynamically by scanning DreamHost FTP
 * This ensures playlists always reflect the current state of files on DreamHost
 */

import type { APIRoute } from 'astro';
import { scanDreamHostFTP } from '../../utils/ftp-scanner';

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
            'Cache-Control': 'no-cache, no-store, must-revalidate', // Don't cache - always fetch fresh data
            'Pragma': 'no-cache',
            'Expires': '0',
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



