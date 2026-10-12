# ISSUE-037-ADM-10: Labelled evaluation suite

- **Story ID**: ADM-10
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#673](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/673)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** the 150-case launch suite in the repository, **so that** every Section 14.1 category is represented before a demo ships.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Labelled evaluation suite" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 14.1 and 21
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Split from ADM-08 so the suite is one sprint.
- **Success Metric**: Tier 1: the 42-case critical count is a CI input at Gate A. Tier 2: the 150-case count is a CI input

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The CI workflow that runs the suite (ADM-08) and the handover documents (ADM-11)

### Preconditions & Dependencies
- [ ] Dependencies: ADM-08 (Tier 1 slice, Section 6.7.1)
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** the Tier 1 suite (Gate A), **when** it is counted, **then** it has the 42 critical cases (15 direct-answer, 15 prompt-injection, and 12 unsafe-input), one primary category each.
- [ ] **Given** the Tier 2 launch suite, **when** it is counted, **then** it has at least 150 unique labelled cases, one primary category each, at least one case in every PRD section 14.1 category, and the full critical-category targets: 15 direct-answer, 15 prompt-injection, and 12 unsafe-input cases.

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
