# ISSUE-006-STU-06: Test understanding with a similar question

- **Story ID**: STU-06
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#642](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/642)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to try a similar question after finishing, **so that** I can check I can solve it without help.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Test understanding with a similar question" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-10
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Transfer item selection is deterministic: graph-legal shortlist, tie-break by pgvector similarity then lowest `question_id` (Tier 1b)
- **Success Metric**: At least 80% of completed sessions are followed by a transfer problem

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Student choice of transfer difficulty

### Preconditions & Dependencies
- [x] Dependencies: Question bank, skill graph (pgvector tie-break from Tier 1b), learner model
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a problem is completed, **then** a near-transfer question with different context or values is offered, and it is an approved published item.
- [x] **Given** the transfer question starts, **then** no hint is given before the first independent attempt.
- [x] **Given** the transfer is completed or declined, **then** the outcome is correct, incorrect, or skipped, and a skip does not raise learner confidence.
- [x] **Given** a shortlist (authored skill-graph partners at Tier 1a, with pgvector similarity as the tie-break from Tier 1b), **then** the skill graph rejects an item that needs a skill the student has not been taught, and it rejects an item whose accepted value or simplified ratio matches the completed item.
- [x] **Given** the skill graph has no legal partner, **then** the session records `no_legal_transfer` and no item is invented.
- [x] **Given** content validation of the published bank, **then** an approved item with no legal transfer partner fails validation.
- [x] **Given** the student solves the item, **when** the session enters `reflection`, **then** the item's authored `reflection` prompt is shown with the student's own verified value in place of `{student_value}`, with 3 or 4 structured options and Skip. No model, verifier or retrieval runs, and there is no `hint_decision`.
- [x] **Given** the student selects a reflection option or Skip, **then** the choice and its `sound` flag are stored (the flag is visible to the teacher only), the option's authored `feedback` is shown whatever its value, the student is never told they are wrong, and the session moves to `transfer_offered`.
- [x] **Given** an item whose `reflection` block breaks V9, **when** import validation runs, **then** the item is rejected.

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
- `2026-10-12`: Implemented `lib/transfer-selector.js`:
  - Implemented `selectTransferPartner` and `extractSimplifiedRatio`.
  - Filtered transfer candidates for approved/published status, identical learning objective, taught skill eligibility, differing canonical accepted values, and differing simplified ratios.
  - Deterministic tie-break at Tier 1a by lowest `question_id`.
- `2026-10-12`: Implemented `lib/content-validator.js`:
  - Rule V9 validation: checks `prompt_template` (<= 1 question mark, exactly one `{student_value}`), 3-4 options, at least one `sound: true`, plain language without taxonomy phrasing.
  - Rule V8 validation: verifies every approved/published question has a legal transfer partner in the bank.
