# ISSUE-027-STU-12: Leave and resume a session

- **Story ID**: STU-12
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#663](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/663)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to leave and come back, **so that** a timeout does not wipe my attempt or count it twice.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Leave and resume a session" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-05, Section 11.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Session state is in Postgres before the response returns
- **Success Metric**: A resumed session shows the same question, hint level, and attempt count

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The session summary and `stuck_after_transfer` (STU-18). A second device editing the same turn at once.

### Preconditions & Dependencies
- [ ] Dependencies: Session state
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** the student leaves a session, **when** they return, **then** the same question, attempts, and hint level are restored.
- [ ] **Given** the client sends an idempotency key, **when** the same key is retried, **then** the server returns the stored result and does not create a second attempt.
- [ ] **Given** the attempt row is persisted and the tutor turn is not, **when** the same idempotency key is retried, **then** the server completes or returns that attempt and does not increment the attempt count.
- [ ] **Given** the function times out after the turn is persisted, **when** the student retries, **then** they see that persisted turn and not a second tutor question. The session summary and the stuck flag are STU-18.
- [ ] **Given** the client sends an event the state machine does not allow (for example "Show me the solution" in `awaiting_first_attempt`, `reflection` or `transfer_active`), **when** the server handles it, **then** it returns 409 `transition_not_allowed` in the error payload of PRD section 15.9, changes nothing, and writes an audit event. The client does not show that control in those states.
- [ ] **Given** the same `Idempotency-Key` with a different request body, or on a different session, **then** the server returns 409 `idempotency_conflict`. While the first request is still running, the same key returns 409 `request_in_progress` with `retry_after_s=3`.
- [ ] **Given** any non-2xx response, **then** it uses the single error payload of PRD section 15.9, and the contract tests (TECH-56) fail if the OpenAPI document and the web types drift from the Pydantic models.
- [ ] **Given** `POST /api/sessions` or `GET /api/sessions/{id}`, **then** the `SessionView` holds the `SessionState`, a `QuestionView` with exactly `question_id`, `version`, `stem`, `answer_type`, `unit`, `answer_requires_unit`, `reasoning_options` (id and label) and `has_diagram`, and the current `TutorTurn`. It never holds the accepted-answer spec, solution steps, probe expected values, predictions, leak patterns, reflection `sound` flags or the isomorphic example.
- [ ] **Given** the item has a diagram and the current level allows one, **when** the student calls `GET /api/sessions/{id}/diagram`, **then** it returns the SVG validated for that level with `Content-Security-Policy: default-src 'none'`. **Given** the item has no diagram, the level allows none, or the session is another student's, **then** it returns 404 `not_found`.
- [ ] **Given** a note arrives in any state, including a terminal one, **then** it is Input-Screened, stored in `student_note` with `state_at_save`, answered with the canned `note_ack` (or the Input Screen reply), and is not a pipeline turn.
- [ ] **Given** the controls-by-state table in PRD section 8.5.1, **then** the client shows exactly the listed controls for each state, and `tutor.controls` in the response is the source.

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
