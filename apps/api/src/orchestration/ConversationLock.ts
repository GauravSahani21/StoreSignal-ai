export class ConversationLock {
  private readonly locks = new Map<string, { lockId: string; expiresAt: number }>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 30000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Attempts to acquire exclusive lock for a conversation.
   * If a lock exists and is past expiration, it is reclaimed.
   */
  acquire(conversationId: string, ttlMs = this.defaultTtlMs): { acquired: boolean; lockId?: string } {
    const now = Date.now();
    const existing = this.locks.get(conversationId);

    if (existing && existing.expiresAt > now) {
      return { acquired: false };
    }

    const lockId = `lock-${Math.random().toString(36).substring(2, 9)}-${now}`;
    this.locks.set(conversationId, {
      lockId,
      expiresAt: now + ttlMs,
    });

    return { acquired: true, lockId };
  }

  /**
   * Releases lock if held by lockId or unconditionally.
   */
  release(conversationId: string, lockId?: string): boolean {
    const existing = this.locks.get(conversationId);
    if (!existing) return true;

    if (lockId && existing.lockId !== lockId) {
      return false; // Not lock owner
    }

    this.locks.delete(conversationId);
    return true;
  }

  isLocked(conversationId: string): boolean {
    const now = Date.now();
    const existing = this.locks.get(conversationId);
    if (!existing) return false;
    return existing.expiresAt > now;
  }
}

export const globalConversationLock = new ConversationLock();
