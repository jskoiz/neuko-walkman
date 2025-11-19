import { useEffect, useReducer, useCallback, useMemo, useRef } from 'react';
import type { Track } from '../types/track';
import { formatTime } from '../utils/tracks';
import { useAudioElement } from '../hooks/useAudioElement';
import { audioPlayerReducer, initialState } from './audioReducer';
import { VOLUME_STORAGE_KEY, DEFAULT_VOLUME } from '../constants';

export function useAudioPlayer(tracks: Track[]) {
  // Load volume from localStorage on mount
  const savedVolume = useRef<number | null>(null);
  if (savedVolume.current === null && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          savedVolume.current = parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load volume from localStorage:', error);
    }
  }

  const [state, dispatch] = useReducer(audioPlayerReducer, {
    ...initialState,
    volume: savedVolume.current ?? DEFAULT_VOLUME,
  });

  // Save volume to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, state.volume.toString());
      } catch (error) {
        console.warn('Failed to save volume to localStorage:', error);
      }
    }
  }, [state.volume]);

  // Initialize playlist on tracks load
  useEffect(() => {
    if (tracks.length > 0 && !state.currentPlaylistName) {
      dispatch({ type: 'INITIALIZE_PLAYLIST', tracks });
    }
  }, [tracks, state.currentPlaylistName]);

  // Get current playlist tracks (memoized)
  const currentPlaylistTracks = useMemo(() => {
    if (!state.currentPlaylistName) {
      const firstTrack = tracks[0];
      if (firstTrack?.playlistName) {
        return tracks.filter(t => t.playlistName === firstTrack.playlistName);
      }
      return tracks;
    }
    return tracks.filter(t => t.playlistName === state.currentPlaylistName);
  }, [tracks, state.currentPlaylistName]);

  // Get current track
  const currentTrack = currentPlaylistTracks[state.currentTrackIndex] || currentPlaylistTracks[0];

  // Validate track index
  useEffect(() => {
    if (currentPlaylistTracks.length > 0 && state.currentTrackIndex >= currentPlaylistTracks.length) {
      dispatch({ type: 'SET_TRACK_INDEX', index: 0 });
    }
  }, [state.currentTrackIndex, currentPlaylistTracks.length]);

  // Audio element management
  const audioSrc = currentTrack?.fileName
    ? (currentTrack.fileName.startsWith('/') ? currentTrack.fileName : `/music/${currentTrack.fileName}`)
    : null;

  // Memoize callbacks to prevent audioElement recreation
  const onTimeUpdate = useCallback((time: number) => {
    dispatch({ type: 'UPDATE_TIME', time });
  }, []);

  const onDurationChange = useCallback((duration: number) => {
    dispatch({ type: 'SET_DURATION', duration });
  }, []);

  const onEnded = useCallback(() => {
    if (currentPlaylistTracks.length === 0) return;
    dispatch({ type: 'SET_WAS_PLAYING', wasPlaying: true });
    dispatch({ 
      type: 'NEXT_TRACK', 
      totalTracks: currentPlaylistTracks.length,
      shuffleMode: state.shuffleMode 
    });
    dispatch({ type: 'SET_CURRENT_TIME', time: 0 });
  }, [currentPlaylistTracks.length, state.shuffleMode]);

  const {
    play: audioPlay,
    pause: audioPause,
    stop: audioStop,
    isLoading
  } = useAudioElement(
    audioSrc,
    state.volume,
    {
      onTimeUpdate,
      onDurationChange,
      onEnded,
    }
  );

  // Use ref to store stable audioElement reference
  const audioElementRef = useRef({ play: audioPlay, pause: audioPause, stop: audioStop });
  audioElementRef.current = { play: audioPlay, pause: audioPause, stop: audioStop };
  const audioElement = audioElementRef.current;

  // Auto-play when track changes if was playing
  useEffect(() => {
    if (state.wasPlaying && currentTrack && audioSrc) {
      audioElement.play()
        .then(() => {
          dispatch({ type: 'PLAY' });
          dispatch({ type: 'SET_WAS_PLAYING', wasPlaying: false });
        })
        .catch((error) => {
          console.error('Error auto-playing audio:', error);
          dispatch({ type: 'SET_WAS_PLAYING', wasPlaying: false });
        });
    }
  }, [state.currentTrackIndex, currentTrack?.fileName, state.wasPlaying, audioSrc, audioElement]);

  // Reset time when track changes
  useEffect(() => {
    if (currentTrack) {
      dispatch({ type: 'SET_CURRENT_TIME', time: 0 });
    }
  }, [currentTrack?.fileName]);

  const play = useCallback(async () => {
    if (!currentTrack) {
      console.error('No track available');
      return;
    }

    try {
      await audioElement.play();
      dispatch({ type: 'PLAY' });
    } catch (error) {
      console.error('Error playing audio:', error);
      dispatch({ type: 'PAUSE' });
    }
  }, [currentTrack, audioElement]);

  const pause = useCallback(() => {
    audioElement.pause();
    dispatch({ type: 'PAUSE' });
  }, [audioElement]);

  const stop = useCallback(() => {
    audioElement.stop();
    dispatch({ type: 'STOP' });
  }, [audioElement]);

  const nextTrack = useCallback(() => {
    if (currentPlaylistTracks.length === 0) return;
    const wasPlaying = state.isPlaying && !state.isPaused;
    dispatch({ type: 'SET_WAS_PLAYING', wasPlaying });
    dispatch({ 
      type: 'NEXT_TRACK', 
      totalTracks: currentPlaylistTracks.length,
      shuffleMode: state.shuffleMode 
    });
  }, [currentPlaylistTracks.length, state.isPlaying, state.isPaused, state.shuffleMode]);

  const previousTrack = useCallback(() => {
    if (currentPlaylistTracks.length === 0) return;
    const wasPlaying = state.isPlaying && !state.isPaused;
    dispatch({ type: 'SET_WAS_PLAYING', wasPlaying });
    dispatch({ type: 'PREVIOUS_TRACK', totalTracks: currentPlaylistTracks.length });
  }, [currentPlaylistTracks.length, state.isPlaying, state.isPaused]);

  // Memoize getAllPlaylists function to avoid recreating on every render
  const getAllPlaylists = useCallback(() => {
    const playlistMap = new Map<string, Track[]>();
    tracks.forEach(track => {
      if (track.playlistName) {
        if (!playlistMap.has(track.playlistName)) {
          playlistMap.set(track.playlistName, []);
        }
        playlistMap.get(track.playlistName)!.push(track);
      }
    });
    return Array.from(playlistMap.keys());
  }, [tracks]);

  const nextPlaylist = useCallback(() => {
    const playlists = getAllPlaylists();
    dispatch({ type: 'NEXT_PLAYLIST', playlists });
  }, [getAllPlaylists]);

  const previousPlaylist = useCallback(() => {
    const playlists = getAllPlaylists();
    dispatch({ type: 'PREVIOUS_PLAYLIST', playlists });
  }, [getAllPlaylists]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    dispatch({ type: 'SET_VOLUME', volume: newVolume });
  }, []);

  const increaseVolume = useCallback(() => {
    dispatch({ type: 'INCREASE_VOLUME' });
  }, []);

  const decreaseVolume = useCallback(() => {
    dispatch({ type: 'DECREASE_VOLUME' });
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (state.isPlaying && !state.isPaused) {
      pause();
    } else {
      await play();
    }
  }, [state.isPlaying, state.isPaused, play, pause]);

  const selectTrack = useCallback((index: number) => {
    if (index >= 0 && index < currentPlaylistTracks.length) {
      const wasPlaying = state.isPlaying && !state.isPaused;
      dispatch({ type: 'SET_WAS_PLAYING', wasPlaying });
      dispatch({ type: 'SET_TRACK_INDEX', index });
    }
  }, [currentPlaylistTracks.length, state.isPlaying, state.isPaused]);

  const toggleShuffle = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  }, []);

  return {
    currentTrack: currentTrack || null,
    currentTrackIndex: state.currentTrackIndex,
    currentPlaylistName: state.currentPlaylistName,
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    volume: state.volume,
    currentTime: state.currentTime,
    duration: state.duration,
    play,
    pause,
    stop,
    nextTrack,
    previousTrack,
    nextPlaylist,
    previousPlaylist,
    setVolumeLevel,
    increaseVolume,
    decreaseVolume,
    togglePlayPause,
    selectTrack,
    formattedCurrentTime: formatTime(state.currentTime),
    formattedDuration: state.duration > 0 ? formatTime(state.duration) : (currentTrack?.duration || '00:00'),
    totalTracks: currentPlaylistTracks.length,
    currentPlaylistTracks,
    isLoading,
    shuffleMode: state.shuffleMode,
    toggleShuffle,
  };
}
