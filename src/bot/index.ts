/**
 * Main bot entry point
 * Handles polling loop and webhook management
 */

import { handleMessage, type MessageHandlerConfig } from './handlers/message';
import { handleCallbackQuery, type CallbackHandlerConfig } from './handlers/callback';
import { logBotActivity } from './utils/logger';
import { WEBHOOK_CHECK_TIMEOUT, LONG_POLLING_TIMEOUT } from '../constants';

export interface BotConfig {
  botToken: string;
}

let lastUpdateId = 0;

/**
 * Check if webhook is set
 */
async function checkWebhook(botToken: string): Promise<{ url?: string; pending_update_count?: number } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CHECK_TIMEOUT);
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.ok && data.result.url && data.result.url !== '') {
      return data.result;
    }
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('[bot] Webhook check timed out (assuming no webhook)');
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      return null;
    } else {
      console.error('[bot] Error checking webhook:', error.message || error);
    }
    return null;
  }
}

/**
 * Verify webhook is actually deleted
 */
async function verifyWebhookDeleted(botToken: string, maxAttempts: number = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const webhookInfo = await checkWebhook(botToken);
    if (!webhookInfo || !webhookInfo.url) {
      return true;
    }
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

/**
 * Delete webhook to enable polling
 */
async function deleteWebhook(botToken: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CHECK_TIMEOUT);
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return data.ok === true;
  } catch (error: any) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      return false;
    }
    console.error('[bot] Error deleting webhook:', error.message || error);
    return false;
  }
}

/**
 * Get updates from Telegram
 */
