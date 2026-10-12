# ISSUE-002-STU-02: One focused hint at a time

- **Story ID**: STU-02
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#638](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/638)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** one focused hint at a time, **so that** I am not overwhelmed and can act on each step.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "One focused hint at a time" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-05, FR-06, Section 9.5
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: One question per turn is this story. The safety loop is STU-13. The wait and the loading state are STU-14. No tokens are shown before allow, the leakage check, and persistence (Section 11.3).
- **Success Metric**: At least 95% of tutor prompts match the configured hint policy

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The safety loop (STU-13), the loading state (STU-14), and multi-step lesson mode

### Preconditions & Dependencies
- [ ] Dependencies: Hint Policy Engine
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a delivered tutor turn, **when** the deterministic checker runs, **then** the prompt has one question mark, or one sentence whose first word is try, look, find, compare, write, or check, and not a second of either. The score is `single_prompt`, and it blocks CI. At Tier 1a it is a local eval-harness score and `trace_status` is `missing` (or local); Langfuse tracing and scoring are live from Tier 1b.
- [ ] **Given** an attempt at hint level 0, 1, 2, or 3, **when** policy runs, **then** the level rises by one only if the attempt is `incorrect`, stalled partial work, or `"I am not sure"`. A `correct` answer or an advancing intermediate step (`partially_correct` with `progress=advancing`) does **not** raise the level.
- [ ] **Given** the prompt "Look at the table. What is the ratio?", **when** the one-question check runs, **then** it passes. **Given** "Look at the table. Find the parts. What is the ratio?", **when** the check runs, **then** it fails.
- [ ] **Given** a turn is delivered, **when** it is stored, **then** hint level, model, prompt version, and policy version are stored on the turn and, from Tier 1b, linked to the Langfuse trace (at Tier 1a `trace_status` is `missing` or local).
- [ ] **Given** a turn at Level 1, 2 or 3, **when** the policy selects a probe, **then** it is the first probe not yet asked, in authored order, whose `min_level` is at most the current level, and it is marked asked. **Given** none remains, **then** the turn is the canned `fallback_l{level}` with no model call.

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
