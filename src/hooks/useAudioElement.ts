/**
 * Audio element management hook
 * Handles audio element lifecycle and event listeners
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { DEFAULT_VOLUME, AUDIO_LOAD_TIMEOUT } from '../constants';

export interface AudioElementCallbacks {
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
}

export function useAudioElement(
  src: string | null,
  volume: number,
  callbacks: AudioElementCallbacks
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = 'auto';
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      callbacks.onTimeUpdate(audio.currentTime);
    };

    const handleDurationChange = () => {
      if (audio.duration) {
        callbacks.onDurationChange(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration) {
        callbacks.onDurationChange(audio.duration);
      }
    };

    const handleEnded = () => {
      callbacks.onEnded();
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handlePlaying = () => {
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, [callbacks]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Load audio source
  useEffect(() => {
    if (!audioRef.current || !src) return;

    const audio = audioRef.current;
    // src is already a full path (e.g., /music/track.mp3)
    const audioSrc = src;
    const newSrc = new URL(audioSrc, window.location.origin).href;

    // Only reload if source actually changed
    const currentSrc = audio.src ? new URL(audio.src).pathname : '';
    const newSrcPath = new URL(newSrc).pathname;

    if (currentSrc !== newSrcPath) {
      setIsLoading(true);
      audio.src = audioSrc;
      audio.volume = volume;
      audio.load();
    }
  }, [src, volume]);

  const play = useCallback(async (): Promise<void> => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    try {
      if (audio.readyState >= 2) {
        await audio.play();
      } else {
        setIsLoading(true);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            setIsLoading(false);
            reject(new Error('Audio load timeout'));
          }, AUDIO_LOAD_TIMEOUT);

          const handleCanPlay = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            setIsLoading(false);
            resolve();
          };

          const handleError = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            setIsLoading(false);
            reject(new Error('Failed to load audio'));
          };

          audio.addEventListener('canplay', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
        });

        await audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoading(false);
      throw error;
    }
  }, []);

  const pause = useCallback((): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsLoading(false);
    }
  }, []);

  const stop = useCallback((): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsLoading(false);
    }
  }, []);

  const setCurrentTime = useCallback((time: number): void => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const getCurrentTime = useCallback((): number => {
    return audioRef.current?.currentTime || 0;
  }, []);

  const getDuration = useCallback((): number => {
    return audioRef.current?.duration || 0;
  }, []);

  return {
    play,
    pause,
    stop,
    setCurrentTime,
    getCurrentTime,
    getDuration,
    isLoading,
  };
}

