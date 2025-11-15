import type { Track } from '../types/track';

export function validateTracks(tracks: Track[]): Track[] {
  tracks.forEach((track, index) => {
    if (!track.trackNumber || !track.trackName || !track.fileName || !track.duration) {
      console.warn(`Track at index ${index} is missing required fields`);
    }
  });
  
  return tracks;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseDuration(duration: string): number {
  const [mins, secs] = duration.split(':').map(Number);
  return (mins * 60) + secs;
}

