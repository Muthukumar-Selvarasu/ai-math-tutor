# ISSUE-018-ADM-03: Review AI quality issues

- **Story ID**: ADM-03
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 3: Platform Governance & Scale]
- **Priority**: [P2]
- **Status**: Completed
- **GitHub Issue**: [#654](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/654)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** to review AI quality issues, **so that** I can find and fix tutoring problems quickly.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Review AI quality issues" as specified in PRD §6, §11.2, §14.1, §14.4 and technical architecture requirements (SPEC OP-22).

### Linked Requirements & Architecture References
- **PRD**: Section 11.2, Section 14.1, Section 14.4
- **SPEC**: SPEC §2.4, §3.4 OP-22, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-26
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5, FB-48
- **Non-functional Notes**: Access limited to administrators who hold `trace_review`
- **Success Metric**: Mean time to triage flagged AI issues

### Scope Boundaries
- **In Scope**:
  - Core implementation of OP-22 GET /api/admin/quality-issues and POST /api/admin/quality-issues/[id]/triage.
  - Strict enforcement of `trace_review` administrator grant scoping (HTTP 403 denial for callers without grant).
  - Surfacing verifier mismatches, leakage events, schema failures, and safety incidents with direct Langfuse trace links.
  - Triage decision workflow supporting `dismiss`, `escalate`, and `quarantine` with immutable audit trail notes.
  - Append-only audit logging of access denials and triage operations.
  - Admin Quality Review UI at `app/admin/quality-issues/page.jsx`.
  - Playwright E2E test suite covering all acceptance criteria.
- **Out of Scope**:
  - The 150-case launch suite and CI gates (ADM-08, ADM-10). Automatic prompt rollback.

### Preconditions & Dependencies
- [x] Dependencies: Langfuse scores, safety events, `trace_review` grant store
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a verifier mismatch, leakage event, schema failure, or safety incident, **then** it appears in the quality list with a trace link.
- [x] **Given** an administrator marks an issue triaged, **then** the note and decision are stored.
- [x] **Given** a caller who is not an administrator holding `trace_review`, **then** the list is denied.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design and quality issue store in `lib/quality-issues.js` implementing OP-22.
- [x] Step 2: Implement API routes `GET /api/admin/quality-issues` and `POST /api/admin/quality-issues/[id]/triage`.
- [x] Step 3: Implement admin oversight UI at `app/admin/quality-issues/page.jsx`.
- [x] Step 4: Verification against acceptance criteria and regression suite via Playwright E2E test.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/quality-issues.js` with `getQualityIssues`, `triageQualityIssue`, and `recordQualityIssue`.
- `2026-10-13`: Seeded and validated coverage for all 4 issue categories: `verifier_mismatch`, `leakage_event`, `schema_failure`, and `safety_incident`.
- `2026-10-13`: Linked all issues to Langfuse trace URLs (`https://cloud.langfuse.com/project/traces/...`).
- `2026-10-13`: Supported triage decisions (`dismiss`, `escalate`, `quarantine`) with required notes and audit event logging.
- `2026-10-13`: Enforced strict `trace_review` grant check on administrator accounts (HTTP 403 and audited denial for unauthorized callers).
- `2026-10-13`: Implemented endpoints at `app/api/admin/quality-issues/route.js` and `app/api/admin/quality-issues/[id]/triage/route.js`.
- `2026-10-13`: Built admin review dashboard at `app/admin/quality-issues/page.jsx`.
- `2026-10-13`: Authored Playwright E2E test suite `tests/e2e/adm-03-quality-issues.spec.ts` with all 4 tests passing.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: Playwright E2E
- [x] Typecheck / Linter: Clean Next.js build
- [x] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Running 4 tests using 1 worker

  ✓ [ADM-03] AC1: Quality list contains verifier mismatch, leakage event, schema failure, and safety incident with trace links (153ms)
  ✓ [ADM-03] AC2: Administrator marks issue triaged with decision and note, storing record and audit event (538ms)
  ✓ [ADM-03] AC3: Caller without trace_review grant is denied with HTTP 403 and logged (35ms)
  ✓ [ADM-03] UI Flow: Administrator reviews quality list, inspects trace link, and performs triage (2.6s)

4 passed (6.3s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - Quality list surfaces verifier mismatch, leakage event, schema failure, and safety incident with trace links: Verified
  - Marking issue triaged stores note, decision, and audit event: Verified
  - Caller without `trace_review` grant is denied with HTTP 403 and logged: Verified

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
Delivered OP-22 AI quality issues review and triage capability under PRD §11.2, §14.1, §14.4. The system surfaces verifier mismatches, candidate leakages, schema validation failures, and safety incidents with direct Langfuse trace links. Administrators holding `trace_review` can inspect events and record triage actions (`dismiss`, `escalate`, `quarantine`) with audit-logged rationale. Scoping denies all callers lacking the `trace_review` grant with HTTP 403. All acceptance criteria validated with 4 passing Playwright E2E tests.
