# ISSUE-007-STU-07: See my progress

- **Story ID**: STU-07
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 2: Platform Launch (Gate C)]
- **Priority**: [P1, and still a launch requirement ([Section 21](#21-launch-criteria))]
- **Status**: Planned
- **GitHub Issue**: [#643](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/643)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to see my progress, **so that** I know what to practise next and can see I am improving.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "See my progress" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-08, FR-11
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Accessible charts with text alternatives
- **Success Metric**: Baseline engagement measured; no target before pilot

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Leaderboards or peer comparison

### Preconditions & Dependencies
- [ ] Dependencies: Learner model, `learner-rollup` job
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** the student dashboard is opened, **then** it shows recent sessions, current skills, strengths, next focus areas, independent success, hint trend, transfer results, and the next practice item.
- [ ] **Given** the hourly rollup has not run since the last session, **then** that saved session is still listed, the screen shows the rollup time, and aggregate mastery may be up to one hour old.
- [ ] **Given** any dashboard text, **then** it does not say "weak", "failing", or "low ability", and it does not compare the student with others.
- [ ] **Given** no completed sessions, **then** an empty state offers a first published question.
- [ ] **Given** the caller is a student, **when** the dashboard loads, **then** only that student's data is returned. Mastery numbers come from STU-16.

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
