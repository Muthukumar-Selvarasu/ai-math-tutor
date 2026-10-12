# ISSUE-008-STU-08: Diagrams that help

- **Story ID**: STU-08
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0 (Level 3 ratio table), P1 (wider diagram set)]
- **Status**: Planned
- **GitHub Issue**: [#644](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/644)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
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
- [ ] Dependencies: Diagram service, Vercel Blob storage
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a question requires a diagram, **then** an approved SVG is shown with a text description.
- [ ] **Given** validation fails or no approved version exists, **then** the question is withheld and flagged.
- [ ] **Given** keyboard or screen-reader use, **then** the diagram has a text alternative and meaning does not depend on colour alone.
- [ ] **Given** a diagram specification generated or rendered below Level 5, **when** validated, **then** all SVG text elements and labels pass the canonical normaliser leakage check; intermediate steps and final answers are masked with `?` or `x`.
- [ ] **Given** a diagram, **when** it is validated, **then** its `<title>`, `<desc>`, `aria-label` and `alt` text, and the textual description shown beside it, pass the same normaliser check.

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
