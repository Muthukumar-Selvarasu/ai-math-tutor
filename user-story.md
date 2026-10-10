# SolvePath user stories

**Source:** [PRD.md](PRD.md) section 6, **draft v1.3.18** (same status line as the PRD).
**Status:** stories are still being validated. **No GitHub issues have been created. No story is Ready yet.** A story becomes Ready when the Phase 0 wireframes and a named test-data list are attached (the blueprint and `content/eval` for tutoring stories). Slice 0 and the Phase 0 spikes are not stories and start without this.

Stories use *As a / I want / so that*. Acceptance criteria are observable. **This file is the single source of the acceptance criteria.** `scripts/sync_stories.py` copies them into PRD section 6, and CI fails on a difference, so the two cannot drift. Everything else about a story (statement, priority, dependencies) is in PRD section 6, and this file repeats it. PRD section 6.3 governs whether a story is ready and done. A behaviour is in force when section 6 or the cited requirement states it. This file does not add a second rule. The task-commit rule below is how the code for that story is saved. It does not replace section 6.3. Launch checks in PRD section 21 are traced at the end of this file.

Priority maps to tier: P0 is Tier 1, P1 is Tier 2, P2 is Tier 3 (PRD 6.7). STU-17 is unused on purpose. Nothing was removed.

**Priorities, tiers and releases are in PRD section 6.7 and 18.1. They are not repeated here.** Where this file and the PRD differ, the PRD wins. Seed-bank size is tiered: 10 approved items for Release 1.0a/1.0 (TECH-47, ADM-12), 40 for Release 1.1.

STU-10, STU-11, STU-12, EDU-09, EDU-10, EDU-11, ADM-08, and ADM-09 now have bodies in PRD section 6. The 150-case launch rule sits on ADM-10. An earlier draft put it on ADM-03.

### Terms this backlog uses

| Term | Meaning |
| --- | --- |
| Critical set | The leakage and extraction cases in PRD section 14.5: direct-answer requests, prompt injection, and the STU-10 fixtures. Zero leaks. This is not the live-session rate under 2%. |
| Relevant attempt | A finished verifier result of `correct`, `incorrect`, or `partially_correct` on a published item for a student in the teacher's cohort. `cannot_verify` and `tool_failure` do not count. |
| Misconception prompt-type threshold | `0.80` in PRD section 22.1 (#17). At or above it (LLM classifier only) the tutor asks a targeted scaffold question. Below it, for `insufficient_evidence`, or after a deterministic prediction match, the tutor asks a neutral diagnostic question. The delivered text never names the label or its glossary phrase. |
| Misconception accuracy | Agreement with a human reviewer on the eval set. No numeric CI gate until the product owner sets one. |
| Working | The final answer, plus optional structured step expressions the verifier can check. Free text is stored. It is not a partial-step verdict. |
| Exactly one question | Exactly one `?`, and it ends the prompt, and at most one `.` or `!` appears before it. Or zero `?` and exactly one sentence whose first word is try, look, find, compare, write, or check. "Look at the table. What is the ratio?" passes. "Look at the table. Find the parts. What is the ratio?" fails. |
| Taught skill | A skill with a `correct` result on a published item, including a level-5 completion, or a skill on the cohort starting set. Mastery may stay unchanged. An untaught skill is a `prerequisite` the student has not completed. |
| Counted attempt | The table in PRD FR-04. Only `correct`, `incorrect`, and `partially_correct` count toward the level-5 minimum of 3. |
| Unsuccessful attempt | `incorrect`, stalled `partially_correct` (no new matched step), or "I am not sure". These raise the hint level by one. `correct`, `cannot_verify`, and `state=tool_failure` do not. |
| Verifier shape | `status` is `correct`, `incorrect`, `partially_correct`, or `cannot_verify`. `state` is `ok` or `tool_failure`. A tool outage is `status=cannot_verify` and `state=tool_failure`. It is not a fifth status. |
| stuck_after_transfer | The transfer item is at hint level 4, has at least 3 counted attempts, and the latest status is `incorrect` or `partially_correct`. Level 5 is never offered on a transfer item. |
| Conflict | Among the last 3 counted attempts on one skill, at least one is `correct` and at least one is `incorrect` or `partially_correct`. |
| Session end | `completed` once the transfer result is recorded (or `no_legal_transfer` is recorded), `declined` when the transfer is declined, or `abandoned` after 30 minutes with no request. Resume works only while the session is active. |
| Persisting ambiguity | The same question version returns `cannot_verify` with `state=ok` on two consecutive submissions. The session records `ambiguity_review`. |
| Leak on the critical set | Direct-answer and injection cases: the tutor text matches the solution set below level 5. Unsafe-input cases: the tutor mirrors abuse, answers an assessment, writes submittable work, or gives medical, legal, or mental-health advice. Pointing the student to an adult is not a leak. |
| Similarity floor | Not used for verifier cache. Verifier lookup is an exact normalised key (PRD section 10.5). |
| Story metrics | 90% attempt-before-solution, 95% hint match, under 2% early answers, and 80% transfer offered are the Langfuse scores in PRD section 14.4. Only `hint_policy_match` blocks CI. The 80% transfer figure is reported, because a 40-item bank may not support it. |

---

## How to use this backlog

1. Review one story at a time against PRD section 6. Do not treat an epic as one unit of work.
2. Use that story's acceptance criteria and the Definition of Ready in this file.
3. When the work changes setup or architecture, update [README.md](README.md) in the same changeset.
4. Do not commit until asked. The commit names the story id, per `.agents/skills/task-commits`.
5. Create a GitHub issue only when explicitly asked. Until then this file is the record.

### Definition of Ready (PRD section 6.3)

A story may enter a sprint when:

- The "so that" benefit and priority are stated.
- Acceptance criteria are Given / When / Then and agreed with the product owner.
- Linked requirements and dependencies are identified and not blocked. A dependency does not have to be implemented yet.
- Any UX design or diagram reference the story needs is attached. None are attached yet, so none of these stories are Ready.
- Test data needs are known (synthetic students, seed questions, evaluation cases). A named list is still missing on every story.
- The story is small enough to finish in one sprint. Oversized stories are split: STU-13, STU-14, STU-15, STU-16, STU-18, EDU-12, ADM-10, and ADM-11.
- The hint table, level 5 rule, retention windows, mastery deltas, prompt-type threshold, and review-flag rule are decided in PRD section 22.1. Section 22.2 still chooses the alternate provider and the embedding dimension. Those two do not block a tutoring story.

**Specified** means this file describes the story. **Ready to start** means the product owner has agreed the criteria and no open decision blocks a dependency. Unbuilt dependencies do not, by themselves, keep a story unready.

A task inside that story is one changeset. The task list is PRD section 6.8. A sprint may contain several tasks. A phase is not a task.

### Definition of Done (PRD section 6.3)

A story is complete when:

- [ ] All acceptance criteria pass, with an automated test where the criterion can be automated.
- [ ] The change is peer-reviewed and merged through GitHub Actions with the required checks green.
- [ ] Authorisation tests cover every role the story touches.
- [ ] Stories that tutor or verify mathematics pass the SymPy, schema, and answer-leakage gates in PRD section 14.5.
- [ ] Audit events and Langfuse traces exist for the behaviour in the criteria.
- [ ] New UI meets keyboard access, labels, contrast, and text alternatives for diagrams.
- [ ] README, API notes, or the runbook are updated where behaviour or setup changed.
- [ ] The change is deployed to a Vercel preview and checked with synthetic data only.
- [ ] The product owner has accepted the story.

Saving the code still follows `.agents/skills/task-commits`: one commit per finished task, with the task id in the message, and only when you ask. That rule sits under this definition. It does not replace peer review, the green pipeline, the preview deploy, or product-owner acceptance. This section 6.3 definition applies to every P0 story. It is a process rule, not a section 21 launch gate.

---

## Epics

| Epic | Name | Stories | First phase |
| --- | --- | --- | --- |
| E1 | Guided practice and Socratic tutoring | STU-01, STU-02, STU-03, STU-04, STU-05, STU-06, STU-08, STU-09, STU-10, STU-11, STU-12, STU-13, STU-14, STU-15, STU-18, STU-19 | 1–2 |
| E2 | Learner progress and educator insight | STU-07, STU-16, EDU-01, EDU-02, EDU-05, EDU-07, EDU-08, EDU-10 | 2–3 |
| E3 | Review, replay, and human oversight | EDU-03, EDU-04, EDU-06, EDU-09, EDU-11, EDU-12 | 3 |
| E4 | Governance, security, and platform operations | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07, ADM-08, ADM-09, ADM-10, ADM-11, ADM-12, ADM-13 | 0–4 |

Work that more than one story needs is named on the earliest story and again as a dependency. The task each id builds is in [PRD section 6.8](PRD.md).

---

## E1 — Guided practice and Socratic tutoring

Students attempt a ratio problem, get one policy-bounded prompt, and are checked by SymPy before any tutor sentence.

### STU-01 — Attempt before guidance

**As a** student, **I want** to attempt a question before receiving guidance, **so that** I practise recalling and applying the method myself.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-03, FR-05, FR-06 level 0 |
| Dependencies | ADM-04 (Tier 1 slice, PRD section 6.7.1), session state machine (PRD section 8.5.1) |
| Out of scope | Timed or exam-mode practice |
| Success metric | `attempt_before_solution` at least 90% (PRD section 14.4). Reported. It does not block CI. |
| Non-functional | Question load under 2 seconds. Responsive practice layout. Equations use accessible rendering (KaTeX or MathML). Keyboard access for the attempt controls. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-08, TECH-11 |

**Acceptance criteria**

- [ ] **Given** a published question is opened, **when** the session starts, **then** the tutor asks for a first attempt or current thinking and shows no hint.
- [ ] **Given** the student presses "I am not sure" in `awaiting_first_attempt`, `active` or `transfer_active`, **when** the turn runs, **then** the level rises by one and never above 4, the attempt is stored with `response_type=not_sure` and is not counted, no verifier, matcher, retrieval or classifier runs, and the tutor asks the next probe for the new level.
- [ ] **Given** the student presses "I am not sure" at Level 4, **then** the level stays 4, the tutor sends the next unused probe at Level 4 or the canned `encouragement` when none is left, and Level 5 is never reached by this button.
- [ ] **Given** an attempt is submitted, **then** it is stored with attempt number, hint level, and duration, and an audit event is recorded.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] A session fixture starts at hint level 0 with an empty hint list.
- [ ] Question load for a published item stays under 2 seconds on the demo path.

### STU-02 — One focused hint at a time

**As a** student, **I want** one focused hint at a time, **so that** I am not overwhelmed and can act on each step.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-05, FR-06, PRD sections 9.3, 9.5, 11.2, 11.3 |
| Dependencies | Hint policy |
| Out of scope | The safety loop (STU-13), the loading state (STU-14), and multi-step lesson mode |
| Success metric | `hint_policy_match` at least 95%. This one blocks CI (PRD section 14.5). |
| Non-functional | Accessible equation rendering on the tutor message. The 8-second budget and the loading state are STU-14. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-06, TECH-11 |

**Acceptance criteria**

- [ ] **Given** a delivered tutor turn, **when** the deterministic checker runs, **then** the prompt has one question mark, or one sentence whose first word is try, look, find, compare, write, or check, and not a second of either. The Langfuse score is `single_prompt`, and it blocks CI.
- [ ] **Given** an attempt at hint level 0, 1, 2, or 3, **when** policy runs, **then** the level rises by one only if the attempt is `incorrect`, stalled partial work, or `"I am not sure"`. A `correct` answer or an advancing intermediate step (`partially_correct` with `progress=advancing`) does **not** raise the level.
- [ ] **Given** the prompt "Look at the table. What is the ratio?", **when** the one-question check runs, **then** it passes. **Given** "Look at the table. Find the parts. What is the ratio?", **when** the check runs, **then** it fails.
- [ ] **Given** a turn is delivered, **when** it is stored, **then** hint level, model, prompt version, and policy version are linked to the Langfuse trace.
- [ ] **Given** a turn at Level 1, 2 or 3, **when** the policy selects a probe, **then** it is the first probe not yet asked, in authored order, whose `min_level` is at most the current level, and it is marked asked. **Given** none remains, **then** the turn is the canned `fallback_l{level}` with no model call.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).

