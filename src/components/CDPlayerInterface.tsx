import { useState } from 'react';
import type { Track } from '../types/track';
import { useAudioPlayer } from './AudioPlayer';
import { Display } from './Display';
import { ControlButtonArray } from './ControlButtonArray';
import { PlaylistPanel } from './PlaylistPanel';
import '../styles/cd-player.css';

interface CDPlayerInterfaceProps {
  tracks: Track[];
}

export function CDPlayerInterface({ tracks }: CDPlayerInterfaceProps) {
  const [buttonPressed, setButtonPressed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  
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
  } = useAudioPlayer(tracks);

  const handleButtonClick = async (action: string, handler: () => void | Promise<void>) => {
    setButtonPressed(action);
    setError(null);
    try {
      await handler();
    } catch (err) {
      console.error('Button action error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
    setTimeout(() => setButtonPressed(null), 150);
  };


  if (tracks.length === 0) {
    return <div>No tracks available</div>;
  }

  return (
    <div className="cd-player-container">
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 0, 0, 0.9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          Error: {error}
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
        <ControlButtonArray
          isPlaying={isPlaying}
          isPaused={isPaused}
          onPlayPause={() => handleButtonClick('play-pause', togglePlayPause)}
          onStop={() => handleButtonClick('stop', stop)}
          onPreviousTrack={() => handleButtonClick('previous', previousTrack)}
          onNextTrack={() => handleButtonClick('next', nextTrack)}
          onVolumeUp={() => handleButtonClick('volume-up', increaseVolume)}
          onVolumeDown={() => handleButtonClick('volume-down', decreaseVolume)}
          onPreviousPlaylist={() => handleButtonClick('playlist-previous', previousPlaylist)}
          onNextPlaylist={() => handleButtonClick('playlist-next', nextPlaylist)}
          onTogglePlaylist={() => setPanelVisible(!panelVisible)}
          isPlaylistVisible={panelVisible}
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
        />
      </div>
    </div>
  );
}

