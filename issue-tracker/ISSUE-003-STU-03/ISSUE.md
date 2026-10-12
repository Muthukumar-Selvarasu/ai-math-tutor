# ISSUE-003-STU-03: Submit working and selected reasoning options

- **Story ID**: STU-03
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#639](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/639)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
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
- [x] Dependencies: Deterministic verifier
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a student picks one of the item's structured reasoning options (deferrable under Cut 1a-1), **then** the choice is stored as `selected_reasoning_option` and the option's metadata maps it to a misconception hint or a solution step. In Release 1.0 this is how reasoning is read.
- [x] **Given** a numeric, fraction, decimal, percentage, ratio, arithmetic expression (judged by form), or multiple-choice response (algebraic expressions with a variable are not enabled in Release 1.0), **then** it is accepted and parsed. Optional working is `step_expressions` (FR-03; deferrable under Cut 1a-1): one number, fraction, ratio, or unit quantity at a time, not an essay box. Free text is stored (scrubbed) with the attempt, is not sent to the partial-step check, and in Release 1.0 reaches no LLM prompt or Langfuse span.
- [x] **Given** the student saves a note with no Input Screen hit, **then** it is stored scrubbed for the teacher, the tutor shows only the canned `note_ack`, and the note is not a pipeline turn and changes no counter in any non-terminal state.
- [x] **Given** an optional confidence rating, **when** the student sends one, **then** it is stored on the attempt. Omitting it still submits the attempt.
- [x] **Given** a response cannot be parsed, **then** the tutor asks for a rephrase and does not mark the student wrong. A number with a comma outside the `30,000` pattern (for example `7,5`) is such a response, and the tutor asks the student to use a dot for decimals.
- [x] **Given** the verifier returns `cannot_verify` with `state=ok`, **when** that happens twice in a row on the same question version, **then** the tutor does not claim the answer is incorrect and the session records `ambiguity_review`. EDU-12 shows that flag. One occurrence asks for a rephrase and does not flag. This applies to unparsed or `comma_ambiguous` input only (SM-1 rows 5 and 6): a parsed expression that matches no step (row 5b) also returns `cannot_verify` with `state=ok`, but it does not change `consecutive_cannot_verify` and never triggers structured mode.
- [x] **Given** the MCP verifier returns an HTTP 4xx/5xx, or a timeout or connect failure whose single per-turn fallback also fails within budget (Gate B [B]; at Tier 1a the verifier is an in-process module and has no transport failure; a budget lapse gives `unverified`, SM-1 row 23), **when** the result is stored, **then** `status` is `cannot_verify` and `state` is `tool_failure`. The student is told the check could not be completed, the session stays open, and the model does not invent a verdict.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, normaliser (`lib/normaliser.js`), and test scaffolding.
- [x] Step 2: Implementation of core logic, state transitions, reasoning options, step expressions, teacher notes, confidence rating, comma/unparsed handling, and UI components in `lib/session-store.js` and `app/practice/page.jsx`.
- [x] Step 3: Verification against acceptance criteria and regression suite via `tests/e2e/stu-03-reasoning.spec.ts`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-12`: Created `lib/normaliser.js` implementing deterministic normalization for values, word numerals, units, fractions, percentages, ratios, arithmetic expressions, valid thousands commas, comma-ambiguous detection, and regex PII scrubbing.
- `2026-10-12`: Updated `lib/session-store.js` to support:
  - Option-only and combined `selected_reasoning_option` submissions, mapping them to misconception probes or solution steps.
  - Partial working step expression evaluation (`step_expressions`), matching steps or returning `cannot_verify` with `state: ok` for row 5b without changing `consecutive_cannot_verify`.
  - PII-scrubbed teacher notes (`note` event) returning canned `note_ack` without incrementing pipeline turn counters.
  - Optional `confidence_rating` (1–5) stored with attempts.
  - `comma_ambiguous` (e.g. `7,5`) and unparsed inputs returning canned `use_dot_for_decimals` and `rephrase_request` on first occurrence without marking student wrong.
  - Loop guard triggering `input_mode: structured`, flag `ambiguity_review`, and canned `structured_mode_notice` on second consecutive parse issue.
  - Verifier tool failure handling returning `cannot_verify` with `state: tool_failure` and canned `tool_failure_notice`.
- `2026-10-12`: Enhanced `app/practice/page.jsx` UI with reasoning option selector, optional confidence rating dropdown, working step input, private teacher note textarea, `input_mode` and `flags` badges, and attempt history labels.
- `2026-10-12`: Authored `tests/e2e/stu-03-reasoning.spec.ts` covering all 7 acceptance criteria with 100% pass rate.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e` (16 passed)
- [x] Typecheck / Build: `npm run build` (Clean production build)
- [x] Functional / E2E: Verification against all 7 acceptance criteria

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test


