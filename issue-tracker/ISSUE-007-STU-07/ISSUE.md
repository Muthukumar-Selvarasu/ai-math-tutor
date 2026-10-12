# ISSUE-007-STU-07: See my progress

- **Story ID**: STU-07
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1, and still a launch requirement ([Section 21](#21-launch-criteria))]
- **Status**: Completed
- **GitHub Issue**: [#643](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/643)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to see my progress, **so that** I know what to practise next and can see I am improving.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See my progress" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-08, FR-11
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Accessible charts with text alternatives
- **Success Metric**: Baseline engagement measured; no target before pilot

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Leaderboards or peer comparison

### Preconditions & Dependencies
- [x] Dependencies: Learner model, `learner-rollup` job
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the student dashboard is opened, **then** it shows recent sessions, current skills, strengths, next focus areas, independent success, hint trend, transfer results, and the next practice item.
- [x] **Given** the hourly rollup has not run since the last session, **then** that saved session is still listed, the screen shows the rollup time, and aggregate mastery may be up to one hour old.
- [x] **Given** any dashboard text, **then** it does not say "weak", "failing", or "low ability", and it does not compare the student with others.
- [x] **Given** no completed sessions, **then** an empty state offers a first published question.
- [x] **Given** the caller is a student, **when** the dashboard loads, **then** only that student's data is returned. Mastery numbers come from STU-16.

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
- `2026-10-12`: Created `lib/learner-model.js`:
  - Implemented STU-16 mastery rules in `updateLearnerModel` (+0.15 for Level 0 success, +0.05 for Level 1-3 success, 0 for Level 4/5, +0.20 for transfer success, -0.10 for conflict among last 3 attempts).
  - Implemented `runLearnerRollup` computing hourly aggregates (`recent_accuracy`, `attempt_count`, `independent_success_rate`, `hint_dependency_profile`, `misconception_distribution`, `transfer_success_rate`).
  - Implemented deterministic Practice Planner `recommendNextPractice` along the curriculum graph.
  - Implemented `buildStudentDashboard` assembling `StudentDashboard` schema with recent sessions, current skills, strengths, next focus areas, and rollup freshness.
  - Implemented `validateDashboardLanguage` checking for forbidden deficit labels ("weak", "failing", "low ability") and peer comparisons.
- `2026-10-12`: Updated `lib/session-store.js`:
  - Integrated `student_id` and `mastery_estimate` persistence.
  - Integrated `updateLearnerModel` on turn completion.
  - Exported `getStudentDashboard`, `runRollup`, and `updateLearnerModel`.
- `2026-10-12`: Created API routes:
  - `app/api/me/dashboard/route.js`: Returns student dashboard adhering to SPEC §3.3.
  - `app/api/jobs/learner-rollup/route.js`: Protected cron route for hourly learner rollups.
- `2026-10-12`: Created UI:
  - `app/dashboard/page.jsx`: Accessible, rich student progress dashboard displaying all required sections, empty state, rollup indicator, and growth-oriented language.
  - Linked dashboard from HomePage (`app/page.jsx`) and Practice Mode header (`app/practice/page.jsx`).
- `2026-10-12`: Created `tests/e2e/stu-07-concept-connections-display.spec.ts` covering all 5 Given/When/Then criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e` (40/40 tests passing)
- [x] Typecheck / Linter / Build: `npm run build` (compiled cleanly)
- [x] Functional / E2E: Verification against all 5 acceptance criteria

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 40 tests using 7 workers

  ✓   1 tests/e2e/stu-02-hints.spec.ts:16:7 › STU-02: One focused hint at a time › advances hint levels sequentially without skipping (1.7s)
  ✓   2 tests/e2e/stu-02-hints.spec.ts:32:7 › STU-02: One focused hint at a time › maintains single-prompt invariant (no multi-question turns) (57ms)
  ✓   3 tests/e2e/stu-01-attempt.spec.ts:105:7 › STU-01: Attempt before guidance › Criterion 4: Submitting an attempt stores attempt number, hint level, duration, and records audit event (1.4s)
  ✓   4 tests/e2e/smoke.spec.ts:3:7 › Smoke Test Suite › should load the home page and render brand header (1.2s)
  ✓   5 tests/e2e/stu-01-attempt.spec.ts:4:7 › STU-01: Attempt before guidance › Criterion 1: Question opens in awaiting_first_attempt with level0_prompt and no hint (1.3s)
  ✓   6 tests/e2e/stu-01-attempt.spec.ts:85:7 › STU-01: Attempt before guidance › Criterion 3: "I am not sure" at Level 4 stays at Level 4 and never reaches Level 5 (1.6s)
  ✓   7 tests/e2e/stu-01-attempt.spec.ts:32:7 › STU-01: Attempt before guidance › Criterion 2: "I am not sure" in awaiting_first_attempt escalates level to 1, preserves attempt count at 0, and asks next probe (1.4s)
  ✓   8 tests/e2e/stu-02-hints.spec.ts:42:7 › STU-02: One focused hint at a time › respects Level 4 cap during regular practice and enables Show Solution at Level 4 (1.3s)
  ✓   9 tests/e2e/stu-02-hints.spec.ts:55:7 › STU-02: One focused hint at a time › resets hint level and history when moving to a new question (1.4s)
  ✓  10 tests/e2e/stu-03-reasoning.spec.ts:18:7 › STU-03: Submit working and selected reasoning options › renders step inputs alongside the final answer input (946ms)
  ✓  11 tests/e2e/stu-03-reasoning.spec.ts:27:7 › STU-03: Submit working and selected reasoning options › allows adding, filling, and removing structured steps (1.0s)
  ✓  12 tests/e2e/stu-03-reasoning.spec.ts:46:7 › STU-03: Submit working and selected reasoning options › allows selecting multiple reasoning options and submitting with attempt (942ms)
  ✓  13 tests/e2e/stu-03-reasoning.spec.ts:63:7 › STU-03: Submit working and selected reasoning options › submits working without final answer as non-substantive attempt (1.3s)
  ✓  14 tests/e2e/stu-03-reasoning.spec.ts:77:7 › STU-03: Submit working and selected reasoning options › scrubs PII from submitted working steps and reasoning notes (1.1s)
  ✓  15 tests/e2e/stu-04-feedback.spec.ts:17:7 › STU-04: Feedback on why my answer is incorrect › detects additive ratio misconception deterministically and responds with diagnostic probe (1.2s)
  ✓  16 tests/e2e/stu-02-hints.spec.ts:70:7 › STU-02: One focused hint at a time › handles empty and whitespace inputs gracefully without advancing hint (75ms)
  ✓  17 tests/e2e/stu-04-feedback.spec.ts:30:7 › STU-04: Feedback on why my answer is incorrect › maintains confidentiality of taxonomy codes, sound flags, and correct answers below Level 5 (1.2s)
  ✓  18 tests/e2e/stu-04-feedback.spec.ts:40:7 › STU-04: Feedback on why my answer is incorrect › provides structured hints without revealing final answers on general incorrect responses (1.1s)
  ✓  19 tests/e2e/stu-04-feedback.spec.ts:50:7 › STU-04: Feedback on why my answer is incorrect › isolates session context per turn and never leaks student identity in state (44ms)
  ✓  20 tests/e2e/stu-04-feedback.spec.ts:61:7 › STU-04: Feedback on why my answer is incorrect › records structured audit log with verifier outcome and prompt type (1.0s)
  ✓  21 tests/e2e/stu-05-summary-and-remediation.spec.ts:18:7 › STU-05: Full solution only after meaningful effort › AC1 & AC9: Denies Level 5 before all 4 conditions are met, audits denial, keeps hint level (1.3s)
  ✓  22 tests/e2e/stu-05-summary-and-remediation.spec.ts:34:7 › STU-05: Full solution only after meaningful effort › AC2, AC4, AC7: Renders full solution and offers transfer question when all 4 conditions met with allow_level_5=true (1.6s)
  ✓  23 tests/e2e/stu-05-summary-and-remediation.spec.ts:57:7 › STU-05: Full solution only after meaningful effort › AC3 & AC8: Structured fallback (worked example) when Level 4 + 3 attempts met but allow_level_5=false (1.7s)
  ✓  24 tests/e2e/stu-05-summary-and-remediation.spec.ts:78:7 › STU-05: Full solution only after meaningful effort › AC5: Blocks prompt injection in answer and notes via Input Screen (68ms)
  ✓  25 tests/e2e/stu-05-summary-and-remediation.spec.ts:98:7 › STU-05: Full solution only after meaningful effort › AC6: Deterministic leakage checker blocks intermediate and final values unless exempt (2ms)
  ✓  26 tests/e2e/stu-05-summary-and-remediation.spec.ts:162:7 › STU-05: Full solution only after meaningful effort › AC10: Deterministic leakage check overrides Safety Guard allow if candidate contains blocked value (21ms)
  ✓  27 tests/e2e/stu-06-concept-connections.spec.ts:8:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 1 & 7: Correct answer enters reflection with verified student value in template, structured options + skip, no hint decision, and offers approved transfer partner (1.3s)
  ✓  28 tests/e2e/stu-06-concept-connections.spec.ts:51:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 8: Selecting reflection option or Skip stores choice and sound flag (visible to teacher/audit only), shows authored feedback, never shames, and moves to transfer_offered (1.2s)
  ✓  29 tests/e2e/stu-06-concept-connections.spec.ts:104:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 2: Transfer question starts with level0_prompt, Level 0, no hint before first independent attempt, and show_solution is excluded (1.3s)
  ✓  30 tests/e2e/stu-06-concept-connections.spec.ts:145:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 3: Transfer outcomes: correct (+0.20 confidence), declined/skipped (no confidence raise), and incorrect after struggle (201ms)
  ✓  31 tests/e2e/stu-06-concept-connections.spec.ts:192:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 4: Skill graph rejects items needing untaught skill, matching accepted value, or matching simplified ratio (1ms)
  ✓  32 tests/e2e/stu-06-concept-connections.spec.ts:241:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 5: Skill graph with no legal partner records no_legal_transfer, canned notice, and invents no item (65ms)
  ✓  33 tests/e2e/stu-06-concept-connections.spec.ts:265:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 6: Content validation fails an approved item with no legal transfer partner (Rule V8) (1ms)
  ✓  34 tests/e2e/stu-06-concept-connections.spec.ts:279:7 › STU-06: Test understanding with a similar question (Concept Connections) › Criterion 9: Content validation rejects reflection block breaking Rule V9 (prompt template, options count, sound true, taxonomy phrasing) (1ms)
  ✓  35 tests/e2e/stu-07-concept-connections-display.spec.ts:14:7 › STU-07: See my progress (Student Dashboard) › Criterion 4: Empty state offers first published question when no completed sessions exist (943ms)
  ✓  36 tests/e2e/stu-07-concept-connections-display.spec.ts:35:7 › STU-07: See my progress (Student Dashboard) › Criterion 1: Dashboard shows recent sessions, current skills, strengths, next focus, independent success, hint trend, transfer results, and next practice item (858ms)
  ✓  37 tests/e2e/stu-07-concept-connections-display.spec.ts:109:7 › STU-07: See my progress (Student Dashboard) › Criterion 2: Newly saved session is listed immediately even when hourly rollup has not run since the session (1.4s)
  ✓  38 tests/e2e/stu-07-concept-connections-display.spec.ts:138:7 › STU-07: See my progress (Student Dashboard) › Criterion 3: Dashboard text never says "weak", "failing", or "low ability", and never compares the student with others (1.0s)
  ✓  39 tests/e2e/stu-07-concept-connections-display.spec.ts:169:7 › STU-07: See my progress (Student Dashboard) › Criterion 5: Caller isolation — only that student's data is returned, and mastery numbers follow STU-16 rules (6ms)
  ✓  40 tests/e2e/stu-07-concept-connections-display.spec.ts:213:7 › STU-07: See my progress (Student Dashboard) › STU-16 Mastery & Confidence rules: Transfer raises confidence (+0.20), conflict reduces confidence (-0.10) (0ms)

40 passed (6.3s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 5/5 passing in Playwright test suite

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
Story STU-07 ("See my progress") successfully delivered:
- Implemented `lib/learner-model.js` providing:
  - STU-16 turn-time mastery rules (`updateLearnerModel`) with level-dependent mastery increases (+0.15 for Level 0, +0.05 for Level 1-3), transfer confidence increase (+0.20), and 3-attempt conflict reductions (-0.10).
  - Hourly background rollup (`runLearnerRollup`) computing independent success rate, recent accuracy, hint dependency profile, misconception distribution, and transfer results.
  - Practice Planner recommendation engine (`recommendNextPractice`) along the curriculum graph.
  - Complete `StudentDashboard` schema generator (`buildStudentDashboard`).
  - Strict language and privacy validator (`validateDashboardLanguage`) preventing deficit words ("weak", "failing", "low ability") and peer comparisons.
- Implemented API endpoints: `GET /api/me/dashboard` and `GET /api/jobs/learner-rollup`.
- Implemented Student Dashboard UI in `app/dashboard/page.jsx` with empty state, next practice recommendation, metrics cards, strengths, next focus, curriculum skills, recent sessions, and rollup timestamp.
- Verified all 5 Given/When/Then acceptance criteria across 40 passing tests in Playwright test suite with 0 regressions.

