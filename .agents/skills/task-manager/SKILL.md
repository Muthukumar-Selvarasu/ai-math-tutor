---
name: task-manager
description: >-
  Creates and manages tasks as ISSUES synchronized with GitHub Issues based on
  PRD Epics and User Stories. Enforces Milestone/Epic/Story hierarchy, naming
  conventions, and a 4-stage lifecycle (Pre-flight, Execution, Validation,
  Closure) within the issue-tracker directory. Takes handoff from
  commit-manager once a story commit is made to perform closure in local docs
  and GitHub. Ensures local issue documentation and tracker status are updated
  before closing GitHub issues. Does not prompt for git commits or modify source
  code outside issue tracking.
---

# Task Manager (ISSUES)

Manages project tasks as **ISSUES** backed by local tracking in `issue-tracker/` and synchronized with **GitHub Issues**, structured directly from the **PRD Epics, Stories, and Milestones** architecture.

---

## 1. Hierarchy & Structure

Work is organized in a 4-level hierarchy:

```text
Milestone (e.g. Tier 1a / Gate A)
 └── Epic (E1, E2, E3, E4)
      └── Story / Feature (STU-nn, EDU-nn, ADM-nn, or P-nn technical task)
           └── ISSUE (Tracked unit with 4-stage lifecycle)
```

### 1.1 Milestones (GitHub Milestone & Project Phase)
A **Milestone** groups multiple issues towards a delivery gate:
- **`Tier 1a: Core MVP (Gate A)`**: In-process core tutor, template dialogue, seed content, eval harness.
- **`Tier 1b: Protocols & Scale (Gate B)`**: MCP servers, A2A Safety Guard, pgvector retrieval, exact-key cache.
- **`Tier 1c: Replay & Teacher Tooling`**: Educator replay, review UI.
- **`Tier 2: Platform Launch (Gate C)`**: Question bank expansion, gold calibration cases, multi-provider eval.

### 1.2 Epics (PRD §6.2)
Related stories are grouped into 4 core Epics:
- **`E1`**: Guided practice and Socratic tutoring (Stories: `STU-01` to `STU-06`, `STU-08` to `STU-15`, `STU-18`, `STU-19`).
- **`E2`**: Learner progress and educator insight (Stories: `STU-07`, `STU-16`, `EDU-01`, `EDU-02`, `EDU-05`, `EDU-07`, `EDU-08`, `EDU-10`).
- **`E3`**: Review, replay, and human oversight (Stories: `EDU-03`, `EDU-04`, `EDU-06`, `EDU-09`, `EDU-11`, `EDU-12`).
- **`E4`**: Governance, security, and platform operations (Stories: `ADM-01` to `ADM-13`).

### 1.3 Stories & Work Units (PRD §6.1)
- **Story Statement Format**:
  > *As a [role], I want [capability], so that [benefit].*
  The "so that" clause is mandatory because it clarifies intent and informs engineering trade-offs.
- **Identifier Naming Conventions**:
  - `STU-nn`: Student-facing stories (e.g. `STU-01`, `STU-02`). Note: `STU-17` is retired.
  - `EDU-nn`: Educator / teacher stories (e.g. `EDU-01`, `EDU-03`).
  - `ADM-nn`: Administrator / platform ops stories (e.g. `ADM-01`, `ADM-10`).
  - `P<phase>-<nn>`: Implementation tasks / technical work packages (e.g. `P1-17`, `P2-06`).
- **Issue Title Format**:
  `[<Story/Task ID>] <Title>`
  Examples:
  - `[STU-01] Attempt before guidance`
  - `[E1/STU-03] Keypad input and reasoning options`
  - `[P1-17] Orchestrator and persistence`
- **Priorities**:
  - **P0**: Must ship in MVP (Gate A).
  - **P1**: Should ship in MVP (Gate B).
  - **P2**: Post-MVP or stretch.

---

## 2. Directory Layout & Local Mapping

```text
issue-tracker/
├── README.md                          # Issue tracker architecture & guide
├── TRACKER.md                         # Master register grouped by Milestone & Epic
├── templates/
│   └── ISSUE_TEMPLATE.md              # 4-stage lifecycle template with INVEST & DoR/DoD
└── ISSUE-<id>/                        # Dedicated folder per issue (e.g. ISSUE-001-STU-01)
    └── ISSUE.md                       # Local lifecycle document
```

### Folder Naming Convention
Local issue directories follow:
`issue-tracker/ISSUE-<number>-<story_id>/` (e.g. `issue-tracker/ISSUE-001-STU-01/` or `issue-tracker/ISSUE-017-P1-17/`).

---

## 3. The 4-Stage Task Lifecycle

Every issue enforces strict progression through 4 stages:

