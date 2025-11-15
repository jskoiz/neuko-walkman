export interface Track {
  trackNumber: number;
  trackName: string;
  fileName: string;
  duration: string; // Format: "MM:SS"
  artist?: string;
  album?: string;
  playlistName?: string;
  playlistIndex?: number;
  playlistTotal?: number;
  playlistPath?: string; // Path to the playlist folder
}

export interface Playlist {
  name: string;
  path: string;
  tracks: Track[];
  index: number;
  total: number;
}

export interface PlayerState {
  currentTrackIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  currentPlaylist?: Playlist;
}

