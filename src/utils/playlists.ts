import type { Track, Playlist } from '../types/track';

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