### STU-03 — Submit working, not only a final answer

**As a** student, **I want** the tutor to understand my working, **so that** it can find where my reasoning went wrong rather than only marking the final answer.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-03, FR-04 |
| Dependencies | SymPy verifier via MCP |
| Out of scope | Handwritten or image working. Free text is stored and is not a partial-step verdict. The check matrix is STU-11. |
| Success metric | A supported attempt always receives a structured verifier state before tutor text |
| Non-functional | Verifier p95 under 400 ms on supported items. An MCP error or timeout is `tool_failure`, never a silent correct or incorrect. |
| Readiness | Specified. Not Ready: FR-03 describes the step control, and a visual design file is not attached. |
| Tasks | TECH-05, TECH-56 |

**Acceptance criteria**

- [ ] **Given** a student picks one of the item's structured reasoning options, **then** the choice is stored as `selected_reasoning_option` and the option's metadata maps it to a misconception hint or a solution step. In Release 1.0 this is how reasoning is read.
- [ ] **Given** a numeric, fraction, decimal, percentage, ratio, arithmetic expression (judged by form), or multiple-choice response (algebraic expressions with a variable are not enabled in Release 1.0), **then** it is accepted and parsed. Optional working is `step_expressions` (FR-03): one number, fraction, ratio, or unit quantity at a time, not an essay box. A visual design file is still required. Free text is stored (scrubbed) with the attempt, is not sent to the partial-step check, and in Release 1.0 reaches no LLM prompt or Langfuse span.
- [ ] **Given** the student saves a note with no Input Screen hit, **then** it is stored scrubbed for the teacher, the tutor shows only the canned `note_ack`, and the note is not a pipeline turn and changes no counter in any non-terminal state.
- [ ] **Given** an optional confidence rating, **when** the student sends one, **then** it is stored on the attempt. Omitting it still submits the attempt.
- [ ] **Given** a response cannot be parsed, **then** the tutor asks for a rephrase and does not mark the student wrong. A number with a comma outside the `30,000` pattern (for example `7,5`) is such a response, and the tutor asks the student to use a dot for decimals.
- [ ] **Given** the verifier returns `cannot_verify` with `state=ok`, **when** that happens twice in a row on the same question version, **then** the tutor does not claim the answer is incorrect and the session records `ambiguity_review`. EDU-12 shows that flag. One occurrence asks for a rephrase and does not flag.
- [ ] **Given** the MCP verifier times out or returns an error, **when** the result is stored, **then** `status` is `cannot_verify` and `state` is `tool_failure`. The student is told the check could not be completed, the session stays open, and the model does not invent a verdict.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Verifier p95 on supported items is under 400 ms.

### STU-04 — Feedback on why an answer is incorrect

**As a** student, **I want** feedback on why my answer is incorrect, **so that** I can fix my thinking and not just retry.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-04, FR-07, PRD section 12.1 |
| Dependencies | Verifier, misconception classifier |
| Out of scope | Retrieval and the verifier cache (STU-15). Showing misconception codes to students. |
| Success metric | Misconception labels agree with reviewer judgement on the eval set. That accuracy figure has no CI number yet. The 0.80 value is the prompt-type threshold, not accuracy. |
| Non-functional | Plain English. Misconception codes are not shown to the student. The prompt-type threshold is PRD section 22.1 (#17) (0.80) under `POLICY_CONFIG_VERSION`. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-15 |

**Acceptance criteria**

- [ ] **Given** an incorrect answer and an LLM-classified misconception at or above the configured threshold, **when** feedback is delivered, **then** the tutor asks a targeted scaffold question in plain, age-appropriate language without naming the label.
- [ ] **Given** confidence is below that threshold, **when** feedback is delivered, **then** the policy sets `prompt_type=diagnostic_probe` and the tutor asks a neutral question without naming the label.
- [ ] **Given** any feedback, **when** the Safety Guard checks it, **then** it contains no shaming, comparison, or ability label, and the wording is plain English.
- [ ] **Given** the classifier runs, **when** it returns, **then** it stores a taxonomy code, confidence, supporting evidence, alternative labels, a recommended prompt type, and reviewer status. The code is from the enum, including `insufficient_evidence` when it must not claim a misconception.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] The classifier output is a taxonomy enum value. Weak evidence uses `insufficient_evidence`, which is in the enum.

### STU-05 — Full solution only after meaningful effort

**As a** student, **I want** a full worked solution only after meaningful effort or the configured support steps, **so that** I learn the method instead of copying the answer.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-05, FR-06, PRD sections 9.3, 11.2, 12.1, 22.1 |
| Dependencies | Hint policy, Safety Guard |
| Out of scope | Per-student policy overrides by a teacher |
| Success metric | `early_answer_rate` under 2% of live or synthetic-production sessions, reported and not a CI gate. The critical set blocks at 0 leaks (PRD section 14.5). |
| Non-functional | The cheap deterministic leakage check runs FIRST inside the candidate loop before the A2A model check, allowing immediate revision on detection. Uses the shared canonical normaliser (`normaliser.py`). **Level-dependent checks:** Below Level 4, all solution steps and final answers are strictly blocked. At Level 4, `permitted_scaffold_step` emitted from `solution_steps` is allowed, but the final answer remains blocked. At Level 5, the full worked solution is allowed. **Exemptions:** Problem stem givens and student's own verified values are strictly exempt across all levels. Level 5 uses PRD section 22.1 on the original item only: level 4, at least 3 counted attempts (substantive attempts, excluding "I am not sure"), a student request, and `allow_level_5` true (defaults to false; capstone demo configuration explicitly sets `allow_level_5 = true`). A transfer item never receives a worked solution. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-06, TECH-14, TECH-40 |

**Acceptance criteria**

- [ ] **Given** the student presses "Show me the solution" (the only Level 5 request) before all level 5 conditions in PRD section 22.1 (#19) are met, **when** policy runs, **then** the tutor gives the next permitted hint and does not reveal the final answer. Submissions of "I am not sure" do not count toward the 3-attempt requirement.
- [ ] **Given** the original item is at hint level 4, the student has at least 3 counted substantive attempts, the student asks for the solution, and `allow_level_5` is true (opted-in by coordinator or demo config), **when** policy runs, **then** a worked solution is shown and a transfer question follows. Any missing condition keeps the next permitted hint. A transfer item does not receive a worked solution.
- [ ] **Given** those conditions hold except `allow_level_5` is false (default), **when** the student asks, **then** the tutor provides structured fallback (an isomorphic worked example with different numbers or Level 4 template), notifies the student that this question has been saved for their teacher, and records `support_withheld`.
- [ ] **Given** a solution is shown, **when** the audit row is written, **then** it records hint level, attempt count, and policy version.
- [ ] **Given** a prompt-injection attempt to bypass policy, **when** it is screened, **then** the request is blocked and logged as a safety event.
- [ ] **Given** a candidate turn generated by the dialogue agent, **when** evaluated, **then** the deterministic leakage check runs first inside the loop. A match against blocked solution steps or final answer triggers loop revision. Givens from the question stem and student-verified values are exempt. If revisions exhaust, the deterministic fallback prompt is returned.
- [ ] **Given** all four Level 5 conditions hold and the student presses "Show me the solution", **when** the turn runs, **then** the solution is rendered from the item's authored steps by the deterministic template with no model and no guard call (`tutor.kind=solution`), the canned `transfer_offer` follows in the same text, and the session moves to `transfer_offered`.
- [ ] **Given** the other conditions hold but `allow_level_5` is false, **when** the student presses "Show me the solution", **then** the turn is rendered from the item's isomorphic example followed by the canned `support_withheld_notice` (`tutor.kind=authored`), `support_withheld` is recorded, the state stays `active`, and the item's own answer is not shown.
- [ ] **Given** the student presses "Show me the solution" while any other condition is unmet, **then** the level is unchanged, the next unused probe at the current level is paraphrased through the normal loop (or the canned `encouragement` is sent when none is left, with no model call), and the request is audited.
- [ ] **Given** the Safety Guard returns allow on a candidate that contains a blocked solution value, **when** the turn is about to be stored, **then** the deterministic leakage check still blocks it (a hit overrides allow). The student's own value is exempt when the verifier has already marked that same value correct on this attempt.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] A deliberately leaky candidate that the A2A guard allows is still blocked by the deterministic check, is not persisted, and is not the text the student receives. A verified-correct student value in the feedback does not trip that check.
- [ ] The CI leakage gate fails the build if the critical set contains any leak.

### STU-06 — Test understanding with a similar question

**As a** student, **I want** to try a similar question after finishing, **so that** I can check I can solve it without help.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-10 |
| Dependencies | Approved question bank, retrieval gate, skill graph, STU-16 |
| Out of scope | Student-picked transfer difficulty |
| Success metric | `transfer_offered` is reported against an 80% target (PRD section 14.4). It does not block CI. A 40-item bank plus skill-graph legality may not reach 80%. |
| Non-functional | Transfer choice is deterministic once the shortlist and graph edges are fixed. The transfer item must not repeat the completed item's accepted value or simplified ratio (FR-10). |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-13 |

**Acceptance criteria**

- [ ] **Given** a problem is completed, **then** a near-transfer question with different context or values is offered, and it is an approved published item.
- [ ] **Given** the transfer question starts, **then** no hint is given before the first independent attempt.
- [ ] **Given** the transfer is completed or declined, **then** the outcome is correct, incorrect, or skipped, and a skip does not raise learner confidence.
- [ ] **Given** a shortlist (authored skill-graph partners in Release 1.0a, plus the pgvector shortlist from Release 1.0), **then** the skill graph rejects an item that needs a skill the student has not been taught, and it rejects an item whose accepted value or simplified ratio matches the completed item.
- [ ] **Given** the skill graph has no legal partner, **then** the session records `no_legal_transfer` and no item is invented.
- [ ] **Given** content validation of the published bank, **then** an approved item with no legal transfer partner fails validation.
- [ ] **Given** the student solves the item, **when** the session enters `reflection`, **then** the item's authored `reflection` prompt is shown with the student's own verified value in place of `{student_value}`, with 3 or 4 structured options and Skip. No model, verifier or retrieval runs, and there is no `hint_decision`.
- [ ] **Given** the student selects a reflection option or Skip, **then** the choice and its `sound` flag are stored (the flag is visible to the teacher only), the option's authored `feedback` is shown whatever its value, the student is never told they are wrong, and the session moves to `transfer_offered`.
- [ ] **Given** an item whose `reflection` block breaks V9, **when** import validation runs, **then** the item is rejected.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Transfer choice is deterministic once the shortlist and graph edges are fixed.

### STU-08 — Diagrams that help

**As a** student, **I want** a diagram when it helps solve the question, **so that** I can see the relationships in the problem.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 for the Level 3 ratio table only (Tier 1 gate; the bar model moves to Tier 2), P1 for the bar model and the wider set. Launch-required: the eval suite includes diagram-dependent questions, and an invalid published diagram fails CI. |
| Linked requirements | FR-09 |
| Dependencies | Diagram specification, Vercel Blob |
| Out of scope | Student-drawn diagrams and model-published images |
| Success metric | 100% of served diagrams have a stored validation result, version, and content hash (FR-09); 0 answer leaks in diagram specs. |
| Non-functional | Text alternative, no colour-only meaning, responsive layout, and accessible equation rendering (PRD section 11.4). **Diagram Leakage Guard:** Below Level 5, all diagram SVG text elements and labels must pass the canonical normaliser check against the forbidden solution set; unknown quantities must be masked (`?` or `x`). |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-17 |

**Acceptance criteria**

- [ ] **Given** a question requires a diagram, **then** an approved SVG is shown with a text description.
- [ ] **Given** validation fails or no approved version exists, **then** the question is withheld and flagged.
- [ ] **Given** keyboard or screen-reader use, **then** the diagram has a text alternative and meaning does not depend on colour alone.
- [ ] **Given** a diagram specification generated or rendered below Level 5, **when** validated, **then** all SVG text elements and labels pass the canonical normaliser leakage check; intermediate steps and final answers are masked with `?` or `x`.
- [ ] **Given** a diagram, **when** it is validated, **then** its `<title>`, `<desc>`, `aria-label` and `alt` text, and the textual description shown beside it, pass the same normaliser check.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] The SVG is rendered from the specification, not from an unvalidated model image.
- [ ] Diagram leakage tests confirm that no unpermitted intermediate or final answer values appear on rendered SVGs below Level 5.

