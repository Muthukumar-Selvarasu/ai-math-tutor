# ISSUE-026-STU-11: Check ratio work deterministically

- **Story ID**: STU-11
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#662](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/662)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
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
  - Strict preservation of all existing passing features and zero regressions across earlier issues.
- **Out of Scope**:
  - Changes that violate ADR architectural locks or cut lines.

### Preconditions & Dependencies
- [x] Dependencies: STU-03
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** an equivalent answer in another format (for example 3/4 and 0.75), **then** the verifier returns `correct`.
- [x] **Given** a ratio that simplifies to the accepted ratio (for example 6:4 and 3:2), **then** the verifier returns `correct`.
- [x] **Given** a proportional scaling item, **then** the scaled value is `correct` and an additive change of the same numbers is `incorrect`.
- [x] **Given** a supported unit conversion, **then** a correct conversion is `correct` and a wrong unit is `incorrect` with `error_category` `unit_error`.
- [x] **Given** a tolerance rule, **then** a value inside it is `correct` and a value outside it is `incorrect`.
- [x] **Given** a structured step expression on a supported item, **then** the status is `partially_correct` and `accepted_answer` is false. Free text does not enter this check.
- [x] **Given** the question data, answer key, and solution plan disagree, **when** the verifier runs, **then** it does not return `correct` and the item is flagged for answer-key inconsistency.
- [x] **Given** the tutor's last turn used a `scaffold_probes` entry (for example "how far is 2 cm?"), **when** the student submits the probe's expected value (8 km), **then** the verifier returns `partially_correct` for the probe's `counts_as_step_id`, the policy treats it as `progress=advancing`, and the hint level does not rise. A wrong probe answer is `incorrect`, not `cannot_verify`.
- [x] **Given** a probe answer, **when** the pure verifier result comes from the cache, **then** the response-target overlay is applied after the cache and is never cached. The same value sent with no active probe is judged without the overlay.
- [x] **Given** a value in the answer field (`response_target=final`) equals an intermediate step value, **then** the status is `incorrect` with `error_category=incomplete`. A bare numeric value is `partially_correct` only from a step field or a probe answer; an expression matching a step's `target_expression` follows the next criterion.
- [x] **Given** the expression `7.5 × 4` in the answer field or the probe field, **when** the verifier runs, **then** it is `partially_correct` for the step whose `target_expression` it matches, `accepted_answer` is false, and it is never `correct`. `4 × 7.5` gives the same result and `7.5 ÷ 4` does not.
- [x] **Given** an expression that matches no step, **when** it arrives in the answer field, **then** the status is `cannot_verify` with `state=ok`, its evaluated value and `error_category` are present for classification, and the tutor asks for "the number your calculation gives". The turn is a pipeline turn (SM-1 row 5b): the attempt is not counted, the level does not change, and `consecutive_cannot_verify` is unchanged. **When** it arrives in a probe field, **then** the overlay makes it `incorrect` for the probe.
- [x] **Given** a `kind: setup` probe, **when** the student enters an expression matching `counts_as_step_id`, **then** it is `partially_correct` for that step and the hint level does not rise. A different parsed expression is `incorrect` for the probe.
- [x] **Given** a value that equals an intermediate step's `target_value` but not the accepted answer, **when** the pure verifier runs, **then** `status` is `incorrect`, `matched_step_ids` lists that step, and `matched_solution_step` is `null`. A ratio equal to the accepted ratio is `correct`, and its swapped form is `incorrect` with `reversed_ratio_match` and the `swapped_ratio` tag.
- [x] **Given** an unparseable input, **then** the result is `cannot_verify` with `canonical_value=null` and `error_category=incomplete`. **Given** an MCP HTTP 4xx/5xx, or a timeout whose single per-turn fallback also fails within budget, **then** it is `cannot_verify` with `state=tool_failure` and every other field `null` (a budget lapse is `unverified`, SM-1 row 23).
- [x] **Given** a `/` between two numbers, **when** it is in the answer field, **then** it is a fraction value (`3/4` equals `0.75`). **When** it is in a step or probe field, **then** it is read as `÷`, so `450/5` matches a step whose `target_expression` is `450 / 5`. `÷` and `×` are always operators, and `x` between two numerals is `×`.
- [x] **Given** any verifier call, **then** the result validates against the pure result schema (`input_kind`, `canonical_value`, `canonical_expression`, `matched_step_ids`, `relation_tags`, plus the FR-04 fields), `relation_tags` is derived from `error_category` as FR-04 defines, and the cached value is that same object with no session field.
- [x] **Given** a probe's expected value does not evaluate from its expression or (for a `kind: value` probe) equals the item's final answer, **when** content validation runs, **then** the item fails import.
- [x] **Given** two accepted methods, **when** the student submits either, **then** both return `correct`.
- [x] **Given** a rounding rule, **when** the value is inside it, **then** the status is `correct`. A value outside it is `incorrect`.
- [x] **Given** a required unit is missing, **when** the verifier runs, **then** the status is `incorrect` and `error_category` is `missing_unit`.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding.
- [x] Step 2: Implementation of core logic, state transitions, or UI components.
- [x] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented deterministic mathematics verification agent `MathVerifierAgent` (AG-02) in `lib/math-verifier.js` adhering to FR-04, SPEC §2.4, §3.6-3.9, and WF-06.
  - Added deterministic ratio simplification (`simplifyRatio`), equivalent ratio comparison (`areRatiosEquivalent`), ratio reversal detection (`isRatioSwapped`).
  - Added unit consistency and metric/currency conversion checks (`checkUnitConsistency`).
  - Implemented expression form equivalence matcher (`matchExpressionByForm`) supporting commutative operations (`+`, `*`) and non-commutative (`-`, `/`).
  - Implemented pure evaluation function `verifyExpression`, exact-key cache store (`verifierCache`), pure schema validation (`validatePureResultSchema`), and uncached response-target overlay (`applyOverlay`).
  - Extended `lib/normaliser.js` to support attached and spaced unit tokens (`km`, `m`, `cm`, `mm`, `kg`, `g`, `l`, `litres`, `ml`, `dollars`, `parts`).
  - Extended `lib/content-validator.js` with `validateProbes` for probe expected value and expression consistency (Rule TECH-07).
  - Integrated `MathVerifierAgent.runTurn` into `lib/session-store.js` with support for active probe tracking, `progress: "advancing"`, and response target overlays.
  - Updated `app/practice/page.jsx` to dynamically target active probes when submitting probe responses.
  - Implemented comprehensive Playwright test suite `tests/e2e/stu-11-ratio-verifier.spec.ts` covering all 21 acceptance criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: Playwright E2E (`npm run test:e2e`)
