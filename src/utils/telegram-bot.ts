/**
 * Telegram Bot API helper functions
 */

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Send a message to a Telegram chat
 */
export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: any
): Promise<void> {
  const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Answer a callback query
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const url = `${TELEGRAM_API_URL}${botToken}/answerCallbackQuery`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Edit message text
 */
export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any
): Promise<void> {
  const url = `${TELEGRAM_API_URL}${botToken}/editMessageText`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(
  botToken: string,
  chatId: number,
  messageId: number
): Promise<void> {
  const url = `${TELEGRAM_API_URL}${botToken}/deleteMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
    }),
  });

  if (!response.ok) {
    // Don't throw error if message is already deleted or doesn't exist
    const error = await response.text();
    const errorData = JSON.parse(error);
    // Error code 400 means message not found or already deleted - that's okay
    if (errorData.error_code !== 400) {
      throw new Error(`Telegram API error: ${error}`);
    }
  }
}

/**
 * Send a photo to a Telegram chat
 */
export async function sendPhoto(
  botToken: string,
  chatId: number,
  photo: string | Buffer, // URL or file buffer
  caption?: string,
  replyMarkup?: any
): Promise<void> {
  const url = `${TELEGRAM_API_URL}${botToken}/sendPhoto`;
  
  // Check if photo is a Buffer (more reliable than typeof check)
  const isBuffer = Buffer.isBuffer(photo);
  
  // If photo is a URL string, send it directly
  if (!isBuffer && typeof photo === 'string') {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  } else {
    // If photo is a Buffer, use FormData with native https module
    // Node.js fetch doesn't handle form-data streams well, so use https directly
    const FormDataModule = await import('form-data');
    const FormData = FormDataModule.default;
    const https = await import('https');
    const { URL } = await import('url');
    
    const form = new FormData();
    
    form.append('chat_id', chatId.toString());
    form.append('photo', photo, {
      filename: 'vending-machines.jpg',
      contentType: 'image/jpeg',
    });
    
    if (caption) {
      form.append('caption', caption);
    }
    if (replyMarkup) {
      form.append('reply_markup', JSON.stringify(replyMarkup));
    }

    // Get headers from form-data
    const headers = form.getHeaders();

    // Parse URL and make request with https module
    const parsedUrl = new URL(url);
    
    return new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (!result.ok) {
                reject(new Error(`Telegram API error: ${JSON.stringify(result)}`));
              } else {
                resolve();
              }
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          });
        }
      );

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      form.pipe(req);
    });
  }
}

/**
 * Create inline keyboard markup
 */
export function createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>) {
  return {
    inline_keyboard: buttons,
  };
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
}

/**
 * Validate Spotify URL
 */
export function isValidSpotifyUrl(url: string): boolean {
  const spotifyRegex = /^(https?:\/\/)?(open\.)?spotify\.com\/.+/;
  return spotifyRegex.test(url);
}

/**
 * Validate URL (YouTube or Spotify)
 */
export function isValidSongUrl(url: string): boolean {
  return isValidYouTubeUrl(url) || isValidSpotifyUrl(url);
}

/**
 * Check if a user is an admin
 * Works in both Astro (import.meta.env) and Node.js (process.env) contexts
 */
export function isAdmin(userId: number): boolean {
  let adminIdsEnv: string | undefined;
  
  // Check process.env first (Node.js context)
  if (typeof process !== 'undefined' && process.env) {
    adminIdsEnv = process.env.TELEGRAM_ADMIN_IDS;
  }
  
  // Fallback to import.meta.env (Astro context) if process.env didn't have it
  if (!adminIdsEnv) {
    try {
      // Check if import.meta is available (Astro/Vite context)
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        adminIdsEnv = import.meta.env.TELEGRAM_ADMIN_IDS;
      }
    } catch {
      // import.meta not available, that's okay
    }
  }
  
  if (!adminIdsEnv) {
    return false;
  }
  
  const adminIds = adminIdsEnv
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id));
  
  return adminIds.includes(userId);
}

/**
 * Fetch playlists from the API or local file
 * Falls back to reading local file if API is not available
 */
export async function fetchPlaylists(siteUrl?: string): Promise<any[]> {
  // Try to get baseUrl from various sources
  let baseUrl: string | undefined;
  
  // Check process.env first (Node.js context)
  if (typeof process !== 'undefined' && process.env) {
    baseUrl = siteUrl || process.env.PUBLIC_SITE_URL;
  }
  
  // Fallback to import.meta.env (Astro context)
  if (!baseUrl) {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        baseUrl = siteUrl || import.meta.env.PUBLIC_SITE_URL;
      }
    } catch {
      // import.meta not available
    }
  }
  
  // Default fallback
  if (!baseUrl) {
    baseUrl = siteUrl || 'http://localhost:4321';
  }
  
  const url = `${baseUrl}/api/playlists.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status}`);
    }
    const data = await response.json();
    return data.playlists || [];
  } catch (error) {
    // If API fetch fails, silently try reading from local file (expected in local dev)
    try {
      // Check if we're in Node.js context and can read files
      if (typeof process !== 'undefined' && process.env) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Try to find the playlists.json file
        let playlistsPath: string;
        try {
          // If running from scripts directory
          playlistsPath = path.join(process.cwd(), 'src', 'config', 'playlists.json');
          const data = await fs.readFile(playlistsPath, 'utf-8');
          const parsed = JSON.parse(data);
          return parsed.playlists || [];
        } catch {
          // Try public directory as fallback
          playlistsPath = path.join(process.cwd(), 'public', 'playlists.json');
          const data = await fs.readFile(playlistsPath, 'utf-8');
          const parsed = JSON.parse(data);
          return parsed.playlists || [];
        }
      }
    } catch (fileError) {
      // Only log if local file read also failed (actual error)
      console.error('Error reading local playlists file:', fileError);
    }
    
    // Only log as error if we're in a context where local file fallback isn't available
    if (typeof process === 'undefined' || !process.env) {
      console.error('Error fetching playlists (no local file fallback available):', error);
    }
    return [];
  }
}

/**
 * Validate playlist name to prevent path traversal
 */
export function validatePlaylistName(name: string): boolean {
  // Prevent path traversal and invalid characters
  if (!name || name.length === 0 || name.length > 100) {
    return false;
  }
  // Check for path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false;
  }
  // Allow alphanumeric, spaces, hyphens, underscores
  return /^[a-zA-Z0-9\s_-]+$/.test(name);
}

