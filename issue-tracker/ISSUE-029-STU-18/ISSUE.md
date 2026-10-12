# ISSUE-029-STU-18: Close a session with a summary and a stuck flag

- **Story ID**: STU-18
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#665](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/665)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** a finished session to keep a summary, **so that** being stuck after transfer is recorded without another worked solution.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Close a session with a summary and a stuck flag" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-05, FR-10
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: `cannot_verify` and `tool_failure` do not trigger the flag.
- **Success Metric**: A stuck transfer records the flag and no second solution

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Showing the flag (EDU-12)

### Preconditions & Dependencies
- [ ] Dependencies: STU-12, STU-06
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** the transfer item is at hint level 4, has at least 3 counted attempts, and the latest status is `incorrect` or `partially_correct`, **when** the session is saved, **then** it records `stuck_after_transfer`, the student is told their teacher will look at it, and the tutor does not open a worked solution.
- [ ] **Given** the transfer result is recorded, the transfer is declined, or 30 minutes pass with no request, **when** that happens, **then** the session ends as `completed`, `declined`, or `abandoned`. Resume after `abandoned` starts a new session.
- [ ] **Given** a session ends, **when** it is saved, **then** a summary stores the verifier outcomes, hint levels, and transfer result.
- [ ] **Given** the 12th pipeline turn on an item passes without a `correct`, **when** the turn is saved, **then** the session is `stuck`, records `turn_cap_reached`, and shows a fixed kind message. The question is saved for the teacher, another approved item is offered, and no worked solution is given. Canned Input Screen replies and a first rephrase request do not count toward the 12.
- [ ] **Given** the session state machine (PRD section 8.5.1), **when** an event arrives that the transition table does not list for the current state, **then** it is rejected and audited. The table-driven tests cover every row.

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