- [x] Typecheck / Linter: Validated against strict schema definitions
- [x] Functional / E2E: Verified all 21 acceptance criteria with Playwright

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 79 tests using 1 worker

  ✓   1 tests/e2e/smoke.spec.ts:3:5 › SolvePath Smoke Test Suite › should load the home page and render brand header (9.5s)
  ✓   2 tests/e2e/stu-01-attempt.spec.ts:5:7 › STU-01: First-attempt and counter model › Question opens in awaiting_first_attempt with level0_prompt and no hint (1.2s)
  ...
  ✓  58 tests/e2e/stu-10-input-safety.spec.ts:187:7 › STU-10: Safe handling of unsafe input › synthetic unsafe-input fixtures evaluate with recall >= 0.90 (reported) (4ms)
[STU-10 Unsafe-Input Fixtures Recall Report]
Total fixtures: 12
Matched: 12
Recall: 100.0% (Target: >= 90%)
  ✓  59 tests/e2e/stu-11-ratio-verifier.spec.ts:23:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 1: Equivalent answer in another format (3/4 and 0.75) returns correct (17ms)
  ✓  60 tests/e2e/stu-11-ratio-verifier.spec.ts:71:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 2: Ratio that simplifies to the accepted ratio (6:4 and 3:2) returns correct (0ms)
  ✓  61 tests/e2e/stu-11-ratio-verifier.spec.ts:97:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 3: Proportional scaling is correct, additive change of same numbers is incorrect (16ms)
  ✓  62 tests/e2e/stu-11-ratio-verifier.spec.ts:135:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 4: Supported unit conversion (8 km vs 8000 m) is correct, wrong unit is unit_error (0ms)
  ✓  63 tests/e2e/stu-11-ratio-verifier.spec.ts:175:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 5: Tolerance rule: within tolerance is correct, outside is incorrect (0ms)
  ✓  64 tests/e2e/stu-11-ratio-verifier.spec.ts:204:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 6: Structured step expression on a supported item is partially_correct, accepted_answer: false, and hint level escalates (18ms)
  ✓  65 tests/e2e/stu-11-ratio-verifier.spec.ts:229:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 7: Disagreeing answer key and solution plan returns cannot_verify and flags session (1ms)
  ✓  66 tests/e2e/stu-11-ratio-verifier.spec.ts:257:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 8: Scaffold probe answer expected value returns partially_correct, progress=advancing, level unchanged; wrong probe answer returns incorrect (46ms)
  ✓  67 tests/e2e/stu-11-ratio-verifier.spec.ts:314:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 9: Response-target overlay is applied after cache and is never cached; same value without active probe judged without overlay (1ms)
  ✓  68 tests/e2e/stu-11-ratio-verifier.spec.ts:359:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 10: Intermediate value in final answer field returns incorrect with error_category incomplete (0ms)
  ✓  69 tests/e2e/stu-11-ratio-verifier.spec.ts:375:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 11: Expression 7.5 × 4 is partially_correct, accepted_answer: false, never correct; 4 × 7.5 matches, 7.5 ÷ 4 does not (1ms)
  ✓  70 tests/e2e/stu-11-ratio-verifier.spec.ts:420:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 12: Expression matching no step in answer field returns cannot_verify (row 5b, uncounted, level unchanged); in probe field returns incorrect (17ms)
  ✓  71 tests/e2e/stu-11-ratio-verifier.spec.ts:465:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 13: kind: setup probe expression matching counts_as_step_id is partially_correct, different expression is incorrect (0ms)
  ✓  72 tests/e2e/stu-11-ratio-verifier.spec.ts:517:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 14: Value equal to intermediate step target_value in pure verifier has status incorrect, matched_step_ids; swapped ratio is incorrect with reversed_ratio_match and swapped_ratio tag (0ms)
  ✓  73 tests/e2e/stu-11-ratio-verifier.spec.ts:553:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 15: Unparseable input returns cannot_verify with canonical_value=null and incomplete; tool failure returns cannot_verify tool_failure (1ms)
  ✓  74 tests/e2e/stu-11-ratio-verifier.spec.ts:580:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 16: / in answer field is fraction (3/4 = 0.75); in step or probe field read as ÷ (450/5 matches 450 / 5); x between numerals is × (0ms)
  ✓  75 tests/e2e/stu-11-ratio-verifier.spec.ts:607:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 17: Pure result validates against pure result schema, relation_tags derived from error_category, cached object has no session field (1ms)
  ✓  76 tests/e2e/stu-11-ratio-verifier.spec.ts:632:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 18: Content validation fails item whose kind: value probe does not evaluate or equals final answer, or kind: setup probe expected_expression != target_expression (0ms)
  ✓  77 tests/e2e/stu-11-ratio-verifier.spec.ts:682:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 19: Two accepted methods / valid alternatives: submitting either returns correct (1ms)
  ✓  78 tests/e2e/stu-11-ratio-verifier.spec.ts:718:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 20: Rounding rule: value inside rounding rule is correct, outside is incorrect (0ms)
  ✓  79 tests/e2e/stu-11-ratio-verifier.spec.ts:746:7 › STU-11: Deterministic Ratio & Math Verifier › Criterion 21: Required unit missing returns incorrect with error_category missing_unit (1ms)

  79 passed (40.4s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 21 of 21 verified and passing.

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
The deterministic math verifier agent `MathVerifierAgent` (AG-02) has been fully implemented in accordance with PRD FR-04 and SPEC §2.4, §3.6-§3.9, and WF-06. The verifier accurately recognises equivalent ratios, simplifies ratios, performs unit conversions, validates tolerance and rounding rules, evaluates step expressions, manages probe response overlays, maintains exact-key cache isolation, and strictly avoids any LLM calls on the math verification path. All 79 E2E tests pass with zero regressions.
