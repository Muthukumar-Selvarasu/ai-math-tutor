# ISSUE-035-STU-15: Retrieve exemplars only when the verifier can use them

- **Story ID**: STU-15
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#671](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/671)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
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
- [x] Dependencies: STU-03, STU-04
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** `status` is `correct` or `partially_correct` (advancing or stalled), or `state` is `tool_failure`, **when** the turn is assembled, **then** retrieval and the classifier do not run, and the turn stores `retrieval: skipped` and `misconception: none`. `tool_failure` is a state, and the status on that row is `cannot_verify`.
- [x] **Given** the post-overlay status is `incorrect`, or `cannot_verify` with `state=ok`, **when** the gate opens, **then** MCP `search_exemplars` runs on approved published exemplars only (Gate B [B]). At Tier 1a (Gate A) the gate runs but the exemplar source is an empty stub that returns an empty list, and the turn records `retrieval: empty`; the real exact-SQL exemplar query, exemplar authoring and the `search_exemplars` MCP tool arrive in Tier 1b.
- [x] **Given** `cannot_verify` with `state=ok` and no matched step, **when** the classifier returns, **then** the label is `insufficient_evidence`.
- [x] **Given** retrieval ran and returned no exemplars, **when** the classifier finishes, **then** it records that it used none and the turn still completes.
- [x] **Given** `search_exemplars` runs (Gate B [B]), **then** its query contains only `skill_id`, `error_category`, the canonical numeric student value and relation tags, and a prompt-capture test shows no free text in it.
- [x] **Given** the same normalised expression is checked again on the same question version and tolerance rule, **when** the cache is read, **then** the result is an exact-key hit and the trace says so (Gate B [B]; there is no cache at Tier 1a).
- [x] **Given** the taxonomy used for launch, **when** it is loaded, **then** it includes `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, and `answer_guessing`, plus `insufficient_evidence`.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`lib/retrieval-gate.js`).
- [x] Step 2: Implementation of core logic, state transitions, or UI components (`lib/session-store.js` integration).
- [x] Step 3: Verification against acceptance criteria and regression suite (`tests/e2e/stu-15-retrieval-gate.spec.ts`).

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Created `lib/retrieval-gate.js` implementing AG-04 RetrievalGate:
  - `evaluateRetrievalGate`: opens only for `incorrect` without match or `cannot_verify` with `state=ok`; closes on `correct`, `partially_correct`, `tool_failure`, and deterministic match.
  - `searchExemplarsStub`: Tier 1a empty exemplar stub returning `{ exemplars: [], retrieval: 'empty' }`.
  - `validateRetrievalQuery`: prompt-capture guard validating numbers/tags only and rejecting student free text.
  - `isRetrievalCacheEnabled`: returns false (no cache at Tier 1a).
  - `buildExemplarCacheKey`: exact deterministic hash for Gate B.
  - `MISCONCEPTION_TAXONOMY`: 13-value closed taxonomy enum.
- `2026-10-13`: Integrated `evaluateRetrievalGate` into `lib/session-store.js` across attempts, tutor turns, and audit events.
- `2026-10-13`: Created `tests/e2e/stu-15-retrieval-gate.spec.ts` covering all 7 acceptance criteria.
- `2026-10-13`: Ran full E2E test suite (128/128 passed).

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-15-retrieval-gate.spec.ts` (7 passed)
- [x] Full E2E Test Suite: `npm run test:e2e` (128 passed)

### Verification Evidence & Results
```text
Running 7 tests using 1 worker

     1 …re, and deterministic match skip retrieval and record retrieval: skipped
  ✓  1 …deterministic match skip retrieval and record retrieval: skipped (557ms)
     2 …_verify with state=ok opens gate and records retrieval: empty at Tier 1a
  ✓  2 … with state=ok opens gate and records retrieval: empty at Tier 1a (41ms)
     3 …=ok and no matched step forces classifier label to insufficient_evidence
  ✓  3 … no matched step forces classifier label to insufficient_evidence (21ms)
     4 …ieval records exemplars_used: none and the turn still completes normally
  ✓  4 …ecords exemplars_used: none and the turn still completes normally (21ms)
     5 …contains numbers only and prompt-capture guard rejects student free text
  ✓  5 …ns numbers only and prompt-capture guard rejects student free text (2ms)
     6 … 6: Tier 1a has no cache; Gate B exact-key cache format is deterministic
  ✓  6 …er 1a has no cache; Gate B exact-key cache format is deterministic (0ms)
     7 …aunch includes all 12 domain codes plus insufficient_evidence (13 total)
  ✓  7 …includes all 12 domain codes plus insufficient_evidence (13 total) (1ms)
  7 passed (2.3s)

Full regression run (npm run test:e2e):
  128 passed (1.0m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 7/7 passed in `tests/e2e/stu-15-retrieval-gate.spec.ts` and 128/128 across all suites.

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
Implemented STU-15 AG-04 RetrievalGate:
- Retrieval and classifier are skipped on `correct`, `partially_correct`, `tool_failure`, and deterministic prediction matches, storing `retrieval: "skipped"` and `misconception: "none"`.
- Gate opens on unmatched `incorrect` and `cannot_verify` with `state=ok`, recording `retrieval: "empty"` and `exemplars: []` at Tier 1a.
- When `cannot_verify` with `state=ok`, classifier label is forced to `insufficient_evidence`, `exemplars_used: "none"`.
- Empty retrieval records `exemplars_used: "none"` without failing the turn.
- Search query enforces numbers only and blocks student free text with prompt-capture validation.
- Validated 13-value taxonomy enum and documented Tier 1a cache-disabled contract.
- 128/128 E2E tests passing.
