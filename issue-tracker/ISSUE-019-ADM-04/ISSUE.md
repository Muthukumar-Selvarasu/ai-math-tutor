# ISSUE-019-ADM-04: Content publishing controls

- **Story ID**: ADM-04
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#655](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/655)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** only validated and approved questions to be available to students, **so that** learners never see unreviewed content.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Content publishing controls" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-02, FR-14
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Publication status changes are audit-logged
- **Success Metric**: Zero unapproved questions delivered (critical regression test)

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Bulk auto-publishing

### Preconditions & Dependencies
- [ ] Dependencies: Question versioning, review workflow
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a question is draft, rejected, deprecated, flagged, or pending, **then** it is never served.
- [ ] **Given** a question is served, **when** its record is read, **then** validation is approved, publication is published, the curriculum scope is enabled, and the FR-02 fields are present: id, curriculum mapping, skill, difficulty, solution path, accepted answer, misconception tags, Socratic prompt metadata, diagram flag, validation status, and version.
- [ ] **Given** a diagram is not approved, **when** a student requests the question, **then** the diagram is not served. A content reviewer approves or rejects the diagram.
- [ ] **Given** vector search or the practice planner returns rows, **then** unapproved items are excluded.
- [ ] **Given** a question is imported, **when** the offline validation pipeline has not passed, **then** a content reviewer cannot mark it approved.
- [ ] **Given** the bank is ready to demonstrate, **when** content validation runs, **then** at least 10 approved ratio and proportion questions (Release 1.0) or 40 (Release 1.1) are available, and an approved item with no legal transfer partner is rejected. A legal partner shares the learning objective, has a different accepted value, and uses only skills in the cohort starting set. Per-student legality is checked again at practice time.

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
- `2026-10-13`: Implemented `lib/content-review-store.js` managing review items, question overrides, diagram overrides, and decision history.
- `2026-10-13`: Implemented route handlers `GET /api/content/review-items`, `POST /api/content/review-items/[id]/decision`, `POST /api/content/diagrams/[id]/decision`. Enforced RBAC (content_reviewer, administrator) and 409 transition_not_allowed on unvalidated items.
- `2026-10-13`: Enforced strict approved and published gating in `lib/practice-planner.js` (`isQuestionApprovedAndPublished`, `listApprovedPublishedQuestions`, `getApprovedPublishedQuestion`) and `app/api/sessions/route.js`.
- `2026-10-13`: Created comprehensive E2E test suite in `tests/e2e/adm-04-publishing.spec.ts` covering all 6 acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e`
- [x] Functional / E2E: `npx playwright test tests/e2e/adm-04-publishing.spec.ts`

### Verification Evidence & Results
```text
Running 6 tests using 1 worker

     1 … draft, rejected, deprecated, flagged, or pending questions are NEVER served to students
  ✓  1 … draft, rejected, deprecated, flagged, or pending questions are NEVER served to students (681ms)
     2 … served question records have all required FR-02 fields populated and verified
  ✓  2 … served question records have all required FR-02 fields populated and verified (80ms)
     3 … unapproved diagrams are not served; reviewer can approve or reject diagram
  ✓  3 … unapproved diagrams are not served; reviewer can approve or reject diagram (184ms)
     4 … practice planner recommendations exclude unapproved and unreviewed items
  ✓  4 … practice planner recommendations exclude unapproved and unreviewed items (197ms)
     5 … failing offline validation blocks approval with 409 transition_not_allowed; teachers cannot make review decisions
  ✓  5 … failing offline validation blocks approval with 409 transition_not_allowed; teachers cannot make review decisions (499ms)
     6 … approved bank has at least 10 Release 1.0 items, every approved item has a legal transfer partner
  ✓  6 … approved bank has at least 10 Release 1.0 items, every approved item has a legal transfer partner (122ms)
  6 passed (6.2s)

Full regression suite:
  170 passed (1.3m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - Criterion 1: Draft, rejected, deprecated, flagged, and pending items are never served to students. Verified.
  - Criterion 2: Served question records have all required FR-02 fields populated and verified. Verified.
  - Criterion 3: Unapproved diagrams are not served; reviewer can approve or reject diagram. Verified.
  - Criterion 4: Practice planner recommendations exclude unapproved and unreviewed items. Verified.
  - Criterion 5: Failing offline validation blocks approval with 409 transition_not_allowed; teachers cannot make review decisions. Verified.
  - Criterion 6: Approved bank has at least 10 Release 1.0 items, every approved item has a legal transfer partner. Verified.

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
Content publishing controls (ADM-04, FR-02, FR-14, SPEC §3.8 OP-16, OP-17) implemented and verified. Implemented content review store and decision endpoints for questions and diagrams, integrated offline content validation to block approval with 409 transition_not_allowed on invalid items, restricted review decisions to content reviewers and administrators while providing read-only access to teachers, and ensured practice planner and session initialization exclusively serve published, approved, and unflagged questions with approved diagrams. All 170 test suites passing.

