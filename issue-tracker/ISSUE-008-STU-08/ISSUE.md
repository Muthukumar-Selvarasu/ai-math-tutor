# ISSUE-008-STU-08: Diagrams that help

- **Story ID**: STU-08
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0 (Level 3 ratio table), P1 (wider diagram set)]
- **Status**: Completed
- **GitHub Issue**: [#644](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/644)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** diagrams when they help solve the question, **so that** I can see the relationships in the problem.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Diagrams that help" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-09
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Meets the accessibility requirements in Section 11.4
- **Success Metric**: 100% of served diagrams have a stored validation result, version, and content hash

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Student-drawn diagrams

### Preconditions & Dependencies
- [x] Dependencies: Diagram service, SVG rendering and validation, Vercel Blob fallback
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** a question requires a diagram, **then** an approved SVG is shown with a text description.
- [x] **Given** validation fails or no approved version exists, **then** the question is withheld and flagged.
- [x] **Given** keyboard or screen-reader use, **then** the diagram has a text alternative and meaning does not depend on colour alone.
- [x] **Given** a diagram specification generated or rendered below Level 5, **when** validated, **then** all SVG text elements and labels pass the canonical normaliser leakage check; intermediate steps and final answers are masked with `?` or `x`.
- [x] **Given** a diagram, **when** it is validated, **then** its `<title>`, `<desc>`, `aria-label` and `alt` text, and the textual description shown beside it, pass the same normaliser check.

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
- `2026-10-12`: Created `lib/diagram-service.js` implementing SV-01 `DiagramService`:
  - Deterministic SVG rendering across leakage bands (`below_4`, `level_4`, `level_5`) for ratio tables and tape diagrams.
  - High-contrast visual distinctions independent of colour alone (SVG pattern defs for diagonal stripes, dots, crosshatch, distinct borders, and shape markers).
  - Normaliser leakage checks across every text surface (`<text>`, `<title>`, `<desc>`, `aria-label`, `alt`, and textual description beside diagram).
  - Masking of unknown final answers below Level 5 with `?` or `x`, and masking of intermediate calculation steps below Level 4.
  - Calculation and recording of SHA-256 hash, version, and validation result.
- `2026-10-12`: Created API routes:
  - `GET /api/sessions/[id]/diagram`: returns 200 `image/svg+xml` with secure headers (`Content-Security-Policy: default-src 'none'`, `Cache-Control: private`) at Level 3+, and 404 below min_level or when unapproved/invalid.
  - `POST /api/checker/diagram`: endpoint for deterministic diagram specification validation.
- `2026-10-12`: Updated `lib/session-store.js` and `app/practice/page.jsx`:
  - Wired diagram availability check on session creation and turn delivery.
  - Rendered Diagram Card (`data-testid="diagram-card"`) with accessible text alternative and beside description when `hint_level >= 3`.
  - Displayed withheld alert (`data-testid="question-withheld-alert"`) when diagram validation fails or is unapproved.
- `2026-10-12`: Created comprehensive test suite in `tests/e2e/stu-08-diagrams.spec.ts` covering all 5 criteria.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/stu-08-diagrams.spec.ts` (6 passed)
- [x] Full Regression Suite: `npm run test:e2e` (46 passed, 0 failed)

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 46 tests using 1 worker

  ✓   1 …e Test Suite › should load the home page and render brand header (945ms)
  ✓   2 … opens in awaiting_first_attempt with level0_prompt and no hint (728ms)
  ✓   3 …s level to 1, preserves attempt count at 0, and asks next probe (728ms)
  ✓   4 … not sure" at Level 4 stays at Level 4 and never reaches Level 5 (1.0s)
  ✓   5 …s attempt number, hint level, duration, and records audit event (764ms)
  ✓   6 …pt checker passes valid prompts and fails multi-prompt sentences (35ms)
  ✓   7 … level by +1 on incorrect or not_sure, but NOT on correct answer (1.0s)
  ✓   8 … level, model, prompt version, policy version, and trace status (719ms)
  ✓   9 …level, and falls back to canned fallback_l{level} when exhausted (1.0s)
  ✓  10 …elected_reasoning_option and maps to misconception hint or step (819ms)
  ✓  11 …step expression is parsed, matched to solution step, and stored (838ms)
  ✓  12 …red scrubbed, shows canned note_ack, and is not a pipeline turn (790ms)
  ✓  13 …rating is stored on attempt; omitting it still submits normally (783ms)
  ✓  14 …0,000 pattern asks for rephrase and does not mark student wrong (735ms)
  ✓  15 …red mode and flags ambiguity_review; row 5b expression does not (858ms)
  ✓  16 …tool_failure, canned tool_failure_notice, and session stays open (5.0s)
  ✓  17 …ld asks targeted scaffold in plain English without naming label (753ms)
  ✓  18 …diagnostic_probe and asks neutral question without naming label (761ms)
  ✓  19 … shaming, comparison, ability labels, and enforces plain English (16ms)
  ✓  20 … evidence, alternative labels, prompt type, and reviewer status (843ms)
  ✓  21 …r encouragement, keeps level unchanged, and does not leak answer (1.1s)
  ✓  22 …t row, offers transfer, and excludes solution in transfer_active (1.3s)
  ✓  23 …rphic example, records support_withheld, and keeps answer hidden (1.3s)
  ✓  24 …n attempt to bypass policy is blocked and logged as safety event (24ms)
  ✓  25 …alues, allows stem/template exemptions and fallback on exhaustion (1ms)
  ✓  26 …on leaked candidate is overridden by deterministic leakage check (18ms)
  ✓  27 … + skip, no hint decision, and offers approved transfer partner (974ms)
  ✓  28 … authored feedback, never shames, and moves to transfer_offered (936ms)
  ✓  29 … before first independent attempt, and show_solution is excluded (1.0s)
  ✓  30 …ined/skipped (no confidence raise), and incorrect after struggle (97ms)
  ✓  31 …ught skill, matching accepted value, or matching simplified ratio (1ms)
  ✓  32 …er records no_legal_transfer, canned notice, and invents no item (17ms)
  ✓  33 …n fails an approved item with no legal transfer partner (Rule V8) (0ms)
  ✓  34 …9 (prompt template, options count, sound true, taxonomy phrasing) (1ms)
  ✓  35 …ffers first published question when no completed sessions exist (834ms)
  ✓  36 …t success, hint trend, transfer results, and next practice item (802ms)
  ✓  37 …mediately even when hourly rollup has not run since the session (652ms)
  ✓  38 …", or "low ability", and never compares the student with others (877ms)
  ✓  39 …udent's data is returned, and mastery numbers follow STU-16 rules (6ms)
  ✓  40 …er raises confidence (+0.20), conflict reduces confidence (-0.10) (0ms)
  ✓  41 … when question requires diagram and hint level reaches Level 3+ (829ms)
  ✓  42 …agram returns 200 image/svg+xml at Level 3, but 404 at Level 0-2 (37ms)
  ✓  43 …or no approved version exists, question is withheld and flagged (685ms)
  ✓  44 …ibility, non-empty alt text, and non-colour visual distinctions (872ms)
  ✓  45 …ate steps and final answers with ? or x; leakage fails validation (1ms)
  ✓  46 …s <title>, <desc>, aria-label, alt text, and adjacent description (1ms)

46 passed (32.4s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - Criterion 1: Approved SVG diagram and text description appear when question requires diagram and hint level reaches Level 3+.
  - Criterion 2: When diagram validation fails or no approved version exists, question is withheld and flagged.
  - Criterion 3: Keyboard and screen-reader accessibility, non-empty alt text, and non-colour visual distinctions.
  - Criterion 4: Rendered below Level 5 masks intermediate steps and final answers with ? or x; leakage fails validation.
  - Criterion 5: Leakage check inspects <title>, <desc>, aria-label, alt text, and adjacent description.

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
Delivered STU-08: Diagrams that help (Visual Model & Ratio Table):
- Implemented SV-01 `DiagramService` in `lib/diagram-service.js` with deterministic SVG rendering, structured ratio table specification, and accessibility enhancements (textures, SVG patterns, shapes, `<title>`, `<desc>`, `role="img"`).
- Implemented deterministic answer leakage validation preventing unmasked final answers below Level 5 and intermediate calculation values below Level 4 across all text surfaces (`<text>`, `<title>`, `<desc>`, `aria-label`, `alt`, and textual description beside diagram).
- Created endpoints `GET /api/sessions/[id]/diagram` and `POST /api/checker/diagram`.
- Updated Practice UI (`app/practice/page.jsx`) to render the approved SVG diagram and textual description at Level 3+, and display withheld notices when diagrams are unapproved or fail validation.
- All 5 acceptance criteria validated and 46 E2E tests passing with zero regressions.
