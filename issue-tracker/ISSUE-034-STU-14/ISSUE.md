# ISSUE-034-STU-14: Show a wait while the turn is checked

- **Story ID**: STU-14
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#670](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/670)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** a clear wait while my answer is checked, **so that** a silent screen does not look frozen.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Show a wait while the turn is checked" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Section 11.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The 5-second figure remains a target. The CI gate is 8 seconds.
- **Success Metric**: Tutor-turn p95 under 8 seconds, with a visible wait

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Streaming an unreviewed draft, and showing the verifier verdict (correct or incorrect) before the turn is approved

### Preconditions & Dependencies
- [ ] Dependencies: STU-13
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a turn is not yet allowed, leak-checked, and persisted, **when** the student is waiting, **then** they see a loading state and no tutor tokens.
- [ ] **Given** the pipeline uses the 7.5 s hard stop (p95 assertion under 8 s), including one safety retry, **when** the wait exceeds a moment, **then** the loading state stays visible until the allowed turn or the fallback arrives.
- [ ] **Given** the student submits an answer, **when** the request is sent, **then** their own answer appears in the conversation immediately (before any server response), and the input is disabled to prevent a double submit.
- [ ] **Given** the loading state has been visible for more than 1 second, **when** the wait continues, **then** it shows a friendly, child-appropriate message (for example "Thinking about your answer…"). After 4 seconds it adds a reassurance line (for example "Still working, nearly there"). Neither message contains model-generated or tutor text.
- [ ] **Given** the verifier result is back before the turn is approved, **when** the loading state is visible, **then** the UI may show only a fixed, non-solution status such as "Checking your answer…", sent as a separate server event that carries no verdict, value, or model text.
- [ ] **Given** the loading state is visible, **then** it is announced to screen readers (`aria-live="polite"`) and does not rely on colour or animation alone.
- [ ] **Given** the client request timeout of 15 seconds passes with no response (timers start once the request is dispatched), or the server answers 409 `request_in_progress`, **when** the client waits 3 seconds (`retry_after_s=3`) and retries once with the same idempotency key and still receives nothing, **then** the student sees the deterministic fallback and the loading state ends. The client never sends a different key for the same answer.
- [ ] **Given** the optional progress stream is open, **then** it carries only the stage names `checking`, `preparing` and `done`, never a verdict, a value or model text. **Given** it is unavailable, **then** the timed wait messages still show.

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
