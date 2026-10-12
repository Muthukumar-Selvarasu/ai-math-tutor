# ISSUE-010-EDU-02: Understand why a student was flagged

- **Story ID**: EDU-02
- **Epic**: [E2: Learner progress and educator insight]
- **Milestone**: [Tier 1c: Replay & Human Oversight]
- **Priority**: [P1]
- **Status**: Planned
- **GitHub Issue**: [#646](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/646)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** teacher, **I want** every flag to show its evidence, **so that** I can judge it with my own professional knowledge.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Understand why a student was flagged" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-12, FR-15, Section 13.2
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Evidence links respect role-based access
- **Success Metric**: At least 95% of teacher-facing claims link to source events

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Placement, grading, or admissions suggestions

### Preconditions & Dependencies
- [ ] Dependencies: `insight-drafts` job, audit event store
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a flagged student, **then** the flag lists attempts, skills, timing, hint levels, and sessions.
- [ ] **Given** a recommendation, **then** it shows confidence, limitations, suggested action, review status, and the human reviewer decision once one exists.
- [ ] **Given** low confidence, **then** the recommendation is labelled as such and is not stated as fact.
- [ ] **Given** `insight-drafts` writes a draft, **when** the text contains placement, grading, admissions, exclusion, or remedial-classification wording, **then** a deterministic check rejects the draft, the teacher does not see it, and the rejection is stored.

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
