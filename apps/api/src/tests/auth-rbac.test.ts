import { describe, it, expect, beforeEach } from 'vitest';
import { createRepositories } from '../database/repositories/index.js';
import { AuthService } from '../auth/AuthService.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth/crypto.js';
import { buildApp } from '../app.js';

describe('Phase 14: Authentication, RBAC, and Security Architecture', () => {
  let repos = createRepositories();
  let authService = new AuthService(repos);
  const orgId = 'org-vayu-motors-dev';

  beforeEach(() => {
    repos = createRepositories();
    authService = new AuthService(repos);
  });

  describe('Cryptographic Storage & Constant-Time Verification', () => {
    it('hashes passwords using scrypt with random salt and constant-time verification', async () => {
      const password = 'SuperSecurePassword2026!';
      const hash = await hashPassword(password);

      expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);

      // Verify correct password
      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);

      // Verify wrong password
      const isMismatch = await verifyPassword('WrongPassword123!', hash);
      expect(isMismatch).toBe(false);
    });

    it('rejects tampered or expired JWT tokens in constant time', () => {
      const secret = 'test-secret-key-for-jwt-32-chars-long!';
      const nowSec = Math.floor(Date.now() / 1000);

      const validToken = signToken(
        {
          userId: 'u-1',
          orgId,
          role: 'admin',
          email: 'admin@vayu.com',
          exp: nowSec + 3600,
        },
        secret
      );

      const verified = verifyToken(validToken, secret);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe('u-1');

      // Tampered payload
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${Buffer.from(JSON.stringify({ role: 'superadmin' })).toString('base64url')}.${parts[2]}`;
      expect(verifyToken(tamperedToken, secret)).toBeNull();

      // Expired token
      const expiredToken = signToken(
        {
          userId: 'u-2',
          orgId,
          role: 'advisor',
          email: 'adv@vayu.com',
          exp: nowSec - 10,
        },
        secret
      );
      expect(verifyToken(expiredToken, secret)).toBeNull();
    });
  });

  describe('User Registration & Brute-Force Rate Limiting', () => {
    it('registers users and rejects duplicate emails within the same organization', async () => {
      const user = await authService.register({
        orgId,
        email: 'priya@vayu.com',
        password: 'Password123!',
        name: 'Priya Sharma',
        role: 'manager',
      });

      expect(user.id).toBeDefined();
      expect(user.role).toBe('manager');

      // Duplicate registration must throw conflict
      await expect(
        authService.register({
          orgId,
          email: 'priya@vayu.com',
          password: 'Password123!',
          name: 'Priya Sharma',
          role: 'manager',
        })
      ).rejects.toThrow('already exists');
    });

    it('STRICT GUARD: locks account for 15 minutes after 5 consecutive failed login attempts', async () => {
      const email = 'lockout-test@vayu.com';
      await authService.register({
        orgId,
        email,
        password: 'CorrectPassword123!',
        name: 'Lockout Target',
        role: 'advisor',
      });

      // 4 failed attempts: account should remain unlocked
      for (let i = 1; i <= 4; i++) {
        await expect(
          authService.login({
            orgId,
            email,
            password: 'WrongPassword!',
          })
        ).rejects.toThrow(`Attempt ${i} of 5`);
      }

      // 5th failed attempt: triggers lockout
      await expect(
        authService.login({
          orgId,
          email,
          password: 'WrongPassword!',
        })
      ).rejects.toThrow('Account locked for 15 minutes');

      // 6th attempt with CORRECT password: still rejected due to active lockout
      await expect(
        authService.login({
          orgId,
          email,
          password: 'CorrectPassword123!',
        })
      ).rejects.toThrow('Account locked due to consecutive failed attempts');
    });
  });

  describe('Rotating Refresh Tokens', () => {
    it('issues rotating refresh tokens and invalidates the previous token upon use', async () => {
      const email = 'rotation@vayu.com';
      const password = 'RotationPassword123!';
      await authService.register({
        orgId,
        email,
        password,
        name: 'Rotation Tester',
        role: 'advisor',
      });

      const loginResult = await authService.login({ orgId, email, password });
      const initialRefresh = loginResult.refreshToken;

      // Refresh tokens
      const refreshResult = await authService.refreshToken(initialRefresh);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.refreshToken).not.toBe(initialRefresh);

      // Re-using the old refresh token must be rejected
      await expect(authService.refreshToken(initialRefresh)).rejects.toThrow(
        'Invalid or revoked refresh token'
      );
    });
  });

  describe('Role-Based Access Control (RBAC) in Code (§14, §16)', () => {
    it('enforces that admin, manager, and advisor roles have strictly partitioned capabilities', async () => {
      const app = await buildApp({
        repositories: repos,
        authService,
        skipAutoSeed: false,
      });

      // 1. Seed accounts
      await authService.seedDefaultUsers(orgId);

      // 2. Login as Advisor
      const advLogin = await authService.login({
        orgId,
        email: 'advisor@storesignal.ai',
        password: 'AdvisorPassword123!',
      });
      const advToken = advLogin.accessToken;

      // 3. Login as Manager
      const mgrLogin = await authService.login({
        orgId,
        email: 'manager@storesignal.ai',
        password: 'ManagerPassword123!',
      });
      const mgrToken = mgrLogin.accessToken;

      // 4. Login as Admin
      const adminLogin = await authService.login({
        orgId,
        email: 'admin@storesignal.ai',
        password: 'AdminPassword123!',
      });
      const adminToken = adminLogin.accessToken;

      // TEST A: Advisor cannot view admin audit logs
      const advAuditRes = await app.inject({
        method: 'GET',
        url: '/api/auth/audit-logs',
        headers: { authorization: `Bearer ${advToken}` },
      });
      expect(advAuditRes.statusCode).toBe(403);

      // TEST B: Manager cannot view admin audit logs
      const mgrAuditRes = await app.inject({
        method: 'GET',
        url: '/api/auth/audit-logs',
        headers: { authorization: `Bearer ${mgrToken}` },
      });
      expect(mgrAuditRes.statusCode).toBe(403);

      // TEST C: Admin CAN view audit logs
      const adminAuditRes = await app.inject({
        method: 'GET',
        url: '/api/auth/audit-logs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminAuditRes.statusCode).toBe(200);

      // Create a draft for approval test
      const conv = await repos.conversations.createConversation({
        orgId,
        storeId: 'store-indiranagar-01',
        source: 'audio_realtime',
        status: 'ingested',
      });
      const draft = await repos.drafts.createDraft({
        orgId,
        conversationId: conv.id,
        channel: 'whatsapp',
        subject: 'Follow up',
        message: 'Hello',
        factsUsed: [],
        recommendedAction: 'Schedule test ride',
        reason: 'High intent',
      });

      // TEST D: Advisor CANNOT approve draft (Manager/Admin required)
      const advApproveRes = await app.inject({
        method: 'POST',
        url: `/api/drafts/${draft.id}/approve`,
        headers: { authorization: `Bearer ${advToken}` },
        payload: { reviewerNotes: 'Looks good' },
      });
      expect(advApproveRes.statusCode).toBe(403);

      // TEST E: Manager CAN approve draft
      const mgrApproveRes = await app.inject({
        method: 'POST',
        url: `/api/drafts/${draft.id}/approve`,
        headers: { authorization: `Bearer ${mgrToken}` },
        payload: { reviewerNotes: 'Approved by store manager' },
      });
      expect(mgrApproveRes.statusCode).toBe(200);

      // Create a shopper for Right to Erasure test
      const shopper = await repos.shoppers.createShopper({
        orgId,
        anonymousId: 'anon-del-test',
        consentFlags: {},
      });

      // TEST F: Advisor CANNOT execute Right to Erasure deletion
      const advDelRes = await app.inject({
        method: 'DELETE',
        url: `/api/shoppers/${shopper.id}`,
        headers: { authorization: `Bearer ${advToken}` },
        payload: { actor: 'advisor@storesignal.ai' },
      });
      expect(advDelRes.statusCode).toBe(403);

      // TEST G: Admin CAN execute Right to Erasure deletion
      const adminDelRes = await app.inject({
        method: 'DELETE',
        url: `/api/shoppers/${shopper.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { actor: 'admin@storesignal.ai' },
      });
      expect(adminDelRes.statusCode).toBe(200);

      await app.close();
    });
  });

  describe('Multi-Tenancy & Cross-Tenant Access Denial', () => {
    it('strictly isolates resources across distinct tenant organizations', async () => {
      const app = await buildApp({
        repositories: repos,
        authService,
        skipAutoSeed: false,
      });

      const orgA = 'org-vayu-motors-dev';
      const orgB = 'org-competing-dealer-blr';

      // Create conversation in Org B
      const convB = await repos.conversations.createConversation({
        orgId: orgB,
        storeId: 'store-blr-competing',
        source: 'transcript_import',
        status: 'ingested',
      });

      // Seed and login user from Org A
      await authService.register({
        orgId: orgA,
        email: 'user-orga@vayu.com',
        password: 'PasswordOrgA123!',
        name: 'User Org A',
        role: 'manager',
      });

      const loginA = await authService.login({
        orgId: orgA,
        email: 'user-orga@vayu.com',
        password: 'PasswordOrgA123!',
      });
      const tokenA = loginA.accessToken;

      // Org A user queries Org B conversation -> Must return 404
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversations/${convB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(404);

      await app.close();
    });
  });
});
