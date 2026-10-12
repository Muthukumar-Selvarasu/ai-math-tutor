# ISSUE-036-EDU-12: See safety and stuck-session flags

- **Story ID**: EDU-12
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#672](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/672)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to see when a session fell back to the safe prompt, disclosed something worrying, or stayed stuck after transfer, **so that** a person sees the notice without the system making a safeguarding decision.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See safety and stuck-session flags" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, Sections 12.2 and 12.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The support contact is a cohort assignment, not a new role (FR-01).
- **Success Metric**: Each of the seven flags is visible to the assigned teacher

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Safeguarding decisions, parent messages, and the EDU-01 mastery flags

### Preconditions & Dependencies
- [ ] Dependencies: STU-10, STU-12, STU-13, ADM-01
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** an assigned student's session has `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached`, or `verification_unavailable`, **when** the teacher opens the review list or the replay, **then** the flag and its time are shown. It is a notice.
- [ ] **Given** no teacher is assigned, **when** the flag is `safety_fallback` or `worrying_disclosure`, **then** the cohort support contact sees the flag and the session id. Row-level security allows that user to read `session_flag` for their cohort and nothing else.
- [ ] **Given** the cohort has no teacher and no support contact, **when** the flag is stored, **then** a `trace_review` administrator sees it on the safety list.
- [ ] **Given** another user requests the flag, **when** authorisation runs, **then** it is denied and logged.

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
