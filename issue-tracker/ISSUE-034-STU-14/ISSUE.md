# ISSUE-034-STU-14: Show a wait while the turn is checked

- **Story ID**: STU-14
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#670](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/670)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** a clear wait while my answer is checked, **so that** a silent screen does not look frozen.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Show a wait while the turn is checked" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Section 11.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The 5-second figure remains a target. The CI gate is 8 seconds.
- **Success Metric**: Tutor-turn p95 under 8 seconds, with a visible wait

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Streaming an unreviewed draft, and showing the verifier verdict (correct or incorrect) before the turn is approved

### Preconditions & Dependencies
- [x] Dependencies: STU-13
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a turn is not yet allowed, leak-checked, and persisted, **when** the student is waiting, **then** they see a loading state and no tutor tokens.
- [x] **Given** the pipeline uses the 7.5 s hard stop (p95 assertion under 8 s), including one safety retry, **when** the wait exceeds a moment, **then** the loading state stays visible until the allowed turn or the fallback arrives.
- [x] **Given** the student submits an answer, **when** the request is sent, **then** their own answer appears in the conversation immediately (before any server response), and the input is disabled to prevent a double submit.
- [x] **Given** the loading state has been visible for more than 1 second, **when** the wait continues, **then** it shows a friendly, child-appropriate message (for example "Thinking about your answer…"). After 4 seconds it adds a reassurance line (for example "Still working, nearly there"). Neither message contains model-generated or tutor text.
- [x] **Given** the verifier result is back before the turn is approved, **when** the loading state is visible, **then** the UI may show only a fixed, non-solution status such as "Checking your answer…", sent as a separate server event that carries no verdict, value, or model text.
- [x] **Given** the loading state is visible, **then** it is announced to screen readers (`aria-live="polite"`) and does not rely on colour or animation alone.
- [x] **Given** the client request timeout of 15 seconds passes with no response (timers start once the request is dispatched), or the server answers 409 `request_in_progress`, **when** the client waits 3 seconds (`retry_after_s=3`) and retries once with the same idempotency key and still receives nothing, **then** the student sees the deterministic fallback and the loading state ends. The client never sends a different key for the same answer.
- [x] **Given** the optional progress stream is open, **then** it carries only the stage names `checking`, `preparing` and `done`, never a verdict, a value or model text. **Given** it is unavailable, **then** the timed wait messages still show.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding.
- [x] Step 2: Implementation of core logic, state transitions, or UI components (waiting indicator, optimistic echo, disabled controls, retry with idempotency key, fallback delivery).
- [x] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `turn-waiting-indicator` in `app/practice/page.jsx` and styling in `app/globals.css`. Configured `aria-busy="true"`, `aria-live="polite"`, `role="status"`, animated CSS spinner, and screen-reader announcement (`.sr-only`).
- `2026-10-13`: Implemented immediate optimistic student answer echo in conversation with `optimisticAttempt` and disabled inputs/submit buttons during verification to prevent double submit.
- `2026-10-13`: Implemented timed child-appropriate wait messages: <1s "Checking your answer…", >1s "Thinking about your answer…", >4s "Still working, nearly there" with zero model or tutor text.
- `2026-10-13`: Created SSE progress endpoint `/api/sessions/[id]/progress/route.js` carrying strictly stage names (`checking`, `preparing`, `done`) without verdict, student value, or model text.
- `2026-10-13`: Implemented client timeout (15s) and 409 `request_in_progress` handling in `handleSubmit` with 3-second retry reusing the exact same `Idempotency-Key`, falling back cleanly to deterministic fallback prompt when retries are exhausted.
- `2026-10-13`: Added comprehensive E2E test suite `tests/e2e/stu-14-turn-waiting-indicator.spec.ts` covering all criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e`
- [x] Functional / E2E: Verification against acceptance criteria in `tests/e2e/stu-14-turn-waiting-indicator.spec.ts`

### Verification Evidence & Results
```text
$ npm run test:e2e

Running 121 tests using 1 worker
...
  ✓  105 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:5:7 › STU-14: Show a wait while the turn is checked › Criterion 1 & 2: While waiting, student sees loading state with aria-busy and no unapproved tutor tokens until turn arrives (1.5s)
  ✓  106 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:46:7 › STU-14: Show a wait while the turn is checked › Criterion 3: Student answer is echoed immediately in conversation and inputs are disabled to prevent double submit (2.0s)
  ✓  107 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:88:7 › STU-14: Show a wait while the turn is checked › Criterion 4: Timed child-appropriate wait messages (>1s thinking, >4s reassurance without model text) (5.6s)
  ✓  108 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:133:7 › STU-14: Show a wait while the turn is checked › Criterion 5 & 8: Progress stream carries only checking, preparing, done and never verdict, value or model text (562ms)
  ✓  109 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:163:7 › STU-14: Show a wait while the turn is checked › Criterion 6: Loading state is accessible with screen-reader announcement and does not rely on color/animation alone (709ms)
  ✓  110 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:200:7 › STU-14: Show a wait while the turn is checked › Criterion 7a & 7b: 409 request_in_progress triggers 3s retry with same idempotency key; failure delivers deterministic fallback (1.0s)
  ✓  111 [chromium] › tests/e2e/stu-14-turn-waiting-indicator.spec.ts:246:7 › STU-14: Show a wait while the turn is checked › Criterion 7c: Client request timeout (15s) retries once with same key; exhaustion delivers deterministic fallback (1.4s)
...
  ✓  121 [chromium] › tests/e2e/stu-19-estimate-understanding.spec.ts:182:7 › STU-19: Estimate understanding from this turn › Criterion 5: Practice page renders tone and student state badges in tutor meta row (1.8s)

  121 passed (1.0m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 8 acceptance criteria verified across 7 targeted test cases, 121 total test cases passing with zero regressions.

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
STU-14 completed. When an answer is submitted, the student's answer is echoed immediately in the conversation, inputs and submit buttons are disabled to prevent double submit, and an accessible waiting indicator (`turn-waiting-indicator`, `aria-busy="true"`, `aria-live="polite"`, `role="status"`, `.sr-only` announcement) is rendered. It displays timed child-appropriate messages ("Checking your answer…", "Thinking about your answer…", "Still working, nearly there") without exposing unapproved tutor tokens or model text. Idempotent retries handle 409 `request_in_progress` and client timeouts, falling back gracefully to deterministic prompts upon exhaustion. Verified with full E2E test suite (121/121 passing).
