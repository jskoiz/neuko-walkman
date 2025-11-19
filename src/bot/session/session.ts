/**
 * Bot session management
 */

export interface UserSession {
  type: 'waiting_for_url' | 'selecting_playlist_for_add' | 'selecting_playlist_for_delete' | 'selecting_song_to_delete';
  playlistName?: string;
  messageId?: number;
}

class SessionManager {
  private sessions: Map<number, UserSession> = new Map();

  get(chatId: number): UserSession | undefined {
    return this.sessions.get(chatId);
  }

  set(chatId: number, session: UserSession): void {
    this.sessions.set(chatId, session);
  }

  delete(chatId: number): void {
    this.sessions.delete(chatId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

