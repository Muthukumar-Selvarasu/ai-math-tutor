# ISSUE-009-EDU-01: See students needing review

- **Story ID**: EDU-01
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#645](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/645)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to see which students need review, **so that** I spend my time where it matters most.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See students needing review" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-12
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Loads in under 3 seconds for 150 synthetic students
- **Success Metric**: Teacher review time per flagged student (measured in pilot)

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Automated notifications to parents or students

### Preconditions & Dependencies
- [x] Dependencies: Learner model, cohort assignment
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** at least 3 relevant attempts and any flag rule in PRD section 22.1, **when** the teacher opens the list, **then** the students are ordered with the matching reason shown. This is not a leaderboard. The list is computed from persisted attempts, not from the hourly rollup.
- [x] **Given** fewer than 3 relevant attempts, **then** the row says "not enough evidence yet" and is not flagged.
- [x] **Given** the caller is a teacher, **then** only assigned students are listed.

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
- `2026-10-13`: Implemented `evaluateStudentReviewFlags` and `getStudentsNeedingReview` in `lib/student-review.js` evaluating section 22.1 #22 flag rules: same misconception 3 times on one skill, hint level 4/5 on 2 of last 5 attempts, and transfer incorrect/skipped twice.
- `2026-10-13`: Added API route `app/api/teacher/review-list/route.js` enforcing teacher/admin RBAC, scoping to assigned cohorts, and audit-logging unauthorized access.
- `2026-10-13`: Built interactive educator triage dashboard `app/teacher/review/page.jsx` with prominent non-leaderboard notice, status badges, filters, and drill-down links.
- `2026-10-13`: Added comprehensive E2E suite `tests/e2e/edu-01-students-review.spec.ts` validating all acceptance criteria, role restrictions, and performance (< 3s for 150 synthetic students).

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-01-students-review.spec.ts`
- [x] Typecheck / Linter: `npm run lint` / typecheck
- [x] Functional / E2E: `npm run test:e2e` (205/205 passing)

### Verification Evidence & Results
```text
Running 8 tests using 1 worker
  ✓ 1 AC 1: Student with at least 3 attempts and same misconception 3 times on one skill is flagged with reason (547ms)
  ✓ 2 AC 1: Student with hint level 4 or 5 on 2 of the last 5 attempts is flagged (39ms)
  ✓ 3 AC 1: Student with transfer incorrect or skipped twice is flagged (38ms)
  ✓ 4 AC 2: Fewer than 3 relevant attempts says 'not enough evidence yet' and is NOT flagged (36ms)
  ✓ 5 AC 3: Only assigned students are listed; unassigned students or cohorts are excluded (83ms)
  ✓ 6 AC 3: Unauthorized roles (student, unauthenticated) are rejected and logged (52ms)
  ✓ 7 Non-functional requirement: computes review queue in under 3 seconds for 150 synthetic students (262ms)
  ✓ 8 UI: Teacher Review Queue page (/teacher/review) displays non-leaderboard notice, filters, and student rows (1.6s)

8 passed (5.2s)

Full E2E Suite:
205 passed (1.5m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 8/8 passing in `tests/e2e/edu-01-students-review.spec.ts`.

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
EDU-01 delivered with deterministic student review triage queue, PRD §22.1 #22 flag rules, "not enough evidence yet" threshold, strictly scoped teacher cohorts, non-leaderboard design, and verified < 3s performance for 150 synthetic students. Validated across 205 passing E2E tests.

