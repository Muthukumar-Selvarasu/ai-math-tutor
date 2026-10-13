# ISSUE-014-EDU-06: Review content quality

- **Story ID**: EDU-06
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#650](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/650)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13T21:25:00+08:00
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** content reviewer, **I want** to approve or reject flagged questions, **so that** confusing or incorrect items are fixed before students see them.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Review content quality" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-02, FR-14
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Only content reviewers and administrators can change publication status
- **Success Metric**: Time from flag to review decision

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Autonomous question regeneration for learners

### Preconditions & Dependencies
- [x] Dependencies: `item-quality-scan` job, pgvector duplicate detection
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a question or a diagram is flagged for an answer-key inconsistency, a verifier failure, ambiguous wording, an unclear diagram, excessive student confusion, unexpected difficulty, a non-functional distractor, a near-duplicate, a wrong curriculum mapping, inappropriate language, or a weak explanation, **when** a content reviewer opens the queue, **then** it shows that reason and the supporting evidence.
- [x] **Given** a teacher opens the flag, **then** they can read it and cannot approve, reject, or deprecate the item.
- [x] **Given** a content reviewer approves, rejects, or deprecates an item, **then** the decision and publication status are stored.
- [x] **Given** an item is flagged, **then** students are not served that item.
- [x] **Given** an item is edited, **then** it is not published again without a new approval.

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
- `2026-10-13`: Implemented `flagQuestion`, `flagDiagram`, and `editQuestion` in `lib/content-review-store.js` ensuring that flagged items carry quality scan reasons and supporting evidence and are withheld from students. Updated `getReviewItems` to expose `flag_reason` and `evidence`. Implemented route handlers `POST /api/content/review-items/[id]/flag`, `GET /api/content/review-items/[id]`, and `PUT /api/content/review-items/[id]` (which resets publication and validation status to draft on edits). Implemented content review UI at `app/content/review/page.jsx` with teacher read-only view and reviewer decision actions. Authored E2E test suite `tests/e2e/edu-06-content-quality.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-06-content-quality.spec.ts`
- [x] Full Regression Suite: `npm run test:e2e` (233 tests passing)

### Verification Evidence & Results
```text
Running 5 tests using 1 worker

     1 … 1: Flagged items in review queue display reason and supporting evidence
  ✓  1 …gged items in review queue display reason and supporting evidence (1.4s)     2 …: Teacher can read review items but cannot approve, reject, or deprecate
  ✓  2 …er can read review items but cannot approve, reject, or deprecate (1.3s)     3 …roves, rejects, or deprecates item; decision & publication status stored
  ✓  3 …ejects, or deprecates item; decision & publication status stored (172ms)     4 …ontent quality › Criterion 4: Flagged items are never served to students
  ✓  4 …uality › Criterion 4: Flagged items are never served to students (122ms)     5 …Edited items reset to draft and cannot be published without new approval
  ✓  5 …tems reset to draft and cannot be published without new approval (157ms)
  5 passed (5.5s)

Full regression run: 233 passed (1.7m)
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
Implemented content quality review queue with flag reasons and evidence, teacher read-only scoping, reviewer decision persistence (approve, reject, deprecate), student withholding for flagged items, and mandatory re-approval on content edits. Full test suite passing (233/233).

