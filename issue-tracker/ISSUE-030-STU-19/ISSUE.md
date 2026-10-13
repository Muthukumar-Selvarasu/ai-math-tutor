# ISSUE-030-STU-19: Estimate understanding from this turn

- **Story ID**: STU-19
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#666](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/666)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** the tutor's next prompt to use an estimate of my understanding, **so that** the question matches this attempt rather than a general lecture.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Estimate understanding from this turn" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Section 9
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: This is pipeline step 5 (`StudentStateEstimator`, deterministic, followed by the conditional `MisconceptionClassifierAgent`) in Section 9 and AGENTS.md.
- **Success Metric**: Every tutoring turn stores a schema-valid student-state record

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The mastery numbers (STU-16)

### Preconditions & Dependencies
- [x] Dependencies: STU-03
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a turn reaches the student-state step, **when** the `StudentStateEstimator` runs, **then** it returns schema-valid features (`repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`) computed from this session's prior persisted results, and the turn stores them.
- [x] **Given** the estimator, **when** it runs, **then** it makes no model call and reads no free text and no accepted answer. The hint policy turns its features into `tone` in `hint_decision`, which the Dialogue Agent may read.

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
  - Create `lib/student-state-estimator.js` (AG-05) adhering to deterministic boundaries (no LLM, no free text, no accepted answer, only prior persisted results and hint levels).
  - Compute `repeated_wrong_value`, `consecutive_unsuccessful`, and `previous_progress`.
  - Implement hint policy tone derivation from student state (`neutral`, `encouraging`, `patient`, `supportive`).
  - Wire `StudentStateEstimator` into `session-store.js` across tutoring turns (`submit`, `not_sure`, `show_solution`, reflection).
  - Persist `student_state` and `tone` in `tutor_turn` and session state.
  - Expose badges in `app/practice/page.jsx` for visibility.
- [x] Step 3: Verification against acceptance criteria and regression suite.
  - Author comprehensive Playwright E2E test `tests/e2e/stu-19-student-state-estimator.spec.ts`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Stage 1 Pre-flight reviewed and signed off. Moving to Stage 2 Execution.
- `2026-10-13`: Implemented deterministic `StudentStateEstimator` AG-05 in `lib/student-state-estimator.js`. Computed `repeated_wrong_value`, `consecutive_unsuccessful`, and `previous_progress`. Implemented tone selection (`neutral`, `encouraging`, `patient`, `supportive`). Integrated into `lib/session-store.js` across session lifecycle turns and exposed UI meta badges in `app/practice/page.jsx`. Authored and validated 5/5 Playwright tests in `tests/e2e/stu-19-student-state-estimator.spec.ts`. All 100 E2E tests passing.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e` (100 passed)
- [x] Functional / E2E: `npx playwright test tests/e2e/stu-19-student-state-estimator.spec.ts` (5 passed)

### Verification Evidence & Results
```text
Running 5 tests using 1 worker

     1 … stores schema-valid student_state computed from prior persisted results
  ✓  1 …schema-valid student_state computed from prior persisted results (913ms)
     2 …Repeated wrong value triggers repeated_wrong_value=true and patient tone
  ✓  2 …d wrong value triggers repeated_wrong_value=true and patient tone (34ms)
     3 … progress sets previous_progress (advancing / stalled) and resets streak
  ✓  3 …ss sets previous_progress (advancing / stalled) and resets streak (44ms)
     4 …how solution" compute student_state deterministically with no model call
  ✓  4 …ution" compute student_state deterministically with no model call (41ms)
     5 …n: Practice page renders tone and student state badges in tutor meta row
  ✓  5 …tice page renders tone and student state badges in tutor meta row (3.3s)
  5 passed (6.4s)

Full regression suite:
  100 passed (42.0s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - Criterion 1 Verified: Every tutoring turn stores schema-valid student_state (`repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`) computed from this session's prior persisted results.
  - Criterion 2 Verified: AG-05 makes no model call and reads no free text and no accepted answer. Hint policy derives tone (`neutral`, `encouraging`, `patient`, `supportive`) deterministically and exposes it to the Dialogue Agent.

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
STU-19 implemented and verified. Deterministic `StudentStateEstimator` (AG-05) accurately computes attempt-history features (`repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`) strictly from prior persisted results, deriving tone without LLM calls and adhering strictly to PRD §9.3/§9.4 and SPEC WF-08. All 5 dedicated E2E tests and all 100 project tests pass cleanly.
