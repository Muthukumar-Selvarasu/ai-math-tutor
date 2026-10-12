# ISSUE-004-STU-04: Feedback on why my answer is incorrect

- **Story ID**: STU-04
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#640](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/640)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
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
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Retrieval and the verifier cache (STU-15). Showing misconception codes to students.

### Preconditions & Dependencies
- [ ] Dependencies: Misconception Classifier, verifier
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** an incorrect answer and an LLM-classified misconception at or above the configured threshold, **when** feedback is delivered, **then** the tutor asks a targeted scaffold question in plain, age-appropriate language without naming the label.
- [ ] **Given** confidence is below that threshold, **when** feedback is delivered, **then** the policy sets `prompt_type=diagnostic_probe` and the tutor asks a neutral question without naming the label.
- [ ] **Given** any feedback, **when** the Safety Guard checks it, **then** it contains no shaming, comparison, or ability label, and the wording is plain English.
- [ ] **Given** the classifier runs, **when** it returns, **then** it stores a taxonomy code, confidence, supporting evidence, alternative labels, a recommended prompt type, and reviewer status. The code is from the enum, including `insufficient_evidence` when it must not claim a misconception.

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
