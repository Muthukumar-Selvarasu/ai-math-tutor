# ISSUE-035-STU-15: Retrieve exemplars only when the verifier can use them

- **Story ID**: STU-15
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#671](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/671)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** exemplar lookup to run only when my answer was actually checked, **so that** a correct answer or a failed check does not invent a misconception.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Retrieve exemplars only when the verifier can use them" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 9.8, 10.5, 11.3, 21
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: These rules are also in Sections 9.8, 11.3, and 21. This story is their section 6 home.
- **Success Metric**: A correct attempt and a `tool_failure` both record `retrieval: skipped`

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Naming the misconception to the student (STU-04)

### Preconditions & Dependencies
- [ ] Dependencies: STU-03, STU-04
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** `status` is `correct` or `partially_correct` (advancing or stalled), or `state` is `tool_failure`, **when** the turn is assembled, **then** retrieval and the classifier do not run, and the turn stores `retrieval: skipped` and `misconception: none`. `tool_failure` is a state, and the status on that row is `cannot_verify`.
- [ ] **Given** the post-overlay status is `incorrect`, or `cannot_verify` with `state=ok`, **when** the gate opens, **then** MCP `search_exemplars` runs on approved published exemplars only (Gate B [B]). At Tier 1a (Gate A) the gate runs but the exemplar source is an empty stub that returns an empty list, and the turn records `retrieval: empty`; the real exact-SQL exemplar query, exemplar authoring and the `search_exemplars` MCP tool arrive in Tier 1b.
- [ ] **Given** `cannot_verify` with `state=ok` and no matched step, **when** the classifier returns, **then** the label is `insufficient_evidence`.
- [ ] **Given** retrieval ran and returned no exemplars, **when** the classifier finishes, **then** it records that it used none and the turn still completes.
- [ ] **Given** `search_exemplars` runs (Gate B [B]), **then** its query contains only `skill_id`, `error_category`, the canonical numeric student value and relation tags, and a prompt-capture test shows no free text in it.
- [ ] **Given** the same normalised expression is checked again on the same question version and tolerance rule, **when** the cache is read, **then** the result is an exact-key hit and the trace says so (Gate B [B]; there is no cache at Tier 1a).
- [ ] **Given** the taxonomy used for launch, **when** it is loaded, **then** it includes `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, and `answer_guessing`, plus `insufficient_evidence`.

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
