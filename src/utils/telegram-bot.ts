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
      parse_mode: 'HTML',
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
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
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
        parse_mode: 'HTML',
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

