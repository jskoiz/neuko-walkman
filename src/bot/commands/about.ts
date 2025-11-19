/**
 * About command handler
 */

import { sendMessage, createInlineKeyboard } from '../../utils/telegram-bot';
import { logBotActivity } from '../utils/logger';

export interface AboutCommandConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
}

export async function handleAboutCommand(config: AboutCommandConfig): Promise<void> {
  const { botToken, chatId, userId, username } = config;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'COMMAND_ABOUT',
    status: 'info',
  });

  const aboutText = `🎵 **Pirate Radio**

A community-driven music platform powered by Neuko.

**Features:**
• 🎧 Listen to curated playlists
• ➕ Add your favorite songs
• 📻 Retro Walkman-style player
• 🌐 Web player at https://bloc.rocks

**How It Works:**
Share YouTube or Spotify links, and we'll add them to the community playlist. All songs are available to stream on the web player.

**Community:**
This is a community project - everyone can contribute songs! Just use \`/add\` to get started.

Made with ❤️ by the Neuko community`;

  const buttons = createInlineKeyboard([
    [{ text: '🌐 Visit bloc.rocks', url: 'https://bloc.rocks' }],
    [{ text: '🏠 Main Menu', callback_data: 'back_to_main' }],
  ]);

  await sendMessage(botToken, chatId, aboutText, buttons);
}

