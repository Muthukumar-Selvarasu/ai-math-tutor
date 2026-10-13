# ISSUE-031-EDU-09: Add a tutor note

- **Story ID**: EDU-09
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#667](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/667)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13T21:34:00+08:00
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** tutor, **I want** to add a note on an assigned student's session, **so that** the teacher can see my observation on the replay.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Add a tutor note" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, FR-13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Notes are free text with the retention window in Section 22.1 (#20)
- **Success Metric**: 100% of tutor notes are stored and visible to the assigned teacher

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Replay, recommendation review, publishing, and Langfuse traces

### Preconditions & Dependencies
- [x] Dependencies: ADM-01, EDU-03
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a tutor is assigned to the student, **when** they open their list, **then** they see session ids, question titles, and times, and not the student's responses or the tutor output.
- [x] **Given** a tutor is assigned to the student, **when** they save a note on a listed session id, **then** the note is stored and the assigned teacher sees it on the replay.
- [x] **Given** a tutor, **when** they request the replay payload, **then** it is denied.
- [x] **Given** a tutor is not assigned, **when** they save a note, **then** the action is denied and logged.
- [x] **Given** a tutor, **then** they cannot accept, reject, or override a recommendation, and they cannot change publication status.

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
- `2026-10-13`: Implemented `lib/tutor-notes-store.js` with `addTutorNote`, `getTutorNotes`, and `getTutorSessions` (OP-12, OP-13). Enforced tutor assignment verification and audit event logging on unauthorized note attempts (`tutor_note_denied_unassigned`). Enforced metadata-only projection for tutor session listing (excluding student responses, turns, and tutor outputs). Integrated `getTutorNotes` into `buildFullReplayView` in `lib/session-replay.js` and rendered notes on `app/teacher/sessions/[session_id]/replay/page.jsx`. Added route handlers `GET /api/tutor/sessions` and `POST /api/tutor/sessions/[session_id]/notes`. Authored E2E test suite `tests/e2e/edu-09-tutor-notes.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-09-tutor-notes.spec.ts`
- [x] Full Regression Suite: `npm run test:e2e` (238 tests passing)

### Verification Evidence & Results
```text
Running 5 tests using 1 worker

     1 …ssion ids, question titles, and times, without responses or tutor output
  ✓  1 …ds, question titles, and times, without responses or tutor output (1.3s)     2 …gned tutor saves a note on a session; assigned teacher sees it on replay
  ✓  2 …tor saves a note on a session; assigned teacher sees it on replay (1.2s)     3 …r note › Criterion 3: Tutor requesting session replay is denied with 403
  ✓  3 …› Criterion 3: Tutor requesting session replay is denied with 403 (49ms)     4 … Criterion 4: Unassigned tutor saving note is denied with 403 and logged
  ✓  4 …ion 4: Unassigned tutor saving note is denied with 403 and logged (53ms)     5 …rion 5: Tutor cannot review recommendations or change publication status
  ✓  5 …Tutor cannot review recommendations or change publication status (892ms)
  5 passed (6.4s)

Full regression run: 238 passed (1.7m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 5/5 passing

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
Implemented tutor notes workflow and session listing according to OP-12 and OP-13 with tutor authorization scoping, student privacy protections, replay integration for teachers, replay denial for tutors, and RBAC boundary enforcement. Full test suite passing (238/238).

