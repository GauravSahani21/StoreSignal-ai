# ADR 014: Authentication, Role-Based Access Control (RBAC), and Production Deployment

## Status
Accepted

## Context
Production retail AI systems handling physical showroom speech, customer identifiers, and pricing require robust authentication and containerized infrastructure (§14, §16):
1. **Cryptographic Password Storage:** Passwords must be protected against brute-force and hardware acceleration attacks using memory-hard scrypt hashing with constant-time equality comparisons.
2. **Session Security & Rotating Refresh Tokens:** Access must rely on short-lived JWTs (15 min) paired with rotating refresh tokens (7 days). Replay or reuse of previously revoked refresh tokens must immediately invalidate the token family.
3. **Strict Code-Level RBAC:** Three distinct roles:
   - `admin`: Central organization administration, user management, audit log access, right-to-erasure deletion.
   - `manager`: Store supervision, follow-up draft approvals and rejections, store analytics, experimentation oversight.
   - `advisor`: Floor sales representative: conversation ingestion, FloorCoach assistance, draft creation. (Blocked from approving own drafts, accessing audit logs, or executing erasure).
   - **Non-negotiable rule:** RBAC must be strictly enforced in application code. Prompts or LLM outputs are NEVER an authorization boundary.
4. **Brute-Force Lockout Protection:** 5 consecutive failed login attempts must lock the target account for 15 minutes.
5. **Multi-Tenancy Isolation:** Every query enforces `org_id` context. Requests targeting foreign organization entities return 404 to prevent resource existence enumeration.
6. **Containerized Production Deployment:** Multi-stage Dockerfiles with non-root security profiles, automated container healthchecks, and Docker Compose orchestration.

---

## Decision

### 1. Database Schema (`008_auth_rbac.sql`)
- `users`: User profiles with scrypt password hashes, roles (`admin`, `manager`, `advisor`), active status, failed login counters, and lockout timestamps.
- `refresh_tokens`: Hashed refresh tokens with expiration and revocation tracking.

### 2. Cryptographic Security Engine (`apps/api/src/auth/crypto.ts`)
- Implements scrypt password hashing ($N=16384, r=8, p=1, \text{maxmem}=32\text{MB}$) with random 16-byte salts.
- Constant-time verification with `crypto.timingSafeEqual`.
- Zero-dependency HMAC-SHA256 JWT signing and verification.

### 3. Authentication & RBAC Service (`apps/api/src/auth/AuthService.ts`)
- Manages user lifecycle, registration, login, lockout gating, token rotation, and default seed accounts.
- Enforces 15-minute lockouts upon 5 consecutive failed attempts.
- Emits structured audit records into `audit_logs` without sensitive payload contents.

### 4. Middleware & Route Protection (`apps/api/src/auth/middleware.ts`)
- PreHandler hooks:
  - `authenticateOptional`: Extracts and decodes Bearer token, populating `req.auth` and `req.orgId`.
  - `requireAuth`: Rejects unauthenticated callers with 401.
  - `requireRole([roles])`: Rejects unauthorized callers with 403 Forbidden.
  - `enforceTenantIsolation`: Blocks cross-tenant access with 404.

### 5. Protected Endpoint Hardening
- Follow-up draft approval/rejection (`POST /api/drafts/:id/approve`): strictly requires `manager` or `admin` role. Advisors are blocked with 403.
- Right to Erasure deletion (`DELETE /api/shoppers/:id`): strictly requires `admin` role. Non-admins are blocked with 403.
- Audit log inspection (`GET /api/auth/audit-logs`): strictly requires `admin` role.

### 6. Production Docker & Deployment Specs
- `apps/api/Dockerfile`: Multi-stage build running as non-root `node` user with HTTP `/health` healthcheck.
- `apps/web/Dockerfile`: Multi-stage build serving React Vite production bundle via Nginx with SPA routing fallback.
- `docker-compose.yml`: Fully orchestrated multi-service stack (`postgres` with pgvector, `api`, `web`).
- Production documentation: `docs/security.md`, `docs/deployment.md`, and `docs/troubleshooting.md`.

---

## Verification Evidence
```bash
$ npx vitest run src/tests/auth-rbac.test.ts

 ✓ Phase 14: Authentication, RBAC, and Security Architecture
   ✓ Cryptographic Storage & Constant-Time Verification > hashes passwords using scrypt with random salt and constant-time verification
   ✓ Cryptographic Storage & Constant-Time Verification > rejects tampered or expired JWT tokens in constant time
   ✓ User Registration & Brute-Force Rate Limiting > registers users and rejects duplicate emails within the same organization
   ✓ User Registration & Brute-Force Rate Limiting > STRICT GUARD: locks account for 15 minutes after 5 consecutive failed login attempts
   ✓ Rotating Refresh Tokens > issues rotating refresh tokens and invalidates the previous token upon use
   ✓ Role-Based Access Control (RBAC) in Code (§14, §16) > enforces that admin, manager, and advisor roles have strictly partitioned capabilities
   ✓ Multi-Tenancy & Cross-Tenant Access Denial > strictly isolates resources across distinct tenant organizations

Test Files  1 passed (1)
Tests  7 passed (7)
```

---

## Consequences
- The platform is secured against external brute-force, unauthorized access, and privilege escalation.
- Adheres directly to DPDP Act 2023 principles for access control, auditability, and purpose limitation.
- Ready for single-command production deployment on any cloud or on-premise infrastructure.
