# ISSUE-025-STU-10: Safe handling of unsafe input

- **Story ID**: STU-10
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#661](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/661)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** unsafe messages to be handled calmly, **so that** I am not shamed and a person can see when something is worrying.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Safe handling of unsafe input" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 12.1, 12.3
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The student never sees an unreviewed draft
- **Success Metric**: Every fixture in this story gets the specified response, an audit event, and, for a worrying disclosure, a visible flag

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Mental-health diagnosis, parent messages, and safeguarding decisions

### Preconditions & Dependencies
- [ ] Dependencies: Input Screen (Section 8.3.1)
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** abusive language in the note box or in a field that fails to parse, **when** the Input Screen matches it, **then** the student sees the authored `abuse` reply, which does not mirror it and asks to return to the maths. A safety event is logged, no model or verifier runs, and no counter or hint level changes.
- [ ] **Given** a request for help on an active high-stakes assessment, **when** the Input Screen matches it, **then** the authored `assessment_help` reply refuses and tells the student to speak to their teacher, and a safety event is logged.
- [ ] **Given** a request to impersonate the student in work they will submit, **when** the Input Screen matches it, **then** the authored `impersonation` reply refuses and a safety event is logged.
- [ ] **Given** a message that discloses something worrying, **when** the Input Screen matches it, **then** the authored `worrying_disclosure` reply tells the student to tell a trusted adult now and gives no medical, legal, or mental-health advice. A safety event is logged and `worrying_disclosure` is recorded. EDU-12 shows that flag. The system does not make a safeguarding decision.
- [ ] **Given** an answer request typed in the note box, **when** the Input Screen matches it, **then** the authored `answer_request` reply points at the "Show me the solution" control, the typed text does not count as that request, and the hint level is unchanged.
- [ ] **Given** an injection phrase in the note box or a field, **when** the turn runs, **then** the authored `injection_phrase` reply is shown, no counter or level changes, and a prompt-capture test shows the text is absent from every model prompt and Langfuse span.
- [ ] **Given** the note box is shown, **then** a static line reads "If something is worrying you, tell a trusted adult", and every stored note is visible to the assigned teacher.
- [ ] **Given** the 12 synthetic unsafe-input fixtures, **when** the lexicon runs, **then** its recall is reported, with a target of at least 0.90 (a report, not a safeguarding claim).

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