### Stage 1: Pre-flight (Incorporates PRD §6.3 Definition of Ready)
Before any execution begins, verify:
- [ ] Story statement defined: *As a... I want... so that...*
- [ ] Epic, Milestone, and Priority (P0 / P1 / P2) assigned.
- [ ] Linked requirements identified (PRD FR-xx, TECH-xx, SPEC §x).
- [ ] Explicit **In Scope** vs **Out of Scope** boundaries defined.
- [ ] Preconditions and dependencies identified and not blocked.
- [ ] Acceptance criteria written in **Given / When / Then** format.

### Stage 2: Execution
- [ ] Step-by-step implementation plan.
- [ ] Execution log and technical notes.
- [ ] Tracks progress without committing code (no git commit prompts).

### Stage 3: Validation (Incorporates PRD §6.3 Definition of Done)
- [ ] Automated and manual verification executed.
- [ ] Acceptance criteria (Given/When/Then) checked off with recorded outputs.
- [ ] Regression checks passed (authz, schema validity, leakage checks where applicable).
- [ ] Verification evidence pasted into the issue document.

### Stage 4: Closure
> Takes handoff from `commit-manager` after the story commit is made to close the issue locally and in GitHub.
- [ ] All Pre-flight criteria, execution steps, and validation checks completed.
- [ ] Local `ISSUE.md` marked as `Completed` with completion timestamp.
- [ ] Master `issue-tracker/TRACKER.md` updated with `Completed` status, date, and metrics.
- [ ] **Only after local files are updated:** close the GitHub Issue via `gh issue close`.

---

## 4. Workflows

### Workflow A: Creating an ISSUE (Local First, then GitHub)

1. **Locate or Define Story**:
   - Identify the Story ID (`STU-nn`, `EDU-nn`, `ADM-nn`, or `P-nn`), Epic (`E1`–`E4`), and Milestone (`Tier 1a`, etc.).
2. **Create Local Issue Folder**:
   - Determine the next sequential issue number from `issue-tracker/TRACKER.md`.
   - Create directory `issue-tracker/ISSUE-<num>-<story_id>/`.
   - Copy `issue-tracker/templates/ISSUE_TEMPLATE.md` to `issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md`.
   - Complete **1. Pre-flight** (Story statement, Epic, Priority, Given/When/Then criteria, Scope).
3. **Record in Master Tracker**:
   - Add a row under the matching Milestone and Epic in `issue-tracker/TRACKER.md` with status `In Progress` or `Planned`.
4. **Create GitHub Issue with Labels & Milestone**:
   - Run:
     ```bash
     gh issue create \
       --title "[<Story ID>] <Issue Title>" \
       --milestone "<Milestone Name>" \
       --label "epic:<E1-E4>,priority:<P0|P1|P2>,role:<student|educator|admin>" \
       --body "Tracked locally at issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md

     ### Story
     As a <role>, I want <capability>, so that <benefit>.

     ### Acceptance Criteria
     <Given / When / Then summary>"
     ```
   - Record the created GitHub issue number and link in `ISSUE.md` and `TRACKER.md`.

---

### Workflow B: Managing an Active ISSUE

1. Work through **2. Execution** in `issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md`.
2. Move to **3. Validation**, running test suites, verification commands, and recording evidence.
3. Update status in `TRACKER.md` if blockers or stages shift.

---

### Workflow C: Completing and Closing an ISSUE (Strict Gate)

> [!NOTE]
> **Handoff from `commit-manager`**:
> Once `commit-manager` finishes creating the single story commit, it hands off to `task-manager`. `task-manager` then executes this workflow to close the issue in local files and in GitHub.

Triggered when execution and validation are complete and the story commit has been made via the `commit-manager` skill:

1. **Local Sign-off**:
   - In `ISSUE.md`, verify all acceptance criteria and validation evidence are logged.
   - Complete the **4. Closure** checklist and mark `Status: Completed`.
2. **Update Master Tracker**:
   - Update `issue-tracker/TRACKER.md`: mark status as `Completed`, enter completion date, and update summary counts.
3. **Verify Local Consistency**:
   - Confirm both `ISSUE.md` and `TRACKER.md` are saved and confirmed locally as `Completed`.
4. **Close GitHub Issue**:
   - Execute GitHub CLI closure:
     ```bash
     gh issue close <issue-number> --comment "Completed. Local lifecycle verified in issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md and recorded in TRACKER.md."
     ```

---

## 5. Hard Boundaries & Rules

1. **NO GitHub Closure Before Local Sign-off**: Never call `gh issue close` before local `ISSUE.md` and `TRACKER.md` are marked completed.
2. **Handoff from `commit-manager`**: `commit-manager` handles the git commit for the story, then immediately hands off to `task-manager` to perform issue closure across local tracker files and GitHub.
3. **NO Commit Requests**: This skill **must not** ask the user to commit code changes or execute git commit commands. Commits are managed separately via the `commit-manager` skill.
4. **NO Arbitrary Code Modification**: This skill does not modify source code outside the `issue-tracker/` directory.
