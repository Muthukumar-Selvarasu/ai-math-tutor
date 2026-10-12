# ISSUE-004-STU-04: Feedback on why my answer is incorrect

- **Story ID**: STU-04
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#640](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/640)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** feedback on why my answer is incorrect, **so that** I can fix my thinking and not just retry.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Feedback on why my answer is incorrect" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-04, FR-07, Section 12.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Tutor language is plain English
- **Success Metric**: Misconception labels agree with human reviewer judgement at the agreed evaluation threshold

### Scope Boundaries
- **In Scope**:
  - Closed 13-value misconception taxonomy and `MisconceptionClassifierOutput` contract.
  - Configurable confidence threshold (0.80).
  - Target scaffold prompt generation when confidence >= threshold vs diagnostic probe when below or insufficient_evidence.
  - Tutor feedback in plain, age-appropriate English never naming the taxonomy code to the student.
  - Safety Guard checking for shaming, peer comparison, ability labels, and plain language.
  - Persisting `misconception_event` with taxonomy code, confidence, evidence, alternative labels, prompt type, and `reviewer_status: "unreviewed"`.
  - Playwright E2E suite (`tests/e2e/stu-04-feedback.spec.ts`) validating all 4 Given/When/Then acceptance criteria.
- **Out of Scope**:
  - Retrieval and the verifier cache (STU-15).
  - Showing raw misconception codes to students in student prompt bubbles.

### Preconditions & Dependencies
- [x] Dependencies: Misconception Classifier, Safety Guard, session store verifier
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** an incorrect answer and an LLM-classified misconception at or above the configured threshold, **when** feedback is delivered, **then** the tutor asks a targeted scaffold question in plain, age-appropriate language without naming the label.
- [x] **Given** confidence is below that threshold, **when** feedback is delivered, **then** the policy sets `prompt_type=diagnostic_probe` and the tutor asks a neutral question without naming the label.
- [x] **Given** any feedback, **when** the Safety Guard checks it, **then** it contains no shaming, comparison, or ability label, and the wording is plain English.
- [x] **Given** the classifier runs, **when** it returns, **then** it stores a taxonomy code, confidence, supporting evidence, alternative labels, a recommended prompt type, and reviewer status. The code is from the enum, including `insufficient_evidence` when it must not claim a misconception.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, closed 13-value misconception taxonomy enum, and `MisconceptionClassifierOutput` contract (`lib/misconception-classifier.js`).
- [x] Step 2: Implementation of Safety Guard (`lib/safety-guard.js`) enforcing no shaming, no peer comparison, no ability labels, no taxonomy code leakage, and plain English sentence length (< 25 words).
- [x] Step 3: Upgraded session store (`lib/session-store.js`) and API routes to support LLM classifier dialogue mode, `misconception_events` persistence, and targeted scaffold vs diagnostic probe prompt generation.
- [x] Step 4: Enhanced practice UI (`app/practice/page.jsx`) with dialogue mode selector, prompt type badge, safety badge, and teacher diagnostic events panel.
- [x] Step 5: Authored Playwright E2E suite `tests/e2e/stu-04-feedback.spec.ts` validating all 4 acceptance criteria.