Running 16 tests using 7 workers

      1 …escalates level to 1, preserves attempt count at 0, and asks next probe
      2 …calates level by +1 on incorrect or not_sure, but NOT on correct answer
      3 …Question opens in awaiting_first_attempt with level0_prompt and no hint
      4 …: "I am not sure" at Level 4 stays at Level 4 and never reaches Level 5
      5 …th Smoke Test Suite › should load the home page and render brand header
      6 …pt stores attempt number, hint level, duration, and records audit event
      7 …le_prompt checker passes valid prompts and fails multi-prompt sentences
  ✓   7 …pt checker passes valid prompts and fails multi-prompt sentences (45ms)
  ✓   8 …t level, model, prompt version, policy version, and trace status (1.8s)
  ✓   2 … level by +1 on incorrect or not_sure, but NOT on correct answer (2.4s)
  ✓   5 …e Test Suite › should load the home page and render brand header (1.5s)
  ✓   3 …n opens in awaiting_first_attempt with level0_prompt and no hint (2.7s)
  ✓   6 …es attempt number, hint level, duration, and records audit event (1.8s)
  ✓   1 …es level to 1, preserves attempt count at 0, and asks next probe (2.6s)
  ✓   4 … not sure" at Level 4 stays at Level 4 and never reaches Level 5 (2.6s)
  ✓  10 …selected_reasoning_option and maps to misconception hint or step (1.2s)
  ✓  16 …tool_failure, canned tool_failure_notice, and session stays open (38ms)
  ✓   9 …level, and falls back to canned fallback_l{level} when exhausted (1.5s)
  ✓  11 … step expression is parsed, matched to solution step, and stored (1.1s)
  ✓  12 …ored scrubbed, shows canned note_ack, and is not a pipeline turn (1.0s)
  ✓  13 … rating is stored on attempt; omitting it still submits normally (1.1s)
  ✓  14 …30,000 pattern asks for rephrase and does not mark student wrong (1.1s)
  ✓  15 …red mode and flags ambiguity_review; row 5b expression does not (979ms)
  16 passed (5.3s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified

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
Delivered STU-03 working and selected reasoning options flow:
- Normaliser with word numeral, unit expansion, fractions, ratios, percentages, arithmetic expressions, valid thousands commas, comma ambiguity detection, and PII scrubbing.
- Selected reasoning options mapping to misconception probes and solution steps.
- Single working step expressions verification (matching solution steps or returning row 5b cannot_verify without changing consecutive unparsed counters).
- Private teacher notes stored scrubbed and acknowledged with canned note_ack without pipeline turn consumption.
- Optional 1-5 confidence rating stored on attempt records.
- Unparsed loop guard switching to structured mode and setting ambiguity_review flag on 2 consecutive unparsed submissions.
- Verifier tool failure returning cannot_verify with state: tool_failure and canned tool_failure_notice.
- Full E2E Playwright verification suite passing 16/16 tests.
