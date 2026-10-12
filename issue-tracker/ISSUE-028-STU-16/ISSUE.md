# ISSUE-028-STU-16: Update the learner model on the turn

- **Story ID**: STU-16
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#664](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/664)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** my mastery to update when the turn is saved, **so that** the next question can use this attempt and not wait for the hourly rollup.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Update the learner model on the turn" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-08, Section 22.1 (#21)
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: This is P0 because STU-06, STU-09, and EDU-01 depend on it. The deltas are ratified in Section 22.1 (#21).
- **Success Metric**: The next request after a persisted turn sees the new mastery

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The student dashboard (STU-07)

### Preconditions & Dependencies
- [ ] Dependencies: Verifier
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a counted success at hint level 0, **when** the turn is persisted, **then** mastery increases by `0.15` and does not exceed `1.0`.
- [ ] **Given** a counted success only after hint level 1, 2, or 3, **when** the turn is persisted, **then** mastery increases by `0.05`.
- [ ] **Given** completion only at hint level 4 or 5, **when** the turn is persisted, **then** mastery does not increase.
- [ ] **Given** a successful transfer, **when** the turn is persisted, **then** confidence increases by `0.20` and does not exceed `1.0`. Without one, confidence is not increased.
- [ ] **Given** the last 3 counted attempts on the skill conflict, **when** the turn is persisted, **then** confidence decreases by `0.10` and does not fall below `0`.
- [ ] **Given** the turn is persisted, **when** the next practice item is chosen, **then** it uses this write. Cohort aggregates may stay up to one hour old.

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
