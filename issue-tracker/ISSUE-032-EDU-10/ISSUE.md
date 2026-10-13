# ISSUE-032-EDU-10: See a cohort summary

- **Story ID**: EDU-10
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#668](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/668)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** academic coordinator, **I want** cohort summaries and the cohort support setting, **so that** I can see intervention themes and control whether level 5 is allowed.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See a cohort summary" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, FR-12, Section 22.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The summary loads in under 3 seconds for 150 synthetic students
- **Success Metric**: A coordinator can open an assigned cohort summary

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Per-student overrides and publishing

### Preconditions & Dependencies
- [x] Dependencies: ADM-01, learner rollup
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a coordinator opens an assigned cohort, **when** the summary loads, **then** they see cohort mastery, misconception trends, intervention insights, and item-quality indicators.
- [x] **Given** a recommendation was accepted, **when** a later transfer result exists for that skill, **then** the summary shows that outcome. If none exists yet, it says there is not enough later evidence.
- [x] **Given** a new cohort, **when** it is created, **then** `allow_level_5` is false by default until an assigned coordinator enables it.
- [x] **Given** a coordinator requests a student replay, **when** the request is made, **then** it is denied.
- [x] **Given** a coordinator changes `allow_level_5` for an assigned cohort, **when** the change is saved, **then** the value is stored, later level 5 decisions use it, and an audit event records who, when, the previous value, and the new value. A coordinator outside the cohort is denied.
- [x] **Given** a coordinator tries to override a student recommendation, publish a question, grant `trace_review`, or open a Langfuse trace, **when** the request is made, **then** it is denied.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`lib/cohort-summary.js`, `lib/cohort-store.js`).
- [x] Step 2: Implementation of core logic, state transitions, or UI components (`app/api/coordinator/cohorts/[id]/summary/route.js`, `app/api/coordinator/cohorts/[id]/settings/route.js`, `app/coordinator/cohorts/[id]/page.jsx`).
- [x] Step 3: Verification against acceptance criteria and regression suite (`tests/e2e/edu-10-cohort-summary.spec.ts`).

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/cohort-summary.js` aggregating cohort mastery, misconception trends, intervention insights, and item quality indicators without student ranking or leaderboards.
- `2026-10-13`: Implemented `updateCohortAllowLevel5` in `lib/cohort-store.js` with coordinator cohort scoping and audit logging of old and new values.
- `2026-10-13`: Implemented REST endpoints `GET /api/coordinator/cohorts/[id]/summary` and `PATCH /api/coordinator/cohorts/[id]/settings`.
- `2026-10-13`: Implemented frontend UI in `app/coordinator/cohorts/[id]/page.jsx` with Level 5 toggle, mastery cards, recommendation transfer outcomes tracking, and item quality indicators.
- `2026-10-13`: Verified strict boundary enforcement: coordinators cannot replay sessions, override recommendations, publish questions, or grant `trace_review` (all 403 denied).

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-10-cohort-summary.spec.ts`
- [x] Full Regression Suite: `npm run test:e2e` (222 passed)
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 7 tests using 1 worker

  ✓ [EDU-10] AC 1: Coordinator opens assigned cohort and sees cohort mastery, misconception trends, intervention insights, and item-quality indicators (919ms)
  ✓ [EDU-10] AC 2: Accepted recommendation shows outcome if later transfer result exists; says 'not enough later evidence' if none exists yet (515ms)
  ✓ [EDU-10] AC 3: New cohort created has allow_level_5 false by default until coordinator enables it (53ms)
  ✓ [EDU-10] AC 4: Coordinator requests a student replay -> denied (403) (455ms)
  ✓ [EDU-10] AC 5: Coordinator changes allow_level_5 -> saved, audited; coordinator outside cohort is denied (403) (515ms)
  ✓ [EDU-10] AC 6: Coordinator tries to override recommendation, publish question, grant trace_review, or open trace -> denied (403) (860ms)
  ✓ [EDU-10] UI: Coordinator Cohort Summary page renders controls, allows toggling level 5, and shows cards (2.4s)

7 passed (8.7s)
Full suite: 222 passed (1.8m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: PASSED

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
Implemented cohort aggregate progress summary, allow_level_5 coordinator setting toggle with audit event trail, later transfer outcome verification for accepted recommendations, and curriculum item quality health indicators. Access scoping and coordinator boundary restrictions strictly enforced.
