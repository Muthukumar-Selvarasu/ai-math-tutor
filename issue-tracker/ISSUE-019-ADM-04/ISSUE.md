# ISSUE-019-ADM-04: Content publishing controls

- **Story ID**: ADM-04
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#655](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/655)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
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
- [ ] Step 1: Technical design, schema updates, and test scaffolding.
- [ ] Step 2: Implementation of core logic, state transitions, or UI components.
- [ ] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [ ] Automated Tests: `pytest`
- [ ] Typecheck / Linter: `ruff check apps/api && mypy apps/api`
- [ ] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Pending execution
```

### Acceptance Criteria Verification
- [ ] All Given / When / Then criteria verified: Pending

---

## 4. Closure

### Definition of Done (DoD) Sign-off Checklist
- [ ] All Pre-flight acceptance criteria verified
- [ ] Execution plan completed
- [ ] Automated test suite passed with evidence logged
- [ ] Regressions / leakage / security gates checked where applicable
- [ ] Local `ISSUE.md` marked `Status: Completed`
- [ ] Master `issue-tracker/TRACKER.md` updated and marked `Completed`
- [ ] GitHub Issue closed via `gh issue close` (ONLY after local files are updated)

### Closure Summary
Pending implementation.
