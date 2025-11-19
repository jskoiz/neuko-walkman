import type { Track } from '../types/track';
import { ScrollingText } from './ScrollingText';

interface DisplayProps {
  currentTrack: Track | null;
  currentTrackIndex: number;
  totalTracks: number;
  trackName: string;
  fileName: string;
  formattedDuration: string;
  formattedCurrentTime: string;
  playlistName?: string;
  playlistIndex?: number;
  playlistTotal?: number;
  loading?: boolean;
}

export function Display({
  currentTrack,
  currentTrackIndex,
  totalTracks,
  trackName,
  fileName,
  formattedDuration,
  formattedCurrentTime,
  playlistName,
  playlistIndex,
  playlistTotal,
  loading = false,
}: DisplayProps) {
  const trackNumber = currentTrack ? currentTrack.trackNumber : currentTrackIndex + 1;
  const displayFileName = currentTrack?.fileName || fileName;
  const fileNameOnly = displayFileName.split('/').pop() || displayFileName;
  const fileNameUpper = fileNameOnly.toUpperCase();

  const currentPlaylistName = currentTrack?.playlistName || playlistName || '';
  const currentPlaylistIndex = currentTrack?.playlistIndex || playlistIndex || 1;
  const currentPlaylistTotal = currentTrack?.playlistTotal || playlistTotal || 1;

  return (
    <div className="display-screen">
      <div className="display-line">
        <span className="track-number">
          [{trackNumber.toString().padStart(2, '0')}/{totalTracks.toString().padStart(2, '0')}]
        </span>
        <span className="track-time">{formattedCurrentTime}</span>
      </div>

      <div className="display-line track-filename">
        {loading ? (
          <span className="loading-text">LOADING...</span>
        ) : (
          <ScrollingText text={fileNameUpper} />
        )}
      </div>

      <div className="display-line playlist-info">
        <ScrollingText 
          text={`PLAYLIST:[${currentPlaylistName.toUpperCase()}]`}
          className="playlist-name"
        />
      </div>
    </div>
  );
}

