# ISSUE-<num>-<story_id>: <Issue Title>

- **Story ID**: <STU-nn | EDU-nn | ADM-nn | P-nn>
- **Epic**: [E1: Guided practice | E2: Learner progress | E3: Human oversight | E4: Platform ops]
- **Milestone**: [Tier 1a: Core MVP (Gate A) | Tier 1b: Protocols (Gate B) | Tier 1c: Replay | Tier 2: Launch (Gate C)]
- **Priority**: [P0 (Must ship) | P1 (Should ship) | P2 (Stretch)]
- **Status**: [Planned | In Progress | In Review | Completed]
- **GitHub Issue**: #[number](https://github.com/Muthukumar-Selvarasu/ai-math-tutor/issues/<number>)
- **Created Date**: YYYY-MM-DD
- **Completed Date**: YYYY-MM-DD
- **Assignee/Owner**: <Name or Agent>

---

## Story Statement
**As a** <role: student | teacher | administrator>,  
**I want** <capability>,  
**so that** <benefit / intent>.

---

## 1. Pre-flight (Definition of Ready)

### Objective & Intent
<Clear summary of what this issue accomplishes and why.>

### Linked Requirements & Architecture References
- **PRD**: [FR-xx / Section xx]
- **SPEC**: [SPEC WF-xx / Section xx]
- **DESIGN / TECHNICAL**: [DESIGN DD-xx / TECH-xx]

### Scope Boundaries
- **In Scope**:
  - <Deliverable 1>
  - <Deliverable 2>
- **Out of Scope**:
  - <Explicit non-goal / deferred item>

### Preconditions & Dependencies
- [ ] Dependency: <e.g. prerequisite issue, seed data, schema migration>
- [ ] Non-blocking check: <PRD decision or ADR confirmed>

### Acceptance Criteria (Given / When / Then)
- [ ] **Happy Path**: Given <context>, when <action>, then <expected outcome>.
- [ ] **Edge / Failure Case**: Given <edge condition>, when <action>, then <graceful failure / error handling>.
- [ ] **Permission / Role Boundary**: Given <role / actor>, when <action>, then <auth rule or audit event>.

### Definition of Ready (DoR) Sign-off
- [ ] Story format (*As a... I want... so that...*) and Priority stated
- [ ] Acceptance criteria in Given/When/Then agreed
- [ ] Dependencies identified and not blocked
- [ ] Boundaries (In Scope / Out of Scope) defined

---

## 2. Execution

### Implementation Plan
- [ ] Step 1: <Description>
- [ ] Step 2: <Description>
- [ ] Step 3: <Description>

### Implementation Log & Technical Notes
- `YYYY-MM-DD`: <Work done, architectural decisions, file paths touched>

---

## 3. Validation (Definition of Done)

### Verification Commands & Test Suites
- [ ] Automated Tests: `<command, e.g. pytest tests/...>`
- [ ] Typecheck / Linter: `<command, e.g. mypy / ruff / npm run lint>`
- [ ] Functional / E2E: `<verification command or steps>`

### Verification Evidence & Results
```text
<Paste test run output, verification logs, or assertions here>
```

### Acceptance Criteria Verification
- [ ] Happy path verified: <Evidence>
- [ ] Edge / failure case verified: <Evidence>
- [ ] Role / permission verified: <Evidence>

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
<Brief summary of completed work, key files affected, and final sign-off.>
