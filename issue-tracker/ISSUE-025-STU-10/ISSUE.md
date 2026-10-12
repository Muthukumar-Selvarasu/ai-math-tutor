# ISSUE-025-STU-10: Safe handling of unsafe input

- **Story ID**: STU-10
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#661](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/661)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** unsafe messages to be handled calmly, **so that** I am not shamed and a person can see when something is worrying.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Safe handling of unsafe input" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 8.3.1, 12.1, 12.3, 14.5
- **SPEC**: SPEC §2.2, §2.4, §3.6–3.9, §4 (WF-05), §5.1
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5 (DS-11 recall target >= 0.90)
- **Non-functional Notes**: The student never sees an unreviewed draft
- **Success Metric**: Every fixture in this story gets the specified response, an audit event, and, for a worrying disclosure, a visible flag

### Scope Boundaries
- **In Scope**:
  - Deterministic Input Screen (PRD §8.3.1, AG-01) for 6 categories: `answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase`.
  - Non-shaming authored replies in `content/safety/canned_responses.json`.
  - Content lexicon `content/safety/input_lexicon.json` with regex patterns and 12 synthetic unsafe fixtures.
  - Short-circuit on hit: no verifier or model call, no attempt counted, no hint level or counter change, audit safety event logged.
  - Recording of `worrying_disclosure` session flag (EDU-12 / OP-08 `GET /api/session-flags`).
  - Static line "If something is worrying you, tell a trusted adult" under the note box.
  - Visibility of stored teacher notes in practice drawer and via API.
  - Synthetic 12 unsafe fixtures recall evaluation (target >= 0.90, reported).
- **Out of Scope**:
  - Mental-health diagnosis, parent messages, and autonomous safeguarding decisions (PRD §12.2).

### Preconditions & Dependencies
- [x] Dependencies: Input Screen (Section 8.3.1)
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** abusive language in the note box or in a field that fails to parse, **when** the Input Screen matches it, **then** the student sees the authored `abuse` reply, which does not mirror it and asks to return to the maths. A safety event is logged, no model or verifier runs, and no counter or hint level changes.
- [x] **Given** a request for help on an active high-stakes assessment, **when** the Input Screen matches it, **then** the authored `assessment_help` reply refuses and tells the student to speak to their teacher, and a safety event is logged.
- [x] **Given** a request to impersonate the student in work they will submit, **when** the Input Screen matches it, **then** the authored `impersonation` reply refuses and a safety event is logged.
- [x] **Given** a message that discloses something worrying, **when** the Input Screen matches it, **then** the authored `worrying_disclosure` reply tells the student to tell a trusted adult now and gives no medical, legal, or mental-health advice. A safety event is logged and `worrying_disclosure` is recorded. EDU-12 shows that flag. The system does not make a safeguarding decision.
- [x] **Given** an answer request typed in the note box, **when** the Input Screen matches it, **then** the authored `answer_request` reply points at the "Show me the solution" control, the typed text does not count as that request, and the hint level is unchanged.
- [x] **Given** an injection phrase in the note box or a field, **when** the turn runs, **then** the authored `injection_phrase` reply is shown, no counter or level changes, and a prompt-capture test shows the text is absent from every model prompt and Langfuse span.
- [x] **Given** the note box is shown, **then** a static line reads "If something is worrying you, tell a trusted adult", and every stored note is visible to the assigned teacher.
- [x] **Given** the 12 synthetic unsafe-input fixtures, **when** the lexicon runs, **then** its recall is reported, with a target of at least 0.90 (a report, not a safeguarding claim).

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Technical design, schema updates, and test scaffolding (`content/safety/input_lexicon.json` with 6 categories and 12 synthetic fixtures).
- [x] Step 2: Implementation of core logic, state transitions, or UI components:
  - Authored responses in `content/safety/canned_responses.json` aligned with PRD §8.3.1 and C1–C3.
  - Enhanced `lib/input-screen.js` compiling regexes from lexicon and calculating recall.
  - Added `getAllSessionFlags` in `lib/session-store.js` and endpoint `GET /api/session-flags` (`app/api/session-flags/route.js`).
  - Added static notice "If something is worrying you, tell a trusted adult." under note box and `teacher-notes-card` in `app/practice/page.jsx`.
- [x] Step 3: Verification against acceptance criteria and regression suite (`tests/e2e/stu-10-input-safety.spec.ts`).

### Implementation Log & Technical Notes
- `2026-10-12`: Initial issue initialized in local tracker as per task-manager.
- `2026-10-12`: Created `content/safety/input_lexicon.json` containing regexes for the 6 input categories (`injection_phrase`, `worrying_disclosure`, `abuse`, `assessment_help`, `impersonation`, `answer_request`) and 12 synthetic unsafe fixtures across categories (EVALS DS-11, SPEC WF-05).
- `2026-10-12`: Aligned `content/safety/canned_responses.json` canned replies to conform with PRD §8.3.1 rules:
  - `answer_request_reply`: Points to the "Show me the solution" option.
  - `abuse_reply`: Respectful, does not mirror abuse, returns to maths.
  - `assessment_help_reply`: Refuses, tells student to speak to their teacher.
  - `impersonation_reply`: Refuses to write work for them to submit.
  - `worrying_disclosure_reply`: Tells student to tell a trusted adult now, zero medical/legal/mental-health advice.
  - `injection_phrase_reply`: Refuses distraction, keeps focus on maths.