async function getUpdates(botToken: string): Promise<any[]> {
  const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LONG_POLLING_TIMEOUT);
    
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 409 || errorText.includes('Conflict')) {
        throw new Error('CONFLICT: Webhook is active. Please delete webhook first or use webhook mode.');
      }
      throw new Error(`Telegram API error: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }
    return data.result || [];
  } catch (error: any) {
    if (error.message && error.message.includes('CONFLICT')) {
      throw error;
    }
    if (error.name === 'AbortError') {
      return [];
    }
    
    const errorMessage = error.message || String(error);
    const errorCode = error.code || error.errno;
    const isNetworkError = 
      errorCode === 'ECONNRESET' || 
      errorCode === 'ETIMEDOUT' || 
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED' ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection');
    
    if (isNetworkError) {
      return [];
    }
    
    console.error('[bot] Error fetching updates:', errorMessage);
    return [];
  }
}

/**
 * Start bot polling
 */
export async function startBot(config: BotConfig): Promise<void> {
  const { botToken } = config;

  console.log('🤖 Telegram Bot Local Testing');
  console.log('📡 Starting polling...');
  console.log('💡 Send /start to your bot to begin testing');
  console.log('');

  // Test bot token
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    if (data.ok) {
      console.log(`✅ Bot connected: @${data.result.username}`);
    } else {
      console.error('❌ Invalid bot token');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to connect to Telegram:', error);
    process.exit(1);
  }

  // Check for active webhook and delete it to enable polling
  let webhookInfo = await checkWebhook(botToken);
  if (webhookInfo && webhookInfo.url) {
    console.log(`⚠️  Webhook detected: ${webhookInfo.url}`);
    
    if (webhookInfo.url.includes('git-dev') || webhookInfo.url.includes('preview') || webhookInfo.url.includes('-dev-')) {
      console.log('⚠️  Warning: Webhook is pointing to a dev/preview URL!');
      console.log('💡 Dev/preview deployments reject webhooks automatically.');
      console.log('💡 You should only set webhooks for PRODUCTION deployments.');
    }
    
    console.log('🔄 Deleting webhook to enable polling mode...');
    
    const deleted = await deleteWebhook(botToken);
    if (deleted) {
      console.log('⏳ Verifying webhook deletion...');
      const verified = await verifyWebhookDeleted(botToken);
      if (verified) {
        console.log('✅ Webhook deleted and verified. Polling mode enabled.');
        if (webhookInfo.pending_update_count && webhookInfo.pending_update_count > 0) {
          console.log(`⚠️  Note: ${webhookInfo.pending_update_count} pending updates were lost.`);
        }
      } else {
        console.error('⚠️  Warning: Webhook deletion reported success but webhook still exists.');
        console.error('💡 This may be due to Vercel automatically re-enabling it.');
        console.error('💡 Make sure webhook is only set for PRODUCTION, not dev/preview.');
        console.error('💡 Try: npm run delete-webhook');
      }
    } else {
      console.error('❌ Failed to delete webhook. Please delete it manually:');
      console.error(`   npm run delete-webhook`);
      console.error(`   or: curl -X POST "https://api.telegram.org/bot${botToken}/deleteWebhook"`);
      process.exit(1);
    }
    console.log('');
  } else {
    console.log('✅ No webhook detected. Polling mode ready.');
    console.log('');
  }

  // Polling loop
  let conflictCount = 0;
  let consecutiveErrors = 0;
  
  console.log('[bot] 📊 Logging enabled - all user activity will be logged');
  console.log('[bot] 🔍 Log format: [timestamp] [status] User [ID] (@username) | Chat [ID] | [ACTION]');
  console.log('');
  
  const messageConfig: MessageHandlerConfig = { botToken };
  const callbackConfig: CallbackHandlerConfig = { botToken };
  
  while (true) {
    try {
      const updates = await getUpdates(botToken);
      conflictCount = 0;
      consecutiveErrors = 0;
      
      if (updates.length > 0) {
        logBotActivity({
          timestamp: new Date().toISOString(),
          chatId: 0,
          action: 'UPDATES_RECEIVED',
          details: { count: updates.length },
          status: 'info',
        });
      }
      
      for (const update of updates) {
        lastUpdateId = update.update_id;

        if (update.callback_query) {
          await handleCallbackQuery(callbackConfig, update.callback_query);
          continue;
        }

        if (update.message) {
          await handleMessage(messageConfig, update.message);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      const errorCode = error.code || error.errno;
      
      const isNetworkError = 
        errorCode === 'ECONNRESET' || 
        errorCode === 'ETIMEDOUT' || 
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNREFUSED' ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection');
      
      if (isNetworkError) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      if (errorMessage.includes('CONFLICT') || errorMessage.includes('Conflict')) {
        conflictCount++;
        consecutiveErrors++;
        
        if (conflictCount >= 3) {
          console.error('\n❌ Persistent conflict error. Webhook may have been re-enabled.');
          console.error('💡 Checking current webhook status...');
          
          const currentWebhook = await checkWebhook(botToken);
          if (currentWebhook && currentWebhook.url) {
            console.error(`⚠️  Webhook is active: ${currentWebhook.url}`);
            console.error('💡 Attempting to delete webhook automatically...');
            
            const deleted = await deleteWebhook(botToken);
            if (deleted) {
              console.log('⏳ Verifying webhook deletion...');
              const verified = await verifyWebhookDeleted(botToken);
              if (verified) {
                console.log('✅ Webhook deleted and verified. Retrying polling...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                conflictCount = 0;
                continue;
              } else {
                console.error('⚠️  Webhook deletion reported success but webhook still exists.');
                console.error('💡 This may be due to Vercel automatically re-enabling it.');
                console.error('💡 Solution: Make sure webhook is only set for PRODUCTION, not dev/preview.');
                console.error('💡 Or run: npm run delete-webhook');
                await new Promise(resolve => setTimeout(resolve, 10000));
                conflictCount = 0;
                continue;
              }
            } else {
              console.error('❌ Failed to delete webhook automatically.');
              console.error('💡 Please delete it manually:');
              console.error(`   npm run delete-webhook`);
              console.error(`   or: curl -X POST "https://api.telegram.org/bot${botToken}/deleteWebhook"`);
              process.exit(1);
            }
          } else {
            console.error('⚠️  No webhook detected, but still getting conflicts.');
            console.error('💡 This may be a temporary Telegram API issue. Waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            conflictCount = 0;
            continue;
          }
        }
        console.error(`⚠️  Conflict detected (${conflictCount}/3). Retrying...`);
      } else {
        consecutiveErrors++;
        console.error(`Error in polling loop (${consecutiveErrors}):`, errorMessage);
        
        if (consecutiveErrors >= 10) {
          console.error('\n❌ Too many consecutive errors. Exiting.');
          process.exit(1);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

