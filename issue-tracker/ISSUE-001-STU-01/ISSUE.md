# ISSUE-001-STU-01: Attempt before guidance

- **Story ID**: STU-01
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#637](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/637)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to attempt a question before receiving guidance, **so that** I practise recalling and applying the method myself.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Attempt before guidance" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-03, FR-05, FR-06 (level 0)
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Question loads in under 2 seconds
- **Success Metric**: At least 90% of incorrect or uncertain attempts receive a question before any solution is shown

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Timed or exam-mode practice

### Preconditions & Dependencies
- [ ] Dependencies: Question delivery (FR-02), session state machine
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a published question is opened, **when** the session starts, **then** the tutor asks for a first attempt or current thinking and shows no hint.
- [ ] **Given** the student presses "I am not sure" in `awaiting_first_attempt`, `active` or `transfer_active`, **when** the turn runs, **then** the level rises by one and never above 4, the attempt is stored with `response_type=not_sure` and is not counted, no verifier, matcher, retrieval or classifier runs, and the tutor asks the next probe for the new level.
- [ ] **Given** the student presses "I am not sure" at Level 4, **then** the level stays 4, the tutor sends the next unused probe at Level 4 or the canned `encouragement` when none is left, and Level 5 is never reached by this button.
- [ ] **Given** an attempt is submitted, **then** it is stored with attempt number, hint level, and duration, and an audit event is recorded.

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
