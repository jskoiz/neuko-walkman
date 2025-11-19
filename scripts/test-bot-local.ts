/**
 * Local testing script for Telegram bot using polling
 * Run with: npx tsx scripts/test-bot-local.ts
 * or: node --loader ts-node/esm scripts/test-bot-local.ts
 */

import dotenv from 'dotenv';
import { validateAndThrow } from '../src/utils/env-validation';
import { startBot } from '../src/bot';

// Load environment variables
dotenv.config();

/**
 * Main entry point
 */
async function main() {
  // Validate required environment variables
  validateAndThrow('Telegram Bot');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in environment variables');
    process.exit(1);
  }

  // Start the bot
  await startBot({ botToken });
}

// Run the bot
main().catch(console.error);
