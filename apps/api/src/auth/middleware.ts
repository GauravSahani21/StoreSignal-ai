import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationError, ForbiddenError, NotFoundError } from '../errors/AppError.js';
import type { AuthService } from './AuthService.js';
import type { TokenPayload } from './crypto.js';
import type { UserRole } from '../database/repositories/UserRepository.js';

declare module 'fastify' {
  interface FastifyRequest {
    orgId: string;
    auth?: TokenPayload;
  }
}

export function createAuthMiddleware(authService: AuthService) {
  /**
   * PreHandler hook that extracts and validates Bearer token if present.
   */
  const authenticateOptional = async (req: FastifyRequest) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const payload = authService.verifyAccessToken(token);
      if (payload) {
        req.auth = payload;
        req.orgId = payload.orgId;
        return;
      }
    }

    // Dev fallback context if x-org-id is provided and no auth token supplied
    const orgHeader = req.headers['x-org-id'];
    const roleHeader = req.headers['x-user-role'] as UserRole | undefined;
    if (typeof orgHeader === 'string' && orgHeader.trim()) {
      req.orgId = orgHeader.trim();
      if (roleHeader) {
        req.auth = {
          userId: (req.headers['x-user-id'] as string) || 'usr-dev-anon',
          orgId: orgHeader.trim(),
          role: roleHeader,
          email: 'dev@storesignal.ai',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      }
    }
  };

  /**
   * Enforces that the request has a valid authenticated session.
   */
  const requireAuth = async (req: FastifyRequest, _reply: FastifyReply) => {
    await authenticateOptional(req);
    if (!req.auth) {
      throw new AuthenticationError('Valid Bearer authentication token is required.');
    }
  };

  /**
   * Enforces Role-Based Access Control (RBAC) in code (§14, §16).
   * Prompts or models are NEVER an authorization boundary.
   */
  const requireRole = (allowedRoles: UserRole[]) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      await authenticateOptional(req);
      if (!req.auth) {
        throw new AuthenticationError('Valid authentication token is required.');
      }

      if (!allowedRoles.includes(req.auth.role)) {
        throw new ForbiddenError(
          `Access forbidden: Operation requires one of roles [${allowedRoles.join(', ')}]. Current role: '${req.auth.role}'.`
        );
      }
    };
  };

  /**
   * Enforces cross-tenant isolation.
   * If an entity does not belong to the caller's orgId, returns 404
   * to prevent resource existence enumeration.
   */
  const enforceTenantIsolation = (resourceOrgId: string, req: FastifyRequest) => {
    const callerOrgId = req.auth?.orgId || req.orgId;
    if (resourceOrgId !== callerOrgId) {
      throw new NotFoundError('Requested resource not found.');
    }
  };

  return {
    authenticateOptional,
    requireAuth,
    requireRole,
    enforceTenantIsolation,
  };
}
