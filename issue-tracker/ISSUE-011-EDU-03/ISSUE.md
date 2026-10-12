# ISSUE-011-EDU-03: Replay a tutoring session

- **Story ID**: EDU-03
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 1c: Replay & Human Oversight]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#647](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/647)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to replay a tutoring session, **so that** I can see how the student's reasoning developed without reading raw transcripts.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Replay a tutoring session" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Student data in traces is pseudonymised
- **Success Metric**: 100% of tutor turns are replayable

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Editing past session records

### Preconditions & Dependencies
- [ ] Dependencies: Persisted turns, audit events, Langfuse trace IDs
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Tier 1c.** **Given** the Release 1.0 demo, **when** the assigned teacher opens the golden session, **then** a read-only replay shows each turn and one pending draft recommendation with its evidence. Accept, reject, override, comments, and the cohort view are Release 1.1.
- [ ] **Given** a replay of an assigned student, **then** each turn shows question version, diagram version, response, verifier result, hint level, tutor output, misconception label, and learner-model change.
- [ ] **Given** a replay turn, **then** it also shows model name, model version, prompt version, policy version, teacher comments, teacher overrides, and audit timestamps.
- [ ] **Given** a replay turn whose chat body has been purged, **then** the teacher still sees verifier status, hint level, versions, and timestamps, plus a notice that the message body was removed.
- [ ] **Given** a teacher who is not assigned, **when** they request the replay, **then** access is denied and the denial is logged.
- [ ] **Given** an administrator holding `trace_review`, **when** they open the replay, **then** each turn links to its Langfuse trace while that trace is inside the 90-day window. After purge, the link is a retention notice. An administrator without that grant is denied the replay. A teacher without the grant does not receive the trace link. A tutor does not receive the replay.
- [ ] **Given** a misconception on the replay, **when** the assigned teacher sets reviewer status to confirmed or rejected, **then** it is stored. It starts as unreviewed. The student does not see it.

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
