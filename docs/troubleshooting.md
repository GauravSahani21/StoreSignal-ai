# StoreSignal AI — Operational Troubleshooting Guide

## 1. Fast Diagnostic Checklist

Run this command first to verify the monorepo health:
```bash
npm test
npm run typecheck --workspaces
npm run eval
```

---

## 2. Common Issues & Remediations

### 2.1 Database Connection Errors (`ECONNREFUSED 5432`)
**Symptom:** API fails to start with error `connect ECONNREFUSED 127.0.0.1:5432`.
**Root Cause:** PostgreSQL container is not running or pgvector extension failed to initialize.
**Remediation:**
1. Check container status:
   ```bash
   docker compose ps
   ```
2. Verify postgres logs:
   ```bash
   docker logs storesignal_postgres
   ```
3. Restart postgres container:
   ```bash
   docker compose up -d postgres
   ```

### 2.2 Account Locked Out (`401 Account locked`)
**Symptom:** User receives `Account locked for 15 minutes due to 5 consecutive failed login attempts`.
**Root Cause:** Brute-force protection was triggered after 5 invalid password submissions.
**Remediation:**
1. Wait 15 minutes for the automated lockout window to expire.
2. Alternatively, an administrator can unlock the account via API:
   ```bash
   # Reset failed attempts and locked_until in DB
   docker exec -it storesignal_postgres psql -U storesignal -d storesignal_dev -c \
     "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'target@vayu.com';"
   ```

### 2.3 OpenRouter Rate Limiting or Fallback Escalation (`429 Rate Limit`)
**Symptom:** LLM calls fail with `OPENROUTER_RATE_LIMITED` or high latencies.
**Root Cause:** OpenRouter upstream rate limit exceeded on primary model.
**Remediation:**
1. StoreSignal AI automatically switches to the configured `OPENROUTER_FALLBACK_MODEL` (`google/gemini-2.5-flash` or `anthropic/claude-3.5-haiku`).
2. Verify model credits on your OpenRouter dashboard (`https://openrouter.ai/keys`).
3. Ensure `OPENROUTER_TIMEOUT_MS` in `.env` is set to at least 45000 ms.

### 2.4 Customer Consent Rejection on Dialogue Ingestion
**Symptom:** Ingestion fails with `Consent not granted for transcript processing`.
**Root Cause:** The customer verbally declined or consent checkbox was left unchecked.
**Remediation:**
This is an intended compliance behavior (§0.1, §3.3). To proceed, obtain customer authorization and submit consent via `POST /api/consents`.

### 2.5 Knowledge Base Gaps Resulting in Unresolved Inquiries
**Symptom:** FloorCoach returns `unresolved: [...]` with `reason: 'no_source_found'`.
**Root Cause:** The customer inquired about an uncataloged vehicle specification or out-of-warranty aftermarket modification.
**Remediation:**
This is an intended safety behavior (§5.3, §6.2). The system strictly abstains from inventing ungrounded technical figures. To resolve, index the official OEM markdown document via `POST /api/knowledge/documents`.