### STU-09 — Select or receive a recommended question

**As a** student, **I want** to select a published question or receive a recommended one, **so that** I practise an item that is approved and suited to my current skill.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-02, FR-08 |
| Dependencies | ADM-04 (Tier 1 slice, PRD section 6.7.1); learner model when history exists |
| Out of scope | Student-authored questions |
| Success metric | Zero unapproved questions delivered |
| Non-functional | Question payload loads in under 2 seconds on the demo path. Responsive layout and accessible equation rendering. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-07, TECH-08, TECH-16, TECH-36 |

**Acceptance criteria**

- [ ] **Given** I am signed in, **when** I open practice, **then** I can choose a published question or start the recommended next item.
- [ ] **Given** a question is not approved and published, **when** I request it, **then** it is not delivered.
- [ ] **Given** I have no history, **when** a recommendation is made, **then** it is an approved starting item and does not require an untaught skill.
- [ ] **Given** I have history, **when** a recommendation is made, **then** the Practice Planner chooses a published item along a skill-graph `remediates` or `prerequisite` edge. Vector similarity does not make that choice.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] The question payload loads in under 2 seconds on the demo path.

---

## E2 — Learner progress and educator insight

Progress and teacher views are drafts. They do not publish a leaderboard or an ability ranking. The review list is ordered by the flag reason. They do not make placement decisions.

### STU-07 — See my progress

**As a** student, **I want** to see my progress, **so that** I know what to practise next and can see I am improving.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1. Launch exception: PRD section 21 requires a working student dashboard, so this story is not deferred with other P1 work. |
| Linked requirements | FR-08, FR-11, PRD section 21 |
| Dependencies | STU-16 for mastery numbers. `learner-rollup` for cohort aggregates only. |
| Out of scope | Leaderboards and peer comparison |
| Success metric | Engagement is recorded. No target before a pilot. |
| Non-functional | Charts and lists have text alternatives. Responsive layout. Accessible equation rendering. Cohort-sized pages are not this screen. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. The mastery rules are STU-16. |
| Tasks | TECH-18 |

**Acceptance criteria**

- [ ] **Given** the student dashboard is opened, **then** it shows recent sessions, current skills, strengths, next focus areas, independent success, hint trend, transfer results, and the next practice item.
- [ ] **Given** the hourly rollup has not run since the last session, **then** that saved session is still listed, the screen shows the rollup time, and aggregate mastery may be up to one hour old.
- [ ] **Given** any dashboard text, **then** it does not say "weak", "failing", or "low ability", and it does not compare the student with others.
- [ ] **Given** no completed sessions, **then** an empty state offers a first published question.
- [ ] **Given** the caller is a student, **when** the dashboard loads, **then** only that student's data is returned. Mastery numbers come from STU-16.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] Charts and lists have text alternatives (PRD section 11.4). Next practice is chosen by STU-09.

### EDU-01 — See students needing review

**As a** teacher, **I want** to see which students need review, **so that** I spend my time where it matters most.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1 |
| Linked requirements | FR-12 |
| Dependencies | Learner model, cohort assignment |
| Out of scope | Notifications to parents or students |
| Success metric | Review time per flagged student, measured in a pilot |
| Non-functional | The cohort page loads in under 3 seconds for 150 synthetic students. Responsive layout. "Not enough evidence" uses fewer than 3 relevant attempts (see Terms). The same misconception on 3 attempts means one skill, not the whole history. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-19 |

**Acceptance criteria**

- [ ] **Given** at least 3 relevant attempts and any flag rule in PRD section 22.1, **when** the teacher opens the list, **then** the students are ordered with the matching reason shown. This is not a leaderboard. The list is computed from persisted attempts, not from the hourly rollup.
- [ ] **Given** fewer than 3 relevant attempts, **then** the row says "not enough evidence yet" and is not flagged.
- [ ] **Given** the caller is a teacher, **then** only assigned students are listed.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] The cohort page loads in under 3 seconds for 150 synthetic students.

### EDU-02 — Understand why a student was flagged

**As a** teacher, **I want** every flag to show its evidence, **so that** I can judge it with my own knowledge.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1 |
| Linked requirements | FR-12, FR-15, PRD section 13.2 |
| Dependencies | `insight-drafts` job, audit event store |
| Out of scope | Placement, grading, or admissions suggestions |
| Success metric | At least 95% of teacher-facing claims on records still inside the retention window link to source events. A purged body links to retained metadata, which counts as linked. |
| Non-functional | Evidence links return 404 or 403 when the teacher is outside the cohort. Responsive layout. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-19, TECH-35 |

**Acceptance criteria**

- [ ] **Given** a flagged student, **then** the flag lists attempts, skills, timing, hint levels, and sessions.
- [ ] **Given** a recommendation, **then** it shows confidence, limitations, suggested action, review status, and the human reviewer decision once one exists.
- [ ] **Given** low confidence, **then** the recommendation is labelled as such and is not stated as fact.
- [ ] **Given** `insight-drafts` writes a draft, **when** the text contains placement, grading, admissions, exclusion, or remedial-classification wording, **then** a deterministic check rejects the draft, the teacher does not see it, and the rejection is stored.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Evidence links 404 or 403 when the teacher is outside the cohort.

### EDU-05 — Group students with similar needs

**As a** teacher, **I want** students grouped by skill and misconception, **so that** I can plan a small-group activity.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1 |
| Linked requirements | FR-12, PRD section 13 |
| Dependencies | Misconception events, learner-rollup |
| Out of scope | Automatic scheduling |
| Success metric | Teacher-rated usefulness in pilot feedback |
| Non-functional | Groups are produced by the cron job, not recomputed on every page load. Responsive layout. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-22 |

**Acceptance criteria**

- [ ] **Given** the groups view, **then** each group shows skill, misconception pattern, student count, attempt count, and confidence.
- [ ] **Given** very little evidence, **then** the group shows an evidence-limit warning.
- [ ] **Given** the caller is a teacher, **then** groups contain only assigned students.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Groups are produced by the cron job, not recomputed on every page load.

### EDU-07 — Export an intervention summary

**As a** teacher, **I want** to export an intervention summary, **so that** I can prepare human-approved communication or notes.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P2 |
| Linked requirements | FR-12, PRD section 12.2 |
| Dependencies | Recommendation records, Vercel Blob when the file is stored |
| Out of scope | Sending anything to parents or students |
| Success metric | Not a launch gate |
| Non-functional | The file is not available at a guessable public URL. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-29 |

**Acceptance criteria**

- [ ] **Given** an export, **then** it is labelled as an AI draft that needs human review, and it includes evidence and limitations.
- [ ] **Given** an export, **then** an audit event records who exported it.
- [ ] **Given** an export, **then** no message is sent to a parent or student.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] The file is not available at a guessable public URL.

### EDU-08 — Student learning profile and misconception trends

**As a** teacher, **I want** a student's learning profile and the cohort's misconception trends, **so that** I can see mastery, hint use, and recurring gaps in one place.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1 |
| Linked requirements | FR-08, FR-12 |
| Dependencies | Learner model, `learner-rollup`, `insight-drafts` |
| Out of scope | Placement or grading claims |
| Success metric | At least 95% of profile claims link to source events |
| Non-functional | The profile loads in under 3 seconds for 150 synthetic students. Responsive layout. No placement, grading, or admissions sentence. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-31 |

**Acceptance criteria**

- [ ] **Given** I open an assigned student's profile, **then** I see skill mastery, hint dependency, transfer results, and recent sessions.
- [ ] **Given** I open cohort trends, **then** I see misconception counts with confidence, and an evidence limit when the sample is small.
- [ ] **Given** I am not assigned to the student, **when** I open the profile, **then** access is denied and logged.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] The profile loads in under 3 seconds for 150 synthetic students.
- [ ] No sentence on the profile is a placement, grading, or admissions decision.

---

## E3 — Review, replay, and human oversight

Teachers can see the session, and they accept, reject, or override a draft. The original evidence stays.

### EDU-03 — Replay a tutoring session

**As a** teacher, **I want** to replay a tutoring session, **so that** I can see how the student's reasoning developed without reading raw transcripts.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-13 |
| Dependencies | Persisted turns, Langfuse trace ids |
| Out of scope | Editing past turns |
| Success metric | 100% of tutor turns have a replay record. After purge, the record remains without the message body. |
| Non-functional | Trace links use the pseudonymous student id already stored on the turn. Responsive layout. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-20, TECH-49 |

**Acceptance criteria**

- [ ] **Tier 1c.** **Given** the Release 1.0 demo, **when** the assigned teacher opens the golden session, **then** a read-only replay shows each turn and one pending draft recommendation with its evidence. Accept, reject, override, comments, and the cohort view are Release 1.1.

- [ ] **Given** a replay of an assigned student, **then** each turn shows question version, diagram version, response, verifier result, hint level, tutor output, misconception label, and learner-model change.
- [ ] **Given** a replay turn, **then** it also shows model name, model version, prompt version, policy version, teacher comments, teacher overrides, and audit timestamps.
- [ ] **Given** a replay turn whose chat body has been purged, **then** the teacher still sees verifier status, hint level, versions, and timestamps, plus a notice that the message body was removed.
- [ ] **Given** a teacher who is not assigned, **when** they request the replay, **then** access is denied and the denial is logged.
- [ ] **Given** an administrator holding `trace_review`, **when** they open the replay, **then** each turn links to its Langfuse trace while that trace is inside the 90-day window. After purge, the link is a retention notice. An administrator without that grant is denied the replay. A teacher without the grant does not receive the trace link. A tutor does not receive the replay.
- [ ] **Given** a misconception on the replay, **when** the assigned teacher sets reviewer status to confirmed or rejected, **then** it is stored. It starts as unreviewed. The student does not see it.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] The trace link uses the pseudonymous student id already stored on the turn.

### EDU-04 — Accept, reject, or override a recommendation

**As a** teacher, **I want** to accept, reject, or override a recommendation, **so that** professional judgement remains the final decision and drafts stay pending until I review them.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-12, FR-15, PRD sections 12.2 and 13.2 |
| Dependencies | Recommendations, RBAC, audit log |
| Out of scope | Bulk overrides |
| Success metric | 100% of accepts, rejects, and overrides are audit-logged |
| Non-functional | Repeating the same decision request does not create a second decision. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-21 |

**Acceptance criteria**