- `2026-10-12`: Refactored `lib/input-screen.js` to compile patterns from `input_lexicon.json`, guarantee < 10ms execution, and export `evaluateUnsafeFixturesRecall`.
- `2026-10-12`: Implemented `GET /api/session-flags` endpoint (`app/api/session-flags/route.js`) and exported `getAllSessionFlags` in `lib/session-store.js` to satisfy OP-08 and EDU-12 flag queries.
- `2026-10-12`: Enhanced `app/practice/page.jsx`:
  - Static safeguarding notice: `<p data-testid="note-safeguarding-notice">If something is worrying you, tell a trusted adult.</p>`.
  - Added `Notes for Teacher` drawer section (`data-testid="teacher-notes-card"`) displaying saved notes with body text and save state.
  - Audit trail logging updated to identify `safety_incident` categories directly.
- `2026-10-12`: Authored Playwright E2E suite `tests/e2e/stu-10-input-safety.spec.ts` covering all 8 Acceptance Criteria with 100% pass rate.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-10-input-safety.spec.ts` (8 passed in 9.3s)
- [x] Full Regression Suite: `npm run test:e2e` (58 passed in 35.2s)
- [x] Build Verification: `npm run build` (compiled successfully)
- [x] Functional / E2E: Verification against all 8 acceptance criteria

### Verification Evidence & Results
```text
Running 8 tests using 1 worker

  ✓  1 [STU-10] Criterion 1: Abusive language in note box or unparsed field triggers authored abuse reply, logs safety event, and changes no counters or hint level (3.1s)
  ✓  2 [STU-10] Criterion 2: Request for help on high-stakes assessment triggers authored assessment_help reply and logs safety event (28ms)
  ✓  3 [STU-10] Criterion 3: Request to impersonate student or write submittable work triggers authored impersonation reply and logs safety event (21ms)
  ✓  4 [STU-10] Criterion 4: Worrying disclosure triggers authored reply directing to trusted adult, logs safety event and worrying_disclosure flag (EDU-12) (1.5s)
  ✓  5 [STU-10] Criterion 5: Typed answer request in note box points to Show me the solution control without counting as solution request or changing level (785ms)
  ✓  6 [STU-10] Criterion 6: Prompt injection in note box or field shows authored reply, changes no counters, and text is absent from model prompts (prompt-capture proof) (491ms)
  ✓  7 [STU-10] Criterion 7: Note box displays static safeguarding notice and stored notes are visible to assigned teacher (804ms)
  ✓  8 [STU-10] Criterion 8: 12 synthetic unsafe-input fixtures evaluate with recall >= 0.90 (reported) (6ms)
[STU-10 Unsafe-Input Fixtures Recall Report]
Total fixtures: 12
Matched: 12
Recall: 100.0% (Target: >= 90%)
  8 passed (9.3s)

Full regression suite:
Running 58 tests using 1 worker
  ...
  ✓  51 [STU-10] Criterion 1 (866ms)
  ✓  52 [STU-10] Criterion 2 (16ms)
  ✓  53 [STU-10] Criterion 3 (16ms)
  ✓  54 [STU-10] Criterion 4 (844ms)
  ✓  55 [STU-10] Criterion 5 (728ms)
  ✓  56 [STU-10] Criterion 6 (456ms)
  ✓  57 [STU-10] Criterion 7 (745ms)
  ✓  58 [STU-10] Criterion 8 (3ms)
58 passed (35.2s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified: 8 of 8 passed cleanly.

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
Story STU-10 has been fully implemented, verified, and closed:
1. Created `content/safety/input_lexicon.json` with regex patterns covering all 6 categories (`injection_phrase`, `worrying_disclosure`, `abuse`, `assessment_help`, `impersonation`, `answer_request`) and 12 synthetic unsafe fixtures across categories.
2. Aligned `content/safety/canned_responses.json` with PRD §8.3.1 and C1–C3 rules.
3. Enhanced `lib/input-screen.js` compiling patterns from `input_lexicon.json` and exporting `evaluateUnsafeFixturesRecall`.
4. Exported `getAllSessionFlags` in `lib/session-store.js` and implemented `GET /api/session-flags` endpoint (`app/api/session-flags/route.js`) satisfying OP-08 / EDU-12.
5. Enhanced `app/practice/page.jsx` with static safeguarding notice "If something is worrying you, tell a trusted adult." under note box and `teacher-notes-card` displaying stored notes.
6. Authored Playwright E2E suite `tests/e2e/stu-10-input-safety.spec.ts` passing all 8 acceptance criteria (12 fixtures evaluated with 100% recall >= 90% target).
7. Full Playwright regression suite passed (58 tests in 35.2s) with zero regressions, and `npm run build` compiled cleanly. Single atomic commit authored and GitHub issue closed.
