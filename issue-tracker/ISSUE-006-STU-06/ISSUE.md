# ISSUE-006-STU-06: Test understanding with a similar question

- **Story ID**: STU-06
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#642](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/642)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to try a similar question after finishing, **so that** I can check I can solve it without help.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Test understanding with a similar question" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-10
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Transfer item selection is deterministic: graph-legal shortlist, tie-break by pgvector similarity then lowest `question_id` (Tier 1b)
- **Success Metric**: At least 80% of completed sessions are followed by a transfer problem

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Student choice of transfer difficulty

### Preconditions & Dependencies
- [ ] Dependencies: Question bank, skill graph (pgvector tie-break from Tier 1b), learner model
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a problem is completed, **then** a near-transfer question with different context or values is offered, and it is an approved published item.
- [ ] **Given** the transfer question starts, **then** no hint is given before the first independent attempt.
- [ ] **Given** the transfer is completed or declined, **then** the outcome is correct, incorrect, or skipped, and a skip does not raise learner confidence.
- [ ] **Given** a shortlist (authored skill-graph partners at Tier 1a, with pgvector similarity as the tie-break from Tier 1b), **then** the skill graph rejects an item that needs a skill the student has not been taught, and it rejects an item whose accepted value or simplified ratio matches the completed item.
- [ ] **Given** the skill graph has no legal partner, **then** the session records `no_legal_transfer` and no item is invented.
- [ ] **Given** content validation of the published bank, **then** an approved item with no legal transfer partner fails validation.
- [ ] **Given** the student solves the item, **when** the session enters `reflection`, **then** the item's authored `reflection` prompt is shown with the student's own verified value in place of `{student_value}`, with 3 or 4 structured options and Skip. No model, verifier or retrieval runs, and there is no `hint_decision`.
- [ ] **Given** the student selects a reflection option or Skip, **then** the choice and its `sound` flag are stored (the flag is visible to the teacher only), the option's authored `feedback` is shown whatever its value, the student is never told they are wrong, and the session moves to `transfer_offered`.
- [ ] **Given** an item whose `reflection` block breaks V9, **when** import validation runs, **then** the item is rejected.

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
