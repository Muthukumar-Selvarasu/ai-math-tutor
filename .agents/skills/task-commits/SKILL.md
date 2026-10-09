---
name: task-commits
description: >-
  Decides when a git commit is warranted during development. Commit each
  finished task as its own changeset so history stays small and searchable,
  always including the Task ID ([STU-xx], [EDU-xx], [TECH-xx]) in the commit message.
  A milestone bundles many tasks, so do not commit a whole milestone as one
  commit. Do not commit incomplete steps inside a task. Use when the user asks
  whether to commit, asks the agent to commit, finishes a task, or talks about
  commit cadence, git history, milestones, or when to save work. Applies in
  every project.
---

# Task commits

A milestone groups several tasks. Commit each finished task, not the milestone.

Each task commit is one changeset you can find, review, and revert on its own. Commit only when the user asks. When a task is finished and they have not asked, say so in one sentence and wait.

## Commit unit

- **Milestone:** several tasks. Too big for one commit. Open the pull request here, after the task commits are in.
- **Task:** one finished change with a single purpose. This is the commit.
- **Step:** creating a file, wiring an import, or fixing a typo inside that task. Too small. Keep these in the task commit.

## Commit message format

Every commit message **MUST** include the task/story identifier (such as `[STU-xx]`, `[EDU-xx]`, `[TECH-xx]`) to maintain traceability with PRD Section 6 and GitHub Issues:

```text
<type>(<scope>): [<TASK-ID>] <short task description> (fixes #<issue-number>)
```
*or*
```text
[<TASK-ID>] <short task description> (#<issue-number>)
```

## Commit when all of these are true

- The user asked to commit.
- The current task is finished and checked (tests, the app, or a manual pass).
- The commit message includes the **Task ID** (e.g. `[TECH-01]`, `[STU-02]`).
- The diff is only that task.
- The tree builds, and the tests for that task pass.

## Do not commit when

- The user has not asked.
- The commit message is missing the Task ID.
- The task is unfinished, the code does not build, or the relevant tests fail.
- The diff still includes an earlier task. Split it so each commit is one task.
- The work is still exploratory and may be thrown away.

## Rhythm

1. Finish one task.
2. Summarize that task's diff.
3. Commit it when the user asks, with a message that names the Task ID and task title.
4. Start the next task from a clean tree.

## Examples

- Conventional commit with Task ID:
  - `feat(verifier): [TECH-01] add SymPy ratio equivalence validation (fixes #12)`
  - `feat(student): [STU-01] record student initial attempt before hint prompt (fixes #3)`
  - `test(policy): [TECH-04] add red-team answer leakage benchmark tests`
- Three separate commits for three tasks:
  - `feat(policy): [TECH-04] add retry backoff logic`
  - `feat(telemetry): [TECH-05] add timeout metrics to Langfuse tracer`
  - `chore(config): [TECH-06] add hint policy feature flag`
- One commit: `feat(verifier): [TECH-01] add unit conversion verifier with test suite`
- Not one commit: the whole "voice pipeline reliability" or "Phase 1: Tutor Foundation" milestone.

If the user asks to commit and the tree holds more than one finished task, make one commit per task. If they named one task, commit only that slice.
