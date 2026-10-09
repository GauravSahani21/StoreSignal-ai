# StoreSignal AI — Production Deployment Guide

## 1. Prerequisites
- Docker 24.0+ and Docker Compose v2.20+
- Host OS: Linux (Ubuntu 22.04 LTS recommended) or macOS
- Minimum hardware: 2 vCPU, 4 GB RAM, 20 GB SSD
- PostgreSQL 16 with pgvector extension (provided via Docker)

---

## 2. Quickstart Deployment (One Command)

```bash
# 1. Clone repository
git clone https://github.com/vayu-motors/storesignal-ai.git
cd storesignal-ai

# 2. Configure environment
cp .env.example .env
# Edit .env with your production OPENROUTER_API_KEY and high-entropy JWT_SECRET

# 3. Build and launch full container stack
docker compose up -d --build

# 4. Verify service health
docker compose ps
```

Services exposed:
- **Web Dashboard:** `http://localhost:80` (or configured domain)
- **API Backend:** `http://localhost:3001`
- **PostgreSQL + pgvector:** `localhost:5432`

---

## 3. Database Migration Strategy
StoreSignal AI manages schema changes through idempotent, sequential SQL migrations located in `apps/api/src/database/migrations/`:
- `001_core_schema.sql`: Organizations, stores, conversations, transcripts, consents, agent runs
- `002_knowledge_rag.sql`: pgvector tables, document chunks, semantic indexes
- `003_followup_drafts.sql`: Governed follow-up queue, approval records
- `004_orchestration.sql`: Workflow runs, event tracking, conversation locks
- `005_shopper_profiles.sql`: Shopper identifiers, cross-visit continuity, erasure cascades
- `006_analytics_dashboard.sql`: Usage telemetry, model cost attribution, performance indexes
- `007_experimentation.sql`: A/B experiments, variants, assignments, outcome events
- `008_auth_rbac.sql`: Users, password hashes, rotating refresh tokens

To apply migrations manually against a remote PostgreSQL database:
```bash
for migration in apps/api/src/database/migrations/*.sql; do
    echo "Applying $migration..."
    psql "$DATABASE_URL" -f "$migration"
done
```

---

## 4. Container Healthchecks & Liveness Probes
- **API Healthcheck:**
  `curl -f http://localhost:3001/health`
  Returns `200 OK` with JSON status and runtime uptime.
- **Web Healthcheck:**
  `wget -q --spider http://localhost/`
  Validates Nginx availability.
- **PostgreSQL Healthcheck:**
  `pg_isready -U storesignal -d storesignal_dev`

---

## 5. Backup & Disaster Recovery Procedures

### 5.1 Automated PostgreSQL Backup
```bash
# Create timestamped database dump
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec storesignal_postgres pg_dump -U storesignal storesignal_dev | gzip > "backup_storesignal_${TIMESTAMP}.sql.gz"
```

### 5.2 Database Restoration
```bash
# Restore from compressed SQL dump
gunzip -c backup_storesignal_20261009_120000.sql.gz | docker exec -i storesignal_postgres psql -U storesignal -d storesignal_dev
```

---

## 6. Key Rotation & Zero-Downtime Secret Updates
1. **OpenRouter API Key Rotation:**
   Update `OPENROUTER_API_KEY` in `.env` and trigger rolling container restart:
   ```bash
   docker compose up -d --no-deps api
   ```
2. **JWT Secret Rotation:**
   Update `JWT_SECRET` in `.env`. Existing access tokens expire within 15 minutes. Users seamlessly receive new access tokens upon next refresh token exchange.
