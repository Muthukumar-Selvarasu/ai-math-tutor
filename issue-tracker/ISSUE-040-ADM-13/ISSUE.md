# ISSUE-040-ADM-13: Create a cohort and assign people

- **Story ID**: ADM-13
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#676](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/676)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** to create a cohort, enrol students, and assign staff, **so that** practice and review have a scope.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Create a cohort and assign people" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, FR-02
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Membership ids are what an administrator sees. Learning profiles stay with the teacher.
- **Success Metric**: A synthetic cohort can be practised and reviewed

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Self-service enrolment and self-service registration

### Preconditions & Dependencies
- [x] Dependencies: ADM-01 (Tier 1 slice, Section 6.7.1)
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** an administrator creates a cohort, **when** they save it, **then** it has an enabled curriculum scope, an enabled starting set, `allow_level_5` false (default, opt-in), and at most one support contact.
- [x] **Given** the administrator enrols a student and assigns a teacher, tutor, and coordinator, **when** those people sign in, **then** each sees only that cohort's allowed surface.
- [x] **Given** an administrator creates a user for an existing Clerk user id, **then** an `app_user` row is created with a new internal pseudonymous `id`, the role and a synthetic `display_label`, and no name or email is stored. A Clerk user who has no `app_user` row, or who is not created through this route or `scripts/seed_synthetic.py`, is rejected at sign-in with 403 `forbidden` (`auth_unknown_subject`).

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
- `2026-10-13`: Implemented `lib/cohort-store.js` managing cohorts, starting sets, support contact replacement auditing, and role surface scoping.
- `2026-10-13`: Implemented `lib/audit-trail.js` for append-only audit event logging.
- `2026-10-13`: Implemented OP-19 & OP-18 routes: `/api/admin/cohorts`, `/api/admin/cohorts/[id]`, `/api/admin/cohorts/[id]/assignments`, `/api/admin/cohorts/[id]/support-contact`, `/api/admin/users`, and `/api/cohorts/[id]/surface`.
- `2026-10-13`: Added Playwright E2E suite `tests/e2e/adm-13-cohort-assignment.spec.ts` covering all criteria and edge cases.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-13-cohort-assignment.spec.ts`
- [x] Full E2E Regression: `npm run test:e2e`

### Verification Evidence & Results
```text
Running 4 tests using 1 worker

  ✓  Criterion 1: Cohort creation initializes curriculum scope, starting set, default allow_level_5=false, and at most one support contact (2.0s)
  ✓  Support Contact: Cohort has at most one support contact; replacing one audits both changes (1.1s)
  ✓  Criterion 2: Enrolling student and assigning staff scopes each person strictly to that cohort allowed surface (2.8s)
  ✓  Criterion 3: Administrator creates user for Clerk ID without storing name/email; unknown Clerk ID rejected with 403 auth_unknown_subject (404ms)

4 passed (9.1s)

Full regression suite:
160 passed (1.2m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: PASS

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
Implemented ADM-13 cohort creation, staff assignments, starting set configuration, support contact replacement auditing, and administrator user creation with strict privacy enforcement (no name/email). Verified through Playwright E2E suite and full regression pass (160 tests passing).
