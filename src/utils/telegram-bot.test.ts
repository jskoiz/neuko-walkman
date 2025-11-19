import { describe, it, expect } from 'vitest';
import { validatePlaylistName } from './telegram-bot';

describe('telegram-bot utils', () => {
    describe('validatePlaylistName', () => {
        it('accepts valid playlist names', () => {
            expect(validatePlaylistName('My Playlist')).toBe(true);
            expect(validatePlaylistName('playlist_123')).toBe(true);
            expect(validatePlaylistName('Cool-Songs')).toBe(true);
        });

        it('rejects names that are too short', () => {
            expect(validatePlaylistName('')).toBe(false);
        });

        it('accepts single character names', () => {
            expect(validatePlaylistName('a')).toBe(true);
        });

        it('rejects names that are too long', () => {
            const longName = 'a'.repeat(101); // Max is 100, so 101 should fail
            expect(validatePlaylistName(longName)).toBe(false);
        });

        it('rejects names with invalid characters', () => {
            expect(validatePlaylistName('Playlist/../Hack')).toBe(false);
            expect(validatePlaylistName('Playlist\\Hack')).toBe(false);
            expect(validatePlaylistName('Playlist@#$')).toBe(false);
        });

        it('rejects path traversal attempts', () => {
            expect(validatePlaylistName('../etc/passwd')).toBe(false);
            expect(validatePlaylistName('..')).toBe(false);
        });
    });
});
