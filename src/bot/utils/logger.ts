/**
 * Bot logging utility
 */

export interface LogEntry {
  timestamp: string;
  userId?: number;
  username?: string;
  chatId: number;
  action: string;
  details?: any;
  status: 'success' | 'error' | 'info';
  error?: string;
}

export function logBotActivity(entry: LogEntry): void {
  const timestamp = new Date().toISOString();
  const userInfo = entry.userId 
    ? `User ${entry.userId}${entry.username ? ` (@${entry.username})` : ''}`
    : 'Unknown user';
  const chatInfo = `Chat ${entry.chatId}`;
  const statusEmoji = entry.status === 'success' ? '✅' : entry.status === 'error' ? '❌' : 'ℹ️';
  
  const logMessage = `[${timestamp}] ${statusEmoji} ${userInfo} | ${chatInfo} | ${entry.action}`;
  
  if (entry.details) {
    console.log(logMessage, JSON.stringify(entry.details, null, 2));
  } else {
    console.log(logMessage);
  }
  
  if (entry.error) {
    console.error(`[${timestamp}] ERROR:`, entry.error);
  }
}


