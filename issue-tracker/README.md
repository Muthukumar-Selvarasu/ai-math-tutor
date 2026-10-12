# Issue Tracker

Welcome to the local task and issue management repository. All engineering and product work is tracked as **ISSUES** mapped to **Milestones, Epics, and User Stories** defined in the [PRD](file:///Users/muthukumars/Documents/workspace/ai-math-tutor/PRD.md).

---

## Architecture & Hierarchy

```text
Milestone (e.g. Tier 1a / Gate A, Tier 1b / Gate B)
 └── Epic (E1: Guided practice, E2: Progress & insight, E3: Oversight, E4: Governance/ops)
      └── Story / Work Package (STU-nn, EDU-nn, ADM-nn, or P-nn)
           └── ISSUE (Tracked folder with 4-stage lifecycle)
```

### Milestones
- **Tier 1a: Core MVP (Gate A)** — Single-engineer commitment (120h eng + 45h content).
- **Tier 1b: Protocols & Scale (Gate B)** — MCP servers, A2A Safety Guard, pgvector retrieval, exact cache.
- **Tier 1c: Replay & Teacher Tooling** — Session replay, human oversight.
- **Tier 2: Platform Launch (Gate C)** — Extended bank (40 items), multi-provider evaluation.

### Epics (PRD §6.2)
- **E1**: Guided practice and Socratic tutoring
- **E2**: Learner progress and educator insight
- **E3**: Review, replay, and human oversight
- **E4**: Governance, security, and platform operations

### Story Naming Standards
- Format: `As a [role], I want [capability], so that [benefit].`
- Prefixes:
  - `STU-nn`: Student stories
  - `EDU-nn`: Educator / teacher stories
  - `ADM-nn`: Platform / operations stories
  - `P<phase>-<nn>`: Technical work packages (e.g., `P1-17` Orchestrator and persistence)

---

## Directory Organization

```text
issue-tracker/
├── README.md                          # This documentation
├── TRACKER.md                         # Master register grouped by Milestone & Epic
├── templates/
│   └── ISSUE_TEMPLATE.md              # Template for new issues (DoR & DoD integrated)
└── ISSUE-<num>-<story_id>/            # Dedicated folder per issue
    └── ISSUE.md                       # Local lifecycle document
```

---

## 4-Stage Task Lifecycle

1. **Pre-flight (Definition of Ready)**:
   - Story statement (*As a... I want... so that...*), Epic, Milestone, Priority (P0/P1/P2).
   - In Scope vs. Out of Scope boundaries.
   - Acceptance criteria in Given / When / Then format.
2. **Execution**:
   - Implementation plan, notes, and log. No git commits are made or prompted here.
3. **Validation (Definition of Done)**:
   - Automated tests, regression gates, and captured verification evidence.
4. **Closure**:
   - Local sign-off checklist, update `TRACKER.md`, then close the GitHub issue.

---

## Hard Rules

- **Local First**: Initialize `issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md` and `TRACKER.md` before creating the issue in GitHub (`gh issue create`).
- **No Early GitHub Close**: Never run `gh issue close` unless the issue is marked complete in its local file and in `TRACKER.md`.
- **No Commit Requests**: This issue tracking workflow does not make or request git commits. Code commits are handled separately (via `commit-manager` upon explicit user request).
