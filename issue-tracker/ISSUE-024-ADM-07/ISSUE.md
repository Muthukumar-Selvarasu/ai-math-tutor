# ISSUE-024-ADM-07: Scheduled jobs

- **Story ID**: ADM-07
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1b: Protocols & Scale (Gate B)]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#660](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/660)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
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
- [ ] Dependencies: Audit log, learner events
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a cron call without `CRON_SECRET`, **when** it hits a job route, **then** it is rejected and logged.
- [ ] **Given** a job runs twice on the same pending work, **then** it is idempotent, writes `job_run` with start, end, status, and counts, and processes a bounded batch that can resume next time.
- [ ] **Given** a job fails, **then** an administrator can see the failure as a Langfuse score or a log alert.
- [ ] **Given** an approved published question or exemplar changes, **when** `embedding-sync` runs, **then** the question embedding is updated and unapproved questions are not embedded. Exemplars are not embedded (SPEC D-26).
- [ ] **Given** the job catalogue, **then** `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync` (Tier 1b; no-op at Tier 1a), `warmup` (six routes in total; Tier 1b, no-op at Tier 1a), and `retention-purge` each have a protected route. Purge behaviour is ADM-09. The nightly evaluation is the GitHub Actions workflow `eval.yml`, not a cron route.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [ ] Step 1: Technical design, schema updates, and test scaffolding.
- [ ] Step 2: Implementation of core logic, state transitions, or UI components.
- [ ] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [ ] Automated Tests: `pytest`
- [ ] Typecheck / Linter: `ruff check apps/api && mypy apps/api`
- [ ] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Pending execution
```

### Acceptance Criteria Verification
- [ ] All Given / When / Then criteria verified: Pending

---

## 4. Closure

### Definition of Done (DoD) Sign-off Checklist
- [ ] All Pre-flight acceptance criteria verified
- [ ] Execution plan completed
- [ ] Automated test suite passed with evidence logged
- [ ] Regressions / leakage / security gates checked where applicable
- [ ] Local `ISSUE.md` marked `Status: Completed`
- [ ] Master `issue-tracker/TRACKER.md` updated and marked `Completed`
- [ ] GitHub Issue closed via `gh issue close` (ONLY after local files are updated)

### Closure Summary
Pending implementation.