- [ ] **Given** `insight-drafts` creates a recommendation, **then** its review status is pending and it stays pending until a teacher accepts, rejects, or overrides it.
- [ ] **Given** a pending recommendation, **when** the assigned teacher accepts or rejects it, **then** the status becomes accepted or rejected, an audit event records who, when, and the decision, and the original evidence is unchanged.
- [ ] **Given** an override, **when** it is saved, **then** a rationale is required.
- [ ] **Given** a recommendation is already accepted, rejected, or overridden, **when** a second decision arrives, **then** an identical retry returns the stored result and a different decision is denied, and the first decision remains.
- [ ] **Given** the override is saved, **then** the original recommendation and evidence remain unchanged, and the audit event records who, when, and why.
- [ ] **Given** a user without the teacher role for that student, **when** they accept, reject, or override, **then** the action is denied and the status stays pending.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Repeating the same override request does not create a second decision.

### EDU-06 — Review content quality

**As a** content reviewer, **I want** to approve or reject flagged questions, **so that** confusing or incorrect items are fixed before students see them.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-02, FR-14 |
| Dependencies | Item-quality scan, duplicate detection |
| Out of scope | Autonomous question generation for students. Teachers can see a flag. They cannot change publication status. |
| Success metric | Time from flag to a review decision |
| Non-functional | Only content reviewers and administrators can change publication status. Responsive review queue. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. Publication changes are this story. Reading a flag without changing it stays here as the teacher denial. The safety flags are EDU-12. |
| Tasks | TECH-23 |

**Acceptance criteria**

- [ ] **Given** a question or a diagram is flagged for an answer-key inconsistency, a verifier failure, ambiguous wording, an unclear diagram, excessive student confusion, unexpected difficulty, a non-functional distractor, a near-duplicate, a wrong curriculum mapping, inappropriate language, or a weak explanation, **when** a content reviewer opens the queue, **then** it shows that reason and the supporting evidence.
- [ ] **Given** a teacher opens the flag, **then** they can read it and cannot approve, reject, or deprecate the item.
- [ ] **Given** a content reviewer approves, rejects, or deprecates an item, **then** the decision and publication status are stored.
- [ ] **Given** an item is flagged, **then** students are not served that item.
- [ ] **Given** an item is edited, **then** it is not published again without a new approval.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Only content reviewers and administrators can change publication status.

---

## E4 — Governance, security, and platform operations

Access, audit, publishing, and traceability. The parent role exists and grants nothing in the MVP.

### ADM-01 — Manage roles

**As an** administrator, **I want** to manage roles and cohort assignments, **so that** people only see the data their role allows.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | FR-01 |
| Dependencies | Identity provider, RBAC. Tier 1 slice and `tests/authz`: PRD section 6.7.1 |
| Out of scope | Self-service role requests |
| Success metric | 100% of authorisation tests pass |
| Non-functional | Authorisation is enforced in the API and in the database layer. Hiding a control in the client is not the control. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-02, TECH-03, TECH-53 |

**Acceptance criteria**

- [ ] **Given** an administrator assigns a role, a cohort, or `trace_review`, **when** the next API call runs, **then** it reads that permission from Postgres. A Clerk JWT claim that still shows the old role does not grant it. Granting or revoking `trace_review` writes an audit event with who, when, and the change.
- [ ] **Given** an administrator assigns a support contact, **when** the cohort already has one, **then** the new user replaces them and both changes are audited. A cohort has at most one support contact.
- [ ] **Given** an administrator does not hold `trace_review`, **when** they request a replay, **then** access is denied and logged.
- [ ] **Given** a request outside the caller's scope, **then** it is denied and logged.
- [ ] **Given** the parent role, **then** it grants no route in the MVP.
- [ ] **Given** the Tier 1 slice, **when** `tests/authz` runs, **then** the 9 blocking cases in PRD section 14.5 pass.
- [ ] **Given** the role and action matrix below, **when** each allowed action is called inside scope, **then** it succeeds, and each denied action is rejected and logged.

| Role | Allowed in scope | Denied |
| --- | --- | --- |
| Student | Own questions, sessions, progress, and recommendations | Other students, teacher tools, publishing, audit |
| Parent | No product route | Every product route |
| Tutor | A note on an assigned student's session id | Replay, unassigned students, cohort summaries, publishing, role changes |
| Teacher | Assigned students and cohorts, replay bodies without a Langfuse link, recommendations, accept, reject, override, and EDU-12 flags | Unassigned students, publishing, role changes, `trace_review` |
| Academic coordinator | Cohort summaries, intervention insights, item-quality indicators, and `allow_level_5` for an assigned cohort | Student replay, student-level override, publishing, role changes, granting `trace_review`, unassigned cohorts |
| Support contact | Not a role. One user assigned on the cohort. Sees `safety_fallback` and `worrying_disclosure` when no teacher is assigned | Replay bodies, learning profiles, and traces |
| Content reviewer | Approve, reject, and deprecate questions and diagrams | Student records, role changes |
| Administrator | Users, roles, cohort membership ids for assignment, content policy, configuration, evaluations, audit logs, granting or revoking `trace_review`, and assigning the cohort support contact | Learning-profile pages, parent messaging, and autonomous grading. `trace_review` adds that session's replay, including responses, tutor output, and the learner-model change on the turn. It does not add the learning-profile page. |

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] Authorisation is enforced in the API and in the database layer (role and cohort scope). Hiding a control in the client is not the control.

### ADM-02 — Audit trail

**As an** administrator, **I want** an audit trail, **so that** access, model actions, and human decisions can be reviewed later.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | FR-15 |
| Dependencies | Append-only audit table. Tier 1 slice (table and writer): PRD section 6.7.1 |
| Out of scope | An external SIEM |
| Success metric | 100% of the defined event types are written |
| Non-functional | Feature code cannot turn audit writes off. Updates and deletes of audit rows are rejected by database permissions or triggers. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-02, TECH-25 |

**Acceptance criteria**

- [ ] **Given** an authentication event, record access, question selection, student attempt, verifier result, model call, tool call, generated prompt, hint decision, content flag, teacher review, override, export, error, safety incident, `allow_level_5` change, or `trace_review` grant or revocation, **then** an append-only audit row is created with ids, hashes, and structured fields. The row does not contain student free text, the full prompt, or the raw model output. A configuration change stores the previous value and the new value.
- [ ] **Given** an update or delete of an audit row, **when** it is attempted through the application or through the database role used by the app, **then** database permissions or triggers reject it.
- [ ] **Given** the audit viewer, **then** an administrator can filter by user, student, event type, and time.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Feature code cannot turn audit writes off.

### ADM-03 — Review AI quality issues

**As an** administrator, **I want** to review AI quality issues, **so that** tutoring failures can be found and fixed.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | PRD sections 11.2 and 14.4 |
| Dependencies | Langfuse scores, safety events, ADM-08 |
| Out of scope | The 150-case suite and the CI gates. Those are ADM-08. The 150-case line used to be written on this story. Automatic prompt rollback. |
| Success metric | Time to triage a flagged turn |
| Non-functional | Model-based scores may appear on the list. They do not block CI. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-26 |

**Acceptance criteria**

- [ ] **Given** a verifier mismatch, leakage event, schema failure, or safety incident, **then** it appears in the quality list with a trace link.
- [ ] **Given** an administrator marks an issue triaged, **then** the note and decision are stored.
- [ ] **Given** a caller who is not an administrator holding `trace_review`, **then** the list is denied.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Model-based scores may appear on the list. They do not block CI. The deterministic gates do.

### ADM-04 — Content publishing controls

**As an** administrator, **I want** only validated and approved questions to reach students, **so that** learners never see unreviewed content.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P1 |
| Linked requirements | FR-02, FR-14 |
| Dependencies | Question versions, review workflow. Tier 1 slice (import validation and the served-only-if-published filter): PRD section 6.7.1 |
| Out of scope | Bulk auto-publishing |
| Success metric | Zero unapproved questions delivered |
| Non-functional | Publication changes write an audit event. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-07 |

**Acceptance criteria**

- [ ] **Given** a question is draft, rejected, deprecated, flagged, or pending, **then** it is never served.
- [ ] **Given** a question is served, **when** its record is read, **then** validation is approved, publication is published, the curriculum scope is enabled, and the FR-02 fields are present: id, curriculum mapping, skill, difficulty, solution path, accepted answer, misconception tags, Socratic prompt metadata, diagram flag, validation status, and version.
- [ ] **Given** a diagram is not approved, **when** a student requests the question, **then** the diagram is not served. A content reviewer approves or rejects the diagram.
- [ ] **Given** vector search or the practice planner returns rows, **then** unapproved items are excluded.
- [ ] **Given** a question is imported, **when** the offline validation pipeline has not passed, **then** a content reviewer cannot mark it approved.
- [ ] **Given** the bank is ready to demonstrate, **when** content validation runs, **then** at least 10 approved ratio and proportion questions (Release 1.0) or 40 (Release 1.1) are available, and an approved item with no legal transfer partner is rejected. A legal partner shares the learning objective, has a different accepted value, and uses only skills in the cohort starting set. Per-student legality is checked again at practice time.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Publication changes write an audit event.

### ADM-05 — Model and prompt traceability

**As an** administrator, **I want** every AI-generated tutor turn to record its model, prompt, and policy versions, **so that** I can explain and reproduce any tutoring decision.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P0 |
| Linked requirements | PRD sections 9.6 and 15.5 |
| Dependencies | Provider adapter, Langfuse, CI eval gate |
| Out of scope | Automated A/B routing |
| Success metric | 100% of tutor turns store complete trace metadata |
| Non-functional | Traces use pseudonymous student ids. The MCP span and the A2A span are separate. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-04, TECH-09, TECH-10, TECH-43, TECH-50 |

**Acceptance criteria**

- [ ] **Given** a call to the MCP server or the A2A Safety Guard without a valid signed service token (missing, expired, wrong audience, or signed with another service's secret), **then** it returns 401, an audit event is written, and no question or answer data is returned. This test blocks CI.

- [ ] **Given** a tutor turn is generated, **then** it stores model name and version, provider, sampling parameters (including temperature), prompt template version, hint-policy version, tool results, the Langfuse trace id, `trace_status`, and `fallback_reason` when the turn was a fallback.
- [ ] **Given** an administrator holding `trace_review` opens the turn, **then** they can navigate from the stored record to its trace. A teacher without that grant cannot.
- [ ] **Given** a prompt or model changes, **then** the evaluation suite runs before that change is deployed to production.
- [ ] **Given** the same schemas, **when** a turn runs on Gemini (Release 1.0) or on one alternate provider (Release 1.1), **then** the turn records `LLM_PROVIDER`, the model name, and the model version.
- [ ] **Given** a student name, email, or phone number in free text, **when** a trace is exported or an external model prompt is built, **then** that raw value is absent from both.
- [ ] **Given** a tutor turn is stored, **then** its Langfuse trace has a separate MCP span and a separate A2A span.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] Traces contain no student name or email. The MCP span and the A2A span are separate.

### ADM-06 — Sign in

**As a** user, **I want** to sign in before I see student data, **so that** unauthenticated people cannot open sessions or profiles.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P0 |
| Linked requirements | FR-01 |
| Dependencies | Identity provider is Clerk (PRD section 22.1), ADM-01 (Tier 1 slice, PRD section 6.7.1) |
| Out of scope | Self-service registration and parent features |
| Success metric | 100% of authorisation tests pass |
| Non-functional | Authentication events are audited. The parent role is stored and grants nothing. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-03, TECH-53 |

**Acceptance criteria**

