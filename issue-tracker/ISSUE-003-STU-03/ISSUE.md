# ISSUE-003-STU-03: Submit working and selected reasoning options

- **Story ID**: STU-03
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#639](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/639)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to submit my working or select my reasoning method from structured options, **so that** the tutor understands where my thinking went wrong rather than only marking the final answer.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Submit working and selected reasoning options" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-03, FR-04
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Deterministic answer check under 400 ms. In Release 1.0 free text is stored (scrubbed) and reaches no LLM prompt or Langfuse span.
- **Success Metric**: At least 99% alignment between tutor feedback and verifier result for supported problem types

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Handwritten or image-based working. Free-text essay parsing. A partial step is either a structured mathematical expression (STU-11) or a pre-defined selected reasoning option.

### Preconditions & Dependencies
- [ ] Dependencies: Deterministic verifier
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a student picks one of the item's structured reasoning options (deferrable under Cut 1a-1), **then** the choice is stored as `selected_reasoning_option` and the option's metadata maps it to a misconception hint or a solution step. In Release 1.0 this is how reasoning is read.
- [ ] **Given** a numeric, fraction, decimal, percentage, ratio, arithmetic expression (judged by form), or multiple-choice response (algebraic expressions with a variable are not enabled in Release 1.0), **then** it is accepted and parsed. Optional working is `step_expressions` (FR-03; deferrable under Cut 1a-1): one number, fraction, ratio, or unit quantity at a time, not an essay box. Free text is stored (scrubbed) with the attempt, is not sent to the partial-step check, and in Release 1.0 reaches no LLM prompt or Langfuse span.
- [ ] **Given** the student saves a note with no Input Screen hit, **then** it is stored scrubbed for the teacher, the tutor shows only the canned `note_ack`, and the note is not a pipeline turn and changes no counter in any non-terminal state.
- [ ] **Given** an optional confidence rating, **when** the student sends one, **then** it is stored on the attempt. Omitting it still submits the attempt.
- [ ] **Given** a response cannot be parsed, **then** the tutor asks for a rephrase and does not mark the student wrong. A number with a comma outside the `30,000` pattern (for example `7,5`) is such a response, and the tutor asks the student to use a dot for decimals.
- [ ] **Given** the verifier returns `cannot_verify` with `state=ok`, **when** that happens twice in a row on the same question version, **then** the tutor does not claim the answer is incorrect and the session records `ambiguity_review`. EDU-12 shows that flag. One occurrence asks for a rephrase and does not flag. This applies to unparsed or `comma_ambiguous` input only (SM-1 rows 5 and 6): a parsed expression that matches no step (row 5b) also returns `cannot_verify` with `state=ok`, but it does not change `consecutive_cannot_verify` and never triggers structured mode.
- [ ] **Given** the MCP verifier returns an HTTP 4xx/5xx, or a timeout or connect failure whose single per-turn fallback also fails within budget (Gate B [B]; at Tier 1a the verifier is an in-process module and has no transport failure; a budget lapse gives `unverified`, SM-1 row 23), **when** the result is stored, **then** `status` is `cannot_verify` and `state` is `tool_failure`. The student is told the check could not be completed, the session stays open, and the model does not invent a verdict.

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
