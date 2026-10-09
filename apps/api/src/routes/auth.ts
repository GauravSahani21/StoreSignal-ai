import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Repositories } from '../database/repositories/index.js';
import { AuthService } from '../auth/AuthService.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export const authRoutes: FastifyPluginAsync<{
  repositories: Repositories;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const service = opts.authService ?? new AuthService(opts.repositories);
  const { requireAuth, requireRole } = createAuthMiddleware(service);

  // Auto-seed default accounts on startup for dev tenant
  await service.seedDefaultUsers('org-vayu-motors-dev').catch((err) => {
    fastify.log.warn({ err }, 'Failed to seed default auth accounts');
  });

  // POST /api/auth/register
  fastify.post('/register', async (req, reply) => {
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(2),
      role: z.enum(['admin', 'manager', 'advisor']).optional(),
      storeId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid registration payload: ${parsed.error.message}`);
    }

    const user = await service.register({
      orgId,
      ...parsed.data,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        createdAt: user.createdAt,
      },
    });
  });

  // POST /api/auth/login
  fastify.post('/login', async (req, reply) => {
    const orgId = (req.headers['x-org-id'] as string) || 'org-vayu-motors-dev';
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid login payload: ${parsed.error.message}`);
    }

    const result = await service.login({
      orgId,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    return reply.send({ success: true, data: result });
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const schema = z.object({
      refreshToken: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid refresh payload: ${parsed.error.message}`);
    }

    const tokens = await service.refreshToken(parsed.data.refreshToken);
    return reply.send({ success: true, data: tokens });
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (req, reply) => {
    const schema = z.object({
      refreshToken: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (parsed.success) {
      await service.logout(parsed.data.refreshToken);
    }

    return reply.send({ success: true, message: 'Logged out successfully.' });
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const user = await opts.repositories.users.getUserById(auth.userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId,
        createdAt: user.createdAt,
      },
    });
  });

  // GET /api/auth/audit-logs (Strictly Admin Only)
  fastify.get('/audit-logs', { preHandler: requireRole(['admin']) }, async (req, reply) => {
    const orgId = req.auth?.orgId || 'org-vayu-motors-dev';
    const logs = await opts.repositories.auditLogs.listAudits(orgId);
    return reply.send({ success: true, data: logs });
  });
};
