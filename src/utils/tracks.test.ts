import { describe, it, expect, vi } from 'vitest';
import { validateTracks, formatTime, parseDuration } from './tracks';
import type { Track } from '../types/track';

describe('tracks utils', () => {
    describe('formatTime', () => {
        it('formats seconds into MM:SS', () => {
            expect(formatTime(0)).toBe('00:00');
            expect(formatTime(61)).toBe('01:01');
            expect(formatTime(3599)).toBe('59:59');
        });

        it('pads single digits with zeros', () => {
            expect(formatTime(5)).toBe('00:05');
            expect(formatTime(65)).toBe('01:05');
        });
    });

    describe('parseDuration', () => {
        it('parses MM:SS into seconds', () => {
            expect(parseDuration('00:00')).toBe(0);
            expect(parseDuration('01:01')).toBe(61);
            expect(parseDuration('59:59')).toBe(3599);
        });
    });

    describe('validateTracks', () => {
        it('returns tracks as is', () => {
            const tracks: Track[] = [
                {
                    trackNumber: 1,
                    trackName: 'Test',
                    fileName: 'test.mp3',
                    duration: '03:00',
                    playlistName: 'Playlist',
                    playlistIndex: 1,
                    playlistTotal: 1,
                    playlistPath: '/path'
                }
            ];
            expect(validateTracks(tracks)).toEqual(tracks);
        });

        it('logs warning for invalid tracks', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const invalidTracks = [{ trackName: 'Missing Props' }] as Track[];

            validateTracks(invalidTracks);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
