# ISSUE-043-ADM-09: Retain metadata after purge

- **Story ID**: ADM-09
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 3: Platform Governance & Scale]
- **Priority**: [P2]
- **Status**: Planned
- **GitHub Issue**: [#679](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/679)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
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
- [ ] Dependencies: ADM-02, ADM-07
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a chat log, attempt, model trace, student-specific diagram blob, tutor note, student note, or teacher comment is older than its window, **when** `retention-purge` runs, **then** that body is deleted. For an attempt, the body is `response_value`, `step_expressions`, and `free_text`. Status, hint level, skill id, and timestamps remain, so EDU-01 and EDU-02 links still open. Notes and comments use 365 days.
- [ ] **Given** a record is still inside its window, **when** `retention-purge` runs, **then** it is kept.
- [ ] **Given** an audit row or an approved question diagram, **when** `retention-purge` runs, **then** it is kept.
- [ ] **Given** a purged turn, **when** a teacher opens the replay, **then** they see the metadata and a notice that the message body was removed.
- [ ] **Given** the Langfuse trace has been purged, **when** a `trace_review` administrator opens the replay, **then** the link is replaced with a notice that the trace expired.

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
