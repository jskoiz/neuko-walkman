/**
 * Help command handler
 */

import { sendMessage, createInlineKeyboard } from '../../utils/telegram-bot';
import { logBotActivity } from '../utils/logger';

export interface HelpCommandConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
}

export async function handleHelpCommand(config: HelpCommandConfig): Promise<void> {
  const { botToken, chatId, userId, username } = config;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'COMMAND_HELP',
    status: 'info',
  });

  const helpText = `📖 **How to Use Pirate Radio Bot**

**Commands:**
• \`/start\` - Show main menu
• \`/playlists\` - View all playlists
• \`/add\` - Add a song to community playlist
• \`/help\` - Show this help message
• \`/about\` - Learn about Pirate Radio

**Adding Songs:**
1. Use \`/add\` or click "Add Song to Community"
2. Share a YouTube or Spotify link
3. The bot will download and add it automatically

**Supported Links:**
• YouTube: \`https://www.youtube.com/watch?v=...\`
• YouTube Short: \`https://youtu.be/...\`
• Spotify Track: \`https://open.spotify.com/track/...\`
• Spotify Album: \`https://open.spotify.com/album/...\`

**Listening:**
Visit https://bloc.rocks to listen to all the Neuko sounds!

**Need Help?**
If you encounter any issues, try using \`/start\` to return to the main menu.`;

  const buttons = createInlineKeyboard([
    [{ text: '🏠 Main Menu', callback_data: 'back_to_main' }],
  ]);

  await sendMessage(botToken, chatId, helpText, buttons);
}

