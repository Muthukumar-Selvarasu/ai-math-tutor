# ISSUE-013-EDU-05: Group students with similar needs

- **Story ID**: EDU-05
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#649](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/649)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** students grouped by skill and misconception pattern, **so that** I can plan small-group activities efficiently.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Group students with similar needs" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-12, Section 13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Groups are recomputed by background job, not per page load
- **Success Metric**: Teacher-rated usefulness in pilot feedback

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Automatic scheduling of group sessions

### Preconditions & Dependencies
- [x] Dependencies: Misconception events, `learner-rollup` job
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the groups view, **then** each group shows skill, misconception pattern, student count, attempt count, and confidence.
- [x] **Given** very little evidence, **then** the group shows an evidence-limit warning.
- [x] **Given** the caller is a teacher, **then** groups contain only assigned students.

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
- `2026-10-13`: Implemented `lib/student-grouping.js` clustering attempts into skill and misconception patterns with confidence scoring and evidence-limit warning banners.
- `2026-10-13`: Created `app/api/teacher/student-groups/route.js` scoped strictly to teacher's assigned cohort students with audit event on unauthorized access.
- `2026-10-13`: Created `app/teacher/groups/page.jsx` with responsive UI cards, evidence-limit warnings, confidence badges, student badges, and filter tabs.
- `2026-10-13`: Implemented `tests/e2e/edu-05-student-grouping.spec.ts` covering all ACs and verified against entire E2E test suite.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: Playwright E2E suite
- [x] Functional / E2E: Verification against acceptance criteria (`npm run test:e2e`)

### Verification Evidence & Results
```text
Running 210 tests using 1 worker
  210 passed (1.5m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: All 5 EDU-05 test scenarios pass and full suite of 210 tests pass without regression.

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
Implemented small-group student intervention clustering (`lib/student-grouping.js`), API endpoint (`/api/teacher/student-groups`), UI page (`/teacher/groups`), and comprehensive Playwright test suite (`tests/e2e/edu-05-student-grouping.spec.ts`). Validated against full test suite with 210 tests passing.