### Implementation Log & Technical Notes
- `2026-10-12`: Created `lib/misconception-classifier.js` supporting the 13-value closed taxonomy enum, schema validation, confidence threshold (0.80), and targeted scaffold prompt generation without naming taxonomy labels.
- `2026-10-12`: Created `lib/safety-guard.js` implementing deterministic safety checks: blocking shaming language, peer comparisons, ability labels, taxonomy code leakage, and value leakage below level 5, while flagging sentences exceeding 25 words for revision.
- `2026-10-12`: Updated `lib/session-store.js` to run the Misconception Classifier on incorrect submissions, store `misconception_event` with `reviewer_status: "unreviewed"`, evaluate candidates through `checkSafetyGuard`, and return `prompt_type` (`targeted_scaffold` vs `diagnostic_probe`).
- `2026-10-12`: Updated `app/practice/page.jsx` with dialogue mode switch, prompt type metadata badge, safety verdict badge, and teacher diagnostic drawer displaying stored events.
- `2026-10-12`: Authored `tests/e2e/stu-04-feedback.spec.ts` covering all 4 Given/When/Then acceptance criteria.
- `2026-10-12`: Verified full E2E test suite (`npm run test:e2e`, 20/20 passing) and Next.js production build (`npm run build`).

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e` (20 passed)
- [x] Functional / E2E: `npx playwright test tests/e2e/stu-04-feedback.spec.ts` (4 passed)
- [x] Production Build: `npm run build` (compiled successfully)

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 20 tests using 7 workers

  ✓  tests/e2e/stu-02-hint.spec.ts:4:7 › STU-02: One focused hint at a time › Criterion 1 & 3: Deterministic single_prompt checker (43ms)
  ✓  tests/e2e/stu-01-attempt.spec.ts:4:7 › STU-01: Attempt before guidance › Criterion 1: Question opens in awaiting_first_attempt with level0_prompt and no hint (2.2s)
  ✓  tests/e2e/smoke.spec.ts:3:7 › SolvePath Smoke Test Suite › should load the home page and render brand header (1.3s)
  ✓  tests/e2e/stu-02-hint.spec.ts:80:7 › STU-02: One focused hint at a time › Criterion 4: Turn delivery stores hint level, model, prompt version, policy version, and trace status (2.3s)
  ✓  tests/e2e/stu-01-attempt.spec.ts:105:7 › STU-01: Attempt before guidance › Criterion 4: Submitting an attempt stores attempt number, hint level, duration, and records audit event (2.5s)
  ✓  tests/e2e/stu-01-attempt.spec.ts:32:7 › STU-01: Attempt before guidance › Criterion 2: "I am not sure" in awaiting_first_attempt escalates level to 1, preserves attempt count at 0, and asks next probe (2.1s)
  ✓  tests/e2e/stu-01-attempt.spec.ts:64:7 › STU-01: Attempt before guidance › Criterion 3: "I am not sure" at Level 4 stays at Level 4 and never reaches Level 5 (1.6s)
  ✓  tests/e2e/stu-02-hint.spec.ts:45:7 › STU-02: One focused hint at a time › Criterion 2: Policy escalates level by +1 on incorrect or not_sure, but NOT on correct answer (2.2s)
  ✓  tests/e2e/stu-02-hint.spec.ts:104:7 › STU-02: One focused hint at a time › Criterion 5: Policy selects first unasked probe in authored order whose min_level <= current level, and falls back to canned fallback_l{level} when exhausted (1.2s)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:246:7 › STU-03: Submit working and selected reasoning options › Criterion 7: Verifier tool failure simulation returns cannot_verify with state=tool_failure (42ms)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:98:7 › STU-03: Submit working and selected reasoning options › Criterion 3: Teacher private note is stored scrubbed, shows canned note_ack (876ms)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:31:7 › STU-03: Submit working and selected reasoning options › Criterion 2: Accepts and parses varied formats; working step expression is parsed (934ms)
  ✓  tests/e2e/stu-04-feedback.spec.ts:127:7 › STU-04: Feedback on why my answer is incorrect › Criterion 3: Safety Guard checks feedback: blocks shaming, comparison, ability labels, and enforces plain English (31ms)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:133:7 › STU-03: Submit working and selected reasoning options › Criterion 4: Optional student confidence rating is stored on attempt (974ms)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:211:7 › STU-03: Submit working and selected reasoning options › Criterion 6: Second consecutive unparsed switches to structured mode and flags ambiguity_review (854ms)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:166:7 › STU-03: Submit working and selected reasoning options › Criterion 5: Valid thousands comma accepted; comma outside 30,000 pattern asks for rephrase (1.0s)
  ✓  tests/e2e/stu-03-reasoning.spec.ts:4:7 › STU-03: Submit working and selected reasoning options › Criterion 1: Student picks structured reasoning option, stored as selected_reasoning_option and maps to misconception hint or step (1.6s)
  ✓  tests/e2e/stu-04-feedback.spec.ts:12:7 › STU-04: Feedback on why my answer is incorrect › Criterion 1: Incorrect answer with LLM-classified misconception at or above threshold asks targeted scaffold in plain English without naming label (973ms)
  ✓  tests/e2e/stu-04-feedback.spec.ts:77:7 › STU-04: Feedback on why my answer is incorrect › Criterion 2: Confidence below threshold sets prompt_type=diagnostic_probe and asks neutral question without naming label (935ms)
  ✓  tests/e2e/stu-04-feedback.spec.ts:190:7 › STU-04: Feedback on why my answer is incorrect › Criterion 4: Classifier returns and stores closed taxonomy code, confidence, evidence, alternative labels, prompt type, and reviewer status (896ms)

20 passed (5.4s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: Passed (20/20 test suite, 4/4 STU-04 suite)

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
Delivered STU-04 feedback on why answer is incorrect:
- Implemented `lib/misconception-classifier.js` supporting the 13-value closed taxonomy enum, confidence threshold (0.80), schema validation, and targeted scaffold prompt generation without naming taxonomy labels.
- Implemented `lib/safety-guard.js` enforcing zero tolerance for shaming, peer comparisons, and ability labels, preventing raw taxonomy code leakage, and flagging sentences > 25 words.
- Integrated classifier and safety pipeline into `lib/session-store.js`, storing `misconception_event` records with `reviewer_status: "unreviewed"` (visible to teachers only).
- Updated practice UI (`app/practice/page.jsx`) with dialogue mode selector, prompt type metadata badge, safety badge, and teacher diagnostic events panel.
- Validated with Playwright E2E suite `tests/e2e/stu-04-feedback.spec.ts` (all 4 Given/When/Then criteria passing, 20/20 across full test suite).
