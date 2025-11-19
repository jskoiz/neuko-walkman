/**
 * Start command handler
 */

import { sendMessage, sendPhoto, deleteMessage, createInlineKeyboard, isAdmin } from '../../utils/telegram-bot';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logBotActivity } from '../utils/logger';

export interface StartCommandConfig {
  botToken: string;
  chatId: number;
  userId?: number;
  username?: string;
  messageId?: number;
}

export async function handleStartCommand(config: StartCommandConfig): Promise<void> {
  const { botToken, chatId, userId, username, messageId } = config;
  const isAdminUser = userId ? isAdmin(userId) : false;

  logBotActivity({
    timestamp: new Date().toISOString(),
    userId,
    username,
    chatId,
    action: 'COMMAND_START',
    details: { isAdmin: isAdminUser },
    status: 'info',
  });

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '➕ Add Song to Community', callback_data: 'add_song' }],
    [{ text: '📋 View Playlists', callback_data: 'view_playlists' }],
  ];

  // Add restricted access option (admin only)
  if (isAdminUser) {
    buttons.push([{ text: '🔒 Restricted Access', callback_data: 'restricted_access' }]);
  }

  const keyboard = createInlineKeyboard(buttons);
  const displayName = username ? `@${username}` : 'Operative';
  const welcomeText = `Greetings Operative ${displayName}\n\n` +
    `Share your favorite songs with the community.\n\n` +
    `You can listen to all the Neuko sounds at https://bloc.rocks`;

  // Delete previous message if provided (for navigation)
  if (messageId) {
    try {
      await deleteMessage(botToken, chatId, messageId);
    } catch (error) {
      // Ignore errors - might be a photo message which can't be deleted
    }
  }

  const photoPath = join(process.cwd(), 'public', 'vending-machines.jpg');
  let photo: string | Buffer | null = null;
  try {
    photo = await readFile(photoPath);
  } catch (error) {
    console.error('Failed to read photo file:', error);
    photo = null;
  }

  if (photo) {
    await sendPhoto(botToken, chatId, photo, welcomeText, keyboard);
  } else {
    await sendMessage(botToken, chatId, welcomeText, keyboard);
  }
}