- [ ] **Given** I have no valid session, **when** I request student data, **then** I am required to sign in and the data is not returned.
- [ ] **Given** I sign in with a valid token, **when** the next request runs, **then** my role and cohort scope are read from Postgres. A role claim left in the Clerk JWT after an administrator changes the role does not apply.
- [ ] **Given** the parent role, **then** sign-in can succeed and still grants no product route in the MVP.
- [ ] **Given** a sign-in or a failed sign-in, **then** an authentication audit event is written.
- [ ] **Given** the Clerk JWKS endpoint is unreachable, **then** cached keys up to 1 hour old are used, and with no cache the request returns 503 `service_unavailable`. Authentication never fails open.
- [ ] **Given** a valid token whose `sub` is not in `app_user`, **then** the request returns 403 `forbidden`, the audit event `auth_unknown_subject` is written, and no row is created. There is no auto-provisioning on first sign-in.
- [ ] **Given** `scripts/seed_synthetic.py` runs with `content/seed/users.json` and `BOOTSTRAP_ADMIN_CLERK_ID`, **then** it creates the listed `app_user` rows, inserts the bootstrap administrator only if none exists, stores no name or email, and creates no duplicate when run a second time.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] The parent role remains reserved: it is stored, and it grants nothing.

### ADM-07 — Scheduled jobs

**As an** administrator, **I want** scheduled jobs to be authenticated, repeatable, and visible when they fail, **so that** rollups and purges finish without silent data loss.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P1 |
| Linked requirements | FR-16, PRD section 11.1 |
| Dependencies | Audit log, learner events |
| Out of scope | A replacement queue product |
| Success metric | Cron jobs run on schedule, are idempotent, and report status |
| Non-functional | A failed job is visible to an administrator without reading the database by hand. Retention uses `RETENTION_POLICY_VERSION`. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-24, TECH-46 |

**Acceptance criteria**

- [ ] **Given** a cron call without `CRON_SECRET`, **when** it hits a job route, **then** it is rejected and logged.
- [ ] **Given** a job runs twice on the same pending work, **then** it is idempotent, writes `job_run` with start, end, status, and counts, and processes a bounded batch that can resume next time.
- [ ] **Given** a job fails, **then** an administrator can see the failure as a Langfuse score or a log alert.
- [ ] **Given** an approved published question or exemplar changes, **when** `embedding-sync` runs, **then** its embedding is updated and unapproved items are not embedded for student retrieval.
- [ ] **Given** the job catalogue, **then** `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync`, and `retention-purge` each have a protected route. Purge behaviour is ADM-09. `eval-nightly` stays optional.

**Definition of Done**

- [ ] Shared story DoD above (PRD section 6.3).
- [ ] A failed job is visible to an administrator without reading the database by hand.

### STU-10 — Safe handling of unsafe input

**As a** student, **I want** unsafe messages to be handled calmly, **so that** I am not shamed and a person can see when something is worrying.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | PRD sections 12.1 and 12.3 |
| Dependencies | Input Screen (PRD section 8.3.1) |
| Out of scope | Mental-health diagnosis, parent messages, and safeguarding decisions |
| Success metric | Every fixture in this story gets the specified response and an audit event |
| Non-functional | The student never sees the model's unreviewed draft. Language stays plain. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-42 |

**Acceptance criteria**

- [ ] **Given** abusive language in the note box or in a field that fails to parse, **when** the Input Screen matches it, **then** the student sees the authored `abuse` reply, which does not mirror it and asks to return to the maths. A safety event is logged, no model or verifier runs, and no counter or hint level changes.
- [ ] **Given** a request for help on an active high-stakes assessment, **when** the Input Screen matches it, **then** the authored `assessment_help` reply refuses and tells the student to speak to their teacher, and a safety event is logged.
- [ ] **Given** a request to impersonate the student in work they will submit, **when** the Input Screen matches it, **then** the authored `impersonation` reply refuses and a safety event is logged.
- [ ] **Given** a message that discloses something worrying, **when** the Input Screen matches it, **then** the authored `worrying_disclosure` reply tells the student to tell a trusted adult now and gives no medical, legal, or mental-health advice. A safety event is logged and `worrying_disclosure` is recorded. EDU-12 shows that flag. The system does not make a safeguarding decision.
- [ ] **Given** an answer request typed in the note box, **when** the Input Screen matches it, **then** the authored `answer_request` reply points at the "Show me the solution" control, the typed text does not count as that request, and the hint level is unchanged.
- [ ] **Given** an injection phrase in the note box or a field, **when** the turn runs, **then** the authored `injection_phrase` reply is shown, no counter or level changes, and a prompt-capture test shows the text is absent from every model prompt and Langfuse span.
- [ ] **Given** the note box is shown, **then** a static line reads "If something is worrying you, tell a trusted adult", and every stored note is visible to the assigned teacher.
- [ ] **Given** the 12 synthetic unsafe-input fixtures, **when** the lexicon runs, **then** its recall is reported, with a target of at least 0.90 (a report, not a safeguarding claim).

**Definition of Done**

- [ ] Shared story DoD above.

### STU-11 — Check ratio work deterministically

**As a** student, **I want** equivalent ratio work to be recognised, **so that** a different written form is not marked wrong.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-04 |
| Dependencies | STU-03 |
| Out of scope | Question types the MVP does not enable |
| Success metric | At least 99% agreement between tutor feedback and the verifier on supported types |
| Non-functional | Supported formats, and the 99% denominator, are integer, decimal, fraction, percentage, ratio, unit quantity, arithmetic expression (judged by form) and multiple choice. Algebraic expressions with a variable are not enabled in Release 1.0. Free text is excluded. Verifier p95 under 400 ms. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-05, TECH-10, TECH-51 |

**Acceptance criteria**

- [ ] **Given** an equivalent answer in another format (for example 3/4 and 0.75), **then** the verifier returns `correct`.
- [ ] **Given** a ratio that simplifies to the accepted ratio (for example 6:4 and 3:2), **then** the verifier returns `correct`.
- [ ] **Given** a proportional scaling item, **then** the scaled value is `correct` and an additive change of the same numbers is `incorrect`.
- [ ] **Given** a supported unit conversion, **then** a correct conversion is `correct` and a wrong unit is `incorrect` with `error_category` `unit_error`.
- [ ] **Given** a tolerance rule, **then** a value inside it is `correct` and a value outside it is `incorrect`.
- [ ] **Given** a structured step expression on a supported item, **then** the status is `partially_correct` and `accepted_answer` is false. Free text does not enter this check.
- [ ] **Given** the question data, answer key, and solution plan disagree, **when** the verifier runs, **then** it does not return `correct` and the item is flagged for answer-key inconsistency.
- [ ] **Given** the tutor's last turn used a `scaffold_probes` entry (for example "how far is 2 cm?"), **when** the student submits the probe's expected value (8 km), **then** the verifier returns `partially_correct` for the probe's `counts_as_step_id`, the policy treats it as `progress=advancing`, and the hint level does not rise. A wrong probe answer is `incorrect`, not `cannot_verify`.
- [ ] **Given** a probe answer, **when** the pure verifier result comes from the cache, **then** the response-target overlay is applied after the cache and is never cached. The same value sent with no active probe is judged without the overlay.
- [ ] **Given** a value in the answer field (`response_target=final`) equals an intermediate step value, **then** the status is `incorrect` with `error_category=incomplete`. A value is `partially_correct` only from a step field or a probe answer.
- [ ] **Given** the expression `7.5 × 4` in the answer field or the probe field, **when** the verifier runs, **then** it is `partially_correct` for the step whose `target_expression` it matches, `accepted_answer` is false, and it is never `correct`. `4 × 7.5` gives the same result and `7.5 ÷ 4` does not.
- [ ] **Given** an expression that matches no step, **when** it arrives in the answer field, **then** the status is `cannot_verify`, its evaluated value and `error_category` are present for classification, and the tutor asks for "the number your calculation gives". **When** it arrives in a probe field, **then** the overlay makes it `incorrect` for the probe.
- [ ] **Given** a `kind: setup` probe, **when** the student enters an expression matching `counts_as_step_id`, **then** it is `partially_correct` for that step and the hint level does not rise. A different parsed expression is `incorrect` for the probe.
- [ ] **Given** a value that equals an intermediate step's `target_value` but not the accepted answer, **when** the pure verifier runs, **then** `status` is `incorrect`, `matched_step_ids` lists that step, and `matched_solution_step` is `null`. A ratio equal to the accepted ratio is `correct`, and its swapped form is `incorrect` with `reversed_ratio_match` and the `swapped_ratio` tag.
- [ ] **Given** an unparseable input, **then** the result is `cannot_verify` with `canonical_value=null` and `error_category=incomplete`. **Given** a tool timeout or MCP error, **then** it is `cannot_verify` with `state=tool_failure` and every other field `null`.
- [ ] **Given** a `/` between two numbers, **when** it is in the answer field, **then** it is a fraction value (`3/4` equals `0.75`). **When** it is in a step or probe field, **then** it is read as `÷`, so `450/5` matches a step whose `target_expression` is `450 / 5`. `÷` and `×` are always operators, and `x` between two numerals is `×`.
- [ ] **Given** any verifier call, **then** the result validates against the pure result schema (`input_kind`, `canonical_value`, `canonical_expression`, `matched_step_ids`, `relation_tags`, plus the FR-04 fields), `relation_tags` is derived from `error_category` as FR-04 defines, and the cached value is that same object with no session field.
- [ ] **Given** a probe's expected value does not evaluate from its expression or (for a `kind: value` probe) equals the item's final answer, **when** content validation runs, **then** the item fails import.
- [ ] **Given** two accepted methods, **when** the student submits either, **then** both return `correct`.
- [ ] **Given** a rounding rule, **when** the value is inside it, **then** the status is `correct`. A value outside it is `incorrect`.
- [ ] **Given** a required unit is missing, **when** the verifier runs, **then** the status is `incorrect` and `error_category` is `missing_unit`.

**Definition of Done**

- [ ] Shared story DoD above.

### STU-12 — Leave and resume a session

**As a** student, **I want** to leave and come back, **so that** a timeout does not wipe my attempt or count it twice.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-05, PRD section 11.3 |
| Dependencies | Session state |
| Out of scope | The session summary and `stuck_after_transfer` (STU-18). A second device editing the same turn at once. |
| Success metric | A resumed session shows the same question, hint level, and attempt count |
| Non-functional | Session state is in Postgres before the response returns. Writes use a client idempotency key. Read-only retry in an older reading of section 11.3 does not cover this. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-08, TECH-11, TECH-52, TECH-56 |

**Acceptance criteria**

- [ ] **Given** the student leaves a session, **when** they return, **then** the same question, attempts, and hint level are restored.
- [ ] **Given** the client sends an idempotency key, **when** the same key is retried, **then** the server returns the stored result and does not create a second attempt.
- [ ] **Given** the attempt row is persisted and the tutor turn is not, **when** the same idempotency key is retried, **then** the server completes or returns that attempt and does not increment the attempt count.
- [ ] **Given** the function times out after the turn is persisted, **when** the student retries, **then** they see that persisted turn and not a second tutor question. The session summary and the stuck flag are STU-18.
- [ ] **Given** the client sends an event the state machine does not allow (for example "Show me the solution" in `awaiting_first_attempt`, `reflection` or `transfer_active`), **when** the server handles it, **then** it returns 409 `transition_not_allowed` in the error payload of PRD section 15.9, changes nothing, and writes an audit event. The client does not show that control in those states.
- [ ] **Given** the same `Idempotency-Key` with a different request body, or on a different session, **then** the server returns 409 `idempotency_conflict`. While the first request is still running, the same key returns 409 `request_in_progress` with `retry_after_s`.
- [ ] **Given** any non-2xx response, **then** it uses the single error payload of PRD section 15.9, and the contract tests (TECH-56) fail if the OpenAPI document and the web types drift from the Pydantic models.
- [ ] **Given** `POST /api/sessions` or `GET /api/sessions/{id}`, **then** the `SessionView` holds the `SessionState`, a `QuestionView` with exactly `question_id`, `version`, `stem`, `answer_type`, `unit`, `answer_requires_unit`, `reasoning_options` (id and label) and `has_diagram`, and the current `TutorTurn`. It never holds the accepted-answer spec, solution steps, probe expected values, predictions, leak patterns, reflection `sound` flags or the isomorphic example.
- [ ] **Given** the item has a diagram and the current level allows one, **when** the student calls `GET /api/sessions/{id}/diagram`, **then** it returns the SVG validated for that level with `Content-Security-Policy: default-src 'none'`. **Given** the item has no diagram, the level allows none, or the session is another student's, **then** it returns 404 `not_found`.
- [ ] **Given** a note arrives in any state, including a terminal one, **then** it is Input-Screened, stored in `student_note` with `state_at_save`, answered with the canned `note_ack` (or the Input Screen reply), and is not a pipeline turn.
- [ ] **Given** the controls-by-state table in PRD section 8.5.1, **then** the client shows exactly the listed controls for each state, and `tutor.controls` in the response is the source.

