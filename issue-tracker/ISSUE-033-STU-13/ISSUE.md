# ISSUE-033-STU-13: Keep an unapproved turn off the screen

- **Story ID**: STU-13
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#669](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/669)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to see only a turn the safety check has allowed, **so that** a rejected or unreachable draft never appears as the tutor.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Keep an unapproved turn off the screen" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 11.2, 11.3, 12.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: One token rule lives here. STU-05 does not repeat it.
- **Success Metric**: A rejected candidate is absent from the student-visible payload

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The leakage override, which is STU-05

### Preconditions & Dependencies
- [x] Dependencies: STU-02
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a candidate is rejected and an iteration remains, **when** the loop continues, **then** the dialogue agent revises it. The student sees no tokens from the rejected text.
- [x] **Given** the loop has used both iterations without an allow, or the Safety Guard cannot be reached, **when** a turn is due, **then** the student receives the deterministic fallback and the session records `safety_fallback`.
- [x] **Given** the Dialogue agent times out, the provider is unreachable, or its output fails `schema_valid`, **when** the turn is due, **then** the student receives the same fallback and is not told they are wrong.
- [x] **Given** the Classifier times out, the provider is unreachable, or its output fails `schema_valid`, **when** the turn is due, **then** no misconception claim is made, the prompt type is `diagnostic_probe`, an audit event names the cause, and the turn continues through the Dialogue agent and the Safety Guard as normal. The student receives no fallback prompt because of a Classifier failure.
- [x] **Given** a candidate asks for personal information, promises exam success, makes a selective-entry or placement claim, or infers a sensitive attribute, **when** the deterministic phrase check runs (in the same cheap step as the leakage check, before the guard), **then** a hit blocks the candidate before the guard is called and triggers the revision or the fallback.
- [x] **Given** the student text contains an email address or a phone number, **when** the tutor reply and the trace are built, **then** that pattern is removed. The Input PII Scrubber also replaces names it recognises with `[STUDENT_NAME]`, which is best effort, so a name it misses is still treated as untrusted text. The tutor does not ask the student to identify themselves.
- [x] **Given** Postgres is unreachable before the attempt is stored, **when** the student submits, **then** the server returns 503 `service_unavailable` (retryable), no pipeline runs, no counter changes, and the answer field keeps its text.
- [x] **Given** Langfuse is unavailable or its flush fails, **when** a turn runs, **then** the turn is still delivered, the flush waits at most 300 ms, and the turn stores `trace_status=missing`.
- [x] **Given** the provider times out, returns `429` or 5xx, or its output is invalid after one repair, or the turn passes the 7.5 s hard stop, **when** a turn is due, **then** the student receives the deterministic fallback with `fallback_reason` of `provider_error`, `schema_invalid` or `budget`, and no session flag is set. `safety_fallback` is set only for `loop_exhausted` and `guard_unreachable`.
- [x] **Given** MCP returns an HTTP error, **then** the result is `cannot_verify` with `state=tool_failure` and a fixed message, and no counter changes. A timeout or connect failure uses the single per-turn fallback instead (a repeat MCP call on the Vercel topology, the in-process module on a container topology). This AC is Gate B [B]: at Tier 1a the verifier is in-process and has no transport failure.
- [x] **Given** the Blob read fails or the SVG is missing, **then** the diagram is rendered from the validated spec in process, and if that fails the probe text is shown without a diagram and `diagram_unavailable` is stored. An unvalidated image is never served.
- [x] **Given** a student free-text value is found in a model prompt, **when** the prompt-capture guard runs, **then** the turn fails before the model call with the fixed fallback and a `prompt_capture_violation` audit event.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`tests/e2e/stu-13-safety-guard.spec.ts`).
- [x] Step 2: Implementation of core logic, state transitions, prompt capture guard, safety guard 2-iteration loop, deterministic phrase checking, and fallback displays.
- [x] Step 3: Verification against acceptance criteria and regression suite.

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-13`: Implemented `lib/prompt-capture-guard.js` checking that student free-text values are absent from all LLM prompt templates before model invocation; triggers fallback with P0 `prompt_capture_violation` audit event.
- `2026-10-13`: Extended `lib/leak-checker.js` with deterministic forbidden phrase checks (`FORBIDDEN_PHRASE_PATTERNS`) targeting personal information requests, exam success promises, selective-entry/placement claims, and sensitive attribute inferences.
- `2026-10-13`: Enhanced `lib/safety-guard.js` with iterative validation (iteration 1 soft `revise` vs iteration 2 hard `block`), hard block criteria (`shaming_language`, `peer_comparison`, `ability_label`, `forbidden_value_leakage`, `taxonomy_leakage`), escalation detection (`escalate`), and simulation hooks (`simulate_guard_unreachable`, `simulate_guard_timeout`, `simulate_escalate`).
- `2026-10-13`: Refined `lib/normaliser.js` (`scrubPii`) to scrub emails, phone numbers, and capitalized student proper nouns with `[STUDENT_NAME]` while avoiding common verb collisions.
- `2026-10-13`: Updated `lib/session-store.js` with 2-iteration dialogue loop, fallback handling (`loop_exhausted`, `guard_unreachable`, `provider_error`, `schema_invalid`, `budget`, `tool_failure`, `diagram_unavailable`), `safety_fallback` session flag, and fallback reason exposure.
- `2026-10-13`: Updated `app/api/sessions/[id]/events/route.js` and `app/practice/page.jsx` for 503 `service_unavailable` retryable handling with input preservation, fallback reason badges, and safety fallback status display.
- `2026-10-13`: Added full E2E test suite `tests/e2e/stu-13-safety-guard.spec.ts` covering all 12 acceptance criteria + escalation scenario.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e`
- [x] Functional / E2E: Verification against acceptance criteria in `tests/e2e/stu-13-safety-guard.spec.ts`

