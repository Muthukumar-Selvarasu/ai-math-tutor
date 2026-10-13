# ISSUE-041-EDU-11: Comment on a session

- **Story ID**: EDU-11
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#677](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/677)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to comment on a replay, **so that** my comment stays with the session.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Comment on a session" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Comments are free text with the retention window in Section 22.1 (#20)
- **Success Metric**: 100% of saved comments appear on the replay

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Editing the student's past turns

### Preconditions & Dependencies
- [x] Dependencies: EDU-03
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** an assigned teacher saves a comment, **when** it is stored, **then** the replay shows that comment and an audit event records who and when.
- [x] **Given** a teacher who is not assigned, **when** they save a comment, **then** the action is denied.
- [x] **Given** the chat body is purged, **when** the teacher opens the replay, **then** the comment remains until its own 365-day window ends.

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
- `2026-10-13`: Implemented `lib/teacher-comments-store.js` with `addTeacherComment` and `getTeacherComments`:
  - Enforced teacher cohort assignment authorization check; unassigned teacher requests return HTTP 403.
  - Recorded append-only audit event `teacher_comment_added` with `actor_user_id`, `session_id`, `comment_id`, and timestamp.
  - Connected OP-07 route `POST /api/teacher/sessions/[session_id]/comments` and `GET /api/teacher/sessions/[session_id]/comments`.
  - Integrated `getTeacherComments(sessionId)` into `lib/session-replay.js` `buildFullReplayView`.
  - Added teacher session comments thread and interactive submission form to `app/teacher/sessions/[session_id]/replay/page.jsx`.
  - Added Playwright test suite `tests/e2e/edu-11-session-comments.spec.ts` validating all acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-11-session-comments.spec.ts`
- [x] Regression Suite: `npm run test:e2e` (246 passed)
- [x] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Running 4 tests using 1 worker

     1 …er saves comment; replay shows comment; audit event records who and when
  ✓  1 …s comment; replay shows comment; audit event records who and when (3.1s)
     2 …n › Criterion 2: Unassigned teacher is denied (403 forbidden) and logged
  ✓  2 …terion 2: Unassigned teacher is denied (403 forbidden) and logged (52ms)
     3 …rged chat body preserves comments on replay until 365-day retention ends
  ✓  3 …at body preserves comments on replay until 365-day retention ends (58ms)
     4 …rent) cannot comment (403) and comments never leak to practice interface
  ✓  4 …nnot comment (403) and comments never leak to practice interface (574ms)
  4 passed (6.6s)

Full regression run:
246 passed (1.7m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - AC1 (Assigned teacher saves comment, replay displays comment, audit log records who and when): Verified
  - AC2 (Unassigned teacher denied with 403 and logged): Verified
  - AC3 (Purged student chat body preserves teacher comments until 365-day retention ends): Verified
  - AC4 (Unauthorized roles cannot comment and comments are not leaked to student practice interface): Verified

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
Successfully implemented EDU-11 session commentary capability. Assigned teachers can comment on session replays with persistent storage, full audit trail, and UI integration. Unassigned teachers and non-teacher roles are rejected with HTTP 403. Comments persist through chat body purging per retention rules. All E2E tests and regression suite (246 tests) passing.
