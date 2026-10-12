# ISSUE-023-ADM-06: Sign in

- **Story ID**: ADM-06
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#659](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/659)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** user, **I want** to sign in before I see student data, **so that** unauthenticated people cannot open sessions or profiles.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Sign in" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Authentication events are audited (FR-15)
- **Success Metric**: 100% of authorisation tests pass

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Self-service registration and parent features

### Preconditions & Dependencies
- [ ] Dependencies: Identity provider, RBAC (ADM-01, Tier 1 slice, Section 6.7.1)
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** I have no valid session, **when** I request student data, **then** I am required to sign in and the data is not returned.
- [ ] **Given** I sign in with a valid token, **when** the next request runs, **then** my role and cohort scope are read from Postgres. A role claim left in the Clerk JWT after an administrator changes the role does not apply.
- [ ] **Given** the parent role, **then** sign-in can succeed and still grants no product route in the MVP.
- [ ] **Given** a sign-in or a failed sign-in, **then** an authentication audit event is written.
- [ ] **Given** the Clerk JWKS endpoint is unreachable, **then** cached keys up to 1 hour old are used, and with no cache the request returns 503 `service_unavailable`. Authentication never fails open.
- [ ] **Given** a valid token whose `sub` is not in `app_user`, **then** the request returns 403 `forbidden`, the audit event `auth_unknown_subject` is written, and no row is created. There is no auto-provisioning on first sign-in. The audit row, traces and every foreign key carry only internal `app_user.id` values, never a Clerk id.
- [ ] **Given** `scripts/seed_synthetic.py` runs with `content/seed/users.json` (logical `clerk_ref` values), the active `content/seed/clerk_ids.<APP_ENV>.json` map and `BOOTSTRAP_ADMIN_CLERK_ID`, **then** it fails with an explicit error for any `clerk_ref` missing from the map, otherwise it creates the listed `app_user` rows, inserts the bootstrap administrator only if none exists, stores no name or email, and creates no duplicate when run a second time.

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
