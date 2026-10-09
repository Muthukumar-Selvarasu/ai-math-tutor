---
name: github-issues
description: >-
  Creates, manages, and closes GitHub issues aligned with PRD Section 6
  specifications and the task-commits workflow. Use whenever creating user stories
  or tasks in GitHub Issues, checking Definitions of Ready/Done, or marking
  issues as completed when commits are made.
---

# GitHub Issues Management

This skill defines the end-to-end workflow for tracking user stories, technical tasks, and bugs as GitHub Issues in strict compliance with **PRD Section 6 (User Stories)** and the **task-commits** rhythm.

---

## Core Principles

1. **All issues live in GitHub Issues:** Every deliverable story or task must have a corresponding issue in GitHub Issues using the `gh` CLI.
2. **PRD Section 6 Compliance:** Every issue must contain the standard fields, INVEST criteria, Given / When / Then acceptance criteria, Definition of Ready (DoR), and Definition of Done (DoD).
3. **Commit-Driven Completion:** An issue is only closed once its implementation is verified, the user explicitly asks to commit, and the task commit is executed per the `task-commits` skill.

---

## Issue Template (PRD Section 6 Format)

When creating an issue, format the title and body strictly as follows:

### Title Format
`[<Story/Task-ID>] <Title>`

*Examples:*
- `[STU-01] Attempt before guidance`
- `[EDU-03] Session replay for educators`
- `[TECH-01] SymPy deterministic verification engine`

### Body Format
```markdown
## Story Statement
**As a** [role: student | teacher | tutor | academic_coordinator | admin]  
**I want** [capability]  
**so that** [mandatory benefit / intent]

## Metadata
| Field | Value |
| :--- | :--- |
| **Epic** | E1 (Guided practice) \| E2 (Learner progress) \| E3 (Review & replay) \| E4 (Governance) |
| **Priority** | **P0** (MVP Must) \| **P1** (MVP Should) \| **P2** (Post-MVP/Stretch) |
| **Linked Requirements** | e.g. FR-03, FR-05, FR-06 |
| **Dependencies** | Prerequisites or "None" |
| **Out of Scope** | Boundaries to prevent scope creep |
| **Success Metric** | How value is measured (PRD Section 4) |

## Acceptance Criteria
<!-- Must use Given / When / Then describing observable behavior -->
- [ ] **Given** [context/precondition], **when** [action/trigger], **then** [observable outcome].
- [ ] **Given** [edge case/failure condition], **when** [action/trigger], **then** [fallback outcome].
- [ ] **Given** [unauthorized role], **when** [access attempted], **then** [permission denied].
- [ ] **Given** [tutoring turn completed], **when** [processed], **then** [audit event & Langfuse trace recorded].

## Non-Functional Requirements
- **Performance:** Deterministic verifier <500ms; dialogue turn <5s
- **Security & Safety:** Strict prompt isolation; zero answer leakage prior to allowed hint level
- **Accessibility:** WCAG 2.1 AA (contrast, keyboard navigation, aria labels)

## Definition of Ready (DoR) Checklist
- [x] Benefit stated in "so that" clause and priority assigned (P0/P1/P2)
- [x] Acceptance criteria written in Given / When / Then format
- [x] Linked requirements and dependencies identified
- [x] Test data needs identified (seed questions, synthetic students)
- [x] Small enough for one sprint / single task changeset

## Definition of Done (DoD) Checklist
- [ ] All acceptance criteria pass with automated tests where applicable
- [ ] Authorization tests cover every role touched
- [ ] SymPy verifier, schema, and answer-leakage checks pass
- [ ] Audit events and Langfuse traces emitted
- [ ] Code peer-reviewed and verified with clean build
- [ ] Completed and committed as per `task-commits` skill
```

---

## Creating Issues with `gh` CLI

Use the `gh` CLI to interact with GitHub issues. Always ensure repository context:

### Create an Issue
```bash
gh issue create \
  --title "[STU-01] Attempt before guidance" \
  --body "<formatted_body>" \
  --label "enhancement"
```

If labels (e.g. `P0`, `epic:E1`) do not exist yet, they can be created or standard available labels can be used:
```bash
# Check existing labels
gh label list

# Create custom label if needed
gh label create "P0" --color "b60205" --description "Must ship in MVP"
```

### View or List Issues
```bash
# List open issues
gh issue list

# View issue details
gh issue view <issue-number>
```

---

## Lifecycle & Task-Commits Integration

Issues are progressed following the `task-commits` rhythm:

### 1. Readying the Task
- Select an issue that satisfies the **Definition of Ready (DoR)**.
- Work on only the scope defined in the acceptance criteria.

### 2. Verification
- Validate all acceptance criteria.
- Run automated unit tests and verifiers.
- Confirm all **Definition of Done (DoD)** items are satisfied.

### 3. User Prompt & Commit Rhythm
- Summarize the task's diff to the user in one sentence and wait.
- **Do not commit until the user asks.**
- When the user asks to commit:
  - Create the task commit referencing the issue number:
    ```bash
    git commit -m "feat(tutor): implement attempt before guidance (fixes #<issue-number>)"
    ```

### 4. Closing the Issue
- Once the task commit is created, close the issue with an auditable completion comment:
  ```bash
  gh issue close <issue-number> --comment "Completed and verified per DoD in commit $(git rev-parse --short HEAD). All acceptance criteria satisfied."
  ```
- Start the next task from a clean tree.
