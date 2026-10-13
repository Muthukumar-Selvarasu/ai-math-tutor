# ISSUE-039-ADM-12: Seed the approved bank

- **Story ID**: ADM-12
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#675](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/675)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-13
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** content reviewer, **I want** the launch bank loaded through the import pipeline, **so that** students practise approved ratio items.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Seed the approved bank" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: FR-02, FR-07, Section 21
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Synthetic content only
- **Success Metric**: The section 21 content counts are files in the repository

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Building the importer

### Preconditions & Dependencies
- [x] Dependencies: The import pipeline (TECH-07)
- [x] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [x] **Given** the content directory, **when** import validation passes, **then** it contains at least 10 approved ratio questions for Release 1.0 and at least 40 for Release 1.1, the STU-15 taxonomy, an exemplar for each label (Tier 1b: exemplar authoring is a Tier 1b item), a diagram spec for every diagram item, and a skill-graph edge that gives each item a legal transfer partner inside the starting set. Every item passes content validation V1–V9, and `content/safety/canned_responses.json` has all 28 keys and passes C1–C3 with `draft` or `reviewed` entries. At the Gate B tag every key is `reviewed` (C4) (PRD sections 8.3.2 and 10.3.1).

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
- `2026-10-13`: Seeded approved question bank (`scripts/seed_approved_bank.py`) delivering 13 Release 1.0 approved items and 36 Release 1.1 items (49 total approved items >= 40 target) with blueprint `content/questions/blueprint.md`. Implemented STU-15 taxonomy (`content/taxonomy/taxonomy.json`) and 13 label exemplars (`content/taxonomy/exemplars.json`). Added diagram specifications `diag_scale_0001` and `diag_ratio_table_001` to `lib/diagram-service.js`. Implemented `lib/content-validator.js` validating V1–V9, C1–C3, and transfer partner legality. Authored `tests/e2e/adm-12-seed-bank.spec.ts`.

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [x] Automated Tests: `npx playwright test tests/e2e/adm-12-seed-bank.spec.ts`
- [x] Typecheck / Linter: Content validation pipeline passes with 0 violations
- [x] Functional / E2E: Full test suite passes across all 156 specs

### Verification Evidence & Results
```text
Running 5 tests using 1 worker

     1 …ent bank validation pipeline passes V1–V9 and C1–C3 with zero violations
  ✓  1 …k validation pipeline passes V1–V9 and C1–C3 with zero violations (55ms)
     2 …roved question has a legal transfer partner inside the starting set (V8)
  ✓  2 …uestion has a legal transfer partner inside the starting set (V8) (74ms)
     3 …omy contains all 13 closed taxonomy codes and exemplars cover all labels
  ✓  3 …ntains all 13 closed taxonomy codes and exemplars cover all labels (2ms)
     4 …/canned_responses.json contains all 28 required keys and satisfies C1–C3
  ✓  4 …d_responses.json contains all 28 required keys and satisfies C1–C3 (0ms)
     5 …content/questions/blueprint.md exists and documents the seed bank matrix
  ✓  5 …t/questions/blueprint.md exists and documents the seed bank matrix (0ms)

  5 passed (2.8s)

Full E2E Suite: 156 passed (1.1m)
```

### Acceptance Criteria Verification
- [x] All Given / When / Then criteria verified:
  - 13 approved ratio questions for Release 1.0 (target >= 10).
  - 49 approved ratio questions for Release 1.1 (target >= 40).
  - STU-15 taxonomy present with 13 closed codes.
  - Exemplars authored for all 13 taxonomy labels.
  - Diagram specs present for all diagram items (`has_diagram: true`).
  - Skill-graph edges and legal transfer partner verified for every approved item (V8).
  - Every approved item passes V1–V9 with 0 violations.
  - `content/safety/canned_responses.json` has all 28 keys and passes C1–C3.

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
Seeded approved ratio question bank with 13 Release 1.0 items, 36 Release 1.1 items (49 total), STU-15 taxonomy, exemplars, diagram specs, and blueprint. Content validator and full Playwright test suite pass cleanly with 156 passing tests.
