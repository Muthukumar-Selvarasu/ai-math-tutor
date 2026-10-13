# ISSUE-010-EDU-02: Understand why a student was flagged

- **Story ID**: EDU-02
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 1c: Replay & Human Oversight]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#646](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/646)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** every flag to show its evidence, **so that** I can judge it with my own professional knowledge.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Understand why a student was flagged" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-12, FR-15, Section 13.2
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Evidence links respect role-based access
- **Success Metric**: At least 95% of teacher-facing claims link to source events

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Placement, grading, or admissions suggestions

### Preconditions & Dependencies
- [x] Dependencies: `insight-drafts` job, audit event store
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a flagged student, **then** the flag lists attempts, skills, timing, hint levels, and sessions.
- [x] **Given** a recommendation, **then** it shows confidence, limitations, suggested action, review status, and the human reviewer decision once one exists.
- [x] **Given** low confidence, **then** the recommendation is labelled as such and is not stated as fact.
- [x] **Given** `insight-drafts` writes a draft, **when** the text contains placement, grading, admissions, exclusion, or remedial-classification wording, **then** a deterministic check rejects the draft, the teacher does not see it, and the rejection is stored.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`lib/teacher-flags.js`, `tests/e2e/edu-02-flagged-student.spec.ts`).
- [x] Step 2: Implementation of core logic, state transitions, or UI components (`app/api/teacher/flagged-students/route.js`, `app/api/teacher/recommendations/route.js`, `app/api/teacher/recommendations/[id]/review/route.js`, `app/teacher/flags/page.jsx`).
- [x] Step 3: Verification against acceptance criteria and regression suite (`npm run test:e2e`).

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/teacher-flags.js` containing:
  - `getFlaggedStudents()` extracting attempts, skills, timing, hint levels, sessions, and non-shaming explanations.
  - Standard 7-part recommendation structure: Recommendation, Reason, Evidence, Confidence, Limitations, Suggested Action, Review Status.
  - Low confidence explicit labelling ("Preliminary indicator only — low confidence; not stated as fact").
  - Deterministic wording check (`checkForbiddenDraftWording`) rejecting drafts with placement, grading, admissions, exclusion, or remedial wording (TECH-35 / Section 13.2).
  - Reviewer decision recording (`recordReviewerDecision`) with idempotence and audit events.
- `2026-10-13`: Built API endpoints for teacher flagged students and recommendation reviews.
- `2026-10-13`: Built teacher UI `/teacher/flags` allowing visual drill-down into attempt evidence and decisioning.
- `2026-10-13`: Added Playwright E2E suite `tests/e2e/edu-02-flagged-student.spec.ts` covering all 4 acceptance criteria and UI validation.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-02-flagged-student.spec.ts`
- [x] Full E2E Test Suite: `npm run test:e2e`
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 5 tests using 1 worker

  ✓ [EDU-02] Criterion 1: Flagged student drill-down lists attempts, skills, timing, hint levels, sessions, and non-shaming explanations (723ms)
  ✓ [EDU-02] Criterion 2: Recommendation displays confidence, limitations, suggested action, review status, and reviewer decision once made (489ms)
  ✓ [EDU-02] Criterion 3: Low confidence recommendations are explicitly labelled as such and not stated as fact (39ms)
  ✓ [EDU-02] Criterion 4: Insight draft containing placement, grading, admissions, exclusion, or remedial wording is deterministically rejected, hidden, and stored (70ms)
  ✓ [EDU-02] Criterion 5: Teacher UI page (/teacher/flags) renders evidence drill-down and allows recommendation review (1.0s)

5 passed (4.1s)

Full E2E Test Suite:
190 passed (1.5m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 5/5 passing in E2E suite.

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
Teacher flag explanation and recommendation oversight fully implemented for Tier 1c. Teachers have access to evidence drill-downs (attempts, skills, timing, hint levels, sessions) with respectful and non-shaming explanations. Recommendations follow the 7-part standard template, low confidence is labelled explicitly, and drafts with forbidden placement/grading/admissions/exclusion/remedial wording are deterministically rejected and hidden from educators.
