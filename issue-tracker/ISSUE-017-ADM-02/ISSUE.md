# ISSUE-017-ADM-02: Audit trail

- **Story ID**: ADM-02
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P2]
- **Status**: Planned
- **GitHub Issue**: [#653](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/653)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** an audit trail, **so that** every access, AI action, and human decision can be reviewed.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Audit trail" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-15
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Audit writes must not be skippable by feature code
- **Success Metric**: Audit completeness at 100% of defined events

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - External SIEM integration

### Preconditions & Dependencies
- [ ] Dependencies: Audit service, append-only table
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** an authentication event, record access, question selection, student attempt, verifier result, model call, tool call, generated prompt, hint decision, content flag, teacher review, override, export, error, safety incident, `allow_level_5` change, or `trace_review` grant or revocation, **then** an append-only audit row is created with ids, hashes, and structured fields. The row does not contain student free text, the full prompt, or the raw model output. A configuration change stores the previous value and the new value.
- [ ] **Given** an update or delete of an audit row, **when** it is attempted through the application or through the database role used by the app, **then** database permissions or triggers reject it.
- [ ] **Given** the audit viewer, **then** an administrator can filter by user, student, event type, and time.

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
