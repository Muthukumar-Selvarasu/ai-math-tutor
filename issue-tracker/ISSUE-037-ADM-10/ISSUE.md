# ISSUE-037-ADM-10: Labelled evaluation suite

- **Story ID**: ADM-10
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#673](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/673)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
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
- [x] Dependencies: ADM-08 (Tier 1 slice, Section 6.7.1)
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the Tier 1 suite (Gate A), **when** it is counted, **then** it has the 42 critical cases (15 direct-answer, 15 prompt-injection, and 12 unsafe-input), one primary category each.
- [x] **Given** the Tier 2 launch suite, **when** it is counted, **then** it has at least 150 unique labelled cases, one primary category each, at least one case in every PRD section 14.1 category, and the full critical-category targets: 15 direct-answer, 15 prompt-injection, and 12 unsafe-input cases.

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
- `2026-10-13`: Implemented `scripts/build_eval_suite.py` to deterministically generate both `content/eval/tier1_critical.jsonl` (42 critical cases) and `content/eval/tier2_launch.jsonl` (161 cases across all 17 categories). Implemented `lib/eval-suite.js` validation engine and `app/api/admin/eval-suite/route.js`. Authored `tests/e2e/adm-10-eval-suite.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-10-eval-suite.spec.ts`
- [x] Typecheck / Linter: verified clean execution and validation schema
- [x] Functional / E2E: Verification against acceptance criteria

### Verification Evidence & Results
```text
Running 3 tests using 1 worker

     1 …critical suite satisfies Gate A requirements (exactly 42 critical cases)
  ✓  1 …l suite satisfies Gate A requirements (exactly 42 critical cases) (26ms)
     2 …isfies Section 14.1 requirements (>= 150 cases across all 17 categories)
  ✓  2 …Section 14.1 requirements (>= 150 cases across all 17 categories) (35ms)
     3 …ion Suite › Admin eval-suite API enforces RBAC and returns valid reports
  ✓  3 …te › Admin eval-suite API enforces RBAC and returns valid reports (94ms)

  3 passed (1.9s)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - Criterion 1: Tier 1 suite counted exactly 42 critical cases (15 direct_answer, 15 prompt_injection, 12 unsafe_input), each with one primary category.
  - Criterion 2: Tier 2 launch suite counted 161 unique cases (>= 150), covering all 17 PRD Section 14.1 categories, with full critical targets preserved.

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
Implemented labelled evaluation suites in JSONL format conforming strictly to PRD §14.1 and §21.2. Validated 42-case Gate A Tier 1 suite and 161-case Tier 2 launch suite across all 17 categories. RBAC-protected endpoint and E2E validation tests pass.
