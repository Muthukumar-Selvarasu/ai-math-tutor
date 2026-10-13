# SolvePath — Operating Runbook & Incident Response (PRD §15.8, §21, §22, SPEC §13)

## 1. System Overview & Deployment Architecture

SolvePath operates as a serverless Next.js application on Vercel backed by Neon Lakebase Postgres, Clerk Authentication, and Langfuse Observability.

### Environment Configuration Variables
- `APP_ENV`: Deployment tier (`development`, `preview`, `production`).
- `DATABASE_URL`: Connection pooled Neon Postgres URL.
- `DATABASE_URL_UNPOOLED`: Direct Neon Postgres connection URL for migrations.
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk identity keys.
- `CRON_SECRET`: Bearer authentication token for automated scheduled background jobs.
- `GEMINI_API_KEY`: Google AI Studio / Vertex AI enterprise credentials.
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`: Langfuse tracing credentials.
- `DIALOGUE_MODE`: Runtime dialogue engine (`template` [default, safe] or `llm` [opt-in stretch]).

---

## 2. Background Scheduled Jobs (Vercel Cron)

All scheduled cron jobs are secured with `Authorization: Bearer <CRON_SECRET>` and log audit events upon execution:

| Route | Cadence | Purpose | Invariant / Failure Mode |
|---|---|---|---|
| `GET /api/jobs/learner-rollup` | Hourly (`0 * * * *`) | Recomputes student skill mastery & confidence deltas | Max 1 hour telemetry lag; bounded batch processing |
| `GET /api/jobs/embedding-sync` | Hourly (`30 * * * *`) | Syncs question embeddings in pgvector | Preserves deterministic question metadata |
| `GET /api/jobs/insight-drafts` | Daily 18:00 (`0 18 * * *`) | Generates draft teacher recommendations | Only drafts created; requires educator review |
| `GET /api/jobs/item-quality-scan`| Daily 03:00 (`0 3 * * *`) | Scans item bank for difficulty anomalies | Flags anomalies for content reviewer queue |
| `GET /api/jobs/retention-purge` | Daily 19:00 (`0 19 * * *`) | Enforces multi-tier data retention policies | Never deletes audit rows or approved diagrams |

---

## 3. Incident Response Procedures

### 3.1 Severity Definitions
- **Sev-1 (Critical)**:
  - Child safety violation: Inappropriate or toxic text presented to a student.
  - Answer leakage: Final solution value or calculation leaked prior to Level 5.
  - Widespread system outage preventing active practice sessions.
  - **SLA**: Immediate acknowledgment (< 15 min), containment (< 30 min).
- **Sev-2 (High)**:
  - SymPy verifier tool failure rate > 5%.
  - LLM provider elevated latency (p95 > 8.0s) or provider rate limit exhaustion.
  - **SLA**: Response < 1 hour, mitigation < 4 hours.
- **Sev-3 (Medium)**:
  - Cron job execution delay > 2 hours.
  - Minor UI styling anomaly or export formatting glitch.
  - **SLA**: Response next business day.

### 3.2 Emergency Containment Controls & Kill-Switches
1. **Emergency LLM Kill-Switch**:
   - If an unsafe candidate or leakage event occurs, immediately set `DIALOGUE_MODE=template` in the Vercel environment settings.
   - This instantly bypasses all LLM generation stages (`MisconceptionClassifierAgent` and `SocraticDialogueAgent`) platform-wide and switches exclusively to pre-approved, educator-validated template probes.
2. **Platform-Wide Solution Lockdown**:
   - Set `allow_level_5=false` on all active cohorts via the Academic Coordinator controls.
   - This ensures full worked solutions cannot be delivered under any circumstances.
3. **Quarantine Active Sessions**:
   - Use the Admin Quality Issues dashboard (`/admin/quality-issues`) to set session triage to `quarantine`.
   - Quarantined sessions are immediately locked against further student interactions pending teacher review.

### 3.3 Emergency Incident Workflow
```text
 1. Detect (Sentry alert / Langfuse anomaly / Teacher flag)
      │
 2. Contain (Set DIALOGUE_MODE=template / Quarantine session)
      │
 3. Notify (Academic coordinator and assigned teacher informed)
      │
 4. Investigate (Audit log review via /api/admin/audit-events)
      │
 5. Remediate (Update prompt filter / blacklist pattern / item blueprint)
      │
 6. Post-Mortem (Document root cause, update threat model & eval suite)
```

---

## 4. Disaster Recovery & Business Continuity

- **Recovery Point Objective (RPO)**: < 1 hour. Achieved via continuous Neon WAL archiving and daily automated database backups.
- **Recovery Time Objective (RTO)**: < 4 hours. Fully automated deployment of the stateless Next.js application stack to Vercel.
- **Database Restoration**:
  1. Access the Neon Console or execute Neon CLI branch recovery:
     ```bash
     neon branch create --from-timestamp <recovery_iso_timestamp> recovery_branch
     ```
  2. Update `DATABASE_URL` in Vercel to target the restored branch.
  3. Validate database schema and execute integrity health checks.
