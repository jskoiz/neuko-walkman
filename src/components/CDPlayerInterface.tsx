import { useState, useEffect, useCallback } from 'react';
import type { Track } from '../types/track';
import { useAudioPlayer } from './AudioPlayer';
import { Display } from './Display';
import { ControlButtonArray } from './ControlButtonArray';
import { PlaylistPanel } from './PlaylistPanel';
import '../styles/cd-player.css';
import { BUTTON_PRESS_TIMEOUT, ERROR_AUTO_DISMISS_TIME, KEYBOARD_SHORTCUTS } from '../constants';

interface CDPlayerInterfaceProps {
  tracks: Track[];
}

export function CDPlayerInterface({ tracks }: CDPlayerInterfaceProps) {
  const [buttonPressed, setButtonPressed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Detect mobile and set panel visible by default on mobile
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });
  
  const [panelVisible, setPanelVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768; // Visible by default on mobile
    }
    return false;
  });
  const [panelExtended, setPanelExtended] = useState(false);
  
  // Update mobile state on resize
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        const mobile = window.innerWidth <= 768;
        setIsMobile(mobile);
        // On mobile, always keep panel visible
        if (mobile) {
          setPanelVisible(true);
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const {
    currentTrack,
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
    increaseVolume,
    decreaseVolume,
    togglePlayPause,
    selectTrack,
    formattedCurrentTime,
    formattedDuration,
    totalTracks,
    currentPlaylistTracks,
    isLoading,
    shuffleMode,
    toggleShuffle,
  } = useAudioPlayer(tracks);

  const handleButtonClick = async (action: string, handler: () => void | Promise<void>) => {
    setButtonPressed(action);
    setError(null);
    try {
      await handler();
    } catch (err) {
      console.error('Button action error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      // Auto-dismiss error after timeout
      setTimeout(() => {
        setError(null);
      }, ERROR_AUTO_DISMISS_TIME);
    }
    setTimeout(() => setButtonPressed(null), BUTTON_PRESS_TIMEOUT);
  };

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Prevent default for our shortcuts
      if (
        e.key === KEYBOARD_SHORTCUTS.SPACE ||
        e.key === KEYBOARD_SHORTCUTS.ARROW_LEFT ||
        e.key === KEYBOARD_SHORTCUTS.ARROW_RIGHT ||
        e.key === KEYBOARD_SHORTCUTS.ARROW_UP ||
        e.key === KEYBOARD_SHORTCUTS.ARROW_DOWN ||
        e.key === KEYBOARD_SHORTCUTS.ENTER ||
        e.key === KEYBOARD_SHORTCUTS.ESCAPE ||
        e.key === KEYBOARD_SHORTCUTS.PLUS ||
        e.key === KEYBOARD_SHORTCUTS.MINUS ||
        e.key === KEYBOARD_SHORTCUTS.S ||
        e.key === KEYBOARD_SHORTCUTS.S_UPPER
      ) {
        e.preventDefault();
      }

      switch (e.key) {
        case KEYBOARD_SHORTCUTS.SPACE:
          togglePlayPause();
          break;
        case KEYBOARD_SHORTCUTS.ARROW_LEFT:
          if (e.shiftKey) {
            previousPlaylist();
          } else {
            previousTrack();
          }
          break;
        case KEYBOARD_SHORTCUTS.ARROW_RIGHT:
          if (e.shiftKey) {
            nextPlaylist();
          } else {
            nextTrack();
          }
          break;
        case KEYBOARD_SHORTCUTS.ARROW_UP:
          increaseVolume();
          break;
        case KEYBOARD_SHORTCUTS.ARROW_DOWN:
          decreaseVolume();
          break;
        case KEYBOARD_SHORTCUTS.ESCAPE:
          // Don't close panel on mobile - it's always visible
          if (!isMobile && panelVisible) {
            setPanelVisible(false);
          }
          if (error) {
            dismissError();
          }
          break;
        case KEYBOARD_SHORTCUTS.PLUS:
        case '=':
          increaseVolume();
          break;
        case KEYBOARD_SHORTCUTS.MINUS:
          decreaseVolume();
          break;
        case KEYBOARD_SHORTCUTS.S:
        case KEYBOARD_SHORTCUTS.S_UPPER:
          toggleShuffle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    togglePlayPause,
    nextTrack,
    previousTrack,
    nextPlaylist,
    previousPlaylist,
    increaseVolume,
    decreaseVolume,
    panelVisible,
    error,
    dismissError,
    toggleShuffle,
    isMobile,
  ]);


  if (tracks.length === 0) {
    return <div>No tracks available</div>;
  }

  return (
    <div className="cd-player-container">
      {error && (
        <div className="error-overlay">
          <div className="error-content">
            <span className="error-icon">!</span>
            <span className="error-message">{error}</span>
            <button
              className="error-dismiss"
              onClick={dismissError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="cd-player-wrapper">
        <img
          src="/walkman-hi-ref.png"
          alt="CD Walkman"
          className="walkman-image"
        />

        <div className="display-overlay">
          <Display
            currentTrack={currentTrack}
            currentTrackIndex={currentTrackIndex}
            totalTracks={totalTracks}
            trackName={currentTrack?.trackName || ''}
            fileName={currentTrack?.fileName || ''}
            formattedDuration={formattedDuration}
            formattedCurrentTime={formattedCurrentTime}
            playlistName={currentTrack?.playlistName}
            playlistIndex={currentTrack?.playlistIndex}
            playlistTotal={currentTrack?.playlistTotal}
            loading={isLoading}
          />
        </div>

        <div className="controls-overlay">
          <button
            className={`control-button play-pause ${buttonPressed === 'play-pause' ? 'pressed' : ''} ${isPlaying && !isPaused ? 'playing' : ''}`}
            onClick={() => handleButtonClick('play-pause', togglePlayPause)}
            aria-label={isPlaying && !isPaused ? 'Pause' : 'Play'}
          />

          <button
            className={`control-button previous ${buttonPressed === 'previous' ? 'pressed' : ''}`}
            onClick={() => handleButtonClick('previous', previousTrack)}
            aria-label="Previous Track"
          />

          <button
            className={`control-button next ${buttonPressed === 'next' ? 'pressed' : ''}`}
            onClick={() => handleButtonClick('next', nextTrack)}
            aria-label="Next Track"
          />

          <button
            className={`control-button stop ${buttonPressed === 'stop' ? 'pressed' : ''}`}
            onClick={() => handleButtonClick('stop', stop)}
            aria-label="Stop"
          />

          <a
            href="https://neuko.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={`control-button website ${buttonPressed === 'website' ? 'pressed' : ''}`}
            onClick={() => setButtonPressed('website')}
            aria-label="Visit Neuko.ai"
          />

          <div className="playlist-control">
            <button
              className={`control-button playlist-previous ${buttonPressed === 'playlist-previous' ? 'pressed' : ''}`}
              onClick={() => handleButtonClick('playlist-previous', previousPlaylist)}
              aria-label="Previous Playlist"
            />
            <button
              className={`control-button playlist-next ${buttonPressed === 'playlist-next' ? 'pressed' : ''}`}
              onClick={() => handleButtonClick('playlist-next', nextPlaylist)}
              aria-label="Next Playlist"
            />
          </div>

          <div className="volume-control">
            <button
              className={`control-button volume-down ${buttonPressed === 'volume-down' ? 'pressed' : ''}`}
              onClick={() => handleButtonClick('volume-down', decreaseVolume)}
              aria-label="Volume Down"
            />
            <button
              className={`control-button volume-up ${buttonPressed === 'volume-up' ? 'pressed' : ''}`}
              onClick={() => handleButtonClick('volume-up', increaseVolume)}
              aria-label="Volume Up"
            />
          </div>
        </div>
      </div>

      <div className="button-array-container">
        <div style={{ 
          position: 'relative', 
          display: isMobile ? 'flex' : 'inline-block',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'center' : 'flex-start',
          width: isMobile ? '100%' : 'auto',
        }}>
          <ControlButtonArray
            isPlaying={isPlaying}
            isPaused={isPaused}
            onPlayPause={() => handleButtonClick('play-pause', togglePlayPause)}
            onPause={() => handleButtonClick('pause', pause)}
            onPreviousTrack={() => handleButtonClick('previous', previousTrack)}
            onNextTrack={() => handleButtonClick('next', nextTrack)}
            onVolumeUp={() => handleButtonClick('volume-up', increaseVolume)}
            onVolumeDown={() => handleButtonClick('volume-down', decreaseVolume)}
            onPreviousPlaylist={() => handleButtonClick('playlist-previous', previousPlaylist)}
            onNextPlaylist={() => handleButtonClick('playlist-next', nextPlaylist)}
            onTogglePlaylist={() => {
              // Don't toggle on mobile - panel is always visible
              if (!isMobile) {
                setPanelVisible(!panelVisible);
              }
            }}
            isPlaylistVisible={panelVisible}
            isMobile={isMobile}
          />
          <PlaylistPanel
            currentPlaylistName={currentPlaylistName}
            currentPlaylistTracks={currentPlaylistTracks}
            currentTrackIndex={currentTrackIndex}
            onTrackSelect={async (index) => {
              selectTrack(index);
              // Auto-play the selected track
              await play();
            }}
            isVisible={panelVisible}
            isExtended={panelExtended}
            onToggleExtended={() => setPanelExtended(!panelExtended)}
          />
        </div>
      </div>
    </div>
  );
}

