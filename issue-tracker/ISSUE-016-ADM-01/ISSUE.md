# ISSUE-016-ADM-01: Manage roles

- **Story ID**: ADM-01
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P2]
- **Status**: Planned
- **GitHub Issue**: [#652](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/652)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** to manage roles and assignments, **so that** people only access the data their role and cohort allow.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Manage roles" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Authorisation enforced in the API and database layer
- **Success Metric**: 100% of authorisation tests pass for all roles

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Self-service role requests

### Preconditions & Dependencies
- [ ] Dependencies: Identity provider, RBAC layer
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** an administrator assigns a role, a cohort, or `trace_review`, **when** the next API call runs, **then** it reads that permission from Postgres. A Clerk JWT claim that still shows the old role does not grant it. Granting or revoking `trace_review` writes an audit event with who, when, and the change.
- [ ] **Given** an administrator assigns a support contact, **when** the cohort already has one, **then** the new user replaces them and both changes are audited. A cohort has at most one support contact.
- [ ] **Given** an administrator does not hold `trace_review`, **when** they request a replay, **then** access is denied and logged.
- [ ] **Given** a request outside the caller's scope, **then** it is denied and logged.
- [ ] **Given** the parent role, **then** it grants no route in the MVP.
- [ ] **Given** the Tier 1 slice, **when** `tests/authz` runs, **then** the 16 blocking Gate A cases in PRD section 14.5 (9 app-layer, 3 RLS, 4 hardening) pass.
- [ ] **Given** the role and action matrix in Section 8.1 (FR-01), **when** each allowed action is called inside scope, **then** it succeeds, and each denied action is rejected and logged (Tier 3; the Tier 1 slice is the 16 Gate A cases above).

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
