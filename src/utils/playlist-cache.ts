/**
 * In-memory cache for playlist data
 * Provides TTL-based caching to reduce FTP scan load
 */

import type { ScanResult } from './ftp-scanner';
import { PLAYLIST_CACHE_TTL, PLAYLIST_CACHE_KEY } from '../constants';

interface CacheEntry {
  data: ScanResult;
  timestamp: number;
  ttl: number;
}

class PlaylistCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = PLAYLIST_CACHE_TTL) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached playlist data if valid
   */
  get(key: string = PLAYLIST_CACHE_KEY): ScanResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age >= entry.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached playlist data
   */
  set(data: ScanResult, ttl?: number, key: string = PLAYLIST_CACHE_KEY): void {
    const cacheTTL = ttl || this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: cacheTTL,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string = PLAYLIST_CACHE_KEY): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[]; entries: Array<{ key: string; age: number; ttl: number; expired: boolean }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      const age = now - entry.timestamp;
      return {
        key,
        age,
        ttl: entry.ttl,
        expired: age >= entry.ttl,
      };
    });

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance
let cacheInstance: PlaylistCache | null = null;

/**
 * Get the playlist cache instance
 */
export function getPlaylistCache(ttl?: number): PlaylistCache {
  if (!cacheInstance) {
    // Allow TTL override via environment variable
    const envTTL = typeof import.meta !== 'undefined' && import.meta.env?.PLAYLIST_CACHE_TTL
      ? parseInt(import.meta.env.PLAYLIST_CACHE_TTL, 10)
      : undefined;
    
    cacheInstance = new PlaylistCache(envTTL || ttl);
  }
  return cacheInstance;
}

/**
 * Invalidate playlist cache (called when playlists are updated)
 */
export function invalidatePlaylistCache(): void {
  getPlaylistCache().invalidate();
}

/**
 * Clear all playlist cache
 */
export function clearPlaylistCache(): void {
  getPlaylistCache().clear();
}