### Verification Evidence & Results
```text
$ npm run test:e2e

Running 114 tests using 1 worker
  ✓   1 [chromium] › tests/e2e/stu-01-question-view.spec.ts:8:7 › STU-01: Question View (Tier 1a) › AC-1: Display question text without answer leak (500ms)
...
  ✓  91 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:9:7 › STU-13: Keep an unapproved turn off the screen › Criterion 1: Rejected candidate is revised by dialogue agent in iteration 2; student sees no tokens from rejected text (597ms)
  ✓  92 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:51:7 › STU-13: Keep an unapproved turn off the screen › Criterion 2a: Both iterations rejected triggers deterministic fallback and sets safety_fallback flag (592ms)
  ✓  93 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:86:7 › STU-13: Keep an unapproved turn off the screen › Criterion 2b: Safety Guard unreachable triggers deterministic fallback and sets safety_fallback flag (582ms)
  ✓  94 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:117:7 › STU-13: Keep an unapproved turn off the screen › Criterion 3: Dialogue agent timeout / provider error / schema_invalid delivers fallback without telling student they are wrong (24ms)
  ✓  95 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:159:7 › STU-13: Keep an unapproved turn off the screen › Criterion 4: Classifier failure yields no misconception claim, prompt_type=diagnostic_probe, and continues turn through dialogue without fallback (608ms)
  ✓  96 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:187:7 › STU-13: Keep an unapproved turn off the screen › Criterion 5: Asking personal info, promising exam success, or inferring sensitive attributes is blocked by phrase check before guard (0ms)
  ✓  97 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:223:7 › STU-13: Keep an unapproved turn off the screen › Criterion 6: Student text PII scrubber redacts emails, phone numbers, and recognizes names as [STUDENT_NAME] (0ms)
  ✓  98 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:238:7 › STU-13: Keep an unapproved turn off the screen › Criterion 7: Postgres unreachable returns 503 service_unavailable, no pipeline runs, counters unchanged, and answer input preserves text (643ms)
  ✓  99 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:289:7 › STU-13: Keep an unapproved turn off the screen › Criterion 8: Langfuse failure delivers turn normally with trace_status=missing (576ms)
  ✓ 100 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:311:7 › STU-13: Keep an unapproved turn off the screen › Criterion 9: Provider error / schema invalid / budget exceeded delivers fallback with reason=budget and sets NO session flag (15ms)
  ✓ 101 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:333:7 › STU-13: Keep an unapproved turn off the screen › Criterion 10: Verifier cannot_verify / tool_failure returns tool_failure_notice without changing counters or hint level (14ms)
  ✓ 102 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:359:7 › STU-13: Keep an unapproved turn off the screen › Criterion 11: Blob / SVG diagram unavailable preserves probe text without diagram and records diagram_unavailable flag (578ms)
  ✓ 103 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:386:7 › STU-13: Keep an unapproved turn off the screen › Criterion 12: Prompt capture guard detects student free text in model prompt, fails turn before model call with fallback and P0 audit event (19ms)
  ✓ 104 [chromium] › tests/e2e/stu-13-safety-guard.spec.ts:421:7 › STU-13: Keep an unapproved turn off the screen › Safety Guard Escalate: Candidate triggering safety guard escalate returns fallback with reason=loop_exhausted, safety_fallback flag, and safety_incident audit event (618ms)
...
  ✓ 114 [chromium] › tests/e2e/stu-19-estimate-understanding.spec.ts:182:7 › STU-19: Estimate understanding from this turn › Criterion 5: Practice page renders tone and student state badges in tutor meta row (1.7s)

  114 passed (48.2s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 12 criteria and all edge cases verified across 14 dedicated test cases, 114 total test cases passing with zero regressions.

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
STU-13 completed successfully. Unapproved candidates are intercepted by deterministic checks and AG-10 Safety Guard. Revision logic handles soft violations on iteration 1, while exhausted loops, unreachable guards, prompt-capture violations, or critical errors fall back to deterministic canned responses with appropriate audit events and flags (`safety_fallback`, `fallback_reason`), ensuring no unapproved or unsafe text reaches the student.
