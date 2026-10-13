# ISSUE-023-ADM-06: Sign in

- **Story ID**: ADM-06
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#659](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/659)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** user, **I want** to sign in before I see student data, **so that** unauthenticated people cannot open sessions or profiles.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Sign in" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Authentication events are audited (FR-15)
- **Success Metric**: 100% of authorisation tests pass

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Self-service registration and parent features

### Preconditions & Dependencies
- [x] Dependencies: Identity provider, RBAC (ADM-01, Tier 1 slice, Section 6.7.1)
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** I have no valid session, **when** I request student data, **then** I am required to sign in and the data is not returned.
- [x] **Given** I sign in with a valid token, **when** the next request runs, **then** my role and cohort scope are read from Postgres. A role claim left in the Clerk JWT after an administrator changes the role does not apply.
- [x] **Given** the parent role, **then** sign-in can succeed and still grants no product route in the MVP.
- [x] **Given** a sign-in or a failed sign-in, **then** an authentication audit event is written.
- [x] **Given** the Clerk JWKS endpoint is unreachable, **then** cached keys up to 1 hour old are used, and with no cache the request returns 503 `service_unavailable`. Authentication never fails open.
- [x] **Given** a valid token whose `sub` is not in `app_user`, **then** the request returns 403 `forbidden`, the audit event `auth_unknown_subject` is written, and no row is created. There is no auto-provisioning on first sign-in. The audit row, traces and every foreign key carry only internal `app_user.id` values, never a Clerk id.
- [x] **Given** `scripts/seed_synthetic.py` runs with `content/seed/users.json` (logical `clerk_ref` values), the active `content/seed/clerk_ids.<APP_ENV>.json` map and `BOOTSTRAP_ADMIN_CLERK_ID`, **then** it fails with an explicit error for any `clerk_ref` missing from the map, otherwise it creates the listed `app_user` rows, inserts the bootstrap administrator only if none exists, stores no name or email, and creates no duplicate when run a second time.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding for authentication and identity mapping.
- [x] Step 2: Implementation of `lib/auth.js` (`authenticateRequest`, `authorizeRoute`, JWKS caching with 503 fallback, DB role overrides, unknown subject handling without auto-provisioning, auth audit events), protected profile endpoint `app/api/me/profile/route.js`, synthetic seed data (`content/seed/users.json`, `content/seed/clerk_ids.*.json`), and seed script `scripts/seed_synthetic.py`.
- [x] Step 3: Verification against acceptance criteria and regression suite via `tests/e2e/adm-06-auth-signin.spec.ts`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/auth.js` with `authenticateRequest`, `authorizeRoute`, JWKS key caching with 1h TTL (and 503 fail-closed when unreachable without cache), DB role resolution ignoring token role claims, parent route exclusion, and audit logging with pseudonymous IDs (zero Clerk IDs in audit rows or traces). Created `app/api/me/profile/route.js`, `content/seed/users.json`, `content/seed/clerk_ids.test.json`, `content/seed/clerk_ids.development.json`, and `scripts/seed_synthetic.py`. Verified all 7 acceptance criteria in `tests/e2e/adm-06-auth-signin.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-06-auth-signin.spec.ts`
- [x] Regression Suite: `npx playwright test` (all suites passing)
- [x] Functional / E2E: Verification against all acceptance criteria

### Verification Evidence & Results
```text
Running 7 tests using 1 worker

  ✓  1 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:28:7 › ADM-06: Sign in › Criterion 1: Requesting student data without valid session returns 401 and data is not returned (6.0s)
  ✓  2 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:44:7 › ADM-06: Sign in › Criterion 2: Role and cohort are read from database; stale role claim in Clerk JWT does NOT apply (1ms)
  ✓  3 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:80:7 › ADM-06: Sign in › Criterion 3: Parent role sign-in succeeds but grants NO product route in the MVP (1ms)
  ✓  4 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:114:7 › ADM-06: Sign in › Criterion 4: Authentication audit event is written on sign-in and failed sign-in (1ms)
  ✓  5 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:149:7 › ADM-06: Sign in › Criterion 5: Clerk JWKS unreachable uses cached keys up to 1 hour; with no cache returns 503 service_unavailable (never fails open) (0ms)
  ✓  6 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:182:7 › ADM-06: Sign in › Criterion 6: Valid token whose sub is not in app_user returns 403 forbidden and writes auth_unknown_subject without auto-provisioning (1ms)
  ✓  7 [chromium] › tests/e2e/adm-06-auth-signin.spec.ts:208:7 › ADM-06: Sign in › Criterion 7: scripts/seed_synthetic.py contract verification (97ms)

  7 passed (9.1s)
```

### Acceptance Criteria Verification
- [x] Criterion 1 verified: Unauthenticated request to student data returns 401 and logs `auth_failed`.
- [x] Criterion 2 verified: Role is read from `app_user` on each request, ignoring stale token claims.
- [x] Criterion 3 verified: Parent role sign-in succeeds, but product routes are denied with 403.
- [x] Criterion 4 verified: Audit events recorded on success and failure with internal pseudonymous IDs (no Clerk IDs).
- [x] Criterion 5 verified: JWKS cached up to 1 hour; returns 503 when unreachable without cache (never fails open).
- [x] Criterion 6 verified: Unknown subject returns 403 `auth_unknown_subject` and creates no user row.
- [x] Criterion 7 verified: `scripts/seed_synthetic.py` creates `app_user` rows, inserts bootstrap administrator, stores no names/emails, and is idempotent.

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
ADM-06 sign-in, authentication, and RBAC delivered and verified. All acceptance criteria and security invariants confirmed passing.
