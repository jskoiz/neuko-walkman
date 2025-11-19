/**
 * API endpoint that serves playlists.json dynamically by scanning DreamHost FTP
 * This ensures playlists always reflect the current state of files on DreamHost
 */

import type { APIRoute } from 'astro';
import { scanDreamHostFTP } from '../../utils/ftp-scanner';
import { validateFTPEnv } from '../../utils/env-validation';
import { getPlaylistCache } from '../../utils/playlist-cache';

/**
 * API route handler - serves playlists.json dynamically
 */
export const GET: APIRoute = async () => {
  try {
    const ftpUser = import.meta.env.DREAMHOST_FTP_USER;
    const ftpPassword = import.meta.env.DREAMHOST_FTP_PASSWORD;
    
    // Check cache first if FTP credentials are available
    if (ftpUser && ftpPassword) {
      const cache = getPlaylistCache();
      const cachedData = cache.get();
      
      if (cachedData) {
        // Return cached data
        return new Response(
          JSON.stringify(cachedData),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
              'Cache-Control': 'public, max-age=600', // 10 minutes
            },
          }
        );
      }

      // Validate FTP credentials if provided
      const validation = validateFTPEnv();
      if (!validation.valid && ftpUser && ftpPassword) {
        // If credentials are provided but validation fails, log warning but continue
        console.warn('FTP validation warning:', validation.missing);
      }

      try {
        // Cache miss - fetch from FTP
        const playlistsData = await scanDreamHostFTP();
        
        // Store in cache
        cache.set(playlistsData);
        
        return new Response(
          JSON.stringify(playlistsData),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'MISS',
              'Cache-Control': 'public, max-age=600', // 10 minutes
            },
          }
        );
      } catch (ftpError: any) {
        // If FTP fails, try to return stale cache if available
        const staleCache = cache.get();
        if (staleCache) {
          console.warn('FTP scan failed, returning stale cache:', ftpError.message);
          return new Response(
            JSON.stringify(staleCache),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'STALE',
                'Cache-Control': 'public, max-age=60', // 1 minute for stale data
              },
            }
          );
        }
        throw ftpError;
      }
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



