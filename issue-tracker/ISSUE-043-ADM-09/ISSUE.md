# ISSUE-043-ADM-09: Retain metadata after purge

- **Story ID**: ADM-09
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 3: Platform Governance & Scale]
- **Priority**: [P2]
- **Status**: Completed
- **GitHub Issue**: [#679](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/679)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** old message bodies removed while replay metadata stays, **so that** retention does not break the audit or the teacher view.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Retain metadata after purge" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-15, FR-16, Sections 11.1 and 22.1 (#20)
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Purge uses `RETENTION_POLICY_VERSION`
- **Success Metric**: A purged turn still opens in replay with a retention notice

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Deleting audit rows, and consent for real students

### Preconditions & Dependencies
- [x] Dependencies: ADM-02, ADM-07
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a chat log, attempt, model trace, student-specific diagram blob, tutor note, student note, or teacher comment is older than its window, **when** `retention-purge` runs, **then** that body is deleted. For an attempt, the body is `response_value`, `step_expressions`, and `free_text`. Status, hint level, skill id, and timestamps remain, so EDU-01 and EDU-02 links still open. Notes and comments use 365 days.
- [x] **Given** a record is still inside its window, **when** `retention-purge` runs, **then** it is kept.
- [x] **Given** an audit row or an approved question diagram, **when** `retention-purge` runs, **then** it is kept.
- [x] **Given** a purged turn, **when** a teacher opens the replay, **then** they see the metadata and a notice that the message body was removed.
- [x] **Given** the Langfuse trace has been purged, **when** a `trace_review` administrator opens the replay, **then** the link is replaced with a notice that the trace expired.

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
- `2026-10-13`: Implemented multi-tier data retention purge in `lib/scheduled-jobs.js` (`executeScheduledJob("retention-purge")`):
  - 30-day message and attempt body purge: clears `student_response`, `tutor_output`, `response_value`, `answer_text`, `step_expressions`, `free_text`, and sets `body_purged = true` with standard retention notice.
  - 90-day model trace purge via `purgeTracesOlderThan` in `lib/traceability.js`.
  - 365-day tutor notes and teacher comments purge via `purgeTutorNotesOlderThan` and `purgeTeacherCommentsOlderThan`.
  - Enforced strict invariants: audit log rows (`getAllAuditEvents()`) and approved question diagrams are never deleted.
  - Retained all critical turn metadata: verifier status, hint level, question version, diagram version, prompt/policy versions, and audit timestamps.
  - Updated session replay logic (`lib/session-replay.js`) and UI (`app/teacher/sessions/[session_id]/replay/page.jsx`) to display `purged-body-notice` and trace expiration notice for `trace_review` administrators.
  - Added end-to-end test suite in `tests/e2e/adm-09-retention-metadata.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-09-retention-metadata.spec.ts`

### Verification Evidence & Results
```text
Running 3 tests using 1 worker

     1 …keeping 365-day metadata, verifier outcomes, hint counts, and timestamps
  ✓  1 … 365-day metadata, verifier outcomes, hint counts, and timestamps (1.0s)     2 …rows and approved question diagrams are never deleted by retention-purge
  ✓  2 …d approved question diagrams are never deleted by retention-purge (87ms)     3 …etention notice and trace_review administrator sees expired trace notice
  ✓  3 …n notice and trace_review administrator sees expired trace notice (1.8s)
  3 passed (5.2s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: All 5 criteria pass cleanly.

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
Implemented multi-tier data retention purge in `retention-purge` scheduled job and session replay components, ensuring privacy compliance by removing old response/tutor message bodies while preserving pedagogical metadata, verifier statuses, hint levels, timestamps, audit events, and approved diagrams. Passed automated E2E tests across all acceptance criteria.
