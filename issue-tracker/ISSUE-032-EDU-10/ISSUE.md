# ISSUE-032-EDU-10: See a cohort summary

- **Story ID**: EDU-10
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#668](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/668)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** academic coordinator, **I want** cohort summaries and the cohort support setting, **so that** I can see intervention themes and control whether level 5 is allowed.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See a cohort summary" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-01, FR-12, Section 22.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: The summary loads in under 3 seconds for 150 synthetic students
- **Success Metric**: A coordinator can open an assigned cohort summary

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Per-student overrides and publishing

### Preconditions & Dependencies
- [ ] Dependencies: ADM-01, learner rollup
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a coordinator opens an assigned cohort, **when** the summary loads, **then** they see cohort mastery, misconception trends, intervention insights, and item-quality indicators.
- [ ] **Given** a recommendation was accepted, **when** a later transfer result exists for that skill, **then** the summary shows that outcome. If none exists yet, it says there is not enough later evidence.
- [ ] **Given** a new cohort, **when** it is created, **then** `allow_level_5` is false by default until an assigned coordinator enables it.
- [ ] **Given** a coordinator requests a student replay, **when** the request is made, **then** it is denied.
- [ ] **Given** a coordinator changes `allow_level_5` for an assigned cohort, **when** the change is saved, **then** the value is stored, later level 5 decisions use it, and an audit event records who, when, the previous value, and the new value. A coordinator outside the cohort is denied.
- [ ] **Given** a coordinator tries to override a student recommendation, publish a question, grant `trace_review`, or open a Langfuse trace, **when** the request is made, **then** it is denied.

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
