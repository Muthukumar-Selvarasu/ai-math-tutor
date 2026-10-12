# SolvePath — Agent Orchestration Architecture (AGENTS.md)

Sources: `PRD.md` §9, §11.6; `SPEC.md` §2.4, §3.6–3.9, §4 (WF-03 to WF-10, WF-18), §5; `DESIGN.md` §1–4; `TECHNICAL.md` §3, §5.

Conventions: **Stated** values are fixed by a source. **Open** means the sources defer the value, and it is not decided here. Prompt text is not stored in this file. Runtime prompts live in Langfuse under the pinned label `LANGFUSE_PROMPT_LABEL` and are cached as `prompt_template` (Tier 1b onward, `PROMPT_SOURCE=langfuse`). At Tier 1a (`PROMPT_SOURCE=repo`) they are versioned repo files identified by file version id and hash. This file fixes the constraints those prompts must satisfy. Any change to a prompt, the hint policy or the model configuration runs the evaluation suite before merge (TECHNICAL §5.2 #33).

---

## 1. Agent Topology & System Overview

### 1.1 Orchestration model

SolvePath is a **deterministic hub-and-spoke workflow harness with bounded LLM stages**, not an agent mesh (DESIGN §1.1, PRD §9.1).

| Property | Specification |
| --- | --- |
| Hub | The Tutor Orchestrator (`run_turn`). It is the only component that talks to the browser, MCP, A2A, the LLM provider, Blob and Postgres on a student's behalf (SPEC §1.3) |
| Pipeline | One ADK `SequentialAgent` in a fixed order per request. No agent chooses its successor |
| Loop | One ADK `LoopAgent`, at most 2 iterations (1 initial, 1 revision): Dialogue Agent, deterministic check, Safety Guard |
| Spokes | MCP server (`solvepath-mcp`), A2A Safety Guard (`solvepath-safety`), provider adapter, Postgres. Reached only by the orchestrator or its deterministic steps |
| Parallelism | None. `ParallelAgent` is not used in Release 1.0 (PRD §9.2) |
| Peer messaging | None. Agents hand structured results to the next step only through ADK state keys (§4.2) |
| Authority | No model chooses a tool, route, verdict, hint level, state transition or retry. No open ReAct loop |
| Statelessness | ADK state is built from Postgres rows for one request and discarded (DESIGN DD-04) |

```text
                           Tutor Orchestrator (hub, deterministic)
   TX-A ──► ADK Runner ─► SequentialAgent ─────────────────────────────────────────────► TX-B
            1 ProblemContextAgent ──► 2 MathVerifierAgent ──► 3 DeterministicMisconceptionMatcher
            ──► 4 RetrievalGate ──► 5 StudentStateEstimator ──► MisconceptionClassifierAgent (conditional)
            ──► 6 HintPolicyEngine ──► 7 LoopAgent[ SocraticDialogueAgent ► DeterministicLeakCheck ► SafetyGuard ]
            ──► 8 fallback_l{level} (authored)
   spokes:  MCP (verify_expression, search_exemplars, get_question) · A2A (SafetyGuard) · LLM adapter · Postgres
   off-path: TeacherInsightAgent (cron / on demand) · ProblemParser (offline import)
```

### 1.2 Agent inventory

Every row has one responsibility. "LLM" means a schema-bound model call. "BaseAgent" means deterministic Python wrapped as an ADK step.

| ID | Agent / service | Type and runtime | Single responsibility | Source |
| --- | --- | --- | --- | --- |
| AG-00 | `TutorOrchestrator` | Deterministic Python. Per request | Own the turn: transitions, leases, the ADK run, persistence, response | PRD §9.4, SPEC §3.9 |
| AG-01 | `ProblemContextAgent` | BaseAgent. Per turn, step 1 | Load the pinned question, scrub and normalise input, run the Input Screen | PRD §9.3 |
| AG-02 | `MathVerifierAgent` | BaseAgent. Per turn, step 2 | Obtain the pure verifier result (cache, then MCP, then the single per-turn fallback) and apply the uncached overlay | PRD §9.3, SPEC WF-06 |
| AG-03 | `DeterministicMisconceptionMatcher` | BaseAgent. Per turn, step 3 | Match a numeric wrong answer against authored predictions | PRD §9.3, SPEC WF-07 |
| AG-04 | `RetrievalGate` | BaseAgent. Per turn, step 4 | Decide whether exemplar retrieval and the classifier run, and fetch exemplars when they do | PRD §9.3, SPEC WF-07 |
| AG-05 | `StudentStateEstimator` | BaseAgent. Per turn, step 5 | Compute attempt-history features from prior persisted results | PRD §9.4 |
| AG-06 | `MisconceptionClassifierAgent` | LLM. Per turn, conditional | Label an unmatched error from the closed taxonomy, citing exemplars | PRD §9.4, SPEC §2.4 |
| AG-07 | `HintPolicyEngine` | BaseAgent. Per turn, step 6 | Decide level, probe, content, prompt type and tone | PRD §9.4, SPEC WF-08 |
| AG-08 | `SocraticDialogueAgent` | LLM. Per turn, loop | Phrase one bounded prompt for what the policy already selected | PRD §9.4, SPEC WF-09 |
| AG-09 | `DeterministicLeakCheck` | Deterministic rule step (`check_candidate`). Per turn, loop | Block value leakage, method leakage, forbidden phrases, jargon and multi-prompt candidates | PRD §9.3 step 7b |
| AG-10 | `SafetyGuard` | A2A service, `MODEL_SAFETY`. Per turn, loop | Return `allow`, `block`, `revise` or `escalate` for a candidate | PRD §9.4, SPEC §3.7 |
| AG-11 | `TeacherInsightAgent` | LLM. Cron (`insight-drafts`) and on demand (OP-11) | Draft an evidence-linked recommendation for teacher review | PRD §9.4, SPEC WF-18 |
| SV-01 | `DiagramService` | Deterministic SVG renderer. Import time and on demand | Render and validate diagrams from structured specifications | PRD §9.4 |
| SV-02 | `PracticePlanner` | Deterministic engine (`recommend_next`). Post-question transition | Choose the next approved item along `remediates` and `prerequisite` edges | PRD §9.4, SPEC WF-02 |
| SV-03 | `ProblemParser` | Offline import step. Not on the student path. Its LLM or deterministic mode is **open** (PRD §9.4 says "Deterministic / LLM") | Convert an authored question into the structured representation | PRD §9.4 |

Orchestrator-invoked deterministic engines that are not agents (no ADK step of their own): `transitions.apply`, `select_transfer`, `render_solution_turn`, `render_example_turn`, `update_learner_model`, the canned-text registry, the cache store, the rate-counter store.

LLM agents are exactly three at runtime in the opt-in `llm` mode: AG-06, AG-08 and AG-11 (AG-11 is off the student path). The shipped `DIALOGUE_MODE=template` default (SPEC D-37) runs no LLM agent on the student path. There is no LLM student-state agent in Release 1.0 (Decision #32).

### 1.3 Tier 1a baseline reductions and cut (PRD §18.2, ADR-015; BUILD_LOG)

Cuts 1a-2 and 1a-3 are taken at baseline and are no longer contingency cuts. Only Cut 1a-1 remains (engineering hours, per PRD v1.3.28):

- **Cut 1a-1** (about 8-12 h; hour-70 trigger: P1-01a and P2-06 not both Done): defer STU-03 reasoning options and `step_expressions`.
- **Cut 1a-2, taken at baseline** (about 8-10 h): the advisory Classifier (AG-06, P2-10) is deferred to the opt-in `llm` stretch. No misconception claim, `diagnostic_probe`.
- **Cut 1a-3, taken at baseline** (about 15-20 h): `DIALOGUE_MODE=template` is the shipped default. Turns are `kind=probe_template`: the Classifier, Dialogue Agent and Safety Guard are skipped and no model is called. `llm` is an opt-in stretch and becomes the default only by a PRD change after the educator check and a Gate B live calibration run (n ≥ 100).

Hour-100 trigger: if P2-08 and P1-17 are not both Done, apply Cut 1a-1 if not already taken and start no task outside the Gate A dependency set. Gate A passes by engineering hour 138. Tier 1b cuts (T1b-1, T1b-2, T1b-4) apply only during Tier 1b.

### 2.1 Rules common to every agent

1. A step may read and write only its allow-listed ADK state keys (§4.2).
2. No LLM agent receives student free text, a name, a transcript, the accepted answer (AG-06, AG-08), a repository, an MCP client or a vendor SDK. The `before_model` prompt-capture guard fails the turn before the model call if student free text is in any prompt. **One constrained exception:** the Safety Guard (AG-10) receives `forbidden_strings[]` (the accepted answer, solution-step values and not-yet-produced probe values, including the selected probe's expected value; values already produced this session are not sent) strictly so it can recognise leakage in the candidate. They contain no student text, are replaced by a count and a hash in every span and audit row, and are never returned (SPEC §3.7, DESIGN DD-08). AG-06 and AG-08 never receive them.
3. Every LLM output is a versioned Pydantic schema (`schema_version`). Output outside the closed enums or the schema is rejected after one adapter repair, never "fixed" by guessing.
4. No agent states a verdict, a misconception code, a `sound` flag or a solution value to the student below Level 5.
5. Student-facing language is respectful and non-shaming. No comparison with other students. No claim about intelligence, future success or placement suitability. No request for personal information (SPEC §5.7).
6. No agent publishes content, changes a learner record, changes a role or setting, or contacts a parent or student.
7. Each agent records `prompt_version`, `policy_version` and model metadata through the provider adapter and the turn record. Audit rows hold hashes, never bodies.

### 2.2 AG-00 `TutorOrchestrator`

| Item | Specification |
| --- | --- |
| Objective | Execute exactly one turn per request, with the attempt stored before the pipeline and the turn stored before the response |
| Persona | None. Not an LLM. No tutor text of its own |
| Instruction baseline | Follow WF-03 and DESIGN §3.3. Run `transitions.apply` phase 1 (legality, in TX-A) first and phase 2 (outcome resolution, in TX-B) when persisting. No state is written between the two phases. Pass `TurnDeadline` to every stage. Choose the turn kind from `HintDecision.turn_kind` and never from model output |
| Boundaries | May not override the verifier or bypass the hint policy. May not send an unguarded candidate. May not hold a database connection across MCP, A2A or LLM calls. May not retry a model call free-form. May not change state outside `transitions.apply` |
| Limits | 7.5 s hard stop. 200 ms persistence reserve. At most one fallback per turn (verifier: repeat MCP call, or in-process on a container topology; guard: in-process). One in-flight event per session (lease, 12 s). Langfuse flush asynchronously in the background after the response, otherwise inline with the turn deadline and revision gate at 7.2 s |

### 2.3 AG-01 `ProblemContextAgent`

| Item | Specification |
| --- | --- |
| Objective | Produce `problem_context`: the pinned question version, scrubbed and normalised input, `input_kind` and `parse_issue` |
| Persona | None. Deterministic |
| Instruction baseline | Load the question through the repository (DD-05). Run `scrub_pii`, then `normalise` with `field_kind` `answer` or `step`. For unparsed answer or step text run `input_screen`. A hit short-circuits the turn to a canned reply (no `tutor_turn` row, audit safety event) |
| Boundaries | Does not call a model or MCP. Does not change the question. Does not count an attempt on an Input Screen hit |
| Limits | `scrub_pii` < 5 ms. `input_screen` < 10 ms. Session and question load inside the 150 ms ingress budget |

### 2.4 AG-02 `MathVerifierAgent`

| Item | Specification |
| --- | --- |
| Objective | Produce `verifier_result` (pure) and `verifier_outcome` (post-overlay) |
| Persona | None. No pedagogical advice |
| Instruction baseline | Cache lookup by exact key (Tier 1b onward: there is no cache at Tier 1a), else MCP `verify_expression`, else the single per-turn fallback (from Phase B; in Phase A, Slice 0 and Tier 1a, the verifier module is called in process and there is no MCP call): a repeat MCP call on the Vercel topology (from Phase B the API bundle holds no SymPy), or the in-process module on a container topology that packages SymPy with the API. Store the pure result. Apply `apply_overlay` afterwards. Never cache or send session context to MCP |
| Boundaries | An expression is never evaluated into a final answer. A model never calls the verifier and never issues a verdict. `tool_failure` is a `state`, not a `status` |
| Limits | MCP 400 ms. Cache lookup target < 20 ms. Verifier p95 < 400 ms (CI gate: `not-run` at Tier 1a, where the verifier is in process, and applies at Gate B on MCP) |

### 2.5 AG-03 `DeterministicMisconceptionMatcher`

| Item | Specification |
| --- | --- |
| Objective | Set a taxonomy code from `misconception_predictions` without a model |
| Instruction baseline | Run only when the post-overlay status is `incorrect` and `input_kind` is `value` or `ratio`. A match sets `confidence=0.90`, `source=deterministic_match`, `prompt_type=diagnostic_probe`, and skips retrieval and the classifier |
| Boundaries | A match is a hypothesis from one numeric answer. It is never stated to the student and never alters correctness |
| Limits | < 10 ms |

### 2.6 AG-04 `RetrievalGate`

| Item | Specification |
| --- | --- |
| Objective | Decide retrieval and classifier eligibility and write `retrieval` and `exemplars` |
| Instruction baseline | Open only for `incorrect` without a match, or `cannot_verify` with `state=ok`. Closed for `correct`, `partially_correct`, `tool_failure` and a deterministic match (store `retrieval: skipped`, `misconception: none`). Build the query from numbers only |
| Boundaries | Never sends free text. Never consults vectors to choose the next skill. Empty or failed retrieval is a valid empty result and never fails the turn |
| Limits | MCP `search_exemplars` 250 ms (Phase B / Tier 1b). Tier 1a: the gate runs and the exemplar source is an empty stub (empty retrieval recorded); MCP `search_exemplars` with the exact SQL filter arrives in Tier 1b. Top-k is a policy-configuration value (open) |

### 2.7 AG-05 `StudentStateEstimator`

| Item | Specification |
| --- | --- |
| Objective | Produce `student_state`: `repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress` |
| Instruction baseline | Read only this session's prior persisted verifier results and hint levels. Runs on every tutoring turn |
| Boundaries | No model, no free text, no accepted answer, no other student's data. Decides no educational outcome |

### 2.8 AG-06 `MisconceptionClassifierAgent` (LLM)

| Item | Specification |
| --- | --- |
| Identifier | `MisconceptionClassifierAgent`. Model from `MODEL_CLASSIFIER`. Schema `MisconceptionClassifierOutput` |
| Objective | Label an unmatched numeric error and recommend a prompt type, citing retrieved exemplar ids or stating that it used none |
| Persona | A careful diagnostic analyst for teachers. It speaks to no student and produces no tutor text |
| Prompt baseline | Input is verifier status, `error_category`, the canonical numeric value of the student's answer, `relation_tags`, the candidate taxonomy code from the `error_category` mapping (a hypothesis only) and the retrieved exemplars. Choose one value of the closed 13-value taxonomy. Set `exemplars_used` to `some` or `none` and cite only ids it was given. Prefer `insufficient_evidence` when the numbers do not support a code. Return the schema only |
| Reads | `verifier_outcome`, `retrieval`, `exemplars` |
| Writes | `classification` |
| Must not read | The accepted answer value, the tutor draft, free text, session history beyond the keys above |
| Boundaries | Invents no label. Holds no tool. For `cannot_verify` with `state=ok` the orchestrator forces the stored label to `insufficient_evidence`. Its code never reaches the student and never changes correctness. `targeted_scaffold` applies only when confidence ≥ 0.80 (threshold stored with `POLICY_CONFIG_VERSION`) and the code is not `insufficient_evidence` |
| Limits | Runs only in the opt-in `DIALOGUE_MODE=llm`. It is skipped in the shipped `DIALOGUE_MODE=template` default and under Cut 1a-2 (advisory Classifier deferred, taken at baseline; see §1.3). Runs at most once per turn. 1,000 ms. One schema repair. **Advisory:** a timeout, provider error or invalid output yields no misconception claim (`classification` null, `misconception: none`, an audit event naming the cause) and the turn continues with `prompt_type=diagnostic_probe`. It never triggers `fallback_l{level}` and is not counted in `fallback_rate` |

### 2.9 AG-07 `HintPolicyEngine`

| Item | Specification |
| --- | --- |
| Objective | Produce `hint_decision` (`HintDecision`) and the counters the persistence step writes |
| Instruction baseline | Apply WF-06 level effects (raise exactly +1, cap 4). Select the first unasked probe with `min_level` ≤ level for Levels 1–3, `permitted_scaffold_step` for Level 4. Evaluate the four Level 5 conditions only for `show_solution` on the original item. Derive `tone` from `student_state`. Set `prompt_type`: `targeted_scaffold` only for a classifier code at confidence ≥ 0.80 that is not `insufficient_evidence`, otherwise `diagnostic_probe`. A null `classification` (classifier timeout, error or not run) therefore gives `diagnostic_probe` and never blocks the turn. Set `turn_kind` |
| Boundaries | Never generates text and never calls a model. Only these inputs raise or lower runtime escalation: attempt outcome, counted attempts, the explicit solution request and the cohort's `allow_level_5`. Pleading, repeated requests and typed answer requests never raise the level. Level 5 is reachable only through all four conditions |
| Limits | < 40 ms. `allow_level_5` is read from Postgres each turn |

### 2.10 AG-08 `SocraticDialogueAgent` (LLM)

| Item | Specification |
| --- | --- |
| Identifier | `SocraticDialogueAgent`. Model from `MODEL_TUTOR`. Schema `SocraticDialogueOutput` |
| Objective | Phrase the one prompt the policy selected, at the policy's level |
| Persona | A patient, warm Socratic maths tutor for a primary or lower-secondary student (Year 6 foundation, Year 7 ratio items). Plain words. Never shames. Asks, does not tell |
| Prompt baseline | Input is the `HintDecision` subset (level, prompt type, `tone`, `permitted_scaffold_step` at Level 4 only), the selected probe template, the misconception code, and one question stem. Output one question or one imperative whose first word is `try`, `look`, `find`, `compare`, `write` or `check`. Under 100 tokens. No sentence over 25 words. No taxonomy code, glossary phrase or unexplained jargon. `hint_level` equals `HintDecision.level`. On a revision request it receives only the word "revise" and the same inputs |
| Reads | `hint_decision` (allow-listed subset), the misconception code (`classification` or `misconception_match`, as hypothesis context only, never shown in student text), `problem_context.question` (the question stem), the selected probe template (carried in `hint_decision`) |
| Writes | `candidate` |
| Must not read | The retrieval corpus, `exemplars`, the accepted answer, any guard verdict beyond "revise", student free text, chat history |
| Boundaries | Names no operation below Level 4. States no intermediate or final value below the level that permits it. Asks one question only. Never claims the student is right or wrong. Below Level 4 digits and word numerals are strictly forbidden unless they match (a) a value quoted verbatim from the question stem, (b) a value quoted verbatim from the selected authored probe template, or (c) the student's own value that the verifier marked correct this attempt. Exemption (c) is applied inside `check_candidate` (AG-09) only, from the current attempt's `verifier_outcome`: the Dialogue Agent never receives the student's value, so it can quote only (a) and (b). It introduces no new computed value (the digit rule of SPEC WF-09). Invoked only in the opt-in `DIALOGUE_MODE=llm`. Not invoked when `DIALOGUE_MODE=template` (the shipped default, Cut 1a-3 taken at baseline, and the emergency kill-switch), or when `turn_kind` is `solution`, `authored`, `canned`, `probe_template` or `fallback`. The early educator check reviews and tunes the `llm` prompts before Gate B, the model-level ratchets are reported until the first live calibration run (n ≥ 100), and `llm` becomes the default only by a PRD change after both |
| Limits | 1,400 ms including one schema repair. At most 2 iterations. Provider timeout, 429 or 5xx gives `provider_error`. Invalid after repair gives `schema_invalid` |

### 2.11 AG-09 `DeterministicLeakCheck`

| Item | Specification |
| --- | --- |
| Objective | Block an unsafe candidate cheaply before the model guard, and re-check after it |
| Instruction baseline | Value leakage, method leakage (below Level 4), phrase check, `age_appropriate`, `single_prompt`, schema consistency (SPEC WF-09 step 2). Exempt (the check receives this exemption set): digits and values stated verbatim in the question stem, values stated verbatim in the selected authored probe template, and the student's own value that the verifier already marked correct this attempt. `check_candidate` reads the current attempt's `verifier_outcome` from ADK state to apply this last exemption (it is applied nowhere else). Probe values already produced (answered) this session are exempt from the value-leakage check only, not from the digit rule. Not-yet-produced probe values, including the selected probe's own expected value, are not exempt: they stay forbidden and are sent to the guard in `forbidden_strings[]`, so the deterministic check and the guard agree. No new computed value is exempt. Run again as the final override before storing |
| Boundaries | A deterministic hit overrides a guard `allow`. Runs on a model candidate only. Authored text is validated offline instead (V2, V9, C2, C3) |

### 2.12 AG-10 `SafetyGuard` (A2A service; Tier 1b onward; Tier 1a: in-process module, `guard_unreachable` cannot arise from transport)

| Item | Specification |
| --- | --- |
| Identifier | `solvepath-safety`, entrypoint `a2a_safety.py`. Model from `MODEL_SAFETY` (small, capped output tokens) |
| Objective | Return a verdict for one candidate |
| Persona | A strict reviewer of tutor text for a young student. Not a tutor |
| Prompt baseline | Input is `candidate_text`, `hint_level`, `prompt_type`, `forbidden_strings[]`, `iteration` and `request_id`. Output only `SafetyVerdict`: `allow`, `block`, `revise` or `escalate`, with an optional `reason_code`. Use `escalate` for content that is unsafe rather than merely too revealing |
| Boundaries | Verdict-only. Writes no tutor text. Modifies no learner record. Has no read access to domain data. Receives `forbidden_strings[]` as a constrained exception to the no-answer-to-LLM rule (§2.1 #2), for leakage detection only. Holds only its own service-token secret and an audit-insert-only database role. The orchestrator may not skip it |
| Limits | 1,200 ms (1.3 s cap). Accepts only a valid audience-scoped bearer of ≤ 60 s lifetime |

### 2.13 AG-11 `TeacherInsightAgent` (LLM)

| Item | Specification |
| --- | --- |
| Identifier | `TeacherInsightAgent`. Schema `TeacherInsightDraft`. Model variable is not named in the sources for this agent (**open**) |
| Objective | Summarise aggregated evidence for educator review as one draft per recommendation |
| Persona | A cautious educational data analyst writing for a teacher. Hedged, evidence-first |
| Prompt baseline | Input is aggregated events of the cohort being drafted. Output the seven-part template: recommendation, reason, evidence (source event ids), confidence, limitations, suggested action. Label low confidence as such and never state it as fact |
| Reads | Aggregated events of the cohort being drafted |
| Must not read | Live state of an in-progress turn, student notes or any free text (SPEC §1.4 item 6), other cohorts |
| Boundaries | No placement, grading, admissions, exclusion or remedial-classification wording. No diagnosis of learning difficulty. No message to a parent or student. A draft failing the deterministic wording check is stored `rejected` and never shown. An accepted draft is stored `pending` and changes nothing until an assigned teacher decides |
| Limits | Bounded batch inside the cron function duration. Not on the student path and not under the 7.5 s turn budget. Per-call timeout is **open** (`LLM_TIMEOUT_SECONDS` is the stated upper bound) |

### 2.14 Non-agent services

| Service | Role | Boundaries |
| --- | --- | --- |
| `DiagramService` (SV-01) | `render_diagram` and `validate_diagram` over a structured spec. Leakage check over every text surface. One variant per band (`below_4`, `level_4`, `level_5`) | No LLM diagrams. An unvalidated image is never served. Failure withholds the item and flags it |
| `PracticePlanner` (SV-02) | `recommend_next` reads `learner_skill_state` and graph edges. Deterministic | Vector similarity never chooses the next skill. Serve filter always applied. No generated questions |
| `ProblemParser` (SV-03) | Offline structured extraction at import, then V1–V9 and C1–C4 (C4 release-time at the Gate B tag only) | Never runs at tutoring time. Never changes content at runtime |

---

## 3. Tool Calling Definitions & Capabilities

### 3.1 Tool-access principles

1. Tools are called only by deterministic steps. An ADK `LlmAgent` with `output_schema` cannot call tools (PRD §9.2), and no LLM agent holds a tool client.
2. The `before_tool` callback enforces the allow-list in §3.2. A call outside it fails the turn into the deterministic fallback and is audited.
3. MCP and A2A calls carry a service bearer and W3C `traceparent` and `tracestate`. Each call is a child span of the turn trace.
4. All tool results are schema-validated before use. A schema-invalid tool result is treated as a tool failure for that call.

### 3.2 Permission matrix

`C` calls directly. `—` no access.

| Capability | AG-00 | AG-01 | AG-02 | AG-03 | AG-04 | AG-05 | AG-06 | AG-07 | AG-08 | AG-09 | AG-10 | AG-11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MCP `verify_expression` | — | — | C | — | — | — | — | — | — | — | — | — |
| MCP `search_exemplars` (Phase B / Tier 1b; Tier 1a: empty stub) | — | — | — | — | C | — | — | — | — | — | — | — |
| MCP `get_question` | — (tool consumers and import tests only) | — | — | — | — | — | — | — | — | — | — | — |
| A2A `SafetyGuard` | C (safety loop) | — | — | — | — | — | — | — | — | — | — | — |
| Provider adapter (model call) | C on behalf of | — | — | — | — | — | via adapter | — | via adapter | — | own call | via adapter |
| Repositories (SQL) | C (L6 only) | C (question load) | — | — | — | — | — | — | — | — | — | — |
| Cache store (Tier 1b only; no cache at Tier 1a) | — | — | C | — | C (`exemplar_query`) | — | — | — | — | — | — | — |
| Pure engines (`normalise`, `scrub_pii`, `input_screen`, `apply_overlay`, `match_prediction`, `retrieval_gate`, `estimate_student_state`, `decide_hint`, `check_candidate`) | C | C (first three) | C (`normalise`, `apply_overlay`) | C | C | C | — | C | — | C | — | — |
| `transitions.apply`, `select_transfer`, `render_*_turn`, `update_learner_model`, `recommend_next` | C | — | — | — | — | — | — | — | — | — | — | — |
| Blob | C (diagram route only) | — | — | — | — | — | — | — | — | — | — | — |

### 3.3 MCP tools (`solvepath-mcp`)

Transport: MCP streamable HTTP, stateless. Caller: the orchestrator. MCP holds a separate Postgres role with `SELECT` on question and exemplar tables (and the question embedding table for the off-path scans) and `INSERT` on `audit_event`. It has no access to student tables and generates no tutor text.

| Tool | Caller | Input | Output | Timeout | Errors and handling |
| --- | --- | --- | --- | --- | --- |
| `verify_expression` | AG-02 | `question_id`, `question_version`, `input` (string), `field_kind` (`answer` or `step`). No session input | `PureVerifierResult` | 400 ms | From Phase B. (In Phase A there is no MCP call: the verifier is an in-process call with the same 400 ms cap and `tool_failure` cannot arise from transport.) Timeout or connect failure: one fallback per turn inside the remaining budget, which is a repeat MCP call on the Vercel topology (from Phase B the API bundle holds no SymPy) or `app.verifier.service` in process on a container topology that packages SymPy with the API. HTTP 4xx or 5xx: no retry, `status=cannot_verify`, `state=tool_failure`, all other fields null. 401 bad token. 400 schema. 404 question not servable |
| `search_exemplars` (Phase B / Tier 1b; Tier 1a: the gate runs and the exemplar source is an empty stub) | AG-04 | `skill_id`, `error_category`, `canonical_value`, `relation_tags[]`, `taxonomy_version`. Numbers only | `exemplars[]` of `{exemplar_id, code, feature_template}`. Approved and published only. Top-k from policy configuration. Empty list is valid | 250 ms | Any failure (Postgres exemplar query, HTTP): empty result, span recorded, turn continues |
| `get_question` | Tool consumers and import tests (not the hot path, DD-05) | `question_id`, optional `version` | Full authored question including solution data | Inside the 150 ms load budget if used | 401. 404 for anything not approved and published |

### 3.4 A2A tool (`solvepath-safety`)

| Item | Specification |
| --- | --- |
| Caller | AG-00 safety loop step, after `check_candidate` passes |
| Input | `schema_version`, `request_id`, `candidate_text`, `hint_level`, `prompt_type`, `forbidden_strings[]`, `iteration` (1 or 2) |
| Output | `SafetyVerdict`: `schema_version`, `verdict`, optional `reason_code`, `request_id` |
| Timeout | 1,200 ms (1.3 s cap) |
| Handling | `allow` goes to the final deterministic override. `block` or `revise` rejects the candidate: iteration 1 revises, iteration 2 falls back with `loop_exhausted` and flag `safety_fallback`. `escalate` rejects with no second iteration, falls back with `loop_exhausted`, flag `safety_fallback` and a safety-incident audit event. Timeout or connect failure: one in-process retry of `app.safety.service` inside the remaining budget, else `guard_unreachable`. HTTP 4xx or 5xx: no retry, `guard_unreachable` (the A2A hop and this retry apply Tier 1b onward; Tier 1a: in-process module, `guard_unreachable` cannot arise from transport) |

### 3.5 Deterministic function tools

Pure functions of their inputs. No I/O, no model calls, injected `now` only (DESIGN §1.4 L4).

| Function | Used by | Input | Output | Limit |
| --- | --- | --- | --- | --- |
| `normalise` | AG-01, AG-02, AG-09 | `raw`, `field_kind` | `input_kind`, `canonical_value`, `canonical_expression`, `unit`, `parse_issue` (`none`, `comma_ambiguous`, `unparsed`) | Deterministic. One shared test corpus |
| `scrub_pii` | AG-01 | text | scrubbed text | < 5 ms |
| `input_screen` | AG-01 | text | `hit`, `category`, `canned_key` | < 10 ms |
| `apply_overlay` | AG-02 | `PureVerifierResult`, `response_target`, session, question | `VerifierOutcome` | Never cached |
| `match_prediction` | AG-03 | outcome, question | `matched`, `code`, `confidence=0.90` | < 10 ms |
| `retrieval_gate` | AG-04 | outcome, match | `open`, `skipped_reason` | — |
| `estimate_student_state` | AG-05 | prior persisted results | `StudentState` | — |
| `decide_hint` | AG-07 | event, outcome, match, classification, student state, session, question, cohort | `HintDecision` | < 40 ms |
| `check_candidate` | AG-09 | candidate text, hint decision, question, the current attempt's `verifier_outcome` (ADK state; for the student's-own-value exemption) | `blocked`, `reasons[]` | — |
| `render_solution_turn`, `render_example_turn` | AG-00 | question | verbatim authored text | No model, no guard |
| `transitions.apply` | AG-00 | state, event, guards | next state, effects | Unlisted pair gives 409 `transition_not_allowed` |
| `select_transfer` | AG-00 | student, original session | question or none | Graph decides legality, tie-break by pgvector similarity then lowest `question_id` (off the hot path; pgvector is used only here and in the near-duplicate scan, never for exemplar retrieval) |
| `recommend_next` | SV-02 | student, cohort | question or none | Graph edges only |
| `update_learner_model` | AG-00 (TX-B) | student, skill, turn | `learner_skill_state` | Same transaction as the turn |

### 3.6 LLM call interface (provider adapter)

| Item | Specification |
| --- | --- |
| Signature | `(agent, input, schema) → validated output` |
| Providers | Gemini default. OpenRouter and vLLM alternates. Same agent schemas. Selected with `LLM_PROVIDER` |
| Records | Provider, model, model version, temperature, prompt version, thinking budget. Gemini thinking is **disabled (budget 0)** on every call, so thinking tokens cannot enlarge the completion |
| Errors | Timeout, 429, 5xx: `provider_error`. Invalid after one repair: `schema_invalid`. Both end in the deterministic fallback with no free-form retry |
| Prompt fetch | One `PromptSource` interface (SPEC D-31). Tier 1a (`PROMPT_SOURCE=repo`): versioned files under `apps/api/app/prompts/`, no network fetch. Tier 1b onward (`PROMPT_SOURCE=langfuse`): Langfuse prompt by id and pinned label, cached as `prompt_template`. Langfuse fetch failure with no cache: deterministic fallback for the turn (derived from the SC-19 fail-closed rule) |

### 3.7 Callbacks as guards

| Callback | Enforces | On violation |
| --- | --- | --- |
| `before_model` | Prompt-capture: no student free text in any prompt | Turn fails before the model call. Fallback `fallback_l{level}`, `fallback_reason` null, P0 audit `prompt_capture_violation`. CI blocks on the test |
| `before_tool` | Allow-list of §3.2 | Turn fails into the deterministic fallback. Audited |
| `after_model` | Schema, leak-check hand-off, Langfuse span metadata | Rejected output follows the §5.3 ladder |

### 3.8 Authentication and permission boundaries

| Boundary | Rule |
| --- | --- |
| Orchestrator to MCP or Safety | When present (Tier 1b onward; at Tier 1a the verifier and guard are in-process modules with no service call), and the guard itself is never cut (cut T1b-4 replaces the A2A hop with the in-process safety module behind the same interface, with no A2A service call): HMAC bearer with `aud`, `iat`, `exp`, `exp − iat ≤ 60 s`. One secret per target. The orchestrator holds both signing secrets. Each target holds only its own and verifies, never signs for the other |
| Rejected token (when service-to-service authentication is present, Tier 1b) | Missing, expired, wrong audience or badly signed: 401, audit event, no data returned. An unauthenticated-call test blocks CI |
| Browser | Never reaches MCP or Safety. The single per-turn fallback is used only by the orchestrator and does not bypass the token rule |
| Database roles | API pooled role (`INSERT` only on `audit_event`). The API role is a non-owner without `BYPASSRLS`, and every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`. The auth lookup that runs before `SET LOCAL app.user_id` goes through a narrow `SECURITY DEFINER` function keyed by the Clerk `sub`, which returns only the caller's rows. The function is owned by a dedicated non-login role, has `search_path = pg_catalog, public`, and has `EXECUTE` revoked from `PUBLIC` and granted only to the API role. MCP read-only on content tables. Safety insert-only on `audit_event`. Migrations role only from CI |
| Audit | Tool calls, model calls and verdicts write audit rows with hashes only. Feature code cannot skip the unit-of-work audit writer |

---

## 4. State, Memory & Context Management

### 4.1 Memory tiers

| Tier | Store | Lifetime | Used by | Writer |
| --- | --- | --- | --- | --- |
| Working memory | ADK state, in process | One request. Discarded after the turn | All pipeline steps | Pipeline steps through `output_key` |
| Short-term (session) | `tutoring_session`, `attempt`, `tutor_turn`, `student_note`, `session_flag`, `misconception_event` | Session life, then immutable summary. Retention per §4.5 | AG-00, AG-01, AG-05, AG-07 | AG-00 in TX-A and TX-B |
| Long-term (learner) | `learner_skill_state` | Forever | SV-02, dashboards | AG-00 (turn-time fields), `learner-rollup` (aggregates, ≤ 1 h stale) |
| Long-term (curriculum) | `question` (immutable per version), skill graph (`graph_node`, `graph_edge`) | Forever | AG-01, SV-02, `select_transfer` | Import and review only |
| Long-term (retrieval) | `misconception_exemplar` read by an exact SQL filter (AG-04, via MCP). pgvector `question_embedding` (`vector(768)`) is used only for the transfer tie-break and the near-duplicate scan, off the hot path. Exemplar retrieval uses no vector search and no embeddings | Forever | AG-04 (via MCP); `select_transfer` and `item-quality-scan` (embeddings) | Import; `embedding-sync` (questions only) |
| Cache (Tier 1b only; no cache at Tier 1a) | `cache_entry`: `verifier_result`, `exemplar_query`, `prompt_template` | TTL (values open) | AG-02, AG-04, prompt fetch | AG-02, AG-04, prompt fetch |
| Policy as versioned data | Hint policy, `canned_responses.json`, `input_lexicon.json`, `jargon.json`, Langfuse prompts | Versioned. Stamped on each turn | AG-07, AG-09, AG-00 | Release process |
| Evidence | Postgres `audit_event` (authoritative). Langfuse traces (supplementary, 90 days) | Audit never deleted | Teachers, administrators | Audit writer, exporters |

Two memories, two jobs: vector retrieval answers "which labelled example resembles this error". The skill graph answers "which skill is next and which item is a fair transfer". Vectors never decide legality or the next skill. The graph is not a knowledge base and does not grow from student chat.

### 4.2 ADK state keys

State is a pure function of Postgres rows. Nothing in it is read on the next request (DD-04). Each key has exactly one writer.

| Key | Writer | Readers |
| --- | --- | --- |
| `problem_context` (includes `problem_context.question`: the pinned question stem and authored probe templates) | AG-01 | AG-02, AG-03, AG-05, AG-07, AG-08 (question stem only), AG-09 (`check_candidate` takes the question) |
| `verifier_result` (pure), `verifier_outcome` (post-overlay) | AG-02 | AG-03, AG-04, AG-05, AG-06, AG-07, AG-09 (`verifier_outcome` only), persistence |
| `misconception_match`, `retrieval` | AG-03, AG-04 | AG-06, AG-07, AG-08 (misconception code only) |
| `exemplars` | AG-04 | AG-06 only |
| `classification` | AG-06 | AG-07, AG-08 (misconception code only) |
| `student_state` | AG-05 | AG-07, persistence |
| `hint_decision` | AG-07 | AG-08 (allow-listed subset), AG-09, persistence |
| `candidate`, `guard_verdict`, `turn` | Loop steps | Final override, persistence |

LLM allow-lists are in §2.8, §2.10 and §2.13. The Dialogue Agent never reads `exemplars` or the accepted answer. The Classifier never reads the tutor draft or the accepted answer.

### 4.3 Context and token budget

| Rule | Value | Source |
| --- | --- | --- |
| Prompt tokens per model call | ≤ 1,500, applied to each individual call (Classifier, each Dialogue call, each Safety Guard call, each repair call) | SPEC §5.2 |
| Completion tokens per model call | ≤ 250, applied to each individual call. Thinking tokens disabled | SPEC §5.2 |
| Dialogue message | < 100 tokens. One question or one imperative. No sentence over 25 words | SPEC §5.2 |
| LLM calls per turn | Dialogue ≤ 2 iterations. Classifier ≤ 1. One schema repair per call. No free-form retry | SPEC §5.3 |
| Safety Guard output | Capped output tokens (cap value open) | SPEC §3.7 |
| Spend | USD 20 monthly ceiling for model-provider usage only, alert at USD 16 (80%) via the Langfuse cost budget (Decision #34, accepted 2026-10-11) | TECHNICAL §3.3 |
| Split of the 1,500 / 250 budget between agents | **Closed.** The ceiling is per individual model call, so no split is needed. A turn's cumulative tokens are reported, not gated | SPEC §5.2 (derived) |
| Enforcement point | The provider adapter is the only code that calls a model, so prompt assembly and completion caps are applied there (derived) | DESIGN §1.4 rule 3 |

### 4.4 Pruning and context-minimisation strategy

1. **By construction, not by trimming.** LLM agents are given only allow-listed keys. No chat history, transcript or free text enters a prompt. Context never grows across turns, because each turn is rebuilt from rows.
2. **Revision context.** The second Dialogue iteration receives the same inputs plus the single word "revise". It never receives the blocked candidate, the guard reason or the leak reasons.
3. **Numbers-only retrieval.** The exemplar query holds `skill_id`, `error_category`, canonical value, `relation_tags` and taxonomy version (Phase B / Tier 1b; at Tier 1a the exemplar source is an empty stub). The exemplar-query cache key is `error_category`, `skill_id`, taxonomy version, canonical numeric value and `relation_tags` (Tier 1b only, no cache at Tier 1a).
4. **Cache hygiene.** Exact keys only. No free text in keys or values. Verifier cache values hold the pure result only, never `progress`, level, retry count or `response_target`.
5. **Telemetry masking.** A masking function runs before Langfuse export. Pseudonymous ids only. No free text in any span.
6. **Retention pruning.** `retention-purge` nulls or deletes bodies only (§4.5). Audit rows and approved question diagrams are never deleted.
7. **Teacher Insight context.** Aggregated events for one cohort per draft. Evidence entries are references to source event ids, not copied bodies.

### 4.5 Retention (`RETENTION_POLICY_VERSION`)

| Data | Window | On expiry |
| --- | --- | --- |
| `tutor_turn.body` | 90 days | Body null. Row, verifier status, level, versions kept |
| `attempt` (`response_value`, `step_expressions`, `free_text`) | 365 days | Fields deleted. Status, level, skill, timestamps kept |
| `student_note`, `teacher_comment`, `tutor_note` | 365 days | Body deleted. Row kept |
| Langfuse traces | 90 days | Link replaced by an expiry notice |
| Student-specific diagram blobs | 90 days | Blob deleted |
| `audit_event`, approved question diagrams | Never | — |

### 4.6 Guardrails summary

| Guardrail | Value |
| --- | --- |
| Turn deadline | 7.5 s hard stop. A stage whose minimum useful time would cross it is skipped and the turn takes the `budget` fallback |
| Stage timeouts | Verifier 400 ms, retrieval 250 ms, classifier 1,000 ms, hint policy 40 ms, dialogue 1,400 ms, guard 1,200 ms (1.3 s cap), persistence 200 ms, overhead 0.25 s |
| Revision gate | The second iteration starts only if the remaining time covers dialogue 1.4 s + guard 1.2 s + persistence 200 ms. Otherwise `budget`. The gate is measured against the turn deadline D: 7.5 s with the background flush, 7.2 s in the inline-flush fallback (SPEC §5.1). |
| Pipeline turns per session | 12. A transfer session has its own 12. The cap counter is `tutoring_session.turn_number`, never `tutor_turn.turn_number` |
| Rate limits | 60 turns per hour and 15 per 5 minutes per student, counted per accepted, non-replayed event |
| Single per-turn fallback | At most one per turn |
| Idempotency record | 24 h |
| Session inactivity | 30 minutes then `abandoned` (lazy) |

---

## 5. Handoff Protocols & Multi-Agent Coordination

### 5.1 Pipeline handoffs

Handoffs are fixed by the `SequentialAgent` order. A step hands over by writing its state key. The next step does not start until the previous one returns or times out.

| # | From → To | Trigger | Payload (state key and schema) | If the step fails or is skipped |
| --- | --- | --- | --- | --- |
| H1 | AG-00 → AG-01 | TX-A committed, lease held | Session, attempt, request | 503 before the attempt is stored. After that, resume from the attempt |
| H2 | AG-01 → AG-02 | `input_kind` ≠ `unparsed`, or unparsed with no Input Screen hit | `problem_context` | Input Screen hit: canned reply, stop. `unparsed` or `comma_ambiguous`: verify may be skipped and the outcome is `cannot_verify` |
| H3 | AG-02 → AG-03 | Post-overlay `incorrect`, `input_kind` `value` or `ratio` | `verifier_outcome` | Otherwise AG-03 returns no match |
| H4 | AG-03 → AG-04 | Always | `misconception_match` | — |
| H5 | AG-04 → AG-06 | Gate open: `incorrect` unmatched, or `cannot_verify` with `state=ok` | `retrieval`, `exemplars` | Empty or failed retrieval: classifier runs with no exemplars and records it. In the 1a golden fixture the recorded output is `null` or `insufficient_evidence`, with no misconception claim and `prompt_type=diagnostic_probe` |
| H6 | AG-04 → AG-05 | Gate closed or after the classifier | `retrieval` | — |
| H7 | AG-05, AG-06 → AG-07 | Always | `student_state`, `classification` | Classifier timeout or invalid: no misconception claim, `prompt_type=diagnostic_probe`, and the turn continues (no `fallback_l{level}`) |
| H8 | AG-07 → loop | `turn_kind=model` | `hint_decision` | Other kinds (`solution`, `authored`, `canned`, `probe_template`, `fallback`) skip the loop and the guard |
| H9 | AG-08 → AG-09 | A schema-valid `candidate` | `candidate` | `schema_invalid` or `provider_error` fallback |
| H10 | AG-09 → AG-10 | `check_candidate` passed | `candidate` plus guard input | Blocked: revise (iteration 1) or `loop_exhausted` (iteration 2) |
| H11 | AG-10 → final override → persistence | Verdict `allow` | `guard_verdict`, `candidate` | See §5.3 |
| H12 | Persistence → AG-00 response | TX-B committed | `turn` | See §5.3 |

### 5.2 Routing by event

The route is decided by the event and the state, never by a model (SPEC WF-03). The model calls listed below apply in the opt-in `llm` mode. In the shipped `template` default (SPEC D-37) no event makes a model call.

| Event | Steps that run | Model calls |
| --- | --- | --- |
| `submit` with value, ratio or expression | 1 to 8 | Classifier (gate only), Dialogue (0 to 2), Guard |
| `submit` correct on the final answer | 1 to 2, then the authored reflection turn | None |
| `submit` unparsed, first in a row | 1 to 2 (`cannot_verify`) | None. Canned `rephrase_request`, `use_dot_for_decimals` or `enter_the_number` |
| `submit` unparsed, second in a row | Same | None. `input_mode=structured`, `structured_mode_notice`, flag `ambiguity_review` |
| Input Screen hit | 1 only | None. Canned reply, no `tutor_turn` row, safety audit event |
| `submit` with a reasoning option only | Load-only 1, 5, 6, loop or authored | Dialogue and Guard, or canned |
| `not_sure` | Load-only 1, 5, 6 (+1, max 4), loop | Dialogue and Guard |
| `show_solution` | Load-only 1, 5, 6 (the same steps as SPEC WF-03 and DESIGN S3) | None for the solution turn and the example turn. Dialogue and Guard when paraphrasing the next probe. Canned `encouragement` when no probe remains |
| `reflection_choice`, `transfer_decision` | `select_transfer` or transfer creation | None |
| `note` | `scrub_pii`, `input_screen` | None. No hit stores `student_note` and `note_ack` |
| MCP HTTP error | 2 | None. Canned `tool_failure_notice`, no counter change, no retrieval |

### 5.3 Fallback ladder

Every ladder ends in an authored, mathematics-free prompt. No failure produces a verdict, a leak or unguarded model text.

| Condition | Result | `fallback_reason` | Session flag |
| --- | --- | --- | --- |
| Verifier MCP timeout or connect failure | One repeat MCP call (Vercel topology) or in-process verifier (container topology), then continue | — | — |
| Verifier needs a second fallback, or would cross 7.5 s, so no verifier result exists | `fallback_l{level}`. Outcome `unverified` (SPEC SM-1 row 23): session state unchanged, the attempt is not counted toward the Level 5 minimum, a `tutor_turn` row with the audit ordinal + 1 but no change to the cap counter `tutoring_session.turn_number`, hint level unchanged, `consecutive_unverified` + 1 (third in a row: canned `tool_failure_notice` and flag `verification_unavailable`). Phase 2 of `transitions.apply` maps it to row 23 | `budget` | — |
| Verifier MCP HTTP error | `tool_failure_notice` | — | — |
| Retrieval or cache failure | Empty retrieval or cache miss, continue | — | — |
| Classifier timeout or invalid | No misconception claim. Normal tutor turn with `prompt_type=diagnostic_probe`. Audit event with the cause | — (not a fallback) | — |
| Provider timeout, 429, 5xx | `fallback_l{level}` | `provider_error` | No |
| Schema invalid after one repair | `fallback_l{level}` | `schema_invalid` | No |
| Both candidates rejected, or `escalate` | `fallback_l{level}` | `loop_exhausted` | `safety_fallback` |
| Guard unreachable (after one in-process retry) or guard HTTP error (Tier 1b onward; Tier 1a: in-process module, `guard_unreachable` cannot arise from transport) | `fallback_l{level}` | `guard_unreachable` | `safety_fallback` |
| Prompt-capture violation | `fallback_l{level}` | null | No. P0 audit event |
| 7.5 s exceeded | `fallback_l{level}` | `budget` | No |
| Levels 1–3 with no unused probe, or Level 4 unsuccessful with none left | Canned `fallback_l{level}`, `kind=canned`, no model | null | No |
| Postgres unreachable before the attempt is stored | 503, `save_failed_notice`, answer kept | — | — |
| Postgres fails at TX-B | 503, retry resumes from the stored attempt | — | — |
| Langfuse failure | Turn continues, `trace_status=missing` | — | — |
| Blob or SVG failure | In-process render, else probe text with `diagram_unavailable` | — | — |

Order in which the orchestrator handles failures: provider quota or 429, tool timeout, schema invalid, retrieval empty, safety block, loop exhausted. Each writes an audit event and none becomes a free-form model retry.

### 5.4 Dialogue loop protocol

1. Run the `before_model` prompt-capture guard. A hit fails the turn before iteration 1.
2. Iteration 1: AG-08, then AG-09, then AG-10 (only if AG-09 passed), then the final override.
3. If the candidate is blocked at any point and the revision gate allows it, iteration 2: AG-08 receives only "revise". Otherwise `budget`.
4. If iteration 2 is blocked: `loop_exhausted`. If `escalate` at any point: no iteration 2, `loop_exhausted`, safety-incident audit event.
5. Only a candidate that passed AG-09, received `allow` and passed the final override is persisted or shown. Nothing is streamed from an unreviewed draft.

### 5.5 Loop detection

| Loop risk | Detection | Termination |
| --- | --- | --- |
| Dialogue regenerate loop | Iteration counter | Hard cap of 2 iterations. Then fallback |
| Unparsed-input loop | `consecutive_cannot_verify` | First occurrence: canned reply, no counted attempt, no level change and not a pipeline turn (SPEC SM-1 row 5). Second occurrence switches to structured input and records `ambiguity_review`: no counted attempt and no level change, but a pipeline turn (SPEC SM-1 row 6) |
| Repeated pleading for the solution | Level 5 gate | Level never rises from requests. Next unused probe, then `encouragement`. Request audited |
| `not_sure` at Level 4 | Hint policy | Level stays 4. Next probe or `encouragement`. Never Level 5 |
| Stuck student | `tutoring_session.turn_number` | 12th pipeline turn without `correct` moves to `stuck`, flag `turn_cap_reached`, no worked solution |
| Stuck on transfer | Level 4, ≥ 3 counted attempts, latest `incorrect` or `partially_correct` | `completed`, flag `stuck_after_transfer`, no worked solution |
| Retry storm | `Idempotency-Key`, rate counters | Replay returns the stored response. Over cap: 429 |
| Repeated fallbacks | Per-turn counter | At most one. A second goes to the deterministic fallback |
| Tool-selection loops | — | Not possible. No model chooses tools or routes |

### 5.6 Concurrency, deadlocks and stale ownership

| Hazard | Mechanism |
| --- | --- |
| Concurrent events on one session | Session lease (12 s, `SESSION_LEASE_SECONDS`) taken in TX-A. A different-key event during a live lease returns 409 `request_in_progress`, `retry_after_s=3`. The client (request timeout 15 s, timers start at dispatch) retries once with the same key 3 s after a timeout, a network error or a 409. A row lock is held only inside TX-A and TX-B |
| Crashed or timed-out turn | The lease expires. A retry with the same key re-takes it and resumes from the stored attempt. No second attempt and no `attempt_count` change before TX-B |
| Lease reclaimed during a slow turn | TX-B updates only where `lease_holder = key`. Zero rows means rollback and 409. Only one run ever reaches TX-B |
| Pipeline overrun | `TurnDeadline` with do-not-start and revision-gate rules. The 200 ms persistence reserve guarantees the fallback turn can be stored |
| Connection starvation | No connection is held across MCP, A2A or LLM calls. No session-level advisory locks (transaction-mode pooler) |
| Cron overlap | Work derived from data, `FOR UPDATE SKIP LOCKED`, no stored cursor. A failed chunk rolls back only itself |
| Event not allowed in the state | `transitions.apply` returns 409 `transition_not_allowed`, nothing changes, independent-transaction audit |
| Terminal session | The session row accepts no mutation except the `transfer_outcome` back-fill. `student_note`, `session_flag` (safety disclosures) and audit events are separate tables and are written in any state |

### 5.7 Human-in-the-loop and escalation

Agents never escalate to a person mid-turn and never wait for one. Escalation is a recorded flag or a pending item that a person acts on later.

| Trigger | Record | Human who acts | What they can do |
| --- | --- | --- | --- |
| Safety Guard `escalate` | Safety-incident audit event, flag `safety_fallback` | Assigned teacher. If none, the cohort support contact. If none, an administrator holding `trace_review` | Review the session (replay) |
| Loop exhausted or guard unreachable | Flag `safety_fallback` | Same | Same |
| Input Screen `worrying_disclosure` | Safety audit event, flag `worrying_disclosure`, canned `worrying_disclosure_reply` (tell a trusted adult). No safeguarding decision is made by the system | Same | Follow the school's own process |
| Other Input Screen hits | Safety audit event, canned reply | Audit viewer | Review |
| Two consecutive unparsed inputs | Flag `ambiguity_review` | Assigned teacher | Review input difficulty |
| 12th pipeline turn without `correct` | Flag `turn_cap_reached`, question saved for the teacher | Assigned teacher | Follow up with the student |
| Stuck after transfer | Flag `stuck_after_transfer` | Assigned teacher | Follow up |
| Level 5 withheld | Flag `support_withheld`, audit `support_withheld` | Assigned academic coordinator | Change `allow_level_5` for the cohort (audited, next decision only) |
| Misconception hypothesis | `misconception_event`, `reviewer_status=unreviewed` | Assigned teacher | Confirm or reject. Not shown to the student |
| Teacher Insight draft | Recommendation `pending`, with evidence and limitations | Assigned teacher | Accept, reject or override with rationale. A different second decision returns 409 |
| Draft with forbidden wording | Stored `rejected`, never shown | None needed | — |
| Verifier mismatch, leakage event, schema failure | Content flag or quality issue | Content reviewer. Administrator holding `trace_review` | Approve, reject, deprecate. Triage |
| Answer-key inconsistency | Item flagged, not served | Content reviewer | Resolve |
| Cron job `failed` | `job_run` status and a Langfuse score or log alert | Administrator | Investigate |

An agent never decides placement, grading, admissions, exclusion, remedial classification, welfare or safeguarding.

### 5.8 Handoffs outside the student turn

| Flow | Participants and order | Gate |
| --- | --- | --- |
| Reflection and transfer | AG-00 renders the authored reflection on a verified correct final answer. `select_transfer` filters by graph legality. Accept creates the linked transfer session and completes the original in one transaction | No model, no verifier call, no guard. A transfer session never receives a worked solution |
| Next practice | SV-02 `recommend_next` after a terminal state | Graph edges and the serve filter. No vector choice |
| Recommendation drafting | Cron or OP-11 → aggregated events → AG-11 → deterministic wording check → store `pending` or `rejected` | Teacher decision (SM-2) |
| Content import | SV-03 → V1–V9 and C1–C4 (C4 release-time at the Gate B tag only) → diagram render and `validate_diagram` → write as `pending` and `draft` | Content reviewer approval, only after offline validation passes. No autonomous publication |
| Embedding and rollups | Cron jobs derive pending work from data | Idempotent, bounded batches |

### 5.9 Observability of coordination

One Langfuse trace per turn (`session_id` = session id, `user_id` = pseudonymous student id) with one span per agent step and tool call. MCP and A2A calls are child spans with propagated trace context. Trace metadata: `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment`. The turn record stores provider, model, model version, temperature, prompt and policy versions, tool results, `trace_id`, `trace_status`, `cache_status` and `fallback_reason`. The Postgres audit ledger is authoritative. Langfuse never fails a turn. Gates that bind agent behaviour include `answer_leakage` = 0, `schema_valid` 100%, `single_prompt` 100%, `age_appropriate` 100%, `hint_policy_match` ≥ 95%, `verifier_agreement` ≥ 99%, trajectory leakage 0 and `fallback_rate` ≤ 5% (a live, post-calibration ratchet), per SPEC §5.9. Harness-level checks (measured on delivered turns against fixtures, including poisoned ones) and model-level ratchets (measured pre-guard on at least 100 live turns) are different checks and are never substituted for one another (SPEC §5.9 gate semantics).

### 5.10 Open items that affect agents (not decided here)

| Item | Owner or source |
| --- | --- |
| Exact pins for `google-adk`, MCP SDK, A2A SDK, model ids (`MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING`) | Phase 0 ADR (Decision #30) |
| Structured-output route: ADK `output_schema` or adapter JSON mode, per provider | Phase 0 provider spike (Decision #27) |
| Model variable and timeout for `TeacherInsightAgent` | Not named in the sources |
| Safety Guard output cap (value) | Not specified. The per-call 1,500 / 250 ceiling applies and the guard's own cap must be lower |
| `tone` value set, exemplar top-k, cache TTLs, evidence-limit sample threshold | Policy configuration (SPEC §1.5) |
| `ProblemParser` mode (LLM or deterministic) | PRD §9.4 leaves both |
| Session lease duration | **Closed:** 12 s (`SESSION_LEASE_SECONDS`) |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
