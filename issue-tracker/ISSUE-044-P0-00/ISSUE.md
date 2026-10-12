# ISSUE-044-P0-00: Setup Playwright E2E test harness

- **Story ID**: P0-00
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Completed
- **GitHub Issue**: [#680](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/680)
- **Created Date**: 2026-10-12
- **Completed Date**: 2026-10-12
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
- [x] **Given** the repository workspace, **when** `npm run test:e2e` is executed, **then** Playwright launches the configured test suite in headless mode and reports test results.
- [x] **Given** a baseline smoke test `tests/e2e/smoke.spec.ts`, **when** Playwright runs, **then** it verifies the Next.js app server is reachable and renders the home page without uncaught errors.
- [x] **Given** the `playwright.config.ts` configuration, **when** running tests, **then** webServer auto-starts the Next.js dev server on `http://localhost:3000` and outputs clear terminal logs.

### Definition of Ready (DoR) Sign-off
- [x] Story format (*As a... I want... so that...*) and Priority stated
- [x] Acceptance criteria in Given/When/Then agreed
- [x] Dependencies identified and not blocked
- [x] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [x] Step 1: Install `@playwright/test` and required browser binary (Chromium).
- [x] Step 2: Create `playwright.config.ts` targeting Next.js port 3000 with auto-starting webServer.
- [x] Step 3: Add `test:e2e` and `test:e2e:ui` scripts to `package.json`.
- [x] Step 4: Write baseline smoke test in `tests/e2e/smoke.spec.ts`.
- [x] Step 5: Execute validation through `qa-manager`.

### Implementation Log & Technical Notes
- `2026-10-12`: Initialized task `ISSUE-044-P0-00` for Playwright testing harness.
- `2026-10-12`: Installed `@playwright/test` v1.64.0 into `package.json` devDependencies.
- `2026-10-12`: Installed Chromium headless shell binary (`chromium_headless_shell-1248`).
- `2026-10-12`: Created `playwright.config.ts` configured with `baseURL: http://localhost:3000` and auto-spawning `webServer` running `npm run dev`.
- `2026-10-12`: Added `"test:e2e"` and `"test:e2e:ui"` scripts to `package.json`.
- `2026-10-12`: Created `tests/e2e/smoke.spec.ts` asserting page load, logo header, hero headline, and sign-in CTA.
- `2026-10-12`: Added `test-results/` and `playwright-report/` to `.gitignore`.

---

## 3. Validation (Definition of Done; Managed by `qa-manager`)

### Verification Commands & Test Suites
- [x] Automated Tests: `npm run test:e2e`
- [x] Typecheck / Linter / Build: `npm run build`

### Verification Evidence & Results
```text
> ai-math-tutor@0.1.0 build
> next build

▲ Next.js 16.4.0 (Turbopack)
✓ Compiled successfully in 1305ms
✓ Generating static pages using 8 workers (5/5) in 306ms
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/sentry-example-api
├ ○ /sentry-example-page
├ ƒ /sign-in/[[...sign-in]]
└ ƒ /sign-up/[[...sign-up]]
ƒ Proxy (Middleware)
○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand

> ai-math-tutor@0.1.0 test:e2e
> playwright test

Running 1 test using 1 worker
  ✓  1 …ke Test Suite › should load the home page and render brand header (2.4s)
  1 passed (6.7s)
```

### Acceptance Criteria Verification
- [x] Happy path verified: `npm run test:e2e` launched headless Chromium and executed smoke test cleanly.
- [x] Smoke test verified: Verified `.logo-title` ("SolvePath"), `.hero-title`, and Sign In button on `/`.
- [x] Config & webServer verified: Playwright webServer auto-started `next dev` on port 3000 and shut down cleanly upon test completion.

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
Playwright E2E testing framework is fully installed, configured, and verified. Baseline smoke test passed in 6.7s with zero regressions. Ready for story-by-story test integration.

