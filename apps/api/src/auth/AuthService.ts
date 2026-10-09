import crypto from 'node:crypto';
import type { Repositories } from '../database/repositories/index.js';
import type { User, UserRole } from '../database/repositories/UserRepository.js';
import { AuthenticationError, ConflictError, ValidationError } from '../errors/AppError.js';
import { hashPassword, verifyPassword, signToken, verifyToken, type TokenPayload } from './crypto.js';

export interface LoginResult {
  user: {
    id: string;
    orgId: string;
    email: string;
    name: string;
    role: UserRole;
    storeId?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

export class AuthService {
  private repositories: Repositories;
  private jwtSecret: string;
  private accessTokenTtlSec: number;
  private refreshTokenTtlSec: number;

  constructor(
    repositories: Repositories,
    jwtSecret: string = 'storesignal-jwt-super-secret-key-32chars-min!!',
    accessTokenTtlSec: number = 15 * 60, // 15 mins
    refreshTokenTtlSec: number = 7 * 24 * 60 * 60 // 7 days
  ) {
    this.repositories = repositories;
    this.jwtSecret = jwtSecret;
    this.accessTokenTtlSec = accessTokenTtlSec;
    this.refreshTokenTtlSec = refreshTokenTtlSec;
  }

  async register(params: {
    orgId: string;
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    storeId?: string;
  }): Promise<User> {
    const existing = await this.repositories.users.getUserByEmail(params.orgId, params.email);
    if (existing) {
      throw new ConflictError(`User with email "${params.email}" already exists in organization.`);
    }

    if (params.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long.');
    }

    const passwordHash = await hashPassword(params.password);
    const user = await this.repositories.users.createUser({
      orgId: params.orgId,
      email: params.email,
      name: params.name,
      passwordHash,
      role: params.role ?? 'advisor',
      storeId: params.storeId,
    });

    await this.repositories.auditLogs.recordAudit({
      orgId: params.orgId,
      actor: user.id,
      action: 'user_created',
      resource: `user:${user.id}`,
      metadata: { role: user.role, email: user.email },
    });

    return user;
  }

  async login(params: {
    orgId: string;
    email: string;
    password: string;
  }): Promise<LoginResult> {
    const user = await this.repositories.users.getUserByEmail(params.orgId, params.email);
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid email or password.');
    }

    // Check account lockout
    if (user.lockedUntil) {
      const lockExpiry = new Date(user.lockedUntil).getTime();
      if (Date.now() < lockExpiry) {
        const remainingMinutes = Math.ceil((lockExpiry - Date.now()) / 60000);
        throw new AuthenticationError(
          `Account locked due to consecutive failed attempts. Try again in ${remainingMinutes} minute(s).`
        );
      }
    }

    const isValid = await verifyPassword(params.password, user.passwordHash);
    if (!isValid) {
      const { failedAttempts, lockedUntil } = await this.repositories.users.recordFailedLogin(user.id);
      if (lockedUntil) {
        throw new AuthenticationError(
          'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
        );
      }
      throw new AuthenticationError(
        `Invalid email or password. Attempt ${failedAttempts} of 5 before lockout.`
      );
    }

    // Reset failed login counter on success
    await this.repositories.users.resetFailedLogins(user.id);

    // Generate tokens
    const nowSec = Math.floor(Date.now() / 1000);
    const accessPayload: TokenPayload = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      storeId: user.storeId,
      email: user.email,
      exp: nowSec + this.accessTokenTtlSec,
    };
    const accessToken = signToken(accessPayload, this.jwtSecret);

    // Generate rotating Refresh Token
    const refreshTokenPlain = `rt_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(refreshTokenPlain).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTokenTtlSec * 1000).toISOString();

    await this.repositories.users.saveRefreshToken(user.id, tokenHash, refreshExpiresAt);

    await this.repositories.auditLogs.recordAudit({
      orgId: user.orgId,
      actor: user.id,
      action: 'login_success',
      resource: `user:${user.id}`,
      metadata: { role: user.role },
    });

    return {
      user: {
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
      },
      accessToken,
      refreshToken: refreshTokenPlain,
      expiresInSec: this.accessTokenTtlSec,
    };
  }

  async refreshToken(refreshTokenStr: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
    const record = await this.repositories.users.findRefreshToken(tokenHash);

    if (!record || record.revokedAt) {
      throw new AuthenticationError('Invalid or revoked refresh token.');
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new AuthenticationError('Refresh token has expired.');
    }

    const user = await this.repositories.users.getUserById(record.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User account not found or disabled.');
    }

    // Token rotation: Revoke current refresh token
    await this.repositories.users.revokeRefreshToken(tokenHash);

    // Issue new tokens
    const nowSec = Math.floor(Date.now() / 1000);
    const accessPayload: TokenPayload = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      storeId: user.storeId,
      email: user.email,
      exp: nowSec + this.accessTokenTtlSec,
    };
    const newAccessToken = signToken(accessPayload, this.jwtSecret);

    const newRefreshTokenPlain = `rt_${crypto.randomBytes(32).toString('hex')}`;
    const newTokenHash = crypto.createHash('sha256').update(newRefreshTokenPlain).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTokenTtlSec * 1000).toISOString();

    await this.repositories.users.saveRefreshToken(user.id, newTokenHash, refreshExpiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenPlain,
    };
  }

  async logout(refreshTokenStr: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
    await this.repositories.users.revokeRefreshToken(tokenHash);
  }

  verifyAccessToken(token: string): TokenPayload | null {
    return verifyToken(token, this.jwtSecret);
  }

  /**
   * Seeds realistic role accounts for Indiranagar showroom: Admin, Store Manager, and Floor Advisor
   */
  async seedDefaultUsers(orgId: string): Promise<void> {
    const existing = await this.repositories.users.getUserByEmail(orgId, 'admin@storesignal.ai');
    if (existing) return;

    // 1. Admin
    await this.register({
      orgId,
      email: 'admin@storesignal.ai',
      password: 'AdminPassword123!',
      name: 'Vayu Central Admin',
      role: 'admin',
    });

    // 2. Manager
    await this.register({
      orgId,
      email: 'manager@storesignal.ai',
      password: 'ManagerPassword123!',
      name: 'Priya Sharma (Store Manager)',
      role: 'manager',
      storeId: 'store-indiranagar-01',
    });

    // 3. Advisor
    await this.register({
      orgId,
      email: 'advisor@storesignal.ai',
      password: 'AdvisorPassword123!',
      name: 'Karthik Rao (Floor Advisor)',
      role: 'advisor',
      storeId: 'store-indiranagar-01',
    });
  }
}
