# ISSUE-024-ADM-07: Scheduled jobs

- **Story ID**: ADM-07
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1b: Protocols & Scale (Gate B)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#660](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/660)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** scheduled jobs to be authenticated, repeatable, and visible when they fail, **so that** rollups and purges finish without silent data loss.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Scheduled jobs" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-16, Section 11.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Jobs resume on the next invocation if the batch is unfinished
- **Success Metric**: Cron jobs run on schedule, are idempotent, and report status

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - A replacement queue product

### Preconditions & Dependencies
- [x] Dependencies: Audit log, learner events
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a cron call without `CRON_SECRET`, **when** it hits a job route, **then** it is rejected and logged.
- [x] **Given** a job runs twice on the same pending work, **then** it is idempotent, writes `job_run` with start, end, status, and counts, and processes a bounded batch that can resume next time.
- [x] **Given** a job fails, **then** an administrator can see the failure as a Langfuse score or a log alert.
- [x] **Given** an approved published question or exemplar changes, **when** `embedding-sync` runs, **then** the question embedding is updated and unapproved questions are not embedded. Exemplars are not embedded (SPEC D-26).
- [x] **Given** the job catalogue, **then** `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync` (Tier 1b; no-op at Tier 1a), `warmup` (six routes in total; Tier 1b, no-op at Tier 1a), and `retention-purge` each have a protected route. Purge behaviour is ADM-09. The nightly evaluation is the GitHub Actions workflow `eval.yml`, not a cron route.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`lib/scheduled-jobs.js`, `tests/e2e/adm-07-scheduled-jobs.spec.ts`).
- [x] Step 2: Implementation of core logic, state transitions, or UI components (All 6 cron routes with `CRON_SECRET` validation, admin metrics route `app/api/admin/jobs/route.js`).
- [x] Step 3: Verification against acceptance criteria and regression suite (`npm run test:e2e`).

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/scheduled-jobs.js` with `verifyCronAuth`, `executeScheduledJob`, `getJobRuns`, `getJobAlerts`, and question embedding sync (768 dimensions).
- `2026-10-13`: Implemented 6 protected cron job endpoints (`/api/jobs/warmup`, `/api/jobs/learner-rollup`, `/api/jobs/embedding-sync`, `/api/jobs/insight-drafts`, `/api/jobs/item-quality-scan`, `/api/jobs/retention-purge`).
- `2026-10-13`: Created admin endpoint `GET /api/admin/jobs` for tracking job runs, alerts, and sync state.
- `2026-10-13`: Updated `tests/e2e/stu-07-concept-connections-display.spec.ts` with required `CRON_SECRET` bearer header on rollup requests.
- `2026-10-13`: Added full E2E test suite `tests/e2e/adm-07-scheduled-jobs.spec.ts` covering authentication rejection, all 6 routes, idempotence, bounded batches, failure alerts, embedding sync, and nightly eval workflow invariant.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-07-scheduled-jobs.spec.ts`
- [x] Full E2E Test Suite: `npm run test:e2e`
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 7 tests using 1 worker

  ✓ [ADM-07] Criterion 1: Unauthenticated cron call without or with invalid CRON_SECRET is rejected (401) and logged to audit trail (949ms)
  ✓ [ADM-07] Criterion 2: All six job routes in catalogue require CRON_SECRET and return 200 with job_run_id, status, and counts (697ms)
  ✓ [ADM-07] Criterion 3: Jobs are idempotent: running twice on same pending work produces consistent state and writes job_run (153ms)
  ✓ [ADM-07] Criterion 4: Bounded batching and resumption: processes bounded batch and reports remaining_count for next invocation (43ms)
  ✓ [ADM-07] Criterion 5: Job failure records alert and Langfuse score representation visible to administrators (52ms)
  ✓ [ADM-07] Criterion 6: embedding-sync embeds approved published questions only (768-dim vector), skips unapproved questions, excludes exemplars (90ms)
  ✓ [ADM-07] Criterion 7: Architecture invariant: nightly evaluation is GitHub Actions workflow eval.yml, not a cron route (1ms)

7 passed (4.6s)

Full E2E Suite:
185 passed (1.5m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 7/7 passing in E2E suite.

---

## 4. Closure

### Definition of Done (DoD) Sign-off Checklist
- [x] All Pre-flight acceptance criteria verified
- [x] Execution plan completed
- [x] Automated test suite passed with evidence logged
- [x] Regressions / leakage / security gates checked where applicable
- [x] Local `ISSUE.md` marked `Status: Completed`
- [x] Master `issue-tracker/TRACKER.md` updated and marked `Completed`
- [x] GitHub Issue closed via `gh issue close` (ONLY after local files are updated)

### Closure Summary
Scheduled jobs architecture fully implemented for Tier 1b (Gate B). All six job routes authenticated via `CRON_SECRET` bearer token, idempotent execution verified with start/end/status `job_run` tracking, failure alerting visible to administrators with Langfuse score mapping, bounded batches with resumption capability, and embedding sync restricted to approved published questions only.
