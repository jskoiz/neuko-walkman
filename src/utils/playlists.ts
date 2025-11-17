import type { Track, Playlist } from '../types/track';

export async function loadPlaylists(): Promise<Playlist[]> {
  try {
    // Try dynamic API endpoint first (scans DreamHost FTP)
    const response = await fetch('/api/playlists.json');
    if (response.ok) {
      const data = await response.json();
      if (data.playlists && data.playlists.length > 0) {
        return data.playlists as Playlist[];
      }
    }
  } catch (error) {
    console.log('Dynamic playlists API failed, trying static file...');
  }

  try {
    // Fallback to static playlists.json file
    const response = await fetch('/playlists.json');
    if (response.ok) {
      const data = await response.json();
      return data.playlists as Playlist[];
    }
  } catch (error) {
    console.log('No playlist manifest found, using default structure');
  }

  const playlists: Playlist[] = [];
  
  const defaultPlaylist: Playlist = {
    name: 'Default',
    path: '/music',
    tracks: [],
    index: 1,
    total: 1
  };
  
  playlists.push(defaultPlaylist);
  
  return playlists;
}

export function createTracksFromFiles(
  files: string[],
  playlistName: string,
  playlistIndex: number,
  playlistTotal: number,
  playlistPath: string
): Track[] {
  return files
    .filter(file => /\.(mp3|wav|ogg|m4a)$/i.test(file))
    .map((file, index) => {
      const fileName = file.split('/').pop() || file;
      const trackName = fileName.replace(/\.[^/.]+$/, '');
      
      return {
        trackNumber: index + 1,
        trackName: trackName,
        fileName: file.startsWith('/') ? file : `/${playlistPath}/${file}`,
        duration: '0:00',
        playlistName: playlistName,
        playlistIndex: playlistIndex,
        playlistTotal: playlistTotal,
        playlistPath: playlistPath
      };
    });
}

export function getAllTracks(playlists: Playlist[]): Track[] {
  return playlists.flatMap(playlist => playlist.tracks);
}

export function getPlaylistForTrack(track: Track | null, playlists: Playlist[]): Playlist | null {
  if (!track || !track.playlistName) return null;
  return playlists.find(p => p.name === track.playlistName) || null;
}