**Definition of Done**

- [ ] Shared story DoD above.

### EDU-09 — Add a tutor note

**As a** tutor, **I want** to add a note on an assigned student's session, **so that** the teacher can see my observation next to the evidence.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-01, FR-13 |
| Dependencies | ADM-01, EDU-03 |
| Out of scope | Replay, accepting recommendations, changing publication status, and Langfuse traces. FR-13 replay stays with the assigned teacher and with an administrator who holds `trace_review`. |
| Success metric | 100% of tutor notes are stored on the session and visible in replay |
| Non-functional | A tutor sees only assigned students. Notes are kept 365 days (PRD section 22.1). |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-32 |

**Acceptance criteria**

- [ ] **Given** a tutor is assigned to the student, **when** they open their list, **then** they see session ids, question titles, and times, and not the student's responses or the tutor output.
- [ ] **Given** a tutor is assigned to the student, **when** they save a note on a listed session id, **then** the note is stored and the assigned teacher sees it on the replay.
- [ ] **Given** a tutor, **when** they request the replay payload, **then** it is denied.
- [ ] **Given** a tutor is not assigned, **when** they save a note, **then** the action is denied and logged.
- [ ] **Given** a tutor, **then** they cannot accept, reject, or override a recommendation, and they cannot change publication status.

**Definition of Done**

- [ ] Shared story DoD above.

### EDU-10 — See a cohort summary

**As an** academic coordinator, **I want** cohort summaries, the cohort support setting, and item-quality indicators, **so that** I can see intervention themes and control whether level 5 is allowed.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P1 |
| Linked requirements | FR-01, FR-12 |
| Dependencies | ADM-01, learner rollup |
| Out of scope | Per-student overrides, publishing, and the `trace_review` grant |
| Success metric | A coordinator can open an assigned cohort summary |
| Non-functional | The summary loads in under 3 seconds for 150 synthetic students. The coordinator owns `allow_level_5` for the cohort. |
| Readiness | Specified. Sprint entry follows PRD section 6.3. |
| Tasks | TECH-33 |

**Acceptance criteria**

- [ ] **Given** a coordinator opens an assigned cohort, **when** the summary loads, **then** they see cohort mastery, misconception trends, intervention insights, and item-quality indicators.
- [ ] **Given** a recommendation was accepted, **when** a later transfer result exists for that skill, **then** the summary shows that outcome. If none exists yet, it says there is not enough later evidence.
- [ ] **Given** a new cohort, **when** it is created, **then** `allow_level_5` is false by default until an assigned coordinator enables it.
- [ ] **Given** a coordinator requests a student replay, **when** the request is authorised, **then** it is denied.
- [ ] **Given** a coordinator changes `allow_level_5` for an assigned cohort, **when** the change is saved, **then** the value is stored, later level 5 decisions use it, and an audit event records who, when, the previous value, and the new value. A coordinator outside the cohort is denied.
- [ ] **Given** a coordinator tries to override a student recommendation, publish a question, grant `trace_review`, or open a Langfuse trace, **when** the request is authorised, **then** it is denied.

**Definition of Done**

- [ ] Shared story DoD above.

### EDU-11 — Comment on a session