- `2026-10-12`: Updated `lib/session-store.js`:
  - Correct final answer moves session to `reflection` with rendered `prompt_template` (`{student_value}` replaced by student's verified value), `hint_level: null`, `prompt_type: "reflection"`.
  - Structured options provided (sound flag stripped for student, visible to teacher/audit only) with Skip choice.
  - Added `handleReflectionChoiceEvent`: records reflection attempt with `sound` flag, displays authored feedback + transfer offer, transitions to `transfer_offered` (or `completed` with `no_legal_transfer` if no legal partner).
  - Added transfer execution handling: `accept` initializes linked transfer session with Level 0, `turn_cap: 12`, independent attempt prompt (`level0_prompt`), excludes `show_solution` (attempts throw 409 `transition_not_allowed`).
  - Added transfer outcomes: `correct` adds +0.20 to `mastery_confidence`; `skipped` (declined) leaves confidence unchanged; struggle (Level 4, >= 3 attempts, incorrect) marks `transfer_outcome: "incorrect"`, flags `stuck_after_transfer`, and displays canned `transfer_stuck_notice`.
- `2026-10-12`: Updated `app/practice/page.jsx`:
  - Rendered reflection options and Skip button in `reflection` state.
  - Added transfer outcome and confidence badges in header.
  - Enforced `show_solution` hidden in `transfer_active`.
- `2026-10-12`: Seeded question bank with published/approved status in `docs/question-bank/*.json`.
- `2026-10-12`: Created `tests/e2e/stu-06-concept-connections.spec.ts` covering all 9 acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e` (34/34 passed)
- [x] Typecheck / Linter / Build: `npm run build` (compiled successfully)
- [x] Functional / E2E: Verification against all 9 acceptance criteria

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 34 tests using 7 workers

  ✓  1 tests/e2e/stu-01-attempt.spec.ts:16:7 › STU-01: Attempt before guidance › displays question and input without revealing hint initially (1.8s)
  ✓  2 tests/e2e/stu-01-attempt.spec.ts:24:7 › STU-01: Attempt before guidance › shows substantive hint only after an attempt is submitted (1.8s)
  ✓  3 tests/e2e/stu-01-attempt.spec.ts:34:7 › STU-01: Attempt before guidance › tracks attempt history correctly across multiple submissions (1.8s)
  ✓  4 tests/e2e/stu-01-attempt.spec.ts:47:7 › STU-01: Attempt before guidance › distinguishes substantive from non-substantive attempts (2.1s)
  ✓  5 tests/e2e/stu-01-attempt.spec.ts:58:7 › STU-01: Attempt before guidance › persists attempt and updates session stats in local storage (47ms)
  ✓  6 tests/e2e/stu-02-hints.spec.ts:16:7 › STU-02: One focused hint at a time › advances hint levels sequentially without skipping (2.2s)
  ✓  7 tests/e2e/smoke.spec.ts:3:7 › Smoke Test Suite › should load the home page and render brand header (1.6s)
  ✓  8 tests/e2e/stu-02-hints.spec.ts:32:7 › STU-02: One focused hint at a time › maintains single-prompt invariant (no multi-question turns) (1.6s)
  ✓  9 tests/e2e/stu-02-hints.spec.ts:42:7 › STU-02: One focused hint at a time › respects Level 4 cap during regular practice and enables Show Solution at Level 4 (2.0s)
  ✓ 10 tests/e2e/stu-02-hints.spec.ts:55:7 › STU-02: One focused hint at a time › resets hint level and history when moving to a new question (1.4s)
  ✓ 11 tests/e2e/stu-02-hints.spec.ts:70:7 › STU-02: One focused hint at a time › handles empty and whitespace inputs gracefully without advancing hint (1.6s)
  ✓ 12 tests/e2e/stu-03-reasoning.spec.ts:18:7 › STU-03: Submit working and selected reasoning options › renders step inputs alongside the final answer input (1.8s)
  ✓ 13 tests/e2e/stu-03-reasoning.spec.ts:27:7 › STU-03: Submit working and selected reasoning options › allows adding, filling, and removing structured steps (1.8s)
  ✓ 14 tests/e2e/stu-03-reasoning.spec.ts:46:7 › STU-03: Submit working and selected reasoning options › allows selecting multiple reasoning options and submitting with attempt (2.0s)
  ✓ 15 tests/e2e/stu-03-reasoning.spec.ts:63:7 › STU-03: Submit working and selected reasoning options › submits working without final answer as non-substantive attempt (2.5s)
  ✓ 16 tests/e2e/stu-03-reasoning.spec.ts:77:7 › STU-03: Submit working and selected reasoning options › scrubs PII from submitted working steps and reasoning notes (29ms)
  ✓ 17 tests/e2e/stu-04-feedback.spec.ts:17:7 › STU-04: Feedback on why my answer is incorrect › detects additive ratio misconception deterministically and responds with diagnostic probe (2.1s)
  ✓ 18 tests/e2e/stu-04-feedback.spec.ts:30:7 › STU-04: Feedback on why my answer is incorrect › maintains confidentiality of taxonomy codes, sound flags, and correct answers below Level 5 (2.0s)
  ✓ 19 tests/e2e/stu-04-feedback.spec.ts:40:7 › STU-04: Feedback on why my answer is incorrect › provides structured hints without revealing final answers on general incorrect responses (30ms)
  ✓ 20 tests/e2e/stu-04-feedback.spec.ts:50:7 › STU-04: Feedback on why my answer is incorrect › isolates session context per turn and never leaks student identity in state (1.9s)
  ✓ 21 tests/e2e/stu-04-feedback.spec.ts:61:7 › STU-04: Feedback on why my answer is incorrect › records structured audit log with verifier outcome and prompt type (2.2s)
  ✓ 22 tests/e2e/stu-05-summary-and-remediation.spec.ts:18:7 › STU-05: Full solution only after meaningful effort › AC1 & AC9: Denies Level 5 before all 4 conditions are met, audits denial, keeps hint level (2.4s)
  ✓ 23 tests/e2e/stu-05-summary-and-remediation.spec.ts:34:7 › STU-05: Full solution only after meaningful effort › AC2, AC4, AC7: Renders full solution and offers transfer question when all 4 conditions met with allow_level_5=true (2.2s)
  ✓ 24 tests/e2e/stu-05-summary-and-remediation.spec.ts:57:7 › STU-05: Full solution only after meaningful effort › AC3 & AC8: Structured fallback (worked example) when Level 4 + 3 attempts met but allow_level_5=false (39ms)
  ✓ 25 tests/e2e/stu-05-summary-and-remediation.spec.ts:78:7 › STU-05: Full solution only after meaningful effort › AC5: Blocks prompt injection in answer and notes via Input Screen (1ms)
  ✓ 26 tests/e2e/stu-05-summary-and-remediation.spec.ts:98:7 › STU-05: Full solution only after meaningful effort › AC6: Deterministic leakage checker blocks intermediate and final values unless exempt (17ms)
  ✓ 27 tests/e2e/stu-06-concept-connections.spec.ts:8:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 1 & 7: Correct answer enters reflection with verified student value in template, structured options + skip, no hint decision, and offers approved transfer partner (1.3s)
  ✓ 28 tests/e2e/stu-06-concept-connections.spec.ts:51:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 8: Selecting reflection option or Skip stores choice and sound flag (visible to teacher/audit only), shows authored feedback, never shames, and moves to transfer_offered (1.8s)
  ✓ 29 tests/e2e/stu-06-concept-connections.spec.ts:104:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 2: Transfer question starts with level0_prompt, Level 0, no hint before first independent attempt, and show_solution is excluded (1.9s)
  ✓ 30 tests/e2e/stu-06-concept-connections.spec.ts:145:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 3: Transfer outcomes: correct (+0.20 confidence), declined/skipped (no confidence raise), and incorrect after struggle (165ms)
  ✓ 31 tests/e2e/stu-06-concept-connections.spec.ts:192:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 4: Skill graph rejects items needing untaught skill, matching accepted value, or matching simplified ratio (2ms)
  ✓ 32 tests/e2e/stu-06-concept-connections.spec.ts:241:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 5: Skill graph with no legal partner records no_legal_transfer, canned notice, and invents no item (29ms)
  ✓ 33 tests/e2e/stu-06-concept-connections.spec.ts:265:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 6: Content validation fails an approved item with no legal transfer partner (Rule V8) (0ms)
  ✓ 34 tests/e2e/stu-06-concept-connections.spec.ts:279:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 9: Content validation rejects reflection block breaking Rule V9 (prompt template, options count, sound true, taxonomy phrasing) (1ms)

34 passed (7.7s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 9/9 passing in Playwright test suite

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
Story STU-06 ("Test understanding with a similar question") successfully delivered:
- Implemented `lib/transfer-selector.js` providing deterministic partner selection (`selectTransferPartner`, `extractSimplifiedRatio`) with skill-graph legality filtering (published/approved items, matching learning objective, taught skill prerequisites, differing accepted values and simplified ratios, tie-break by lowest question ID).
- Implemented `lib/content-validator.js` with offline validation rules Rule V9 (reflection template and options structure, sound flag, taxonomy phrasing prevention) and Rule V8 (verifies every approved item has a legal transfer partner).
- Extended `lib/session-store.js` with reflection lifecycle transitions (`{student_value}` interpolation, sound flag stored for teachers only, prompt_type: "reflection", hint_level: null), `handleReflectionChoiceEvent`, and transfer session orchestration (Level 0, no hints before attempt, show_solution barred with 409 transition_not_allowed, correct +0.20 confidence, skip 0 confidence change, struggle marked with stuck_after_transfer and transfer_stuck_notice).
- Extended `app/practice/page.jsx` with reflection options, skip option, transfer offer controls, and transfer confidence/outcome status badges.
- Seeded question bank JSONs with approved and published status.
- Verified all 9 Given/When/Then acceptance criteria across 34 passing tests in Playwright E2E suite (`tests/e2e/stu-06-concept-connections.spec.ts` passing 8/8) with 0 regressions.
