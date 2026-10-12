# ISSUE-021-STU-09: Select or receive a recommended question

- **Story ID**: STU-09
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#657](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/657)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to select a published question or receive a recommended one, **so that** I practise an item that is approved and suited to my current skill.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Select or receive a recommended question" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-02, FR-08
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Question load under 2 seconds
- **Success Metric**: Zero unapproved questions delivered

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Student-authored questions

### Preconditions & Dependencies
- [x] Dependencies: Question publishing (ADM-04, Tier 1 slice, Section 6.7.1), learner model when history exists
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** I am signed in, **when** I open practice, **then** I can choose a published question or start the recommended next item.
- [x] **Given** a question is not approved and published, **when** I request it, **then** it is not delivered.
- [x] **Given** I have no history, **when** a recommendation is made, **then** it is an approved starting item and does not require an untaught skill.
- [x] **Given** I have history, **when** a recommendation is made, **then** the Practice Planner chooses a published item along a skill-graph `remediates` or `prerequisite` edge. Vector similarity does not make that choice.

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
- `2026-10-12`: Implemented SV-02 `PracticePlanner` engine in `lib/practice-planner.js` with deterministic skill graph (`ratio_simplifying`, `ratio_sharing`, `ratio_unitary`), `prerequisite` and `remediates` edges, tie-breaking alphabetically, zero vector similarity (SPEC WF-02, PRD FR-02).
- `2026-10-12`: Implemented `isQuestionApprovedAndPublished` enforcing approval and publication status, unflagged validation, and diagram variant checks. Added draft test question `docs/question-bank/ratio_draft_001.json` to verify non-delivery of unapproved items.
- `2026-10-12`: Updated API endpoints: `GET /api/questions` filters to approved published items; `GET /api/questions/[id]` returns 404 for unapproved/draft items; `POST /api/sessions` accepts `recommended: true` and logs `question_selection` audit events with `edge_type`.
- `2026-10-12`: Added AG-03 deterministic misconception matching in template mode for authored predicted responses (e.g. 57 -> `ratio_additive_interpretation`).
- `2026-10-12`: Enhanced `app/practice/page.jsx` with Question Selection Bar (`question-selection-bar`), dropdown list of published questions, "Start Selected" (`start-selected-btn`), "Start Recommended" (`start-recommended-btn`), recommendation badges, and error banners for unapproved items.
- `2026-10-12`: Authored Playwright E2E suite `tests/e2e/stu-09-question-selection.spec.ts` covering all 4 Acceptance Criteria (Criteria 1, 2, 3, 4A, 4B, 4C, 4D).

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-09-question-selection.spec.ts` (4 passed)
- [x] Full Regression Suite: `npm run test:e2e` (50 passed in 29.6s)
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 50 tests using 1 worker

  ✓   1 [STU-01] Question opens in awaiting_first_attempt with level0_prompt and no hint
  ✓   2 [STU-01] preserves attempt count at 0 on "I am not sure"
  ✓   3 [STU-01] "I am not sure" at Level 4 stays at Level 4 and never reaches Level 5
  ✓   4 [STU-01] Submit attempt stores attempt number, hint level, duration, and records audit event
  ✓   5 [STU-02] single_prompt checker passes valid prompts and fails multi-prompt sentences
  ...
  ✓  47 [STU-09] Criterion 1: Given signed in, when opening practice, can choose a published question or start the recommended next item (912ms)
  ✓  48 [STU-09] Criterion 2: Given not approved/published, when requested, then it is not delivered (404 and filtered out) (716ms)
  ✓  49 [STU-09] Criterion 3: Given no history, when recommendation made, then it is an approved starting item and does not require an untaught skill (10ms)
  ✓  50 [STU-09] Criterion 4: Given history, when recommendation made, then Practice Planner chooses along a skill-graph remediates or prerequisite edge (73ms)

50 passed (29.6s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 4 of 4 passed cleanly.

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
Story STU-09 has been fully implemented and verified against all 4 Given/When/Then acceptance criteria:
1. Student can choose an approved and published question or request the recommended next item from the Practice UI and API.
2. Unapproved, draft, or unvalidated questions (tested with `ratio_draft_001.json`) are blocked with 404 and filtered from published lists.
3. Students with no session history deterministically receive an approved starting question (`ratio_simp_001`) with zero untaught prerequisites.
4. Students with attempt history receive questions recommended along skill-graph `remediates` and `prerequisite` edges with deterministic alphabetical tie-breaking and zero vector similarity.
5. All 50 Playwright E2E tests pass with zero regressions. Single atomic commit authored and issue closed.
