# ISSUE-020-ADM-05: Model and prompt traceability

- **Story ID**: ADM-05
- **Epic**: [E4: Governance, security, and platform operations]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#656](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/656)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As an** administrator, **I want** every AI-generated tutor turn to record its model, prompt, and policy versions, **so that** I can explain and reproduce any tutoring decision.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Model and prompt traceability" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Section 9.6, Section 15.5
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: Trace data is pseudonymised
- **Success Metric**: 100% of tutor turns have complete trace metadata

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - Automated A/B routing

### Preconditions & Dependencies
- [ ] Dependencies: Langfuse prompt management (Gate B [B]; Tier 1a uses repo prompt files, `PROMPT_SOURCE=repo`), CI evaluation gate
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a call to the MCP server or the A2A Safety Guard without a valid signed service token (missing, expired, wrong audience, or signed with another service's secret), **then** it returns 401, an audit event is written, and no question or answer data is returned. This test blocks CI (Gate B [B]; MCP and A2A are separate services from Phase B, so at Tier 1a this AC is not testable).
- [ ] **Given** a tutor turn is generated, **then** it stores model name and version, provider, sampling parameters (including temperature), prompt template version, hint-policy version, tool results, the Langfuse trace id, `trace_status`, and `fallback_reason` when the turn was a fallback.
- [ ] **Given** an administrator holding `trace_review` opens the turn, **then** they can navigate from the stored record to its trace. A teacher without that grant cannot.
- [ ] **Given** a prompt or model changes, **then** the evaluation suite runs before that change is deployed to production.
- [ ] **Given** the same schemas, **when** a turn runs on Gemini (Release 1.0) or on one alternate provider (Release 1.1), **then** the turn records `LLM_PROVIDER`, the model name, and the model version.
- [ ] **Given** a student name, email, or phone number in free text, **when** a trace is exported or an external model prompt is built, **then** that raw value is absent from both.
- [ ] **Given** a tutor turn is stored, **then** its Langfuse trace has a separate MCP span and a separate A2A span (Gate B [B]).
- [ ] **Given** an unhandled error is reported to Sentry, **then** the event holds no student answer, step, note, bearer token, Clerk id or `app_user.id`, and carries only `request_id`, `trace_id`, `session_id`, `environment`, `release` and the service name.

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
