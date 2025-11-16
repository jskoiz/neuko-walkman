import { useEffect, useRef, useState, useCallback } from 'react';
import type { Track } from '../types/track';
import { formatTime } from '../utils/tracks';

export function useAudioPlayer(tracks: Track[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const wasPlayingRef = useRef(false);
  const currentTrackIndexRef = useRef(0);
  const currentPlaylistNameRef = useRef<string | null>(null);
  const tracksRef = useRef(tracks);
  
  const getCurrentPlaylistTracks = useCallback(() => {
    if (!currentPlaylistName) {
      const firstTrack = tracks[0];
      if (firstTrack?.playlistName) {
        return tracks.filter(t => t.playlistName === firstTrack.playlistName);
      }
      return tracks;
    }
    return tracks.filter(t => t.playlistName === currentPlaylistName);
  }, [tracks, currentPlaylistName]);
  
  const currentPlaylistTracks = getCurrentPlaylistTracks();
  
  useEffect(() => {
    if (tracks.length > 0 && !currentPlaylistName) {
      const neukoPlaylist = tracks.find(t => t.playlistName === 'NEUKO');
      if (neukoPlaylist?.playlistName) {
        setCurrentPlaylistName('NEUKO');
      } else {
        const firstTrack = tracks[0];
        if (firstTrack?.playlistName) {
          setCurrentPlaylistName(firstTrack.playlistName);
        }
      }
    }
  }, [tracks, currentPlaylistName]);
  
  useEffect(() => {
    currentPlaylistNameRef.current = currentPlaylistName;
  }, [currentPlaylistName]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const currentTrack = currentPlaylistTracks[currentTrackIndex] || currentPlaylistTracks[0];
  
  useEffect(() => {
    if (currentPlaylistTracks.length > 0 && currentTrackIndex >= currentPlaylistTracks.length) {
      setCurrentTrackIndex(0);
    }
  }, [currentPlaylistName, currentPlaylistTracks.length, currentTrackIndex]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = 'auto';
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      const currentIndex = currentTrackIndexRef.current;
      const currentPlaylist = currentPlaylistNameRef.current;
      const playlistTracks = tracksRef.current.filter(t => 
        !currentPlaylist || t.playlistName === currentPlaylist
      );
      if (playlistTracks.length === 0) return;
      const nextIndex = (currentIndex + 1) % playlistTracks.length;
      wasPlayingRef.current = true;
      setCurrentTrackIndex(nextIndex);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current || !currentTrack || tracks.length === 0) return;

    const audio = audioRef.current;
    const wasPlaying = wasPlayingRef.current;
    const audioSrc = currentTrack.fileName.startsWith('/') 
      ? currentTrack.fileName 
      : `/music/${currentTrack.fileName}`;
    
    setCurrentTime(0);
    
    const currentSrc = audio.src;
    const newSrc = new URL(audioSrc, window.location.origin).href;
    if (!currentSrc || !currentSrc.includes(currentTrack.fileName)) {
      console.log('Loading track:', audioSrc);
      
      const handleError = (e: Event) => {
        console.error('Audio loading error:', e);
        console.error('Audio error details:', {
          error: audio.error,
          code: audio.error?.code,
          message: audio.error?.message,
          src: audio.src,
          networkState: audio.networkState,
          readyState: audio.readyState
        });
      };
      
      audio.addEventListener('error', handleError);
      
      audio.src = audioSrc;
      audio.volume = volume;
      audio.load();

      if (wasPlaying) {
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          audio.play().then(() => {
            setIsPlaying(true);
            setIsPaused(false);
            wasPlayingRef.current = false;
          }).catch((error) => {
            console.error('Error auto-playing audio:', error);
            wasPlayingRef.current = false;
            setIsPlaying(false);
            setIsPaused(false);
          });
        };
        
        if (audio.readyState >= 2) {
          audio.removeEventListener('error', handleError);
          audio.play().then(() => {
            setIsPlaying(true);
            setIsPaused(false);
            wasPlayingRef.current = false;
          }).catch((error) => {
            console.error('Error auto-playing audio:', error);
            wasPlayingRef.current = false;
            setIsPlaying(false);
            setIsPaused(false);
          });
        } else {
          audio.addEventListener('canplay', handleCanPlay);
        }
      } else {
        setTimeout(() => {
          audio.removeEventListener('error', handleError);
        }, 1000);
      }
    }
  }, [currentTrackIndex, currentTrack?.fileName, volume, tracks.length]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const play = useCallback(async () => {
    if (!audioRef.current || !currentTrack) {
      console.error('Audio ref or track not available');
      return;
    }

    const audio = audioRef.current;
    const audioSrc = currentTrack.fileName.startsWith('/') 
      ? currentTrack.fileName 
      : `/music/${currentTrack.fileName}`;

    try {
      const isAlreadyLoaded = audio.src && (audio.src.includes(currentTrack.fileName) || audio.src.endsWith(`/music/${currentTrack.fileName}`));
      
      if (isPaused && isAlreadyLoaded) {
        console.log('Resuming playback');
        await audio.play();
      } else {
        console.log('Loading new track:', audioSrc);
        audio.src = audioSrc;
        audio.volume = volume;
        
        const handleError = (e: Event) => {
          console.error('Audio error:', e);
          console.error('Audio error details:', {
            error: audio.error,
            code: audio.error?.code,
            message: audio.error?.message,
            src: audio.src,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
        };
        
        audio.addEventListener('error', handleError);
        
        audio.load();
        
        if (audio.readyState >= 2) {
          console.log('Audio ready, playing immediately');
          await audio.play();
        } else {
          console.log('Waiting for audio to load...');
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('error', handleErrorEvent);
              reject(new Error('Audio load timeout'));
            }, 5000);
            
            const handleCanPlay = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('error', handleErrorEvent);
              console.log('Audio can play now');
              resolve();
            };
            
            const handleErrorEvent = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('error', handleErrorEvent);
              console.error('Audio failed to load');
              reject(new Error('Failed to load audio'));
            };
            
            audio.addEventListener('canplay', handleCanPlay, { once: true });
            audio.addEventListener('error', handleErrorEvent, { once: true });
          });
          
          console.log('Playing audio:', audioSrc);
          await audio.play();
        }
      }
      
      setIsPlaying(true);
      setIsPaused(false);
      wasPlayingRef.current = true;
      console.log('Audio playing successfully');
    } catch (error) {
      console.error('Error playing audio:', error);
      console.error('Audio state:', {
        src: audio.src,
        volume: audio.volume,
        paused: audio.paused,
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: audio.error
      });
      setIsPlaying(false);
      setIsPaused(false);
      wasPlayingRef.current = false;
    }
  }, [currentTrack, isPaused, volume]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    setIsPaused(true);
    wasPlayingRef.current = false;
  }, []);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    wasPlayingRef.current = false;
  }, []);

  const nextTrack = useCallback(() => {
    const playlistTracks = getCurrentPlaylistTracks();
    if (playlistTracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % playlistTracks.length;
    const wasPlaying = isPlaying && !isPaused;
    wasPlayingRef.current = wasPlaying;
    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);
  }, [currentTrackIndex, isPlaying, isPaused, getCurrentPlaylistTracks]);

  const previousTrack = useCallback(() => {
    const playlistTracks = getCurrentPlaylistTracks();
    if (playlistTracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? playlistTracks.length - 1 : currentTrackIndex - 1;
    const wasPlaying = isPlaying && !isPaused;
    wasPlayingRef.current = wasPlaying;
    setCurrentTrackIndex(prevIndex);
    setCurrentTime(0);
  }, [currentTrackIndex, isPlaying, isPaused, getCurrentPlaylistTracks]);
  
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
    if (playlists.length <= 1) return;
    const currentIndex = playlists.indexOf(currentPlaylistName || '');
    const nextIndex = (currentIndex + 1) % playlists.length;
    setCurrentPlaylistName(playlists[nextIndex]);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    wasPlayingRef.current = false;
  }, [currentPlaylistName, getAllPlaylists]);
  
  const previousPlaylist = useCallback(() => {
    const playlists = getAllPlaylists();
    if (playlists.length <= 1) return;
    const currentIndex = playlists.indexOf(currentPlaylistName || '');
    const prevIndex = currentIndex === 0 ? playlists.length - 1 : currentIndex - 1;
    setCurrentPlaylistName(playlists[prevIndex]);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    wasPlayingRef.current = false;
  }, [currentPlaylistName, getAllPlaylists]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  }, []);

  const increaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.min(1, prevVolume + 0.1);
      return newVolume;
    });
  }, []);

  const decreaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.max(0, prevVolume - 0.1);
      return newVolume;
    });
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying && !isPaused) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, isPaused, play, pause]);

  return {
    currentTrack: currentTrack || null,
    currentTrackIndex,
    currentPlaylistName,
    isPlaying,
    isPaused,
    volume,
    currentTime,
    duration,
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
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: duration > 0 ? formatTime(duration) : (currentTrack?.duration || '00:00'),
    totalTracks: currentPlaylistTracks.length,
  };
}
