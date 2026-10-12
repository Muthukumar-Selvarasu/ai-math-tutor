---
name: commit-manager
description: >-
  Commits each finished story as one single git commit with the story ID in the
  commit title and a proper description. Never bundle an entire milestone into a
  single commit, and never split a story into partial step commits. Once the commit
  is done, informs the task-manager skill to perform story closure and close the
  associated GitHub issue.
---

# Commit Manager

Once QA validation is approved by **`qa-manager`**, commit the finished story as **one single commit** with the Story ID prefixed in the commit message, followed by a proper description.

Once the commit is complete, hand off to **`task-manager`** to perform the story closure workflow.

---

## Commit Unit: Exactly One Commit Per Story

- **Milestone:** Several stories / tasks. Too big for one commit.
- **Story (Commit Unit):** One finished story or technical work package (e.g. `STU-01`, `P1-17`). **Each story must be committed into exactly one single commit.**
- **Step / File:** Creating a file, wiring an import, fixing a test inside that story. Too small. Do not create separate commits for individual steps—keep them unified within the single story commit.

---

## Commit Message Format

Every commit title **must have the Story ID in the front**, followed by a clear, proper description:

```text
[<Story-ID>] <Imperative summary of what was delivered>

<Proper description / body detailing what was changed, key design decisions,
and verification results.>

Refs: issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md
```

### Examples
- `[STU-01] Implement attempt-before-guidance flow and not-sure escalation`
- `[EDU-01] Add cohort accuracy heatmap and common error cluster dashboard`
- `[P1-17] Implement tutor orchestrator turn pipeline and session lease persistence`

---

## Rules: When to Commit

Commit when all of the following are true:
1. The user requested the commit, or the story's execution and validation are complete.
2. The entire story is finished and all tests pass (tree builds, linter/typecheck clean).
3. The diff contains only changes belonging to that story.
4. All steps of the story are staged together into this **single** commit.

### Do NOT Commit When:
- The story is unfinished, tests fail, or the build is broken.
- Changes from multiple distinct stories are mixed together (split them so each story has its own commit).
- Work is purely exploratory or temporary.

---

## Story Commit & Closure Rhythm

1. **QA Approval**: `qa-manager` runs all tests (Playwright/pytest/lint), logs evidence in `ISSUE.md`, and approves DoD.
2. **Review the Diff**: Ensure the diff is clean and contains only the changes for this story.
3. **Commit the Story**:
   - Create one single commit with `[<Story-ID>] <Proper description>`.
4. **Handoff to Task Manager (Story Closure)**:
   - **Immediately inform `task-manager`** to execute the closure workflow:
     1. Complete Stage 4 (Closure) in `issue-tracker/ISSUE-<num>-<story_id>/ISSUE.md`.
     2. Update `issue-tracker/TRACKER.md` to mark the story as `Completed`.
     3. Close the corresponding GitHub Issue via `gh issue close`.
5. **Start Next Story**: Begin the next story from a clean git working tree.
