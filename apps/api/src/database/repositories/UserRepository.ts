import { randomUUID } from 'node:crypto';

export type UserRole = 'admin' | 'manager' | 'advisor';

export interface User {
  id: string;
  orgId: string;
  storeId?: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreateUserParams {
  orgId: string;
  storeId?: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface IUserRepository {
  createUser(params: CreateUserParams): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(orgId: string, email: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  recordFailedLogin(id: string): Promise<{ failedAttempts: number; lockedUntil: string | null }>;
  resetFailedLogins(id: string): Promise<void>;
  saveRefreshToken(userId: string, tokenHash: string, expiresAt: string): Promise<RefreshTokenRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
}

export class MemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private refreshTokens: Map<string, RefreshTokenRecord> = new Map();

  async createUser(params: CreateUserParams): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: `usr-${randomUUID()}`,
      orgId: params.orgId,
      storeId: params.storeId,
      email: params.email.toLowerCase().trim(),
      passwordHash: params.passwordHash,
      name: params.name,
      role: params.role,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(orgId: string, email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    return (
      Array.from(this.users.values()).find(
        (u) => u.orgId === orgId && u.email === normalized
      ) || null
    );
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated: User = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async recordFailedLogin(id: string): Promise<{ failedAttempts: number; lockedUntil: string | null }> {
    const existing = this.users.get(id);
    if (!existing) return { failedAttempts: 0, lockedUntil: null };

    const attempts = existing.failedLoginAttempts + 1;
    let lockedUntil: string | null = null;

    // Lock account for 15 minutes if 5 or more failed attempts (§14 brute-force protection)
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    const updated: User = {
      ...existing,
      failedLoginAttempts: attempts,
      lockedUntil,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return { failedAttempts: attempts, lockedUntil };
  }

  async resetFailedLogins(id: string): Promise<void> {
    const existing = this.users.get(id);
    if (existing) {
      this.users.set(id, {
        ...existing,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async saveRefreshToken(userId: string, tokenHash: string, expiresAt: string): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: `rt-${randomUUID()}`,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.refreshTokens.set(tokenHash, record);
    return record;
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(tokenHash) || null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const record = this.refreshTokens.get(tokenHash);
    if (record) {
      record.revokedAt = new Date().toISOString();
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.userId === userId) {
        record.revokedAt = new Date().toISOString();
      }
    }
  }
}
