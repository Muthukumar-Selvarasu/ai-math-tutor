# ISSUE-028-STU-16: Update the learner model on the turn

- **Story ID**: STU-16
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#664](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/664)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** my mastery to update when the turn is saved, **so that** the next question can use this attempt and not wait for the hourly rollup.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Update the learner model on the turn" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-08, Section 22.1 (#21)
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: This is P0 because STU-06, STU-09, and EDU-01 depend on it. The deltas are ratified in Section 22.1 (#21).
- **Success Metric**: The next request after a persisted turn sees the new mastery

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The student dashboard (STU-07)

### Preconditions & Dependencies
- [x] Dependencies: Verifier
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a counted success at hint level 0, **when** the turn is persisted, **then** mastery increases by `0.15` and does not exceed `1.0`.
- [x] **Given** a counted success only after hint level 1, 2, or 3, **when** the turn is persisted, **then** mastery increases by `0.05`.
- [x] **Given** completion only at hint level 4 or 5, **when** the turn is persisted, **then** mastery does not increase.
- [x] **Given** a successful transfer, **when** the turn is persisted, **then** confidence increases by `0.20` and does not exceed `1.0`. Without one, confidence is not increased.
- [x] **Given** the last 3 counted attempts on the skill conflict, **when** the turn is persisted, **then** confidence decreases by `0.10` and does not fall below `0`.
- [x] **Given** the turn is persisted, **when** the next practice item is chosen, **then** it uses this write. Cohort aggregates may stay up to one hour old.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding for STU-16 turn-time mastery rules.
- [x] Step 2: Implementation of core logic: level 0 (+0.15), level 1-3 (+0.05), level 4-5 (+0), transfer confidence (+0.20), conflict penalty (-0.10, floor 0), and getters `getSkillState` / `getAllSkillStatesForStudent` in `lib/learner-model.js`.
- [x] Step 3: Verification against acceptance criteria and regression suite via `tests/e2e/stu-16-learner-model.spec.ts`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Verified STU-16 rules in `lib/learner-model.js`. Updated conflict detection to properly account for `partially_correct` attempts alongside `incorrect`. Exported `getSkillState` and `getAllSkillStatesForStudent`. Created `tests/e2e/stu-16-learner-model.spec.ts` covering all 6 Given/When/Then criteria plus non-shaming language invariant. All 7 tests passed cleanly, and full regression suite (135 tests) passed.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-16-learner-model.spec.ts`
- [x] Regression Suite: `npx playwright test` (135 tests passing)
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 7 tests using 1 worker

  ✓  1 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:20:7 › STU-16: Update the learner model on the turn › Criterion 1: Counted success at hint level 0 increases mastery by 0.15 (capped at 1.0) (2ms)
  ✓  2 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:54:7 › STU-16: Update the learner model on the turn › Criterion 2: Counted success after hint level 1, 2, or 3 increases mastery by 0.05 (0ms)
  ✓  3 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:85:7 › STU-16: Update the learner model on the turn › Criterion 3: Completion only at hint level 4 or 5 does not increase mastery (0ms)
  ✓  4 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:121:7 › STU-16: Update the learner model on the turn › Criterion 4: Successful transfer raises confidence by +0.20 (capped at 1.0); without one, confidence is not increased (1ms)
  ✓  5 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:169:7 › STU-16: Update the learner model on the turn › Criterion 5: Conflict rule — last 3 counted attempts conflict reduces confidence by -0.10 (floor 0) (0ms)
  ✓  6 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:240:7 › STU-16: Update the learner model on the turn › Criterion 6: Next practice item uses this turn write immediately; cohort aggregates may stay up to one hour old (729ms)
  ✓  7 [chromium] › tests/e2e/stu-16-learner-model.spec.ts:304:7 › STU-16: Update the learner model on the turn › Language and Invariant: Progress language is encouraging and non-shaming (5ms)

  7 passed (3.4s)
```

### Acceptance Criteria Verification
- [x] Criterion 1 verified: L0 counted success increases mastery by +0.15, capped at 1.0.
- [x] Criterion 2 verified: L1-3 counted success increases mastery by +0.05.
- [x] Criterion 3 verified: L4-5 completion adds +0 mastery.
- [x] Criterion 4 verified: Successful transfer raises confidence by +0.20, capped at 1.0; no increase without transfer success.
- [x] Criterion 5 verified: Conflicting attempts in last 3 reduce confidence by -0.10, floor 0.
- [x] Criterion 6 verified: Next practice item uses the turn-time write immediately; cohort rollup timestamp preserved.

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
STU-16 learner model turn-time updating delivered and verified. All acceptance criteria and language invariants confirmed passing.
