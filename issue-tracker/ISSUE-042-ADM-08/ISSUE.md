# ISSUE-042-ADM-08: Platform launch controls

- **Story ID**: ADM-08
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P2]
- **Status**: Planned
- **GitHub Issue**: [#678](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/678)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** the CI gates to block a bad merge, **so that** lint, tests, evals, and the deploy gate run before code is merged.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Platform launch controls" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 14.5, 17, and 21
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Model-based scores do not block CI. Section 14.5 thresholds do. ADM-08 executes the gate checks; ADM-10 owns curating the 150-case benchmark dataset.
- **Success Metric**: A failing Section 14.5 gate blocks the merge

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The 150-case suite (ADM-10), the handover documents (ADM-11), and the teacher-facing quality list (ADM-03)

### Preconditions & Dependencies
- [ ] Dependencies: CI workflow
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a pull request, **when** GitHub Actions runs, **then** lint, tests, every blocking row in section 14.5 (including `single_prompt`, unauthorised access, unapproved content, an invalid diagram, an unaudited override, a misconception prompt type that does not match the confidence, bundle size, and cold start), and the deploy gate must pass before merge. The 99% availability figure is reported for the demo and does not block the merge. The case count itself is ADM-10.
- [ ] **Given** a secret the API needs, **when** the repository and the client bundle are searched, **then** runtime secrets live only in Vercel environment variables, and CI and deploy tokens live only in GitHub Actions secrets.
- [ ] **Given** a public or preview environment, **when** it is opened, **then** the students, names, and attempts are synthetic.
- [ ] **Given** a pull request, **when** `ci.yml` runs, **then** `pip-audit`, `npm audit`, `gitleaks`, `axe` on the practice screen, `tests/contract` (OpenAPI and web-type drift) and `scripts/sync_stories.py --check` also run. A high-severity finding, a detected secret, or a story difference fails the build.
- [ ] **Given** a running deployment, **when** monitoring is read, **then** latency, errors, and tool failures are visible in Langfuse or Vercel.

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
