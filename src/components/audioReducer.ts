/**
 * Audio player reducer
 * Manages complex state transitions for audio player
 */

import type { Track } from '../types/track';
import { DEFAULT_VOLUME, MIN_VOLUME, MAX_VOLUME, VOLUME_INCREMENT, NEUKO_PLAYLIST, ANTHEM_TRACK_NAME } from '../constants';

export interface AudioPlayerState {
  currentPlaylistName: string | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  wasPlaying: boolean;
  shuffleMode: boolean;
  shuffleHistory: number[];
}

export type AudioPlayerAction =
  | { type: 'SET_PLAYLIST'; playlistName: string | null }
  | { type: 'SET_TRACK_INDEX'; index: number }
  | { type: 'NEXT_TRACK'; totalTracks: number; shuffleMode?: boolean }
  | { type: 'PREVIOUS_TRACK'; totalTracks: number }
  | { type: 'NEXT_PLAYLIST'; playlists: string[] }
  | { type: 'PREVIOUS_PLAYLIST'; playlists: string[] }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'INCREASE_VOLUME' }
  | { type: 'DECREASE_VOLUME' }
  | { type: 'SET_CURRENT_TIME'; time: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'UPDATE_TIME'; time: number }
  | { type: 'SET_WAS_PLAYING'; wasPlaying: boolean }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'INITIALIZE_PLAYLIST'; tracks: Track[] };

export const initialState: AudioPlayerState = {
  currentPlaylistName: null,
  currentTrackIndex: 0,
  isPlaying: false,
  isPaused: false,
  volume: DEFAULT_VOLUME,
  currentTime: 0,
  duration: 0,
  wasPlaying: false,
  shuffleMode: false,
  shuffleHistory: [],
};

export function audioPlayerReducer(
  state: AudioPlayerState,
  action: AudioPlayerAction
): AudioPlayerState {
  switch (action.type) {
    case 'SET_PLAYLIST':
      return {
        ...state,
        currentPlaylistName: action.playlistName,
        currentTrackIndex: 0,
        currentTime: 0,
        wasPlaying: false,
      };

    case 'SET_TRACK_INDEX':
      return {
        ...state,
        currentTrackIndex: action.index,
        currentTime: 0,
      };

    case 'NEXT_TRACK':
      if (action.shuffleMode && action.totalTracks > 1) {
        // Shuffle mode: pick random track that hasn't been played recently
        const availableTracks = Array.from({ length: action.totalTracks }, (_, i) => i)
          .filter(i => i !== state.currentTrackIndex);
        
        // If we've played all tracks, reset history
        const recentHistory = state.shuffleHistory.slice(-Math.min(action.totalTracks - 1, 5));
        const unplayedTracks = availableTracks.filter(i => !recentHistory.includes(i));
        const tracksToChooseFrom = unplayedTracks.length > 0 ? unplayedTracks : availableTracks;
        
        const randomIndex = tracksToChooseFrom[Math.floor(Math.random() * tracksToChooseFrom.length)];
        const newHistory = [...state.shuffleHistory, state.currentTrackIndex].slice(-(action.totalTracks - 1));
        
        return {
          ...state,
          currentTrackIndex: randomIndex,
          currentTime: 0,
          shuffleHistory: newHistory,
        };
      }
      return {
        ...state,
        currentTrackIndex: (state.currentTrackIndex + 1) % action.totalTracks,
        currentTime: 0,
      };

    case 'PREVIOUS_TRACK':
      return {
        ...state,
        currentTrackIndex: state.currentTrackIndex === 0 
          ? action.totalTracks - 1 
          : state.currentTrackIndex - 1,
        currentTime: 0,
      };

    case 'NEXT_PLAYLIST':
      if (action.playlists.length <= 1) return state;
      const currentIndex = action.playlists.indexOf(state.currentPlaylistName || '');
      const nextIndex = (currentIndex + 1) % action.playlists.length;
      return {
        ...state,
        currentPlaylistName: action.playlists[nextIndex],
        currentTrackIndex: 0,
        currentTime: 0,
        wasPlaying: false,
      };

    case 'PREVIOUS_PLAYLIST':
      if (action.playlists.length <= 1) return state;
      const currentIdx = action.playlists.indexOf(state.currentPlaylistName || '');
      const prevIndex = currentIdx === 0 ? action.playlists.length - 1 : currentIdx - 1;
      return {
        ...state,
        currentPlaylistName: action.playlists[prevIndex],
        currentTrackIndex: 0,
        currentTime: 0,
        wasPlaying: false,
      };

    case 'PLAY':
      return {
        ...state,
        isPlaying: true,
        isPaused: false,
        wasPlaying: true,
      };

    case 'PAUSE':
      return {
        ...state,
        isPlaying: false,
        isPaused: true,
        wasPlaying: false,
      };

    case 'STOP':
      return {
        ...state,
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        wasPlaying: false,
      };

    case 'SET_VOLUME':
      return {
        ...state,
        volume: Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, action.volume)),
      };

    case 'INCREASE_VOLUME':
      return {
        ...state,
        volume: Math.min(MAX_VOLUME, state.volume + VOLUME_INCREMENT),
      };

    case 'DECREASE_VOLUME':
      return {
        ...state,
        volume: Math.max(MIN_VOLUME, state.volume - VOLUME_INCREMENT),
      };

    case 'SET_CURRENT_TIME':
      return {
        ...state,
        currentTime: action.time,
      };

    case 'SET_DURATION':
      return {
        ...state,
        duration: action.duration,
      };

    case 'UPDATE_TIME':
      return {
        ...state,
        currentTime: action.time,
      };

    case 'SET_WAS_PLAYING':
      return {
        ...state,
        wasPlaying: action.wasPlaying,
      };

    case 'TOGGLE_SHUFFLE':
      return {
        ...state,
        shuffleMode: !state.shuffleMode,
        shuffleHistory: !state.shuffleMode ? [] : state.shuffleHistory, // Reset history when enabling
      };

    case 'INITIALIZE_PLAYLIST':
      // Find NEUKO playlist first, otherwise use first track's playlist
      const neukoPlaylist = action.tracks.find(t => t.playlistName === NEUKO_PLAYLIST);
      const initialPlaylist = neukoPlaylist?.playlistName || action.tracks[0]?.playlistName || null;
      
      // If NEUKO playlist, find anthem track
      let initialTrackIndex = 0;
      if (initialPlaylist === NEUKO_PLAYLIST) {
        const playlistTracks = action.tracks.filter(t => t.playlistName === NEUKO_PLAYLIST);
        const anthemIndex = playlistTracks.findIndex(t => 
          t.fileName && (t.fileName.includes(`${ANTHEM_TRACK_NAME}.mp3`) || 
          t.fileName.includes(ANTHEM_TRACK_NAME) || 
          t.fileName.includes(`/${ANTHEM_TRACK_NAME}`))
        );
        if (anthemIndex !== -1) {
          initialTrackIndex = anthemIndex;
        }
      }
      
      return {
        ...state,
        currentPlaylistName: initialPlaylist,
        currentTrackIndex: initialTrackIndex,
        shuffleHistory: [],
      };

    default:
      return state;
  }
}

