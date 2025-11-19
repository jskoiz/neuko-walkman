/**
 * Application-wide constants
 * Centralizes hardcoded values to improve maintainability
 */

// Playlist Names
export const DEFAULT_PLAYLIST = 'Default';
export const NEUKO_PLAYLIST = 'NEUKO';
export const COMMUNITY_PLAYLIST = 'community';

// Special Track Names
export const ANTHEM_TRACK_NAME = 'anthem';

// Supported Audio Formats
export const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'] as const;
export const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] as const;

// Default Values
export const DEFAULT_AUDIO_QUALITY = '5'; // ~128kbps for web streaming
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
export const DEFAULT_SITE_URL = 'http://localhost:4321';

// Timeouts (in milliseconds)
export const BUTTON_PRESS_TIMEOUT = 150;
export const AUDIO_LOAD_TIMEOUT = 5000; // 5 seconds
export const FTP_TIMEOUT = 30000; // 30 seconds
export const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const WEBHOOK_CHECK_TIMEOUT = 10000; // 10 seconds
export const LONG_POLLING_TIMEOUT = 60000; // 60 seconds

// Rate Limiting
export const RATE_LIMIT_REQUESTS = 10; // requests per window
export const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

// File Paths
export const MUSIC_DIR = '/music';
export const DEFAULT_FTP_PATH = '/public/music';
export const DEFAULT_FTP_HOST = 'files.bloc.rocks';

// Audio Player Configuration
export const DEFAULT_VOLUME = 1;
export const VOLUME_INCREMENT = 0.1;
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
export const VOLUME_STORAGE_KEY = 'pirate-radio-volume';

// UI Configuration
export const CD_PLAYER_SCALE = 0.85; // Scale factor for CD player on desktop
export const ERROR_AUTO_DISMISS_TIME = 5000; // 5 seconds
export const SCROLL_TEXT_SPEED = 50; // pixels per second for scrolling text
export const SCROLL_TEXT_PAUSE = 2000; // milliseconds to pause at start/end

// Retry Configuration
export const MAX_RETRIES = 10;
export const RETRY_DELAY = 1000; // 1 second
export const FILE_SYNC_DELAY = 500; // 500ms delay for file system sync

// Cache Configuration
export const PLAYLIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes default
export const PLAYLIST_CACHE_KEY = 'playlists_cache';

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your internet connection and try again.',
  FILE_TOO_LARGE: 'The song file is too large. Please try a shorter song or a different link.',
  DOWNLOAD_TIMEOUT: 'The download timed out. The song may be too long or the service is busy. Please try again.',
  DOWNLOAD_FAILED: 'Could not download the song. Please check that the URL is valid and the song is available.',
  FTP_ERROR: 'Failed to upload the song. Please contact support if this persists.',
  SERVICE_UNAVAILABLE: 'Download service is not available. Please contact support.',
  INVALID_URL: 'Invalid URL. Please share a valid YouTube or Spotify link.',
  INVALID_PLAYLIST_NAME: 'Invalid playlist name.',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please wait {seconds} seconds before trying again.',
} as const;

// Telegram Bot Configuration
export const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
export const MAX_BUTTONS_PER_MESSAGE = 50;
export const MAX_TRACK_NAME_LENGTH = 30;
export const TRACK_NAME_TRUNCATE_LENGTH = 27;

// Playlist Configuration
export const MAX_PLAYLIST_NAME_LENGTH = 100;
export const MIN_PLAYLIST_NAME_LENGTH = 1;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  SPACE: ' ',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  PLUS: '+',
  MINUS: '-',
  S: 's',
  S_UPPER: 'S',
} as const;

