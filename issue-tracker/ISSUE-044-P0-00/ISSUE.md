# ISSUE-044-P0-00: Setup Playwright E2E test harness

- **Story ID**: P0-00
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#680](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/680)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** developer and QA engineer,  
**I want** an automated Playwright E2E testing framework configured in the repository,  
**so that** every story's user experience and acceptance criteria can be verified automatically before committing and closing tasks.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Install and configure Playwright E2E testing framework with headless browser automation, npm scripts, and a baseline smoke test to empower `qa-manager` to validate all upcoming user stories.

### Linked Requirements & Architecture References
- **PRD**: Section 6.3 (Definition of Done), Section 11.6 (Testing & Quality)
- **TECHNICAL**: TECH-06, TECH-07 (CI/CD and Validation Harness)
- **SKILLS**: `qa-manager`, `commit-manager`, `task-manager`

### Scope Boundaries
- **In Scope**:
  - Install `@playwright/test` as a dev dependency.
  - Install Playwright browser binaries (`npx playwright install chromium`).
  - Configure `playwright.config.ts` with Next.js webServer integration.
  - Add npm script `"test:e2e": "playwright test"` to `package.json`.
  - Add baseline smoke test in `tests/e2e/smoke.spec.ts`.
- **Out of Scope**:
  - Implementing feature-specific tests for STU-01..STU-19 (those are implemented per story).

### Preconditions & Dependencies
- [x] Node.js and Next.js project initialized.
- [x] Local dev server runnable (`npm run dev`).

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** the repository workspace, **when** `npm run test:e2e` is executed, **then** Playwright launches the configured test suite in headless mode and reports test results.
- [ ] **Given** a baseline smoke test `tests/e2e/smoke.spec.ts`, **when** Playwright runs, **then** it verifies the Next.js app server is reachable and renders the home page without uncaught errors.
- [ ] **Given** the `playwright.config.ts` configuration, **when** running tests, **then** webServer auto-starts the Next.js dev server on `http://localhost:3000` and outputs clear terminal logs.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [ ] Step 1: Install `@playwright/test` and required browser binary (Chromium).
- [ ] Step 2: Create `playwright.config.ts` targeting Next.js port 3000 with auto-starting webServer.
- [ ] Step 3: Add `test:e2e` and `test:e2e:ui` scripts to `package.json`.
- [ ] Step 4: Write baseline smoke test in `tests/e2e/smoke.spec.ts`.
- [ ] Step 5: Execute validation through `qa-manager`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initialized task `ISSUE-044-P0-00` for Playwright testing harness.

---

## 3. Validation (Definition of Done; Managed by `qa-manager`)

### Verification Commands & Test Suites
- [ ] Automated Tests: `npm run test:e2e`
- [ ] Typecheck / Linter: `npm run build`

### Verification Evidence & Results
```text
Pending execution
```

### Acceptance Criteria Verification
- [ ] Happy path verified: Pending
- [ ] Smoke test verified: Pending
- [ ] Config & webServer verified: Pending

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
