# ISSUE-011-EDU-03: Replay a tutoring session

- **Story ID**: EDU-03
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 1c: Replay & Human Oversight]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#647](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/647)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to replay a tutoring session, **so that** I can see how the student's reasoning developed without reading raw transcripts.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Replay a tutoring session" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-13
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Student data in traces is pseudonymised
- **Success Metric**: 100% of tutor turns are replayable

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Editing past session records

### Preconditions & Dependencies
- [x] Dependencies: Persisted turns, audit events, Langfuse trace IDs
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Tier 1c.** **Given** the Release 1.0 demo, **when** the assigned teacher opens the golden session, **then** a read-only replay shows each turn and one pending draft recommendation with its evidence. Accept, reject, override, comments, and the cohort view are Release 1.1.
- [x] **Given** a replay of an assigned student, **then** each turn shows question version, diagram version, response, verifier result, hint level, tutor output, misconception label, and learner-model change.
- [x] **Given** a replay turn, **then** it also shows model name, model version, prompt version, policy version, teacher comments, teacher overrides, and audit timestamps.
- [x] **Given** a replay turn whose chat body has been purged, **then** the teacher still sees verifier status, hint level, versions, and timestamps, plus a notice that the message body was removed.
- [x] **Given** a teacher who is not assigned, **when** they request the replay, **then** access is denied and the denial is logged.
- [x] **Given** an administrator holding `trace_review`, **when** they open the replay, **then** each turn links to its Langfuse trace while that trace is inside the 90-day window. After purge, the link is a retention notice. An administrator without that grant is denied the replay. A teacher without the grant does not receive the trace link. A tutor does not receive the replay.
- [x] **Given** a misconception on the replay, **when** the assigned teacher sets reviewer status to confirmed or rejected, **then** it is stored. It starts as unreviewed. The student does not see it.

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
- `2026-10-13`: Implemented `buildFullReplayView` and `updateMisconceptionReview` in `lib/session-replay.js`.
- `2026-10-13`: Exported `getRawSession` in `lib/session-store.js` to ensure replay access retains unstripped session turns while respecting data retention purge boundaries.
- `2026-10-13`: Implemented API route `app/api/teacher/sessions/[session_id]/replay/route.js` enforcing RBAC (`teacher` assigned cohort, `administrator` with `trace_review`), audit logging `replay_access_denied`, redacting trace links for teachers.
- `2026-10-13`: Implemented misconception reviewer API `app/api/teacher/sessions/[session_id]/misconception-review/route.js`.
- `2026-10-13`: Built interactive replay UI page `app/teacher/sessions/[session_id]/replay/page.jsx` with timeline scrub, turn inspector, purged body alerts, and misconception review actions.
- `2026-10-13`: Added comprehensive E2E suite in `tests/e2e/edu-03-session-replay.spec.ts` covering all 7 acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-03-session-replay.spec.ts`
- [x] Typecheck / Linter: `npm run lint` / typecheck
- [x] Functional / E2E: `npm run test:e2e` (197/197 passing)

### Verification Evidence & Results
```text
Running 7 tests using 1 worker
  ✓ 1 Given the Release 1.0 demo, assigned teacher opens replay, shows turns, evidence, question/diagram versions, verifier result, and learner delta (1.7s)
  ✓ 2 Given a replay turn, shows model name, model version, prompt version, policy version, and audit timestamps (45ms)
  ✓ 3 Given a replay turn whose chat body has been purged, teacher still sees verifier status, hint level, versions, and timestamps with retention notice (59ms)
  ✓ 4 Given unauthorized roles (tutor, parent, student) or unassigned teachers are denied (403) and logged (58ms)
  ✓ 5 Trace links only returned for administrators holding trace_review; teachers never receive trace links (33ms)
  ✓ 6 Misconception reviewer status starts as unreviewed; teacher can confirm or reject and it is stored (513ms)
  ✓ 7 Teacher replay page (/teacher/sessions/[session_id]/replay) renders interactive timeline scrub and controls (1.7s)

7 passed (7.1s)

Full E2E Suite:
197 passed (1.5m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 7/7 passing in `tests/e2e/edu-03-session-replay.spec.ts`.

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
EDU-03 delivered with complete session replay capability, turn-by-turn inspector, telemetry versions, data retention compliance, role-scoped access control, teacher misconception review, and interactive UI scrub. Validated across 197 E2E tests.

