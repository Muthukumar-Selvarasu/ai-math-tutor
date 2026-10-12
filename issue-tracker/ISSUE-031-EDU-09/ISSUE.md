# ISSUE-031-EDU-09: Add a tutor note

- **Story ID**: EDU-09
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#667](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/667)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** tutor, **I want** to add a note on an assigned student's session, **so that** the teacher can see my observation on the replay.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Add a tutor note" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, FR-13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Notes are free text with the retention window in Section 22.1 (#20)
- **Success Metric**: 100% of tutor notes are stored and visible to the assigned teacher

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Replay, recommendation review, publishing, and Langfuse traces

### Preconditions & Dependencies
- [ ] Dependencies: ADM-01, EDU-03
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a tutor is assigned to the student, **when** they open their list, **then** they see session ids, question titles, and times, and not the student's responses or the tutor output.
- [ ] **Given** a tutor is assigned to the student, **when** they save a note on a listed session id, **then** the note is stored and the assigned teacher sees it on the replay.
- [ ] **Given** a tutor, **when** they request the replay payload, **then** it is denied.
- [ ] **Given** a tutor is not assigned, **when** they save a note, **then** the action is denied and logged.
- [ ] **Given** a tutor, **then** they cannot accept, reject, or override a recommendation, and they cannot change publication status.

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