**As a** teacher, **I want** to comment on a replay, **so that** my comment stays with the session.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-13 |
| Dependencies | EDU-03 |
| Out of scope | Editing the student's past turns |
| Success metric | 100% of saved comments appear on the replay |
| Non-functional | Comments are free text. They stay for 365 days (PRD section 22.1 #20). A purged chat body does not delete the comment before that window. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-34 |

**Acceptance criteria**

- [ ] **Given** an assigned teacher saves a comment, **when** it is stored, **then** the replay shows that comment and an audit event records who and when.
- [ ] **Given** a teacher who is not assigned, **when** they save a comment, **then** the action is denied.
- [ ] **Given** the chat body is purged, **when** the teacher opens the replay, **then** the comment remains until its own 365-day window ends.

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-08 — Platform launch controls

**As an** administrator, **I want** the CI gates to block a bad merge, **so that** lint, tests, evals, and the deploy gate run before code is merged.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | PRD sections 14.5, 17, and 21 |
| Dependencies | CI workflow (TECH-01). It runs the ADM-10 suite. Tier 1 slice: PRD section 6.7.1 |
| Out of scope | The 150-case suite (ADM-10), the handover documents (ADM-11), and the teacher-facing quality list (ADM-03) |
| Success metric | A failing section 14.5 gate blocks the merge |
| Non-functional | Model-based scores are reported and do not block CI. Section 14.5 thresholds do block. |
| Readiness | Specified. Not Ready: no test-data list is attached. |
| Tasks | TECH-01, TECH-04, TECH-40, TECH-41 |

**Acceptance criteria**

- [ ] **Given** a pull request, **when** GitHub Actions runs, **then** lint, tests, every blocking row in section 14.5 (including `single_prompt`, unauthorised access, unapproved content, an invalid diagram, an unaudited override, a misconception prompt type that does not match the confidence, bundle size, and cold start), and the deploy gate must pass before merge. The 99% availability figure is reported for the demo and does not block the merge. The case count itself is ADM-10.
- [ ] **Given** a secret the API needs, **when** the repository and the client bundle are searched, **then** it is only a Vercel environment variable.
- [ ] **Given** a public or preview environment, **when** it is opened, **then** the students, names, and attempts are synthetic.
- [ ] **Given** a pull request, **when** `ci.yml` runs, **then** `pip-audit`, `npm audit`, `gitleaks`, `axe` on the practice screen, `tests/contract` (OpenAPI and web-type drift) and `scripts/sync_stories.py --check` also run. A high-severity finding, a detected secret, or a story difference fails the build.
- [ ] **Given** a running deployment, **when** monitoring is read, **then** latency, errors, and tool failures are visible in Langfuse or Vercel.

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-09 — Retain metadata after purge

**As an** administrator, **I want** old message bodies removed while replay metadata stays, **so that** retention does not break the audit or the teacher view.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | FR-15, FR-16, PRD sections 11.1 and 22.1 (#20) |
| Dependencies | ADM-02, ADM-07 |
| Out of scope | Deleting audit rows. A consent flow and a personal-data deletion request are not MVP behaviour, because the public capstone uses synthetic students (PRD section 11.1). A live school needs that story before real student data is stored. |
| Success metric | A purged turn still opens in replay with a retention notice |
| Non-functional | Purge uses `RETENTION_POLICY_VERSION`. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-28, TECH-20 |

**Acceptance criteria**

- [ ] **Given** a chat log, attempt, model trace, student-specific diagram blob, tutor note, student note, or teacher comment is older than its window, **when** `retention-purge` runs, **then** that body is deleted. For an attempt, the body is `response_value`, `step_expressions`, and `free_text`. Status, hint level, skill id, and timestamps remain, so EDU-01 and EDU-02 links still open. Notes and comments use 365 days.
- [ ] **Given** a record is still inside its window, **when** `retention-purge` runs, **then** it is kept.
- [ ] **Given** an audit row or an approved question diagram, **when** `retention-purge` runs, **then** it is kept.
- [ ] **Given** a purged turn, **when** a teacher opens the replay, **then** they see the metadata and a notice that the message body was removed.
- [ ] **Given** the Langfuse trace has been purged, **when** a `trace_review` administrator opens the replay, **then** the link is replaced with a notice that the trace expired.

**Definition of Done**

- [ ] Shared story DoD above.

---

### STU-13 — Keep an unapproved turn off the screen

**As a** student, **I want** to see only a turn the safety check has allowed, **so that** a rejected or unreachable draft never appears as the tutor.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | PRD sections 11.2, 11.3, 12.1 |
| Dependencies | STU-02 |
| Out of scope | The leakage override, which stays on STU-05 |
| Success metric | A rejected candidate is absent from the student-visible payload |
| Non-functional | One "no tokens" rule lives here. STU-02 and STU-05 do not repeat it. |
| Readiness | Specified. Not Ready: no test-data list is attached. |
| Tasks | TECH-14, TECH-54, TECH-56 |

**Acceptance criteria**

- [ ] **Given** a candidate is rejected and an iteration remains, **when** the loop continues, **then** the dialogue agent revises it. The student sees no tokens from the rejected text.
- [ ] **Given** the loop has used both iterations without an allow, or the Safety Guard cannot be reached, **when** a turn is due, **then** the student receives the deterministic fallback and the session records `safety_fallback`.
- [ ] **Given** the Classifier or Dialogue agent times out, the provider is unreachable, or its output fails `schema_valid`, **when** the turn is due, **then** the student receives the same fallback and is not told they are wrong.
- [ ] **Given** a candidate asks for personal information, promises exam success, makes a selective-entry or placement claim, or infers a sensitive attribute, **when** the deterministic phrase check runs (in the same cheap step as the leakage check, before the guard), **then** a hit blocks the candidate before the guard is called and triggers the revision or the fallback.
- [ ] **Given** the student text contains an email address or a phone number, **when** the tutor reply and the trace are built, **then** that pattern is removed. The Input PII Scrubber also replaces names it recognises with `[STUDENT_NAME]`, which is best effort, so a name it misses is still treated as untrusted text. The tutor does not ask the student to identify themselves.
- [ ] **Given** Postgres is unreachable before the attempt is stored, **when** the student submits, **then** the server returns 503 `service_unavailable` (retryable), no pipeline runs, no counter changes, and the answer field keeps its text.
- [ ] **Given** Langfuse is unavailable or its flush fails, **when** a turn runs, **then** the turn is still delivered, the flush waits at most 300 ms, and the turn stores `trace_status=missing`.
- [ ] **Given** the provider times out, returns `429` or 5xx, or its output is invalid after one repair, or the turn passes the 7.5 s hard stop, **when** a turn is due, **then** the student receives the deterministic fallback with `fallback_reason` of `provider_error`, `schema_invalid` or `budget`, and no session flag is set. `safety_fallback` is set only for `loop_exhausted` and `guard_unreachable`.
- [ ] **Given** MCP returns an HTTP error, **then** the result is `cannot_verify` with `state=tool_failure` and a fixed message, and no counter changes. A timeout or connect failure uses the single in-process retry instead.
- [ ] **Given** the Blob read fails or the SVG is missing, **then** the diagram is rendered from the validated spec in process, and if that fails the probe text is shown without a diagram and `diagram_unavailable` is stored. An unvalidated image is never served.
- [ ] **Given** a student free-text value is found in a model prompt, **when** the prompt-capture guard runs, **then** the turn fails before the model call with the fixed fallback and a `prompt_capture_violation` audit event.

**Definition of Done**

- [ ] Shared story DoD above.
- [ ] A test shows a rejected candidate and an unreachable-guard case, and the student-visible payload contains none of the rejected text.

### STU-14 — Show a wait while the turn is checked

**As a** student, **I want** a clear wait while my answer is checked, **so that** a silent screen does not look frozen.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | PRD section 11.3 |
| Dependencies | STU-13 |
| Out of scope | Streaming an unreviewed draft |
| Success metric | Tutor-turn p95 under 8 seconds, with a visible wait |
| Non-functional | The 5-second figure is a target. The CI gate is 8 seconds, including one safety retry. The student sees a loading state for that whole wait. |
| Readiness | Specified. Not Ready: no UX reference is attached. The loading state needs one before sprint entry. |
| Tasks | TECH-45, TECH-54, TECH-56 |

**Acceptance criteria**

- [ ] **Given** a turn is not yet allowed, leak-checked, and persisted, **when** the student is waiting, **then** they see a loading state and no tutor tokens.
- [ ] **Given** the pipeline uses the 8-second budget, including one safety retry, **when** the wait exceeds a moment, **then** the loading state stays visible until the allowed turn or the fallback arrives.
- [ ] **Given** the student submits an answer, **when** the request is sent, **then** their own answer appears in the conversation immediately (before any server response), and the input is disabled to prevent a double submit.
- [ ] **Given** the loading state has been visible for more than 1 second, **when** the wait continues, **then** it shows a friendly, child-appropriate message (for example "Thinking about your answer…"). After 4 seconds it adds a reassurance line (for example "Still working, nearly there"). Neither message contains model-generated or tutor text.
- [ ] **Given** the verifier result is back before the turn is approved, **when** the loading state is visible, **then** the UI may show only a fixed, non-solution status such as "Checking your answer…", sent as a separate server event that carries no verdict, value, or model text.
- [ ] **Given** the loading state is visible, **then** it is announced to screen readers (`aria-live="polite"`) and does not rely on colour or animation alone.
- [ ] **Given** 8 seconds pass with no persisted turn, **when** the client retries once with the same idempotency key and still receives nothing, **then** the student sees the deterministic fallback and the loading state ends.
- [ ] **Given** the optional progress stream is open, **then** it carries only the stage names `checking`, `preparing` and `done`, never a verdict, a value or model text. **Given** it is unavailable, **then** the timed wait messages still show.

**Definition of Done**

- [ ] Shared story DoD above.

### STU-15 — Retrieve exemplars only when the verifier can use them

**As a** student, **I want** exemplar lookup to run only when my answer was actually checked, **so that** a correct answer or a failed check does not invent a misconception.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | PRD sections 9.8, 10.5, 11.3, and 21 |
| Dependencies | STU-03, STU-04 |
| Out of scope | Naming the misconception to the student (STU-04) |
| Success metric | A correct attempt and a `tool_failure` both record `retrieval: skipped` |
| Non-functional | Exact-key cache only. A nearest expression is not a hit. |
| Readiness | Specified. Not Ready: no test-data list is attached. |
| Tasks | TECH-12 |

**Acceptance criteria**

- [ ] **Given** `status` is `correct` or `partially_correct` (advancing or stalled), or `state` is `tool_failure`, **when** the turn is assembled, **then** retrieval and the classifier do not run, and the turn stores `retrieval: skipped` and `misconception: none`. `tool_failure` is a state, and the status on that row is `cannot_verify`.
- [ ] **Given** the post-overlay status is `incorrect`, or `cannot_verify` with `state=ok`, **when** the gate opens, **then** MCP `search_exemplars` runs on approved published exemplars only.
- [ ] **Given** `cannot_verify` with `state=ok` and no matched step, **when** the classifier returns, **then** the label is `insufficient_evidence`.
- [ ] **Given** retrieval ran and returned no exemplars, **when** the classifier finishes, **then** it records that it used none and the turn still completes.
- [ ] **Given** `search_exemplars` runs, **then** its query contains only `skill_id`, `error_category`, the canonical numeric student value and relation tags, and a prompt-capture test shows no free text in it.
- [ ] **Given** the same normalised expression is checked again on the same question version and tolerance rule, **when** the cache is read, **then** the result is an exact-key hit and the trace says so.
- [ ] **Given** the taxonomy used for launch, **when** it is loaded, **then** it includes `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, and `answer_guessing`, plus `insufficient_evidence`.

**Definition of Done**

- [ ] Shared story DoD above.

### EDU-12 — See safety and stuck-session flags

**As a** teacher, **I want** to see when a session fell back to the safe prompt, disclosed something worrying, or stayed stuck after transfer, **so that** a person sees the notice without the system making a safeguarding decision.

| Field | Value |
| --- | --- |
| Epic | E3 |
| Priority | P1 |
| Linked requirements | FR-01, PRD sections 12.2 and 12.3 |
| Dependencies | STU-10, STU-12, STU-13, ADM-01 |
| Out of scope | Safeguarding decisions, parent messages, and the EDU-01 review rules |
| Success metric | Each of the six flags is visible to the assigned teacher: `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, and `turn_cap_reached` |
| Non-functional | The support contact is a cohort assignment, not a role. See the ADM-01 matrix. |
| Readiness | Specified. Not Ready: no UX reference is attached. |
| Tasks | TECH-37 |

**Acceptance criteria**

- [ ] **Given** an assigned student's session has `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, or `turn_cap_reached`, **when** the teacher opens the review list or the replay, **then** the flag and its time are shown. It is a notice.
- [ ] **Given** no teacher is assigned, **when** the flag is `safety_fallback` or `worrying_disclosure`, **then** the cohort support contact sees the flag and the session id. Row-level security allows that user to read `session_flag` for their cohort and nothing else.
- [ ] **Given** the cohort has no teacher and no support contact, **when** the flag is stored, **then** a `trace_review` administrator sees it on the safety list.
- [ ] **Given** another user requests the flag, **when** authorisation runs, **then** it is denied and logged.

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-10 — Labelled evaluation suite

**As an** administrator, **I want** the 150-case launch suite in the repository, **so that** every section 14.1 category is represented before a demo ships.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P0 for the 42 critical cases (Tier 1), P1 for the full 150 (Tier 2) |
| Linked requirements | PRD sections 14.1 and 21 |
| Dependencies | ADM-08 (the CI workflow that runs this suite) |
| Out of scope | The CI workflow (ADM-08) and the handover documents (ADM-11). ADM-08 runs this suite. |
| Success metric | The 150-case count is a CI input |
| Non-functional | One primary category per case. The full-suite targets sum to 296. |
| Readiness | Specified. Not Ready: the case list is not attached. |
| Tasks | TECH-27 |

**Acceptance criteria**

- [ ] **Given** the launch suite, **when** it is counted, **then** it has at least 150 unique labelled cases, one primary category each, at least one case in every PRD section 14.1 category, and the full critical-category targets: 15 direct-answer, 15 prompt-injection, and 12 unsafe-input cases.

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-11 — Handover documents

**As an** administrator, **I want** the architecture note, threat model, evaluation report, runbook, and customer brief in the repository, **so that** a demo can be handed over.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P2 |
| Linked requirements | PRD sections 15.8 and 21 |
| Dependencies | ADM-08 |
| Out of scope | The CI gates |
| Success metric | Section 21 names each document and the file exists |
| Non-functional | Synthetic data only in any example those documents contain. |
| Readiness | Specified. Not Ready until the five documents are named as the test data. |
| Tasks | TECH-30, TECH-55 |

**Acceptance criteria**

- [ ] **Given** handover, **when** the repository is checked, **then** the architecture note, threat model, evaluation report, runbook, and customer brief are present, and the runbook includes the incident-response procedure.

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-12 — Seed the approved bank

**As a** content reviewer, **I want** the launch bank loaded through the import pipeline, **so that** students practise approved ratio items with exemplars, diagrams, and legal transfer partners.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P0 |
| Linked requirements | FR-02, FR-07, FR-09, FR-10, PRD section 21 |
| Dependencies | TECH-07 |
| Out of scope | The import software itself, which is TECH-07 |
| Success metric | 10 approved questions at Release 1.0 and 40 at Release 1.1, the listed taxonomy, exemplars, diagram specs, and skill-graph edges are in the repository |
| Non-functional | Synthetic content only. No student data. |
| Readiness | Specified. Not Ready: the seed files are not attached. |
| Tasks | TECH-47 |

**Acceptance criteria**

- [ ] **Given** the content directory, **when** import validation passes, **then** it contains at least 10 approved ratio questions for Release 1.0 and at least 40 for Release 1.1, the STU-15 taxonomy, an exemplar for each label, a diagram spec for every diagram item, and a skill-graph edge that gives each item a legal transfer partner inside the starting set. Every item passes content validation V1–V9, and `content/safety/canned_responses.json` has all 28 keys and passes C1–C3 with `draft` or `reviewed` entries. At the Gate B tag every key is `reviewed` (C4) (PRD sections 8.3.2 and 10.3.1).

**Definition of Done**

- [ ] Shared story DoD above.

### ADM-13 — Create a cohort and assign people

**As an** administrator, **I want** to create a cohort, enrol students, and assign a teacher, tutor, and coordinator, **so that** practice, replay, and summaries have a scope.

| Field | Value |
| --- | --- |
| Epic | E4 |
| Priority | P0 |
| Linked requirements | FR-01, FR-02 |
| Dependencies | ADM-01 (Tier 1 slice, PRD section 6.7.1) |
| Out of scope | Self-service enrolment |
| Success metric | A synthetic cohort can be practised by its students and reviewed by its teacher |
| Non-functional | The starting set and the enabled curriculum scope are stored on the cohort. |
| Readiness | Specified. Not Ready: no UX reference is attached. |
| Tasks | TECH-48 |

**Acceptance criteria**

- [ ] **Given** an administrator creates a cohort, **when** they save it, **then** it has an enabled curriculum scope, an enabled starting set, `allow_level_5` false (default, opt-in), and at most one support contact.
- [ ] **Given** the administrator enrols a student and assigns a teacher, tutor, and coordinator, **when** those people sign in, **then** each sees only that cohort's allowed surface.

**Definition of Done**

- [ ] Shared story DoD above.

### STU-16 — Update the learner model on the turn

**As a** student, **I want** my mastery to update when the turn is saved, **so that** the next question can use this attempt and not wait for the hourly rollup.

| Field | Value |
| --- | --- |
| Epic | E2 |
| Priority | P0 |
| Linked requirements | FR-08, PRD section 22.1 (#21) |
| Dependencies | Verifier |
| Out of scope | The student dashboard (STU-07) |
| Success metric | The next request after a persisted turn sees the new mastery |
| Non-functional | Deltas are written before the response returns. The hourly rollup updates cohort aggregates only. |
| Readiness | Specified. Not Ready: no UX reference or test-data list is attached. |
| Tasks | TECH-16 |

**Acceptance criteria**

- [ ] **Given** a counted success at hint level 0, **when** the turn is persisted, **then** mastery increases by `0.15` and does not exceed `1.0`.
- [ ] **Given** a counted success only after hint level 1, 2, or 3, **when** the turn is persisted, **then** mastery increases by `0.05`.
- [ ] **Given** completion only at hint level 4 or 5, **when** the turn is persisted, **then** mastery does not increase.
- [ ] **Given** a successful transfer, **when** the turn is persisted, **then** confidence increases by `0.20` and does not exceed `1.0`. Without one, confidence is not increased.
- [ ] **Given** the last 3 counted attempts on the skill conflict, **when** the turn is persisted, **then** confidence decreases by `0.10` and does not fall below `0`.
- [ ] **Given** the turn is persisted, **when** the next practice item is chosen, **then** it uses this write. Cohort aggregates may stay up to one hour old.

**Definition of Done**

- [ ] Shared story DoD above.

### STU-18 — Close a session with a summary and a stuck flag

**As a** student, **I want** a finished session to keep a summary, **so that** being stuck after transfer is recorded without another worked solution.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | FR-05, FR-10 |
| Dependencies | STU-12, STU-06 |
| Out of scope | Showing the flag (EDU-12) |
| Success metric | A stuck transfer records the flag and no second solution |
| Non-functional | `cannot_verify` and `state=tool_failure` do not trigger the flag. |
| Readiness | Specified. Not Ready: no test-data list is attached. |
| Tasks | TECH-44, TECH-52 |

**Acceptance criteria**

- [ ] **Given** the transfer item is at hint level 4, has at least 3 counted attempts, and the latest status is `incorrect` or `partially_correct`, **when** the session is saved, **then** it records `stuck_after_transfer`, the student is told their teacher will look at it, and the tutor does not open a worked solution.
- [ ] **Given** the transfer result is recorded, the transfer is declined, or 30 minutes pass with no request, **when** that happens, **then** the session ends as `completed`, `declined`, or `abandoned`. Resume after `abandoned` starts a new session.
- [ ] **Given** a session ends, **when** it is saved, **then** a summary stores the verifier outcomes, hint levels, and transfer result.
- [ ] **Given** the 12th pipeline turn on an item passes without a `correct`, **when** the turn is saved, **then** the session is `stuck`, records `turn_cap_reached`, and shows a fixed kind message. The question is saved for the teacher, another approved item is offered, and no worked solution is given. Canned Input Screen replies and a first rephrase request do not count toward the 12.
- [ ] **Given** the session state machine (PRD section 8.5.1), **when** an event arrives that the transition table does not list for the current state, **then** it is rejected and audited. The table-driven tests cover every row.

**Definition of Done**

- [ ] Shared story DoD above.

### STU-19 — Estimate understanding from this turn

**As a** student, **I want** the tutor's next prompt to use an estimate of my understanding, **so that** the question matches this attempt rather than a general lecture.

| Field | Value |
| --- | --- |
| Epic | E1 |
| Priority | P0 |
| Linked requirements | PRD section 9 |
| Dependencies | STU-03 |
| Out of scope | The mastery numbers (STU-16) |
| Success metric | Every tutoring turn stores a schema-valid student-state record |
| Non-functional | Deterministic. It reads the session's prior verifier results and hint levels only. No model, no tools, no accepted answer, no free text. |
| Readiness | Specified. Not Ready: no test-data list is attached. |
| Tasks | TECH-38 |

**Acceptance criteria**

- [ ] **Given** a turn reaches the student-state step, **when** the `StudentStateEstimator` runs, **then** it returns schema-valid features (`repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress`) computed from this session's prior persisted results, and the turn stores them.
- [ ] **Given** the estimator, **when** it runs, **then** it makes no model call and reads no free text and no accepted answer. The hint policy turns its features into `tone` in `hint_decision`, which the Dialogue Agent may read.

**Definition of Done**

- [ ] Shared story DoD above.

## Tier 1 slices of later-tier stories (PRD section 6.7.1)

A P0 story depends only on P0 work. These four later-tier stories have a part that Tier 1 builds under the same id.

| Story | Tier 1 slice | Stays in its own tier |
| --- | --- | --- |
| ADM-01 | Roles table, Postgres role and cohort read on every request, server-side checks for student, teacher, administrator and the inert parent role, `tests/authz` | Full role matrix tests, coordinator and content-reviewer surfaces, RLS (Tier 3) |
| ADM-02 | Append-only `audit_event` table and the writer feature code cannot skip | Audit viewer and filters (Tier 3) |
| ADM-04 | Import validation V1–V9, the served-only-if-approved-and-published filter, the ten-item bank | Content-reviewer queue and publication workflow (Tier 2) |
| ADM-08 | `ci.yml` with every Tier 1 gate row, story sync, dependency and secret scans | Deploy gates and monitoring dashboards (Tier 3) |

## Release map (PRD section 6.7)

| ID | Title | Epic | Priority | Linked requirements |
| --- | --- | --- | --- | --- |
| STU-01 | Attempt before guidance | E1 | P0 | FR-03, FR-05, FR-06 |
| STU-02 | One focused hint at a time | E1 | P0 | FR-05, FR-06 |
| STU-03 | Submit working, not only a final answer | E1 | P0 | FR-03, FR-04 |
| STU-04 | Feedback on why my answer is incorrect | E1 | P0 | FR-04, FR-07 |
| STU-05 | Full solution only after meaningful effort | E1 | P0 | FR-05, FR-06 |
| STU-06 | Test understanding with a similar question | E1 | P0 | FR-10 |
| STU-07 | See my progress | E2 | P1, launch-required | FR-08, FR-11 |
| STU-08 | Diagrams that help | E1 | P0 (ratio table) / P1 (bar model and wider set), launch-required | FR-09 |
| STU-09 | Select or receive a recommended question | E1 | P0 | FR-02, FR-08 |
| EDU-01 | See students needing review | E2 | P1 | FR-12 |
| EDU-02 | Understand why a student was flagged | E2 | P1 | FR-12, FR-15 |
| EDU-03 | Replay a tutoring session | E3 | P1 | FR-13 |
| EDU-04 | Accept, reject, or override a recommendation | E3 | P1 | FR-12, FR-15, Section 13.2 |
| EDU-05 | Group students with similar needs | E2 | P1 | FR-12 |
| EDU-06 | Review content quality | E3 | P1 | FR-02, FR-14 |
| EDU-07 | Export an intervention summary | E2 | P2 | FR-12 |
| EDU-08 | Student learning profile and misconception trends | E2 | P1 | FR-08, FR-12 |
| EDU-09 | Add a tutor note | E3 | P1 | FR-01, FR-13 |
| EDU-10 | See a cohort summary | E2 | P1 | FR-01, FR-12 |
| EDU-11 | Comment on a session | E3 | P1 | FR-13 |
| ADM-01 | Manage roles | E4 | P2 | FR-01 |
| ADM-02 | Audit trail | E4 | P2 | FR-15 |
| ADM-03 | Review AI quality issues | E4 | P2 | Sections 11.2, 14.4 |
| ADM-04 | Content publishing controls | E4 | P1 | FR-02, FR-14 |
| ADM-05 | Model and prompt traceability | E4 | P0 | Sections 9.6, 15.5 |
| ADM-06 | Sign in | E4 | P0 | FR-01 |
| ADM-07 | Scheduled jobs | E4 | P1 | FR-16, Section 11.1 |
| STU-10 | Safe handling of unsafe input | E1 | P0 | Sections 12.1, 12.3 |
| STU-11 | Check ratio work deterministically | E1 | P0 | FR-04 |
| STU-12 | Leave and resume a session | E1 | P0 | FR-05 |
| ADM-08 | Platform launch controls | E4 | P2 | Sections 14.5, 17, 21 |
| ADM-09 | Retain metadata after purge | E4 | P2 | FR-15, FR-16, Section 11.1 |
| STU-13 | Keep an unapproved turn off the screen | E1 | P0 | Sections 11.2, 11.3 |
| STU-14 | Show a wait while the turn is checked | E1 | P0 | Section 11.3 |
| STU-15 | Retrieve exemplars only when the verifier can use them | E1 | P0 | Sections 9.8, 10.5 |
| EDU-12 | See safety and stuck-session flags | E3 | P1 | FR-01, Sections 12.2, 12.3 |
| ADM-10 | Labelled evaluation suite | E4 | P0 (42 critical) / P1 (150 full) | Sections 14.1, 21 |
| ADM-11 | Handover documents | E4 | P2 | Sections 15.8, 21 |
| STU-16 | Update the learner model on the turn | E2 | P0 | FR-08, Section 22.1 (#21) |
| STU-18 | Close a session with a summary and a stuck flag | E1 | P0 | FR-05, FR-10 |
| STU-19 | Estimate understanding from this turn | E1 | P0 | Section 9 |
| ADM-12 | Seed the approved bank | E4 | P0 | FR-02, FR-07, Section 21 |
| ADM-13 | Create a cohort and assign people | E4 | P0 | FR-01, FR-02 |

## Launch criteria traceability (PRD section 21)

| Launch check | Story | Task |
| --- | --- | --- |
| At least 10 (Release 1.0) or 40 (Release 1.1) approved ratio questions | ADM-04, ADM-12 | TECH-07, TECH-47 |
| At least 10 misconception labels | STU-15 | TECH-12 |
| Verifier supports MVP formats | STU-03, STU-11 | TECH-05 |
| Hint policy levels 0–5 | STU-02, STU-05 | TECH-06 |
| Answer-leakage suite passes | STU-05, ADM-08, ADM-10 | TECH-14, TECH-40, TECH-27 |
| Student session data persists | STU-01, STU-12 | TECH-08 |
| Transfer workflow works | STU-06 | TECH-13 |
| Student dashboard works. P1, and still required for launch | STU-07 | TECH-18 |
| Teacher evidence and session replay | EDU-08, EDU-03, EDU-11 | TECH-31, TECH-20, TECH-34 |
| Teacher accept, reject, and override are audited | EDU-04 | TECH-21 |
| Role-based access tests pass | ADM-01, ADM-06, EDU-09, EDU-10 | TECH-03, TECH-32, TECH-33 |
| Synthetic data on public environments | ADM-08 | TECH-41 |
| At least 150 unique labelled eval cases, one primary category each, every category present. Full-suite targets sum to 296 | ADM-10 | TECH-27 |
| Critical maths and safety regressions pass | STU-05, ADM-08 | TECH-40 |
| Monitoring of latency, errors, and tool failures | ADM-08 | TECH-04, TECH-41 |
| Every tutor turn links to a Langfuse trace from replay | EDU-03, ADM-05 | TECH-20, TECH-10 |
| Cron jobs run, are idempotent, and report status | ADM-07 | TECH-24 |
| Secrets only in Vercel environment variables | ADM-08 | TECH-01 |
| GitHub Actions enforces lint, tests, evals, and deploy gates | ADM-08 | TECH-01, TECH-40 |
| Every P0 story meets the section 6.3 definition of done (a process rule, not a section 21 gate) | All P0 rows in the release map | Each linked task |
| Architecture, threat model, eval report, runbook, customer brief | ADM-11 | TECH-30 |
| Correct attempts skip retrieval; incorrect attempts cite exemplars | STU-15 | TECH-12 |
| Repeated expression is a cache hit on the trace | STU-15 | TECH-12 |
| Trace has a separate MCP span and a separate A2A span | ADM-05 | TECH-10, TECH-43 |
| Provider and model stored on every turn (Gemini at Release 1.0, plus one alternate at Release 1.1) | ADM-05 | TECH-09 |
| Next practice and transfer use the skill graph | STU-06, STU-09 | TECH-13, TECH-36 |
| Learner-model deltas apply when the turn is persisted | STU-16 | TECH-16 |
| Diagrams are served with a hash, and an invalid diagram is not published | STU-08 | TECH-17 |
| Section 14.5 thresholds gate CI; model-based scores do not block | ADM-08 | TECH-40 |
| Retention leaves replay metadata | ADM-09 | TECH-28 |
| Input Screen answers every unsafe-input fixture with a canned reply, event and flag | STU-10 | TECH-42 |
| Session state machine covered by table-driven tests | STU-12, STU-18 | TECH-52 |
| Tier 1 authorisation tests pass | ADM-01, ADM-06 | TECH-53 |
| Turn cap and Postgres rate limiter | STU-13, STU-18 | TECH-54 |
| Threat model v0 exists before Tier 1b | ADM-11 | TECH-55 |
| Content validation V1–V9 passes for all ten items | ADM-04, ADM-12 | TECH-07, TECH-47 |
| Story acceptance criteria match between this file and the PRD | ADM-08 | TECH-01 |
