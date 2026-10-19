# REST API & Database Integration Architecture 🔌

This document provides a technical specification for the Express API layer, PostgreSQL schemas, and background worker services.

---

## Architecture Overview

The backend uses a **Modular Domain Architecture** located in `backend/src/modules/`:

```
backend/src/modules/
├── projects/       # Escrow project creation, indexing, and status queries
├── milestones/     # Milestone verification, deadline tracking, and status
├── proposals/      # Freelancer job applications, quotes, and status
├── users/          # Wallet address to role registration
├── messages/       # Project-scoped client-freelancer communications
├── notifications/  # Event-driven real-time alert dispatch
└── auto-release/   # Background timelock monitoring cron service
```

---

## 1. Feature Domain Endpoints

### Projects (`/api/projects`)
- `GET /api/projects`: Query projects with query parameters `page`, `limit`, `role`, `status`.
- `GET /api/projects/:id`: Fetch complete project metadata, milestone progress, and attachments.
- `POST /api/projects`: Register a new escrow project with validated Zod schema.

### Proposals (`/api/proposals`)
- `GET /api/proposals/project/:projectId`: Fetch all proposals submitted for a specific project.
- `POST /api/proposals`: Freelancer submits an application with pitch, quote, and milestones.
- `PATCH /api/proposals/:id/status`: Client accepts or denies a proposal (`status: 'accepted' | 'denied'`). Accepting one proposal auto-rejects competing proposals.

### Auto-Release Timelock Worker
- Background cron service (`autoRelease.service.ts`) periodically scans submitted milestones.
- If a client fails to review or dispute a submitted milestone within the configured grace period (e.g., 14 days), the worker triggers auto-release and dispatches notification alerts.

---

## 2. PostgreSQL / Supabase Schema

```sql
-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  budget NUMERIC NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  token_address TEXT,
  deadline DATE,
  client_id UUID REFERENCES users(id),
  freelancer_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'open',
  yield_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestones Table
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);

-- Proposals Table
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  freelancer_address TEXT NOT NULL,
  pitch TEXT NOT NULL,
  bid_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
