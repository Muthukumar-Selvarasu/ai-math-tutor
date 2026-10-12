# ISSUE-033-STU-13: Keep an unapproved turn off the screen

- **Story ID**: STU-13
- **Epic**: [E1: Guided practice and Socratic tutoring]
- **Milestone**: [Tier 1a: Core MVP (Gate A)]
- **Priority**: [P0]
- **Status**: Planned
- **GitHub Issue**: [#669](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/669)
- **Created Date**: 2026-10-12
- **Completed Date**: Pending
- **Assignee/Owner**: Antigravity / Muthukumar

---

## Story Statement
**As a** student, **I want** to see only a turn the safety check has allowed, **so that** a rejected or unreachable draft never appears as the tutor.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
Deliver user capability for "Keep an unapproved turn off the screen" as specified in PRD §6 and technical architecture requirements.

### Linked Requirements & Architecture References
- **PRD**: Sections 11.2, 11.3, 12.1
- **SPEC**: SPEC §2.4, §3.6–3.9, §4 (Workflows)
- **DESIGN / TECHNICAL**: DESIGN DD-01..08, TECHNICAL TECH-xx
- **THRESHOLDS / EVALS**: THRESHOLDS §1, EVALS §14.5
- **Non-functional Notes**: One token rule lives here. STU-05 does not repeat it.
- **Success Metric**: A rejected candidate is absent from the student-visible payload

### Scope Boundaries
- **In Scope**:
  - Core implementation of capabilities defined in acceptance criteria.
  - Automated unit and regression test coverage.
  - Integration with session FSM, verifier, or policy engine where applicable.
- **Out of Scope**:
  - The leakage override, which is STU-05

### Preconditions & Dependencies
- [ ] Dependencies: STU-02
- [ ] Non-blocking check: PRD v1.3.28 and ADR-015 constraints verified.

### Acceptance Criteria (Given / When / Then)
- [ ] **Given** a candidate is rejected and an iteration remains, **when** the loop continues, **then** the dialogue agent revises it. The student sees no tokens from the rejected text.
- [ ] **Given** the loop has used both iterations without an allow, or the Safety Guard cannot be reached, **when** a turn is due, **then** the student receives the deterministic fallback and the session records `safety_fallback`.
- [ ] **Given** the Dialogue agent times out, the provider is unreachable, or its output fails `schema_valid`, **when** the turn is due, **then** the student receives the same fallback and is not told they are wrong.
- [ ] **Given** the Classifier times out, the provider is unreachable, or its output fails `schema_valid`, **when** the turn is due, **then** no misconception claim is made, the prompt type is `diagnostic_probe`, an audit event names the cause, and the turn continues through the Dialogue agent and the Safety Guard as normal. The student receives no fallback prompt because of a Classifier failure.
- [ ] **Given** a candidate asks for personal information, promises exam success, makes a selective-entry or placement claim, or infers a sensitive attribute, **when** the deterministic phrase check runs (in the same cheap step as the leakage check, before the guard), **then** a hit blocks the candidate before the guard is called and triggers the revision or the fallback.
- [ ] **Given** the student text contains an email address or a phone number, **when** the tutor reply and the trace are built, **then** that pattern is removed. The Input PII Scrubber also replaces names it recognises with `[STUDENT_NAME]`, which is best effort, so a name it misses is still treated as untrusted text. The tutor does not ask the student to identify themselves.
- [ ] **Given** Postgres is unreachable before the attempt is stored, **when** the student submits, **then** the server returns 503 `service_unavailable` (retryable), no pipeline runs, no counter changes, and the answer field keeps its text.
- [ ] **Given** Langfuse is unavailable or its flush fails, **when** a turn runs, **then** the turn is still delivered, the flush waits at most 300 ms, and the turn stores `trace_status=missing`.
- [ ] **Given** the provider times out, returns `429` or 5xx, or its output is invalid after one repair, or the turn passes the 7.5 s hard stop, **when** a turn is due, **then** the student receives the deterministic fallback with `fallback_reason` of `provider_error`, `schema_invalid` or `budget`, and no session flag is set. `safety_fallback` is set only for `loop_exhausted` and `guard_unreachable`.
- [ ] **Given** MCP returns an HTTP error, **then** the result is `cannot_verify` with `state=tool_failure` and a fixed message, and no counter changes. A timeout or connect failure uses the single per-turn fallback instead (a repeat MCP call on the Vercel topology, the in-process module on a container topology). This AC is Gate B [B]: at Tier 1a the verifier is in-process and has no transport failure.
- [ ] **Given** the Blob read fails or the SVG is missing, **then** the diagram is rendered from the validated spec in process, and if that fails the probe text is shown without a diagram and `diagram_unavailable` is stored. An unvalidated image is never served.
- [ ] **Given** a student free-text value is found in a model prompt, **when** the prompt-capture guard runs, **then** the turn fails before the model call with the fixed fallback and a `prompt_capture_violation` audit event.

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
