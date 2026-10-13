# ISSUE-036-EDU-12: See safety and stuck-session flags

- **Story ID**: EDU-12
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#672](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/672)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to see when a session fell back to the safe prompt, disclosed something worrying, or stayed stuck after transfer, **so that** a person sees the notice without the system making a safeguarding decision.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See safety and stuck-session flags" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, Sections 12.2 and 12.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The support contact is a cohort assignment, not a new role (FR-01).
- **Success Metric**: Each of the seven flags is visible to the assigned teacher

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Safeguarding decisions, parent messages, and the EDU-01 mastery flags

### Preconditions & Dependencies
- [x] Dependencies: STU-10, STU-12, STU-13, ADM-01
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** an assigned student's session has `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached`, or `verification_unavailable`, **when** the teacher opens the review list or the replay, **then** the flag and its time are shown. It is a notice.
- [x] **Given** no teacher is assigned, **when** the flag is `safety_fallback` or `worrying_disclosure`, **then** the cohort support contact sees the flag and the session id. Row-level security allows that user to read `session_flag` for their cohort and nothing else.
- [x] **Given** the cohort has no teacher and no support contact, **when** the flag is stored, **then** a `trace_review` administrator sees it on the safety list.
- [x] **Given** another user requests the flag, **when** authorisation runs, **then** it is denied and logged.

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
- `2026-10-13`: Implemented OP-08 `GET /api/session-flags` with strict RBAC:
  - Teacher cohort assignment filtering: Assigned teachers see all 7 flag types for their cohorts.
  - Cohort support contact escalation: Support contact sees exclusively `safety_fallback` and `worrying_disclosure` when the cohort has NO assigned teacher.
  - Administrator escalation: `trace_review` administrator sees safety flags when cohort has neither teacher nor support contact.
  - Authorization enforcement: Student, tutor, unassigned teacher, and cross-cohort teachers are denied with HTTP 403 and logged in audit trail.
  - Enhanced `lib/teacher-flags.js` with non-shaming neutral descriptions for all 7 EDU-12 flag kinds.
  - Enriched `lib/session-store.js` `getAllSessionFlags` to project student_id, cohort_id, kind, and timestamp.
  - Added Playwright test suite `tests/e2e/edu-12-safety-stuck-flags.spec.ts` covering all 4 acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-12-safety-stuck-flags.spec.ts`
- [x] Regression Suite: `npm run test:e2e` (242 passed)
- [x] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Running 4 tests using 1 worker

     1 … sees all 7 flags and timestamps as notices on review list and flags API
  ✓  1 …l 7 flags and timestamps as notices on review list and flags API (926ms)
     2 …ct sees safety_fallback & worrying_disclosure when cohort has no teacher
  ✓  2 …safety_fallback & worrying_disclosure when cohort has no teacher (345ms)
     3 …nistrator sees flags when cohort has neither teacher nor support contact
  ✓  3 …r sees flags when cohort has neither teacher nor support contact (316ms)
     4 …sers (student, tutor, unassigned teacher) are denied with 403 and logged
  ✓  4 …tudent, tutor, unassigned teacher) are denied with 403 and logged (68ms)
  4 passed (4.5s)

Full regression run:
242 passed (2.2m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - AC1 (Teacher views all 7 flags with timestamps as non-shaming notices): Verified
  - AC2 (Cohort support contact sees only safety_fallback & worrying_disclosure for unstaffed cohort): Verified
  - AC3 (trace_review administrator sees safety flags for completely unstaffed cohort): Verified
  - AC4 (Unauthorized requests by student, tutor, unassigned teacher or cross-cohort teacher return 403 and audit log): Verified

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
Successfully delivered EDU-12. All 7 safety and stuck-session flags are surfaced as non-shaming notices with timestamps. Tiered escalation fallback (teacher -> support contact -> trace_review admin) is enforced at the API level with row-level scoping. 100% of acceptance criteria validated with E2E test suite.
