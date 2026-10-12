# ISSUE-026-STU-11: Check ratio work deterministically

- **Story ID**: STU-11
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#662](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/662)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** equivalent ratio work to be recognised, **so that** a different written form is not marked wrong.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Check ratio work deterministically" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-04
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Verifier p95 under 400 ms (Gate B, on MCP; not run at Tier 1a, where the verifier is in process)
- **Success Metric**: At least 99% agreement between tutor feedback and the verifier on supported types (`verifier_agreement`)

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Question types the MVP does not enable

### Preconditions & Dependencies
- [ ] Dependencies: STU-03
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** an equivalent answer in another format (for example 3/4 and 0.75), **then** the verifier returns `correct`.
- [ ] **Given** a ratio that simplifies to the accepted ratio (for example 6:4 and 3:2), **then** the verifier returns `correct`.
- [ ] **Given** a proportional scaling item, **then** the scaled value is `correct` and an additive change of the same numbers is `incorrect`.
- [ ] **Given** a supported unit conversion, **then** a correct conversion is `correct` and a wrong unit is `incorrect` with `error_category` `unit_error`.
- [ ] **Given** a tolerance rule, **then** a value inside it is `correct` and a value outside it is `incorrect`.
- [ ] **Given** a structured step expression on a supported item, **then** the status is `partially_correct` and `accepted_answer` is false. Free text does not enter this check.
- [ ] **Given** the question data, answer key, and solution plan disagree, **when** the verifier runs, **then** it does not return `correct` and the item is flagged for answer-key inconsistency.
- [ ] **Given** the tutor's last turn used a `scaffold_probes` entry (for example "how far is 2 cm?"), **when** the student submits the probe's expected value (8 km), **then** the verifier returns `partially_correct` for the probe's `counts_as_step_id`, the policy treats it as `progress=advancing`, and the hint level does not rise. A wrong probe answer is `incorrect`, not `cannot_verify`.
- [ ] **Given** a probe answer, **when** the pure verifier result comes from the cache, **then** the response-target overlay is applied after the cache and is never cached. The same value sent with no active probe is judged without the overlay.
- [ ] **Given** a value in the answer field (`response_target=final`) equals an intermediate step value, **then** the status is `incorrect` with `error_category=incomplete`. A bare numeric value is `partially_correct` only from a step field or a probe answer; an expression matching a step's `target_expression` follows the next criterion.
- [ ] **Given** the expression `7.5 × 4` in the answer field or the probe field, **when** the verifier runs, **then** it is `partially_correct` for the step whose `target_expression` it matches, `accepted_answer` is false, and it is never `correct`. `4 × 7.5` gives the same result and `7.5 ÷ 4` does not.
- [ ] **Given** an expression that matches no step, **when** it arrives in the answer field, **then** the status is `cannot_verify` with `state=ok`, its evaluated value and `error_category` are present for classification, and the tutor asks for "the number your calculation gives". The turn is a pipeline turn (SM-1 row 5b): the attempt is not counted, the level does not change, and `consecutive_cannot_verify` is unchanged. **When** it arrives in a probe field, **then** the overlay makes it `incorrect` for the probe.
- [ ] **Given** a `kind: setup` probe, **when** the student enters an expression matching `counts_as_step_id`, **then** it is `partially_correct` for that step and the hint level does not rise. A different parsed expression is `incorrect` for the probe.
- [ ] **Given** a value that equals an intermediate step's `target_value` but not the accepted answer, **when** the pure verifier runs, **then** `status` is `incorrect`, `matched_step_ids` lists that step, and `matched_solution_step` is `null`. A ratio equal to the accepted ratio is `correct`, and its swapped form is `incorrect` with `reversed_ratio_match` and the `swapped_ratio` tag.
- [ ] **Given** an unparseable input, **then** the result is `cannot_verify` with `canonical_value=null` and `error_category=incomplete`. **Given** an MCP HTTP 4xx/5xx, or a timeout whose single per-turn fallback also fails within budget, **then** it is `cannot_verify` with `state=tool_failure` and every other field `null` (a budget lapse is `unverified`, SM-1 row 23).
- [ ] **Given** a `/` between two numbers, **when** it is in the answer field, **then** it is a fraction value (`3/4` equals `0.75`). **When** it is in a step or probe field, **then** it is read as `÷`, so `450/5` matches a step whose `target_expression` is `450 / 5`. `÷` and `×` are always operators, and `x` between two numerals is `×`.
- [ ] **Given** any verifier call, **then** the result validates against the pure result schema (`input_kind`, `canonical_value`, `canonical_expression`, `matched_step_ids`, `relation_tags`, plus the FR-04 fields), `relation_tags` is derived from `error_category` as FR-04 defines, and the cached value is that same object with no session field.
- [ ] **Given** a probe's expected value does not evaluate from its expression or (for a `kind: value` probe) equals the item's final answer, **when** content validation runs, **then** the item fails import.
- [ ] **Given** two accepted methods, **when** the student submits either, **then** both return `correct`.
- [ ] **Given** a rounding rule, **when** the value is inside it, **then** the status is `correct`. A value outside it is `incorrect`.
- [ ] **Given** a required unit is missing, **when** the verifier runs, **then** the status is `incorrect` and `error_category` is `missing_unit`.

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
