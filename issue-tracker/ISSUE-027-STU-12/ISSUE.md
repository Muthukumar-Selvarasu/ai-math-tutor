# ISSUE-027-STU-12: Leave and resume a session

- **Story ID**: STU-12
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#663](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/663)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
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
- [x] Dependencies: Session state
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the student leaves a session, **when** they return, **then** the same question, attempts, and hint level are restored.
- [x] **Given** the client sends an idempotency key, **when** the same key is retried, **then** the server returns the stored result and does not create a second attempt.
- [x] **Given** the attempt row is persisted and the tutor turn is not, **when** the same idempotency key is retried, **then** the server completes or returns that attempt and does not increment the attempt count.
- [x] **Given** the function times out after the turn is persisted, **when** the student retries, **then** they see that persisted turn and not a second tutor question. The session summary and the stuck flag are STU-18.
- [x] **Given** the client sends an event the state machine does not allow (for example "Show me the solution" in `awaiting_first_attempt`, `reflection` or `transfer_active`), **when** the server handles it, **then** it returns 409 `transition_not_allowed` in the error payload of PRD section 15.9, changes nothing, and writes an audit event. The client does not show that control in those states.
- [x] **Given** the same `Idempotency-Key` with a different request body, or on a different session, **then** the server returns 409 `idempotency_conflict`. While the first request is still running, the same key returns 409 `request_in_progress` with `retry_after_s=3`.
- [x] **Given** any non-2xx response, **then** it uses the single error payload of PRD section 15.9, and the contract tests (TECH-56) fail if the OpenAPI document and the web types drift from the Pydantic models.
- [x] **Given** `POST /api/sessions` or `GET /api/sessions/{id}`, **then** the `SessionView` holds the `SessionState`, a `QuestionView` with exactly `question_id`, `version`, `stem`, `answer_type`, `unit`, `answer_requires_unit`, `reasoning_options` (id and label) and `has_diagram`, and the current `TutorTurn`. It never holds the accepted-answer spec, solution steps, probe expected values, predictions, leak patterns, reflection `sound` flags or the isomorphic example.
- [x] **Given** the item has a diagram and the current level allows one, **when** the student calls `GET /api/sessions/{id}/diagram`, **then** it returns the SVG validated for that level with `Content-Security-Policy: default-src 'none'`. **Given** the item has no diagram, the level allows none, or the session is another student's, **then** it returns 404 `not_found`.
- [x] **Given** a note arrives in any state, including a terminal one, **then** it is Input-Screened, stored in `student_note` with `state_at_save`, answered with the canned `note_ack` (or the Input Screen reply), and is not a pipeline turn.
- [x] **Given** the controls-by-state table in PRD section 8.5.1, **then** the client shows exactly the listed controls for each state, and `tutor.controls` in the response is the source.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding.
- [x] Step 2: Implementation of core logic, state transitions, or UI components.
- [x] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented STU-12 session resumption, idempotency store & collision/in-progress guards, PRD §15.9 unified error response payload helper, strict transition validation with audit logging, QuestionView reflection/sound flag stripping, student-scoped diagram endpoint with CSP default-src 'none', note storage across all states with note_ack, and UI dynamic controls driven by tutor.controls. Authored 11-criterion Playwright E2E test suite in `tests/e2e/stu-12-session-resume.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-12-session-resume.spec.ts` (11 passed)
- [x] Full Regression Suite: `npm run test:e2e` (90 passed)
- [x] Functional / E2E: Verification against all 11 acceptance criteria

### Verification Evidence & Results
```text
Running 11 tests using 1 worker

  ✓   1 Criterion 1: Given the student leaves a session, when they return, then the same question, attempts, and hint level are restored (2.4s)
  ✓   2 Criterion 2: Given the client sends an idempotency key, when the same key is retried, then server returns stored result and does not create a second attempt (48ms)
  ✓   3 Criterion 3: Given attempt row persisted and tutor turn is not, when retried with same key, completes or returns attempt without incrementing attempt count (47ms)
  ✓   4 Criterion 4: Given function times out after turn persisted, when retried, student sees persisted turn and not a second tutor question (42ms)
  ✓   5 Criterion 5: Given disallowed state event, returns 409 transition_not_allowed in PRD 15.9 error payload and writes audit event (703ms)
  ✓   6 Criterion 6: Given same key with different body/session returns 409 idempotency_conflict; in-progress returns 409 request_in_progress (63ms)
  ✓   7 Criterion 7: Any non-2xx response uses the single error payload of PRD section 15.9 (40ms)
  ✓   8 Criterion 8: POST/GET /api/sessions/:id holds SessionState, QuestionView without solution leaks, and TutorTurn (18ms)
  ✓   9 Criterion 9: Diagram returns SVG with CSP none when level allows; returns 404 when disallowed or wrong student (501ms)
  ✓  10 Criterion 10: Note in any state stored in student_note with state_at_save, answered with note_ack, not a pipeline turn (64ms)
  ✓  11 Criterion 11: Client controls-by-state table matches PRD 8.5.1 and tutor.controls is source of client controls (689ms)

11 passed (6.9s)

Full regression suite:
90 passed (39.5s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 11 / 11 PASSED

---

## 4. Closure

### Definition of Done (DoD) Sign-off Checklist
- [x] All Pre-flight acceptance criteria verified
- [x] Execution plan completed
- [x] Automated test suite passed with evidence logged
- [x] Regressions / leakage / security gates checked where applicable
- [x] Local `ISSUE.md` marked `Status: Completed`
- [x] Master `issue-tracker/TRACKER.md` updated and marked `Completed`
- [x] GitHub Issue closed via `gh issue close` (ONLY after local files are updated)

### Closure Summary
Completed implementation of STU-12: Leave and resume a session.
- Session resumption via GET /api/sessions/{id} and query param `?sessionId={id}`.
- Idempotency replay with `Idempotent-Replay: true` header, conflict detection (`idempotency_conflict`), and in-progress retry-after handling (`request_in_progress`, retry_after_s=3).
- Turn timeout & crash recovery preserving attempt count without double penalty.
- Strict transition legality checks returning PRD §15.9 409 `transition_not_allowed` error payloads with audit logging.
- QuestionView sanitisation eliminating solution, reflection sound flags, and probe leaks.
- Student-isolated diagram route with `Content-Security-Policy: default-src 'none'`.
- Input-screened notes supported in all states with `note_ack` response.
- UI action controls strictly driven by `tutor.controls` according to PRD §8.5.1 state matrix.
- All 11 acceptance criteria verified with automated Playwright tests in `tests/e2e/stu-12-session-resume.spec.ts`.
