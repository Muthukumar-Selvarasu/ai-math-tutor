# ISSUE-029-STU-18: Close a session with a summary and a stuck flag

- **Story ID**: STU-18
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#665](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/665)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
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
- [x] Dependencies: STU-12, STU-06
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the transfer item is at hint level 4, has at least 3 counted attempts, and the latest status is `incorrect` or `partially_correct`, **when** the session is saved, **then** it records `stuck_after_transfer`, the student is told their teacher will look at it, and the tutor does not open a worked solution.
- [x] **Given** the transfer result is recorded, the transfer is declined, or 30 minutes pass with no request, **when** that happens, **then** the session ends as `completed`, `declined`, or `abandoned`. Resume after `abandoned` starts a new session.
- [x] **Given** a session ends, **when** it is saved, **then** a summary stores the verifier outcomes, hint levels, and transfer result.
- [x] **Given** the 12th pipeline turn on an item passes without a `correct`, **when** the turn is saved, **then** the session is `stuck`, records `turn_cap_reached`, and shows a fixed kind message. The question is saved for the teacher, another approved item is offered, and no worked solution is given. Canned Input Screen replies and a first rephrase request do not count toward the 12.
- [x] **Given** the session state machine (PRD section 8.5.1), **when** an event arrives that the transition table does not list for the current state, **then** it is rejected and audited. The table-driven tests cover every row.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Implement 12-turn hard cap enforcement in `lib/session-store.js` (`turn_cap_reached` flag, fixed kind message `turn_cap_notice`, offer another approved item via `recommendNextQuestion`, no worked solution, excluding canned Input Screen replies and first rephrase request).
- [x] Step 2: Implement session summary generation and persistence (`generateSessionSummary`) on transition to any terminal state (`completed`, `declined`, `stuck`, `abandoned`), capturing verifier outcomes, hint levels, and transfer result.
- [x] Step 3: Implement `stuck_after_transfer` flag setting and transition to `completed` with `end_reason=stuck_after_transfer` and canned `transfer_stuck_notice` for transfer items at Level 4 with >= 3 counted attempts when latest status is `incorrect` or `partially_correct`.
- [x] Step 4: Implement 30-minute inactivity abandonment (lazy evaluation with `ended_at = last_activity_at + 30 min`, summary stored, transfer outcome marked `skipped`) and resume after abandoned starting a new session in Practice UI.
- [x] Step 5: Implement Session Summary display and "Next question" action in Practice UI (`app/practice/page.jsx`) when in terminal states.
- [x] Step 6: Authored Playwright E2E test suite in `tests/e2e/stu-18-session-summary-stuck.spec.ts` covering all 5 Given/When/Then acceptance criteria.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `generateSessionSummary`, 12-turn hard cap pipeline tracking, `stuck_after_transfer` detection on transfer items at level 4 with >= 3 attempts, 30-min idle abandonment with simulated idle support, Practice UI Session Summary component (`[data-testid="session-summary"]`) with Next Question navigation, and authored complete Playwright test suite `tests/e2e/stu-18-session-summary-stuck.spec.ts`. All 95 E2E tests passing cleanly.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-18-session-summary-stuck.spec.ts`
- [x] Functional / Full Regression: `npm run test:e2e` (95 passing tests)

### Verification Evidence & Results
```text
$ npx playwright test tests/e2e/stu-18-session-summary-stuck.spec.ts
Running 5 tests using 1 worker

  ✓ 1 Criterion 1: Transfer item at Level 4 with >= 3 attempts and incorrect/partially_correct records stuck_after_transfer, shows notice, and does not open solution (1.9s)
  ✓ 2 Criterion 2: Session ends as completed, declined, or abandoned; resume after abandoned starts a new session (755ms)
  ✓ 3 Criterion 3: Summary stores verifier outcomes, hint levels, and transfer result when session ends (614ms)
  ✓ 4 Criterion 4: 12th pipeline turn passes without correct -> stuck with turn_cap_reached, offers approved item, no solution (772ms)
  ✓ 5 Criterion 5: State machine rejects illegal transitions with 409 transition_not_allowed and writes audit events (1.0s)

5 passed (7.0s)

$ npm run test:e2e
Running 95 tests using 1 worker
...
  ✓ 91 Criterion 1: Transfer item at Level 4 with >= 3 attempts and incorrect/partially_correct records stuck_after_transfer, shows notice, and does not open solution
  ✓ 92 Criterion 2: Session ends as completed, declined, or abandoned; resume after abandoned starts a new session
  ✓ 93 Criterion 3: Summary stores verifier outcomes, hint levels, and transfer result when session ends
  ✓ 94 Criterion 4: 12th pipeline turn passes without correct -> stuck with turn_cap_reached, offers approved item, no solution
  ✓ 95 Criterion 5: State machine rejects illegal transitions with 409 transition_not_allowed and writes audit events

95 passed (38.6s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: PASS

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
STU-18 successfully implemented and validated across all 5 acceptance criteria:
1. Transfer items at Level 4 with >= 3 counted attempts and incorrect or partially_correct status end as `completed` with `end_reason: "stuck_after_transfer"`, set `stuck_after_transfer` flag, render canned teacher review notice (`transfer_stuck_notice`), and forbid worked solution. `cannot_verify` and `tool_failure` do not trigger the flag.
2. Sessions terminate cleanly as `completed`, `declined`, or `abandoned` (30 min inactivity). Resuming an abandoned session creates a fresh session.
3. Saved session summary stores verifier outcomes, hint levels, distinct hint levels, transfer result, attempt count, turns, and flags.
4. 12th pipeline turn without a correct answer transitions the session to `stuck` with `end_reason: "turn_cap_reached"`, sets `turn_cap_reached` flag, displays canned `turn_cap_notice`, bookmarks question for teacher, offers next approved question, and withholds worked solution. Canned Input Screen replies and first rephrase requests do not count.
5. Session state machine strictly validates transitions per PRD §8.5.1, rejecting illegal transitions with 409 `transition_not_allowed` and emitting audit rows. Full table-driven tests passed.
