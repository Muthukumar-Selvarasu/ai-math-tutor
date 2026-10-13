# ISSUE-012-EDU-04: Accept, reject, or override a recommendation

- **Story ID**: EDU-04
- **Epic**: [E3: Review, replay, and human oversight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Completed
- **GitHub Issue**: [#648](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/648)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13T21:17:00+08:00
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** to accept, reject, or override a recommendation, **so that** professional judgement remains the final decision and drafts stay pending until I review them.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Accept, reject, or override a recommendation" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-12, FR-15, Section 12.2, Section 13.2
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Override action is idempotent
- **Success Metric**: 100% of overrides are audit-logged (critical regression test)

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Bulk overrides

### Preconditions & Dependencies
- [x] Dependencies: Recommendation records, RBAC, audit service
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** `insight-drafts` creates a recommendation, **then** its review status is pending and it stays pending until a teacher accepts, rejects, or overrides it.
- [x] **Given** a pending recommendation, **when** the assigned teacher accepts or rejects it, **then** the status becomes accepted or rejected, an audit event records who, when, and the decision, and the original evidence is unchanged.
- [x] **Given** an override, **when** it is saved, **then** a rationale is required.
- [x] **Given** a recommendation is already accepted, rejected, or overridden, **when** a second decision arrives, **then** an identical retry returns the stored result and a different decision is denied, and the first decision remains.
- [x] **Given** the override is saved, **then** the original recommendation and evidence remain unchanged, and the audit event records who, when, and why.
- [x] **Given** a user without the teacher role for that student, **when** they accept, reject, or override, **then** the action is denied and the status stays pending.

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
- `2026-10-13`: Implemented `recordReviewerDecision` in `lib/teacher-flags.js` with teacher-cohort authorization scoping (`isUserAuthorizedForStudent`), mandatory override rationale validation (HTTP 400 on omission), idempotent identical retries (HTTP 200), conflict denial on conflicting decisions (HTTP 409), preservation of original recommendation and evidence, and full audit logging (`who`, `when`, `why`, `decision`). Added single recommendation GET endpoint at `app/api/teacher/recommendations/[id]/route.js`. Updated `app/teacher/flags/page.jsx` with rationale support. Authored E2E test suite `tests/e2e/edu-04-recommendation-actions.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/edu-04-recommendation-actions.spec.ts`
- [x] Full Regression Suite: `npm run test:e2e` (228 tests passing)

### Verification Evidence & Results
```text
Running 6 tests using 1 worker

     1 …n 1: Created recommendation has pending review status until teacher acts
  ✓  1 …ated recommendation has pending review status until teacher acts (647ms)     2 … rejects recommendation, audit event logs details, evidence is unchanged
  ✓  2 … recommendation, audit event logs details, evidence is unchanged (598ms)     3 …dation › Criterion 3: An override decision strictly requires a rationale
  ✓  3 …› Criterion 3: An override decision strictly requires a rationale (63ms)     4 …commendation › Criterion 4: Decision idempotency and conflict prevention
  ✓  4 …ation › Criterion 4: Decision idempotency and conflict prevention (80ms)     5 …ationale, preserves original recommendation and evidence, audit logs why
  ✓  5 …e, preserves original recommendation and evidence, audit logs why (50ms)     6 …on-teacher or unassigned user is denied and recommendation stays pending
  ✓  6 …her or unassigned user is denied and recommendation stays pending (57ms)
  6 passed (3.4s)

Full regression run: 228 passed (1.8m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 6/6 passing

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
Implemented complete educator recommendation review actions (accept, reject, override) with idempotency, conflict rejection, mandatory override rationale, audit trail logging, and teacher assignment scoping. Full test suite passing (228/228).

