# SolvePath — Functional Specification (SPEC.md)

Source of truth: `PRD.md` v1.3.18. This document translates PRD requirements into contract-level functional specifications. It contains no application source code.

---

## 1. Overview & Scope Boundaries

### 1.1 Purpose and conventions

| Convention | Meaning |
| --- | --- |
| **SHALL / SHALL NOT / MAY** | Normative keywords. SHALL = mandatory, MAY = optional |
| **T1 / T2 / T3** | Release tier of the behaviour. T1 = P0, Release 1.0a/1.0/1.0 with teacher view (Gates A/B/C). T2 = P1, Release 1.1. T3 = P2, Release 1.2 (PRD §6.7, §18.1) |
| **[D]** | *Derived.* The behaviour is not stated verbatim in the PRD. It is derived from the PRD text cited beside it and is registered in §1.5 for confirmation |
| **PRD §n / FR-nn / STU-nn / EDU-nn / ADM-nn / TECH-nn / Decision #n** | References into `PRD.md` |
| **SC-nn** | System capability in §1.2 |
| **WF-nn** | Workflow in §4 |
| **ENT-nn / SM-n** | Entity group (§2) / state machine (§2.8) |

Identifiers: `question_id` is a text slug (for example `scale_0001`). Every other identifier is a UUID. Student identifiers in audit rows, traces and caches are the pseudonymous `app_user.id`. Timestamps are `timestamptz` in UTC. All text exchanged with the browser is plain text with no HTML.

### 1.2 System capabilities (PRD → system-level functional specification)

| ID | Capability | System-level specification | PRD |
| --- | --- | --- | --- |
| SC-01 | Authentication and role-based access | Every request is authenticated with a Clerk JWT. The caller's role, cohort scope and grants are read from Postgres on every request. A role claim in the token never grants access. An unknown subject is rejected with 403 and never provisioned. Authorisation is enforced in the FastAPI dependency layer (T1) and by Postgres row-level security (T3). Denied and successful access are audited | FR-01 |
| SC-02 | Question delivery | A question is delivered only when `validation_status=approved`, `publication_status=published`, the curriculum scope is enabled and every FR-02 field is present. Unapproved, flagged, draft, rejected, deprecated and pending items are never served, including through vector search and the Practice Planner | FR-02 |
| SC-03 | Student attempt capture | The student submits a numeric, fraction, decimal, percentage, ratio, arithmetic-expression or multiple-choice response, optional one-expression working, a structured reasoning option, a confidence rating, a "not sure" signal, a "show me the solution" request or a note for the teacher. Each attempt is stored with its target, hint level and duration | FR-03 |
| SC-04 | Input Screen and authored text | Free text reaches no model and no Langfuse span in Release 1.0. A deterministic scrubber and Input Screen handle notes and unparsable fields. Every fixed student-facing sentence comes from one reviewed registry of 28 keys | PRD §8.3.1, §8.3.2, Decision #31 |
| SC-05 | Deterministic verification | A pure, cacheable, session-independent verifier (SymPy plus ratio rules, reached through MCP) returns a structured result. An uncached response-target overlay adds session context. No LLM calls the verifier and no LLM issues a verdict | FR-04 |
| SC-06 | Socratic tutoring workflow | A table-driven finite-state machine controls every session. A fixed per-turn pipeline produces exactly one bounded tutor prompt per turn. A (state, event) pair the table does not list is rejected with 409 and audited | FR-05 |
| SC-07 | Hint policy | A deterministic engine sets hint level 0–5. Only unsuccessful attempts and "not sure" raise the level. Level 5 needs all four conditions. Levels 4 and 5 content comes only from authored data | FR-06 |
| SC-08 | Misconception classification | A deterministic matcher on authored predictions runs first. A retrieval gate and an LLM classifier run only for an `incorrect` or `cannot_verify` verdict that has no deterministic match. Labels come from a closed taxonomy and are visible to teachers only | FR-07 |
| SC-09 | Learner model | A transparent rules-based model updates mastery and confidence when a turn is persisted. Aggregates are recomputed hourly | FR-08 |
| SC-10 | Diagram support | Diagrams are drawn deterministically as SVG from validated specifications, stored with version and hash, and passed through a level-dependent leakage check before display. No LLM publishes an image | FR-09 |
| SC-11 | Transfer question | After a solved item the skill graph selects one legal, approved, near-transfer item or records `no_legal_transfer`. The transfer is attempted independently and never receives a worked solution | FR-10 |
| SC-12 | Student dashboard | A non-comparative progress view of the caller's own data | FR-11 |
| SC-13 | Teacher dashboard and recommendations | Review list, profiles, groups, trends, content flags and evidence-linked draft recommendations that stay pending until a human decides | FR-12, PRD §13 |
| SC-14 | Session replay | Read-only replay of an assigned session with per-turn evidence. Metadata survives body purge. Langfuse links are shown only to administrators holding `trace_review` | FR-13 |
| SC-15 | Content quality | Items are flagged for eleven defined reasons. Only content reviewers and administrators change publication status. An edited item needs a new approval | FR-14 |
| SC-16 | Auditability | Append-only audit rows of ids, hashes and structured fields for every defined event. Feature code cannot skip the writer | FR-15 |
| SC-17 | Background processing | Seven authenticated, idempotent, batched cron jobs recorded in `job_run` | FR-16 |
| SC-18 | Leakage and output controls | A deterministic leakage, method-leak, phrase and age-appropriateness check runs before the A2A Safety Guard on every candidate turn. A deterministic hit overrides a guard `allow`. No unguarded model text is ever shown | PRD §8.6, §9.3, §11.2 |
| SC-19 | Failure-state contract | No dependency failure produces a verdict, a leak or unguarded model text. Authentication fails closed. Langfuse never fails a turn | PRD §11.6 |
| SC-20 | Service-to-service authentication | The MCP and A2A services accept only short-lived, audience-scoped, HMAC-signed bearer tokens | PRD §9.9 |

### 1.3 System context and trust boundaries

| Component | Responsibility | Boundary rule |
| --- | --- | --- |
| Web SPA (`solvepath-web`) | React/TypeScript UI. Renders only what `tutor.controls` lists | Untrusted. Hiding a control is never an access control. Calls the API through the same-origin `/api/*` rewrite |
| Orchestrator (`solvepath-api`) | FastAPI. Authentication, authorisation, session state machine, ADK pipeline, persistence, cron routes | The only component that talks to the browser. The only component that talks to MCP, A2A, the LLM provider, Blob and Postgres on a student's behalf |
| MCP server (`solvepath-mcp`) | Tools `verify_expression`, `get_question`, `search_exemplars`. No LLM, no tutor text | Reachable only with a valid service token. Holds solution data |
| A2A Safety Guard (`solvepath-safety`) | Returns `allow`, `block`, `revise` or `escalate` for a candidate turn | Reachable only with a valid service token. Verdict-only output |
| PostgreSQL + pgvector | Domain data, skill graph, exact-key cache, audit, rate counters, vectors | Pooled connection for requests, unpooled for migrations |
| Vercel Blob | Approved diagram SVGs, content imports, exports | Served only through controlled routes. No guessable public URLs for student-specific objects |
| Langfuse | Traces, prompts, datasets, scores | Pseudonymous ids only. Never fails a turn |
| LLM provider adapter | Gemini by default, OpenRouter or vLLM alternates, same agent schemas | Agents never import a vendor SDK |
| Vercel Cron | Calls protected `/api/jobs/*` routes | `CRON_SECRET` bearer required |
| Clerk | Identity proof only | Roles and scope are decided in Postgres |

### 1.4 Out-of-scope boundaries

The system SHALL NOT, in any tier:

1. Grade formal assessments, determine placement or selective-school admissions readiness, recommend exclusion, discipline or remedial classification, send parent or student communications, or make welfare or safeguarding decisions (PRD §3.3, §12.2).
2. Diagnose learning difficulties, disability or behavioural conditions (PRD §7.2).
3. Give mental-health, medical or legal advice, promise examination success, or infer sensitive attributes (PRD §12.1).
4. Publish a regenerated, generated or modified question or diagram autonomously, or generate questions for immediate learner delivery (PRD §7.2, FR-14).
5. Run an open ReAct loop in which a model chooses its own tools or can reveal answers (PRD §7.2, §9.1).
6. Cache raw student free text in any cache, or send it to any LLM prompt or Langfuse span in Release 1.0 (PRD §7.2, FR-03).

The product scope excludes: Years 5–10 full coverage, handwritten or image recognition, voice, parent accounts and any parent route, live group classes, native mobile apps, LMS integration, multi-language tutoring, a fully adaptive IRT engine, timed or exam-mode practice, student-authored questions or diagrams, leaderboards or peer comparison, self-service registration or role requests, bulk overrides, per-student policy overrides, automatic scheduling of group sessions, external SIEM integration, automatic prompt rollback or A/B routing, web-scale or video retrieval and a separate graph database (PRD §7.2 and story out-of-scope fields).

Algebraic expressions containing a variable are **not enabled** in Release 1.0 and no item uses one (FR-03).

Real-learner deployment (consent flow, personal-data deletion path, paid or Vertex Gemini tier, Sydney-region Postgres, customer-controlled Langfuse) is out of scope. The public environment SHALL use synthetic data only (PRD §15.8, §11.1).

### 1.5 Resolved decisions and derived-item register

**Resolved with the product owner for this document**

| Ref | Resolution |
| --- | --- |
| R1 | **Linked transfer session.** Accepting the transfer closes the original session as `completed` and creates a new linked session that starts in `transfer_active`. The transfer session's own result ends it. This amends PRD §8.5.1 row 15 and reads Decision #24 as "the original session is `completed` once the transfer is accepted or recorded as not offered" |
| R2 | **`free_text`.** The attempt column `free_text` exists, is nullable and is purgeable (ADM-09). No Release 1.0 event populates it. Note text is stored once, in `student_note` |
| R3 | **Coverage.** All of FR-01 to FR-16 are specified at full detail, each tagged T1/T2/T3 |
| R4 | **Undefined interfaces.** Interfaces and schemas the PRD does not define are derived strictly from PRD acceptance criteria, field lists and role rules, and marked **[D]** |

**Derived-item register (each is marked [D] where it appears)**

| Ref | Derived item | Basis |
| --- | --- | --- |
| D-01 | A reasoning option is a companion field of `submit`. An option-only submit is an answerless pipeline turn that is not counted and does not change the level | STU-03, FR-03, §9.3 |
| D-02 | `step_expressions` holds at most one expression per `submit` in Release 1.0 | FR-03 "one expression at a time" |
| D-03 | Per-event allowed-field matrix for `TurnRequest`, and 400 for a missing `Idempotency-Key` | §15.9 |
| D-04 | Transfer-accept response shape. Transfer outcome mapping: abandoned → `skipped`, stuck or `stuck_after_transfer` → `incorrect`. `transfer_outcome` is back-filled on the original session | R1, STU-06, STU-18 |
| D-05 | Turn content for an unsuccessful attempt that is already at Level 4. A Level 1–3 turn with no unused probe is `kind=canned` (`fallback_l{level}`) with no `fallback_reason` | §8.6 |
| D-06 | A2A request and response bodies, and handling of `block`, `revise`, `escalate` | §9.3, §9.9 |
| D-07 | MCP tool input schemas and the `field_kind` input | §8.4, §9.9 |
| D-08 | URL paths, request and response bodies of educator, tutor, coordinator, content-reviewer and administrator operations | FR-01, FR-11–FR-15, stories |
| D-09 | Cron routes use GET, an invalid bearer returns 401, `job_run.status` values | FR-16, ADM-07 |
| D-10 | Attributes of entities for which the PRD has no field list (cohort, assignment, grant, audit event, recommendation, content-review item, job run, rate counter, export, diagram variants) | §10.1 |
| D-11 | Enumeration value names where the PRD names only the concept (`validation_status`, `publication_status`, confidence labels, review-flag reasons, job status) | FR-02, FR-12, §22.1 #22 |
| D-12 | Abandonment (30 minutes) is applied lazily when the session is next read or written | Decision #24 |
| D-13 | Provisional request payload limits | §5.2 |
| D-14 | Concurrent events with different keys on one session are serialised by a per-session row lock | STU-12 |
| D-15 | Mastery deltas apply to a counted success on the original or the transfer item. The conflict rule is evaluated once per persisted counted attempt. A new skill state starts at `0.0` | STU-16, Decision #21 |
| D-16 | A different second decision on a recommendation returns 409 `transition_not_allowed` | EDU-04 |
| D-17 | Each diagram specification carries `min_level`, the lowest hint level at which it may be shown | STU-12, FR-09 |
| D-18 | The rate limiter counts each accepted, non-replayed `POST /events` | §11.2 |
| D-19 | Transfer tie-break: highest similarity, then lowest `question_id` | §8.10 |
| D-20 | `fallback_reason` is null for `prompt_capture_violation`. A `cannot_verify` (state ok) verdict forces the stored label to `insufficient_evidence` | §11.6, §9.8 |
| D-21 | With `DIALOGUE_MODE=template`, no model call runs on the student path and the turn has `kind=probe_template` | §18.4.2 |

**Open values the PRD does not define.** The SPEC names the parameter, states where it is configured and does not invent a number: exemplar top-k, exact-key cache TTLs, near-duplicate cosine threshold, difficulty-anomaly and "excessive confusion" thresholds, the `tone` value set, the sample size below which an evidence-limit warning is shown, the computation of "strengths and next focus" on the student dashboard, the confidence computation for groups, and the `confidence_rating` range (provisionally 1–5 [D]).

---

## 2. System Entities & Data Contracts

### 2.1 Identity and access (ENT-01)

**`app_user`** (T1)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id` | uuid | PK. The pseudonymous id used in every other table, trace and audit row |
| `clerk_user_id` | text | unique, not null. Looked up from the token `sub` on every request |
| `role` | enum `student`, `parent`, `tutor`, `teacher`, `academic_coordinator`, `content_reviewer`, `administrator` | not null. Single-valued |
| `display_label` | text | nullable. Synthetic label such as "Student A" |
| `created_at` | timestamptz | not null |

The table SHALL hold no name and no email. Rows are created only by `scripts/seed_synthetic.py` (reading `content/seed/users.json`: `{clerk_user_id, role, cohort, display_label}`, idempotent) and by the administrator route of ADM-13. The seed script inserts `BOOTSTRAP_ADMIN_CLERK_ID` as `administrator` only when no administrator exists. The API process never reads that variable.

**`user_grant`** [D-10] (T1 read, T3 audit viewer)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `app_user`. The user's `role` SHALL be `administrator` |
| `grant` | enum `trace_review` | not null. Not a role |
| `granted_by`, `granted_at` | uuid, timestamptz | not null |
| `revoked_at` | timestamptz | nullable. A grant is in force when `revoked_at` is null |

Granting or revoking SHALL write an audit event with who, when and the change.

**`cohort`** [D-10 for attributes beyond the PRD-named ones]

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id` | uuid | PK |
| `label` | text | synthetic label, no personal data |
| `curriculum_scope_enabled` | boolean | not null. An item is servable only when its scope is enabled |
| `starting_set` | set of `skill_id` | enabled starting skills. Defines "taught" skills for a new student |
| `allow_level_5` | boolean | not null, **default false**. Changed only by an assigned academic coordinator. Every change writes an audit event with who, when, previous and new value |
| `support_contact_user_id` | uuid | nullable. At most one per cohort. Replacing it audits both changes. Not a role |
| `created_at` | timestamptz | not null |

**`cohort_assignment`** [D-10]: `(cohort_id, user_id, member_role)` with `member_role` in `student`, `tutor`, `teacher`, `academic_coordinator`. Unique on all three. "Assigned" in every authorisation rule means a row exists for the caller's role in the student's cohort.

**Scope resolution.** For each request the orchestrator SHALL resolve `(role, cohort ids, active grants)` from Postgres. Nothing in the JWT other than `sub` is used for authorisation.

**Role-action matrix** (FR-01, ADM-01)

| Role | Allowed (inside scope) | Denied |
| --- | --- | --- |
| `student` | Own sessions, events, diagram, progress, dashboard, recommended or chosen published question | Other students, all educator, publishing and audit surfaces |
| `parent` | Nothing. Sign-in may succeed and grants no product route | Every product route |
| `tutor` | List assigned students' session ids, question titles and times. Add a note to an assigned session id | Student responses, tutor output, replay, recommendation decisions, cohort summaries, publishing, role changes |
| `teacher` | Assigned students and cohorts: review list, profile, groups, trends, replay body (no Langfuse link), recommendations with accept, reject and override, comments, session flags, content-flag read, export | Unassigned students, publishing, role changes, `trace_review`, Langfuse link |
| `academic_coordinator` | Assigned cohort: summaries, intervention insights, item-quality indicators, `allow_level_5` | Student replay, student-level override, publishing, role changes, granting `trace_review`, Langfuse traces, unassigned cohorts |
| `content_reviewer` | Review queue, approve, reject, deprecate questions and diagrams | Student records, role changes |
| `administrator` | Users, roles, cohort create, enrol and assign, support contact, content policy, configuration, evaluations, audit logs, grant and revoke `trace_review`. With `trace_review` only: replay body, Langfuse link, quality-issue list | Learning profiles, the cohort student list (membership ids for assignment excepted), parent messaging, autonomous grading |
| Cohort support contact (assignment, not a role) | `session_flag` rows of kind `safety_fallback` and `worrying_disclosure` for their cohort, only when no teacher is assigned, plus the session id | Replay bodies, learning profiles, every other row |

### 2.2 Content entities (ENT-02)

**`question`** (one immutable row per `(question_id, version)`) (T1)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `question_id` | text | slug. Unique with `version` |
| `version` | int ≥ 1 | An edit creates a new version that needs a new approval |
| `validation_status` | enum `pending`, `approved`, `rejected` [D-11] | Only `approved` is servable. Set to `approved` only by a content reviewer, and only after the offline validation pipeline has passed |
| `publication_status` | enum `draft`, `published`, `deprecated` [D-11] | Only `published` is servable |
| `flagged` | boolean | A flagged item is not served until a content reviewer resolves the flag |
| `curriculum` | object | `jurisdiction`, `year_level`, `topic`, `subtopic`, `curriculum_code`, `foundation_curriculum_code`. A ratio item carries the Year 7 ratio code in `curriculum_code` and the Year 6 foundation code in `foundation_curriculum_code`. `VC2M6N07` SHALL NOT be a ratio item's primary code |
| `skill_id`, `subskill` | text | `skill_id` is a node of the skill graph |
| `learning_objective` | text | Used for transfer legality |
| `difficulty` | object | `band`, `estimated_difficulty`, `reasoning_depth` |
| `title` | text | Short display title shown in the question list and in the tutor's session list [D-10]. Contains no answer value |
| `problem_type`, `stem` | text | |
| `accepted_answer_spec` | object | `type` (`numeric`, `ratio`, `fraction`, `percentage`), `canonical_value`, `unit`, `tolerance`, `accepted_forms[]`, `valid_alternatives[]`. Also carries `answer_requires_unit` and the rounding rule |
| `solution_steps` | list, 2–4 entries (V1) | each `{step_id, description, target_expression, target_value, unit, permitted_scaffold_step?}`. The final step has no `permitted_scaffold_step` |
| `alternate_solution_paths` | list | each `{path_id, steps[]}`. Every path reaches `accepted_answer_spec` (V7) |
| `method_leak_patterns` | object | `operations[]`, `step_phrases[]`, `blocked_below_level`. Non-empty with at least one operation word and one step phrase (V6) |
| `scaffold_probes` | list, at most 4 (V5) | each `{probe_id, kind: value | setup, min_level, template, expected_expression, expected_value, unit, counts_as_step_id}` |
| `misconception_predictions` | list | each `{predicted_response, misconception_code, confidence=0.90, rationale}`. No collisions (V3) |
| `isomorphic_worked_example` | object | `{stem, solution_steps[], final_answer}`. Different numbers, same skill. Used for withheld Level 5 |
| `reasoning_options` | list | each `{option_id, label}` plus metadata mapping to either a `misconception_code` or a `step_id` [D-01, D-10]. Only `{option_id, label}` is exposed to the browser |
| `misconception_tags` | list of taxonomy codes | |
| `reflection` | object | `{prompt_template, options[3..4]}`, option `{option_id, label, sound, feedback}`. Rule V9 |
| `socratic_prompt_set_id` | text | |
| `has_diagram`, `diagram_id` | boolean, text nullable | |

Question validation rules V1–V9 and C1–C4 are in §2.10.

**Authored content derived from the question**

- *Level 4 content* is a main-path `permitted_scaffold_step`. *Level 5 content* is `permitted_solution`, the ordered main-path steps. Both are copied into session state by the hint policy only.
- A `kind: value` probe asks for a value. A `kind: setup` probe asks for an expression equal to the `target_expression` of its `counts_as_step_id`. Its `expected_value` is a check value and is never shown.
- Authored `target_expression` and `expected_expression` values MAY use `/`, `*`, `÷` and `×` interchangeably and are normalised to the same operators on load.

**`diagram_asset`** (T1 ratio table, T2 bar model and wider set)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `diagram_id` | text | PK with `version` |
| `question_id`, `question_version` | text, int | |
| `spec` | json | structured diagram specification |
| `variants` | list [D-10, D-17] | one per leakage band: `below_4`, `level_4`, `level_5`. Each `{blob_key, sha256, validated_at, validation_result, alt_text, description, min_level}` |
| `approval_status` | enum `pending`, `approved`, `rejected` | Set by a content reviewer |
| `version`, `content_hash` | int, text | Stored for every served diagram |

A served diagram SHALL have a stored validation result, version and content hash.

**`misconception_exemplar`** (T1b): `id`, `skill_id`, `code` (taxonomy enum), `feature_template` (numbers only: `error_category`, canonical value, `relation_tags`), `embedding vector(768)` (Decision #28), `approval_status`, `taxonomy_version`. Every one of the 12 taxonomy codes has at least one exemplar. Only approved, published exemplars are retrievable.

**`question_embedding`** (T1b): `(question_id, version)`, `embedding vector(768)`. Written at import (Decision #29). Every vector query SHALL join to `validation_status=approved` and `publication_status=published`.

**Skill and misconception graph** (T1)

| Table | Attributes |
| --- | --- |
| `graph_node` | `id`, `kind` (`skill`, `misconception`, `question`), `ref` (skill id, taxonomy code, or `(question_id, version)` of an approved version) |
| `graph_edge` | `from_id`, `to_id`, `kind` (`prerequisite`, `indicates`, `remediates`). `prerequisite`: skill A before skill B. `indicates`: a question's error pattern indicates a misconception. `remediates`: an approved question set is the next practice for a misconception |

**Misconception taxonomy** (closed enum, 13 values): `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, `answer_guessing`, `insufficient_evidence`. The last is never shown to a student. The 12 non-sentinel codes are grouped in 4 calibration clusters (PRD §14.5).

**Authored text registry** (`content/safety/canned_responses.json`, T1): each key maps to `{text, status: draft | reviewed, reviewed_by?, reviewed_on?}`. Required keys (28): `level0_prompt`; `fallback_l0`, `fallback_l1`, `fallback_l2`, `fallback_l3`, `fallback_l4`; `rephrase_request`, `use_dot_for_decimals`, `enter_the_number`, `structured_mode_notice`; `tool_failure_notice`, `save_failed_notice`, `rate_limited_notice`; `note_ack`; `answer_request_reply`, `abuse_reply`, `assessment_help_reply`, `impersonation_reply`, `worrying_disclosure_reply`, `injection_phrase_reply`; `encouragement`; `support_withheld_notice`; `turn_cap_notice`; `transfer_offer`, `transfer_declined_ack`, `transfer_stuck_notice`, `no_legal_transfer_notice`, `session_closed_notice`.

Companion content files: `content/safety/input_lexicon.json` (categories `answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase`) and `content/safety/jargon.json` (glossary and jargon terms for the `age_appropriate` check).

### 2.3 Session and turn entities (ENT-03)

**`tutoring_session`** (T1)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id` | uuid | PK |
| `student_id`, `cohort_id` | uuid | `cohort_id` [D-10] |
| `question_id`, `question_version` | text, int | The version is pinned for the life of the session |
| `session_kind` | enum `original`, `transfer` [D-10] | |
| `linked_session_id` | uuid nullable | On an original session: its transfer session. On a transfer session: its original. Set at transfer acceptance (R1) |
| `state` | enum, see SM-1 | |
| `current_hint_level` | int 0–5 | Levels 0–4 are reached by transitions. 5 is set only on the Level 5 solution turn |
| `attempt_count` | int ≥ 0 | Number of *counted* attempts |
| `turn_number` | int ≥ 0 | Pipeline turns used. Cap 12 per session |
| `input_mode` | enum `keypad`, `structured` | Switches to `structured` on the second consecutive `cannot_verify` |
| `active_probe_id` | text nullable | Written by the hint policy. Cleared when answered or superseded |
| `asked_probe_ids` | set of text | Probes already asked in this session |
| `matched_step_ids` | set of text | Steps already matched in this session (drives advancing versus stalled) |
| `consecutive_cannot_verify` | int | Reset by any other outcome on the same question version |
| `transfer_outcome` | enum `correct`, `incorrect`, `skipped`, null | Null until known. See D-04 |
| `end_reason` | enum `completed`, `declined`, `abandoned`, `stuck`, `no_legal_transfer`, `stuck_after_transfer`, `turn_cap_reached`, null | |
| `created_at`, `updated_at`, `last_activity_at`, `ended_at` | timestamptz | `last_activity_at` drives the 30-minute rule |
| `summary` | json nullable | Written on entering a terminal state: verifier outcomes, hint levels, transfer result |

**`session_flag`**: `(id, session_id, kind, created_at)`, `kind` in `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached`. Unique on `(session_id, kind)` [D-10]. Not the EDU-01 review flag.

**`attempt`** (T1)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id`, `student_id`, `session_id`, `question_id` | uuid, uuid, uuid, text | |
| `created_at` | timestamptz | The attempt timestamp |
| `attempt_number` | int | Ordinal among all attempt rows of the session [D-10] |
| `counted` | boolean | True only for the verifier outcomes marked "counts" in the §4 table WF-08 |
| `response_type` | enum `final_answer`, `probe_answer`, `step`, `reasoning_option`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision` | |
| `response_value` | text nullable | Scrubbed. Purgeable |
| `response_target` | enum `final`, `step`, `probe`, null | Null for answerless events |
| `selected_reasoning_option` | text nullable | An `option_id` of the item |
| `step_expressions` | text[] nullable, length ≤ 1 [D-02] | Purgeable |
| `free_text` | text nullable | Purgeable. Not populated by any Release 1.0 event (R2) |
| `response_duration_ms` | int ≥ 0 nullable | |
| `confidence_rating` | int nullable | Optional. Provisional range 1–5 [D-13] |
| `hint_level_at_submission` | int 0–5 | |

**`tutor_turn`** (T1). Columns exactly as PRD §10.7:

| Attribute | Type / values |
| --- | --- |
| `id`, `session_id`, `turn_number` | uuid, uuid, int |
| `event` | `submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision` |
| `kind` | `model`, `probe_template`, `authored`, `canned`, `fallback`, `solution` |
| `hint_level` | int 0–5, null in `reflection` |
| `prompt_type` | `targeted_scaffold`, `diagnostic_probe`, `reflection`, null |
| `tone`, `active_probe_id` | text, text |
| `verifier_result` | json: the pure result plus the overlay outcome |
| `misconception`, `student_state` | json |
| `provider`, `model`, `model_version`, `temperature` | text, text, text, number |
| `prompt_version`, `policy_version`, `policy_config_version` | text |
| `fallback_reason` | `loop_exhausted`, `guard_unreachable`, `provider_error`, `schema_invalid`, `budget`, null |
| `trace_id`, `trace_status`, `cache_status` | text, `ok` or `missing`, `hit` or `miss` or `skipped` |
| `body` | text nullable. The tutor text. Null after purge |
| `created_at` | timestamptz |

A `tutor_turn` additionally stores the tool results and the Langfuse trace id (ADM-05). A reflection or transfer-offer turn has `hint_level` null and `prompt_type=reflection` or null.

**`student_note`** (T1): `id`, `session_id`, `student_id`, `state_at_save`, `input_screen_category` (nullable), `body` (scrubbed, null after purge), `created_at`.

**`idempotency_key`** (T1): `key` (uuid), `session_id`, `request_hash` (SHA-256 of the canonical request body), `status` (`in_progress`, `done`), `response` (json), `created_at`, `expires_at` (`created_at` + 24 h).

**`reflection_choice`** is stored on the attempt (`response_type=reflection_choice`, `selected_reasoning_option` unused) with the chosen `option_id` and the option's `sound` flag. The `sound` flag is visible to teachers only.

**`misconception_event`** (T1)

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id`, `session_id`, `turn_id`, `student_id`, `skill_id` | | |
| `code` | taxonomy enum | |
| `confidence` | number 0–1 nullable | `0.90` for `deterministic_match` (a provisional authored prior). Null allowed for `insufficient_evidence` |
| `source` | enum `deterministic_match`, `classifier`, `none` | |
| `evidence` | text | Supporting evidence |
| `alternative_labels` | list of taxonomy codes | |
| `cited_exemplar_ids` | list | Empty with `retrieval_used=false` or `exemplars_used=none` |
| `recommended_prompt_type` | enum `targeted_scaffold`, `diagnostic_probe` | |
| `reviewer_status` | enum `unreviewed`, `confirmed`, `rejected` | Starts `unreviewed`. Set only by the assigned teacher. Not shown to the student |

### 2.4 Verification, policy and agent data contracts (ENT-04)

**`PureVerifierResult`** (MCP return shape, cache value, one shared Pydantic model; T1). It depends only on input, question version and tolerance rule, never on the session.

| Field | Type | Rule |
| --- | --- | --- |
| `schema_version` | text | `"1.0"` |
| `status` | enum `correct`, `incorrect`, `partially_correct`, `cannot_verify` | The verdict. `tool_failure` is not a status value |
| `state` | enum `ok`, `tool_failure` | Whether the tool ran |
| `confidence` | number | |
| `input_kind` | enum `value`, `ratio`, `expression`, `unparsed` | |
| `canonical_value` | text nullable | Exact decimal string from SymPy rational arithmetic. Null when `unparsed`. For an `expression` it is the evaluated value, used only to classify the error |
| `unit` | text nullable | |
| `canonical_expression` | text nullable | Normalised expression for an `expression` input, otherwise null |
| `matched_solution_step` | text nullable | Set by the pure verifier only for an `expression` that matches a step by form |
| `path_id` | text nullable | `primary` or an alternate path id |
| `matched_step_ids` | list | Every step on any path whose `target_value` equals `canonical_value` (value input) or whose `target_expression` matches by form (expression input). Empty when none |
| `error_category` | enum `none`, `arithmetic`, `unit_error`, `missing_unit`, `incomplete`, `additive_difference_match`, `reversed_ratio_match`, `inverse_operation_match`, `unknown_numeric_discrepancy` | Closed. One Pydantic `Literal` shared by verifier, cache and tests |
| `relation_tags` | list of enum `none`, `sum_of_givens`, `difference_of_givens`, `swapped_ratio`, `inverse_of_answer`, `wrong_unit_scale` | Derived one-to-one from `error_category`, see below |
| `accepted_answer` | boolean | True only for a full accepted answer |
| `explanation_constraints` | list of text | For example "Do not reveal final answer at current hint level" |

`relation_tags` derivation: `additive_difference_match` → `sum_of_givens` or `difference_of_givens` (whichever the value equals); `reversed_ratio_match` → `swapped_ratio`; `inverse_operation_match` → `inverse_of_answer`; `unit_error` → `wrong_unit_scale`; every other category → `none`.

`error_category` → candidate taxonomy code: `additive_difference_match` → `ratio_additive_interpretation`; `reversed_ratio_match` → `ratio_reversal`; `inverse_operation_match` → `scale_direction_error`; `unit_error` → `unit_conversion_error`; `arithmetic` → `arithmetic_error_after_correct_setup`; `missing_unit`, `incomplete` → none (shape the hint prompt only); `unknown_numeric_discrepancy` → `insufficient_evidence`. A candidate is a hypothesis for the classifier and never a verdict. Only the `misconception_predictions` matcher may set a code without the classifier. Content validation rejects a category not in this table.

**Pure `status` by input** (complete; no developer choice)

| Input | `status` | Other fields |
| --- | --- | --- |
| `value` or `ratio` equal to the accepted answer under tolerance, unit and rounding rules | `correct` | `accepted_answer=true`, `error_category=none` |
| Accepted value, required unit missing | `incorrect` | `error_category=missing_unit` |
| Accepted value with a wrong unit, or valid setup with a wrong conversion | `incorrect` | `error_category=unit_error` |
| `value` or `ratio` not equal to the accepted answer | `incorrect` | Category and tags per the mappings above, `unknown_numeric_discrepancy` when none applies. `matched_step_ids` lists every step with an equal `target_value`. `matched_solution_step=null`. A ratio equal to the accepted ratio is `correct`. Its swapped form is `incorrect` with `reversed_ratio_match` and `swapped_ratio` |
| `expression` matching a step by form | `partially_correct` | `matched_solution_step` and `path_id` set, `accepted_answer=false` |
| `expression` matching no step | `cannot_verify` | `canonical_value`, `error_category`, `relation_tags` computed from the evaluated value |
| `unparsed` | `cannot_verify` | `canonical_value=null`, `error_category=incomplete` |
| Tool timeout or MCP error | `cannot_verify`, `state=tool_failure` | All other fields null |

An expression matches a step by form when it has the same operator and the same operands as the step's `target_expression`. Operands of `+` and `×` match in either order. Operands of `−` and `÷` match in order only. An expression is never evaluated into a final answer, so `7.5 × 4` is never `correct`.

**`VerifierOutcome`** (post-overlay, stored on `tutor_turn.verifier_result`): the `PureVerifierResult` plus `response_target`, `overlay_applied` (boolean), `status_post_overlay`, `matched_solution_step_post_overlay`, and `progress` (`advancing`, `stalled`, null). `progress` is written only by the hint policy.

**`StudentState`** (deterministic, T1; no model, no free text, no accepted answer): `repeated_wrong_value` (boolean), `consecutive_unsuccessful` (int ≥ 0), `previous_progress` (`advancing`, `stalled`, `none`). Computed from this session's prior persisted results and stored on every tutoring turn.

**`HintDecision`** (written by the hint policy engine)

| Field | Type | Rule |
| --- | --- | --- |
| `schema_version` | text | |
| `level` | int 0–5 or null | Null in `reflection` |
| `level_changed` | boolean | |
| `prompt_type` | `targeted_scaffold`, `diagnostic_probe`, `reflection`, null | See the prompt-type rule in WF-07 |
| `tone` | text from a closed set in the policy config | Derived from `StudentState`. Value set not defined in the PRD (open value) |
| `active_probe_id` | text nullable | |
| `permitted_scaffold_step` | text nullable | Level 4 only |
| `permitted_solution` | list nullable | Level 5 only |
| `isomorphic_example` | object nullable | Withheld Level 5 only |
| `progress` | `advancing`, `stalled`, null | |
| `counted` | boolean | Whether the attempt counts toward the Level 5 minimum |
| `misconception_code`, `code_source` | taxonomy code, `deterministic_match`, `classifier`, `none` | |
| `support_withheld` | boolean | |
| `turn_kind` | `model`, `probe_template`, `authored`, `canned`, `fallback`, `solution` | |

**`SocraticDialogueOutput`** (LlmAgent, `output_schema`; T1)

```json
{
  "schema_version": "1.0",
  "action": "ask_socratic_question",
  "hint_level": 2,
  "message": "string, under 100 tokens, one question or one imperative",
  "expected_response_types": ["numeric_expression", "free_text_explanation"],
  "target_skill": "ratio.unitising",
  "target_misconception": "whole_to_part_confusion",
  "answer_reveal_risk": "low",
  "requires_safety_review": false
}
```

Constraints: `hint_level` equals `HintDecision.level`. `message` has one question mark, or one sentence whose first word is `try`, `look`, `find`, `compare`, `write` or `check`, and not a second of either. No sentence exceeds 25 words. No taxonomy code or glossary phrase appears.

**`MisconceptionClassifierOutput`** (LlmAgent, `output_schema`; T1)

```json
{
  "schema_version": "1.0",
  "code": "<taxonomy enum>",
  "confidence": 0.0,
  "evidence": "string",
  "alternative_labels": ["<taxonomy enum>"],
  "recommended_prompt_type": "targeted_scaffold | diagnostic_probe",
  "cited_exemplar_ids": ["uuid"],
  "exemplars_used": "some | none"
}
```

**`SafetyVerdict`** [D-06]: `{schema_version, verdict: allow | block | revise | escalate, reason_code?, request_id}`.

**`TeacherInsightDraft`** [D-10] (LlmAgent, cron-driven; T1c on demand, T2 daily): `{schema_version, recommendation, reason, evidence[], confidence, limitations, suggested_action}` with the seven-part template of PRD §13.2. Evidence entries reference source event ids.

Agent context isolation (what each LLM agent MAY read; PRD §9.7)

| Agent | May read | Must not read |
| --- | --- | --- |
| `MisconceptionClassifierAgent` | Verifier status, error category, canonical numeric value with relation tags, retrieved exemplars | Accepted answer value, the tutor draft |
| `SocraticDialogueAgent` | `HintDecision` including `tone`, the selected probe template, misconception code, one question stem | The retrieval corpus, any safety verdict beyond "revise" |
| `TeacherInsightAgent` | Aggregated events of the cohort being drafted | Live state of an in-progress turn |

### 2.5 Learner model (ENT-05)

**`learner_skill_state`** (T1 turn-time fields, T2 aggregates). Key `(student_id, skill_id)`.

| Attribute | Type | Update path |
| --- | --- | --- |
| `mastery_estimate` | number 0–1 | On turn persistence (STU-16). Initial `0.0` [D-15] |
| `mastery_confidence` | number 0–1 | On turn persistence. Initial `0.0` |
| `recent_accuracy`, `median_response_seconds`, `attempt_count`, `independent_success_rate`, `hint_dependency_profile`, `misconception_distribution`, `transfer_success_rate` | | `learner-rollup` (hourly) |
| `recommended_next_skill` | text | Practice Planner along the skill graph |
| `last_updated_at`, `rollup_at` | timestamptz | `rollup_at` is shown on the student dashboard |

**Mastery rules** (Decision #21, STU-16)

| Condition when the turn is persisted | Effect |
| --- | --- |
| Counted success at hint level 0 | `mastery_estimate` + 0.15, cap 1.0 |
| Counted success only after hint level 1, 2 or 3 | `mastery_estimate` + 0.05, cap 1.0 |
| Completion only at hint level 4 or 5 | No increase |
| Successful transfer | `mastery_confidence` + 0.20, cap 1.0. Without a successful transfer, confidence is never increased |
| Conflict: among the last 3 counted attempts on the skill, at least one `correct` and at least one `incorrect` or `partially_correct` | `mastery_confidence` − 0.10, floor 0 |

Mastery deltas apply to a counted success on the original or the transfer item [D-15]. A skipped, declined or abandoned transfer does not raise confidence. The write is made in the same transaction that persists the turn, and the next practice selection reads it.

### 2.6 Educator and review entities (ENT-06)

**`recommendation`** (T1c one pending draft on demand, T2 full lifecycle) [D-10 for attributes beyond PRD §13.2]

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id`, `cohort_id`, `student_id` nullable | uuid | Cohort-level or student-level |
| `recommendation`, `reason`, `limitations`, `suggested_action` | text | Template of PRD §13.2 |
| `evidence` | list of `{event_ref, description}` | Every teacher-facing claim links to source events (target ≥ 95%). Links respect role-based access |
| `confidence` | enum `low`, `moderate`, `high` [D-11] | A `low` item is labelled and not stated as fact |
| `review_status` | enum `pending`, `accepted`, `rejected`, `overridden` | Initial `pending`. See SM-2 |
| `decision`, `decision_rationale`, `decided_by`, `decided_at` | | Rationale required for `overridden`. Original text and evidence are never altered |
| `wording_check` | enum `passed`, `rejected` | A draft containing placement, grading, admissions, exclusion or remedial-classification wording is stored as `rejected` and is not visible to a teacher |
| `created_at` | timestamptz | |

**`teacher_comment`** (T2): `id`, `session_id`, `author_id`, `body` (null after purge), `created_at`. Retention 365 days.
**`tutor_note`** (T2): `id`, `session_id`, `author_id`, `body`, `created_at`. Free text, retention 365 days.
**`review_flag`** (EDU-01; computed, not persisted, T2): `{student_id, reasons[], evidence_refs[], relevant_attempt_count}`, `reasons` in `same_misconception_3x`, `high_hint_2_of_5`, `transfer_failed_twice` [D-11], or `not_enough_evidence`.
**`content_review_item`** (T2) [D-10]: `{id, target_kind: question | diagram, target_ref, reasons[], evidence, status: open | resolved, opened_at, decided_by, decision: approved | rejected | deprecated, decided_at}`. `reasons[]` draws from the eleven FR-14 reasons: `answer_key_inconsistency`, `verifier_failure`, `ambiguous_wording`, `unclear_diagram`, `excessive_confusion`, `unexpected_difficulty`, `non_functional_distractor`, `near_duplicate`, `wrong_curriculum_mapping`, `inappropriate_language`, `weak_explanation`.
**`intervention_export`** (T3) [D-10]: `{id, created_by, created_at, blob_key, scope}`. Labelled "AI draft needing human review". Never at a guessable public URL.

### 2.7 Operational entities (ENT-07)

**`audit_event`** (T1 slice, T3 viewer) [D-10 for column names]

| Attribute | Type | Constraint |
| --- | --- | --- |
| `id`, `created_at` | uuid, timestamptz | |
| `event_type` | enum | Authentication; record access; question selection; student attempt; verifier result; model call; tool call; generated prompt; hint decision; content flag; teacher review; override; export; error; safety incident; `allow_level_5` change; `trace_review` grant or revoke; other configuration change; plus the named events `auth_unknown_subject`, `transition_not_allowed`, `prompt_capture_violation`, `support_withheld`, `idempotency_conflict`, `access_denied` |
| `actor_user_id`, `subject_student_id`, `session_id` | uuid nullable | Pseudonymous ids |
| `status`, `hint_level`, `model_id`, `prompt_version`, `policy_version` | structured fields | |
| `hashes` | json | Hashes of bodies, never the bodies |
| `previous_value`, `new_value` | json nullable | Required for a configuration change |
| `request_id` | uuid | Correlates to the error payload |

An audit row SHALL NOT contain student free text, the full generated prompt or the raw model output. The application database role SHALL have no `UPDATE` or `DELETE` on this table, and triggers SHALL reject both. Feature code cannot skip the writer.

**`job_run`** (T2; `warmup` T1b) [D-09, D-10]: `{id, job_name, started_at, ended_at, status: running | succeeded | partial | failed, processed_count, remaining_count, error_summary}`.
**`cache_entry`** (T1b): `cache_kind` (`verifier_result`, `exemplar_query`, `prompt_template`), `cache_key` (SHA-256), `value_json`, `created_at`, `expires_at`, `hit_count`. Cache-key inputs and the exact-key rule are in §5.5.
**`rate_counter`** (T1) [D-10]: `(student_id, window_kind: hour | five_minutes, window_start)` → `count`. Fixed-window, in Postgres.
**`evaluation_case`**: `{id, category (one primary), secondary_labels[], critical (boolean), input, expected, notes}`, stored as versioned JSONL under `content/eval/` and mirrored to Langfuse datasets.
**`curriculum_chunk`** (optional): `embedding vector(768)`, only if needed for teacher-facing explanations.

### 2.8 State machines and lifecycles (SM)

#### SM-1 Tutoring session (T1)

The machine-readable source is `apps/api/app/fsm/transitions.yaml`, loaded at runtime and parity-checked against this table by `tests/fsm/test_table.py`. A (state, event) pair not listed is rejected with 409 `transition_not_allowed`, nothing changes and an audit event is written. Row numbers follow PRD §8.5.1.

States: `awaiting_first_attempt`, `active`, `reflection`, `transfer_offered`, `transfer_active`, and the terminal states `completed`, `declined`, `stuck`, `abandoned`.

| # | From | Event (and guard) | To | Effect |
| --- | --- | --- | --- | --- |
| 1 | — | Student opens a published item | `awaiting_first_attempt` | Canned `level0_prompt`. No hint |
| 2 | `awaiting_first_attempt` | First submission, or `not_sure` | `active` | Pipeline turn (WF-03) |
| 3 | `active` | Verifier `correct` on the final answer | `reflection` | Mastery delta written. Authored reflection prompt shown. No model, verifier or retrieval |
| 4 | `active`, `transfer_active` | Verifier not `correct` | same | Hint policy per WF-08 |
| 5 | `active`, `transfer_active` | `cannot_verify` with `state=ok`, first time | same | Canned `rephrase_request` (or `use_dot_for_decimals`, `enter_the_number`). No counters change. Not a pipeline turn |
| 6 | `active`, `transfer_active` | `cannot_verify` with `state=ok`, second in a row | same | `input_mode=structured`, canned `structured_mode_notice`, flag `ambiguity_review`. Counts as a pipeline turn. No level change, not counted |
| 7 | `active`, `transfer_active` | `state=tool_failure` | same | Canned `tool_failure_notice`. No counters change. Not a pipeline turn |
| 8 | any state | Input Screen hit | same | Canned reply. Not a pipeline turn. No counter or level change |
| 9 | `active` | `show_solution` with all four Level 5 conditions true | `transfer_offered` | Deterministic worked solution plus canned `transfer_offer`, `kind=solution` |
| 10 | `active` | `show_solution`, `allow_level_5` false, other conditions true | same | Isomorphic example plus canned `support_withheld_notice`, `kind=authored`, flag `support_withheld`, item answer not shown |
| 11 | `active` | `show_solution`, any other condition unmet | same | Next unused probe at the current level (paraphrased through the loop), or canned `encouragement`. Level unchanged. Request audited |
| 12 | `active`, `transfer_active` | Safety loop exhausted or guard unreachable | same | `fallback_l{level}`, flag `safety_fallback` |
| 13 | `reflection` | Reflection option or Skip, and the graph has a legal partner | `transfer_offered` | Choice and `sound` flag recorded. The option's authored `feedback` shown, then canned `transfer_offer` |
| 14 | `reflection` | Same, and no legal partner | `completed` | `end_reason=no_legal_transfer`, canned `no_legal_transfer_notice` |
| 15 | `transfer_offered` | Student accepts | `completed` (original) | **Amended by R1.** Create the linked transfer session in `transfer_active`. Set `linked_session_id` on both. No hint before the first independent attempt. A worked solution is never offered |
| 16 | `transfer_offered` | Student declines | `declined` | `transfer_outcome=skipped`. Confidence not raised. Canned `transfer_declined_ack` |
| 17 | `transfer_active` | Verifier `correct` | `completed` | Confidence delta written. `transfer_outcome=correct` on both sessions |
| 18 | `transfer_active` | Level 4, 3 or more counted attempts, latest `incorrect` or `partially_correct` | `completed` | Flag `stuck_after_transfer`. Canned `transfer_stuck_notice`. No worked solution. `transfer_outcome=incorrect` [D-04] |
| 19 | `active`, `transfer_active` | The 12th pipeline turn without a `correct` | `stuck` | Flag `turn_cap_reached`. Canned `turn_cap_notice`. Question saved for the teacher. Another approved item offered. No worked solution |
| 20 | any non-terminal state | 30 minutes with no request | `abandoned` | Summary written. A return starts a new session. A transfer session sets `transfer_outcome=skipped` [D-04] |
| 21 | any state | A note with no Input Screen hit | same | `student_note` stored, canned `note_ack`. Not a pipeline turn |
| 22 | `active`, `transfer_active` | `not_sure` | same | Level + 1, never above 4. Attempt stored as `not_sure`, not counted. No verifier, matcher, retrieval or classifier. Counts toward the turn cap |

Rules that apply across rows:

- A transfer session starts in `transfer_active`, so row 2 applies to the first item only. A correct answer in `transfer_active` is row 17, never row 3. Rows 9–11 do not apply to `transfer_active`. If `show_solution` arrives there it is rejected with 409 and audited.
- Rows 5, 7, 8 and 21 are not pipeline turns for the cap. Rows 4, 6, 9, 10, 11 and 22 are. A first rephrase request does not count.
- `completed`, `declined`, `stuck` and `abandoned` are terminal. A summary is written on entry to any of them. After row 15, the original session's `transfer_outcome` is back-filled when the linked session reaches a terminal state [D-04]. That back-fill is the only permitted write to a terminal session.
- Session resume: within the 30-minute window the same question, attempts and level are restored. After `abandoned` a new session starts. `abandoned` is applied lazily when the session is next read or written, with `ended_at = last_activity_at + 30 minutes` [D-12].
- Controls by state (the client renders exactly these, and `tutor.controls` is the source):

| State | Controls |
| --- | --- |
| `awaiting_first_attempt` | `answer`, `steps`, `options`, `not_sure`, `note`. No `show_solution` |
| `active` | `answer`, `steps`, `options`, `not_sure`, `show_solution`, `note` |
| `reflection` | Reflection choices and Skip, `note` |
| `transfer_offered` | Accept, Decline, `note` |
| `transfer_active` | `answer`, `steps`, `options`, `not_sure`, `note`. No `show_solution` |
| Terminal | Read-only summary, "Next question", `note` |

#### SM-2 Recommendation (T2)

`pending` → `accepted` | `rejected` | `overridden`. Terminal after one decision. A decision requires the assigned teacher role. `overridden` requires a rationale. An identical second decision returns the stored result. A different second decision is denied with 409 `transition_not_allowed` [D-16] and the first decision stands. Every decision writes an audit event with who, when and what. A tutor, coordinator, administrator or unassigned teacher is denied and the status stays `pending`.

#### SM-3 Question publication (T1 serve filter and import, T2 review workflow)

```text
imported (validation_status=pending, publication_status=draft)
  --offline validation V1–V9 passes--> reviewable
  --content reviewer approves--> validation_status=approved
  --publish--> publication_status=published   (servable only when also flagged=false and scope enabled)
published --flag raised--> flagged=true   (not served)
flagged --content reviewer approves--> flagged=false
any --content reviewer rejects--> validation_status=rejected
published --content reviewer deprecates--> publication_status=deprecated   (terminal)
any edit --> new version in imported state (a new approval is required)
```

A content reviewer SHALL NOT be able to mark an item approved if offline validation has not passed. Every publication-status change is audited.

#### SM-4 Diagram asset

`pending` → `approved` | `rejected` by a content reviewer. A diagram that fails validation, or has no approved variant for the requested level, causes the question to be withheld and flagged. An unvalidated image is never served.

#### SM-5 Content review item

`open` → `resolved` with a decision `approved`, `rejected` or `deprecated`. Teachers read an open item and cannot decide it. While an item is flagged it is not served.

#### SM-6 Idempotency key

`in_progress` → `done`. A repeat with the same key and body while `in_progress` returns 409 `request_in_progress`. After `done` it returns the stored response. Records expire 24 h after creation.

#### SM-7 Job run

`running` → `succeeded` | `partial` | `failed` [D-09]. `partial` means a bounded batch finished and work remains for the next invocation. `failed` raises a Langfuse score or a log alert visible to administrators.

#### SM-8 Misconception review

`unreviewed` → `confirmed` | `rejected`. Set only by the assigned teacher. Not visible to the student.

### 2.9 Consolidated enumerations

| Enum | Values |
| --- | --- |
| Role | `student`, `parent`, `tutor`, `teacher`, `academic_coordinator`, `content_reviewer`, `administrator` |
| Grant | `trace_review` |
| Session state | `awaiting_first_attempt`, `active`, `reflection`, `transfer_offered`, `transfer_active`, `completed`, `declined`, `stuck`, `abandoned` |
| Session flag | `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached` |
| Event | `submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision`, `note` |
| Response type | `final_answer`, `probe_answer`, `step`, `reasoning_option`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision` |
| Response target | `final`, `step`, `probe` |
| Verifier status | `correct`, `incorrect`, `partially_correct`, `cannot_verify` |
| Verifier state | `ok`, `tool_failure` |
| Input kind | `value`, `ratio`, `expression`, `unparsed` |
| Turn kind | `model`, `probe_template`, `authored`, `canned`, `fallback`, `solution` |
| Fallback reason | `loop_exhausted`, `guard_unreachable`, `provider_error`, `schema_invalid`, `budget` |
| Prompt type | `targeted_scaffold`, `diagnostic_probe`, `reflection` |
| Trace status | `ok`, `missing` |
| Safety verdict | `allow`, `block`, `revise`, `escalate` |
| Input Screen category | `answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase` |
| Cache kind | `verifier_result`, `exemplar_query`, `prompt_template` |
| Job name | `warmup`, `learner-rollup`, `embedding-sync`, `insight-drafts`, `item-quality-scan`, `retention-purge`, `eval-nightly` |
| Graph edge | `prerequisite`, `indicates`, `remediates` |

### 2.10 Validation rules

**Content validation (import pipeline, TECH-07).** The import rejects an item that breaks any rule.

| Rule | Check |
| --- | --- |
| V1 | 2 to 4 main-path `solution_steps`. The final step has no `permitted_scaffold_step` |
| V2 | No `permitted_scaffold_step`, probe `template`, other item's `isomorphic_worked_example` or diagram label contains an accepted value (any `accepted_forms`, word numeral or unit expansion) as a literal after normalisation. An expression such as `7.5 × 4` is allowed only inside a `permitted_scaffold_step` |
| V3 | No `predicted_response` equals another prediction, a step `target_value`, a probe `expected_value`, an `accepted_forms` entry or an alternate-path value. No two distinct codes predict the same number on one question |
| V4 | The accepted canonical value has at least two digits, or the item sets `answer_requires_unit: true` |
| V5 | At most 4 probes. A `kind: value` probe evaluates to its `expected_value` and does not equal the final answer. A `kind: setup` probe's `expected_expression` equals the `target_expression` of its `counts_as_step_id` |
| V6 | `method_leak_patterns` is non-empty with at least one operation word and one step phrase |
| V7 | Every alternate path reaches `accepted_answer_spec` |
| V8 | Every approved item has a legal transfer partner (same learning objective, different accepted value, only skills in the cohort starting set) |
| V9 | `reflection` has a `prompt_template` with at most one question and exactly one `{student_value}` placeholder, and 3 or 4 options with at least one `sound: true`. Each option's `label` and `feedback` pass `age_appropriate`, contain no taxonomy code and have at most one question |
| C1 | `canned_responses.json` has all 28 keys, each with `text` and `status`. A `reviewed` entry has `reviewed_by` and `reviewed_on` |
| C2 | Each canned text has sentences of at most 25 words, at most one question mark, no digits, and no taxonomy code or jargon term |
| C3 | Each `fallback_l{n}` text is exactly one question or one imperative sentence and gives no mathematics |
| C4 | Release check (`pytest -m release`, run at the Gate B tag only): every key is `reviewed` |

Bank readiness (ADM-04, ADM-12): at least 10 approved items for Release 1.0, 40 for Release 1.1, each passing V1–V9, with a diagram specification for every diagram item, an exemplar for each of the 12 taxonomy codes, and a skill-graph edge that gives each item a legal transfer partner.

**Attempt input validation**

| Input kind | Accepted forms | Rejected as `cannot_verify` (never "incorrect") |
| --- | --- | --- |
| Answer field | One number, fraction, decimal, percentage, ratio (`5:2` or `5 to 2`), or quantity with a unit. Word numerals (`four`) and unit suffixes are normalised | Surrounding words ("I think it is 11.5 km"), anything unparsable |
| Step and probe field | The above, plus one arithmetic expression (numerals and operators only) | Anything else |
| Number format | Dot decimals. A comma is a thousands separator only when the digits are 1–3 digits followed by groups of exactly 3 (`30,000`) | Any other comma (`7,5`, `1,50`). Reply `use_dot_for_decimals` |
| Operators | `×` and `÷` are always operators. `x` between two numerals is `×`. A `/` between two numbers is a fraction in the answer field and `÷` in a step or probe field, so `450/5` there is the expression `450 ÷ 5` | |

**Retention windows** (Decision #20; `RETENTION_POLICY_VERSION`)

| Data | Window | On expiry |
| --- | --- | --- |
| Chat logs (`tutor_turn.body`) | 90 days | Body set null. Row, verifier status, hint level, versions, timestamps kept |
| Attempts | 365 days | `response_value`, `step_expressions`, `free_text` deleted. Status, hint level, skill id, timestamps kept |
| Model traces | 90 days | Link replaced by an expiry notice |
| Student-specific diagram blobs | 90 days | Blob deleted |
| Tutor notes, teacher comments, student notes | 365 days | Body deleted, row kept |
| Audit rows, approved question diagrams | Never deleted | — |

---

## 3. Interface & API Specifications

### 3.1 Conventions

- Every route is under `/api`, uses JSON (`Content-Type: application/json`) except the diagram and progress routes, and requires a Clerk bearer token. Role, cohort and grants are read from Postgres (WF-01).
- The Pydantic v2 models in `apps/api/app/contracts.py` are the source. The OpenAPI document and web types are generated from them. Contract tests (TECH-56) fail on drift.
- Every response carries `X-Request-Id`. Every error uses the single payload below.
- Interfaces marked **[D]** are not defined in the PRD. Their paths and bodies are derived from the cited acceptance criteria (D-07, D-08, D-09).

**Single error payload** (every non-2xx response)

```json
{ "error": { "code": "transition_not_allowed", "message": "string", "retryable": false, "retry_after_s": null, "request_id": "uuid" } }
```

| HTTP | `code` | Meaning | Retryable |
| --- | --- | --- | --- |
| 400 | `invalid_request` | Schema or field-set violation, including a field not allowed for the event and a missing `Idempotency-Key` [D-03] | No |
| 401 | `unauthenticated` | No or invalid token | No |
| 403 | `forbidden` | Role or cohort scope. Unknown `sub`. Audited | No |
| 404 | `not_found` | Unknown session, a session of another student, a diagram that is not available, a question that is not servable | No |
| 409 | `transition_not_allowed` | The state machine does not allow the event, or a recommendation already has a different decision [D-16]. Audited | No |
| 409 | `idempotency_conflict` | Same key with a different body, or on a different session | No |
| 409 | `request_in_progress` | Same key still running. `retry_after_s=2` | Yes |
| 429 | `rate_limited` | Student rate cap. `retry_after_s` set. Tutor text is canned `rate_limited_notice` | Yes |
| 503 | `service_unavailable` | Postgres or authentication is unavailable | Yes |

A model, tool or guard failure is **never** an error response. It is a 200 with `tutor.kind=fallback` or `tool_failure_notice` (PRD §11.6).

### 3.2 Student session API (T1, defined in PRD §15.9)

| Method and path | Purpose | Request | Success |
| --- | --- | --- | --- |
| `POST /api/sessions` | Start a session | `{"question_id": "scale_0001"}` **or** `{"recommended": true}`. Exactly one | 201 `SessionView`. The first `tutor` is the canned `level0_prompt` |
| `GET /api/sessions/{id}` | Resume | — | 200 `SessionView` with the last tutor turn |
| `POST /api/sessions/{id}/events` | One student event | Header `Idempotency-Key: <uuid>` (required). Body `TurnRequest` | 200 `TurnResponse`. A replay adds header `Idempotent-Replay: true` |
| `GET /api/sessions/{id}/diagram` | SVG for the current level | — | 200 `image/svg+xml`, `Content-Security-Policy: default-src 'none'`, `Cache-Control: private` |
| `GET /api/sessions/{id}/progress` | Optional progress stream | — | 200 `text/event-stream`. Each event is `{"stage": "checking" | "preparing" | "done"}` and nothing else |

**`TurnRequest`**

```json
{
  "event": "submit | not_sure | show_solution | reflection_choice | transfer_decision | note",
  "response_target": "final | step | probe",
  "answer_text": "11.5 km",
  "step_expressions": ["7.5 × 4"],
  "selected_reasoning_option": "opt_additive",
  "confidence_rating": 3,
  "reflection_option_id": "refl_half | skip",
  "accept_transfer": true,
  "note_text": "free text for the teacher",
  "response_duration_ms": 8200
}
```

**Allowed fields by event** [D-03]. Any field outside the row returns 400 `invalid_request`.

| `event` | Required | Optional | Rules |
| --- | --- | --- | --- |
| `submit` | `response_target` when `answer_text` or `step_expressions` is present. At least one of `answer_text`, `step_expressions`, `selected_reasoning_option` | `confidence_rating`, `response_duration_ms` | `answer_text` and `step_expressions` are mutually exclusive. `response_target=step` iff `step_expressions` is present, otherwise `final` or `probe`. `step_expressions` has at most one element [D-02]. An option-only submit is an answerless pipeline turn [D-01] |
| `not_sure` | — | `response_duration_ms` | No value fields |
| `show_solution` | — | — | No other fields |
| `reflection_choice` | `reflection_option_id` (an `option_id` or `skip`) | — | |
| `transfer_decision` | `accept_transfer` (boolean) | — | |
| `note` | `note_text` | — | Valid in every state |

**Shared response shapes.** All text is plain text. The client escapes it and typesets numbers and operators itself.

```json
SessionState = {
  "id": "uuid", "state": "active", "question_id": "scale_0001", "question_version": 1,
  "hint_level": 2, "attempt_count": 3, "turn_number": 4, "turn_cap": 12,
  "input_mode": "keypad | structured", "flags": ["ambiguity_review"],
  "next_target": "final | probe"
}

TutorTurn = {
  "kind": "model | probe_template | authored | canned | fallback | solution",
  "text": "string",
  "diagram": { "alt_text": "string", "version": 1, "hash": "sha256:..." },
  "choices": [{ "id": "refl_half", "label": "string" }],
  "controls": ["answer", "steps", "options", "not_sure", "show_solution", "note"]
}

QuestionView = {
  "question_id": "scale_0001", "version": 1, "stem": "string",
  "answer_type": "numeric | ratio | fraction | percentage",
  "unit": "km", "answer_requires_unit": true,
  "reasoning_options": [{ "option_id": "opt_additive", "label": "string" }],
  "has_diagram": false
}

SessionView  = { "session": SessionState, "question": QuestionView, "tutor": TutorTurn, "linked_session_id": null }
TurnResponse = { "session": SessionState, "tutor": TutorTurn, "linked_session_id": null }
```

Rules for the shapes:

- `diagram` is present only when the current level allows one. `choices` is present only in `reflection`. `controls` is the SM-1 controls-by-state list. `next_target` is `probe` while `active_probe_id` is set, otherwise `final`.
- `answer_type` and `unit` come from `accepted_answer_spec`. `QuestionView` contains exactly the fields shown and never the accepted-answer spec, solution steps, probe expected values, predictions, leak patterns, reflection `sound` flags or the isomorphic example.
- A student response never contains the verifier verdict, a misconception code, a reflection option's `sound` flag or a solution value below Level 5.
- `tutor.text` may be an authored acknowledgement or feedback followed by the authored transfer offer.
- **Transfer acceptance** [D-04]: the `TurnResponse` has `session` = the original session (`completed`), `tutor` = the opening canned `level0_prompt` turn of the linked session, and `linked_session_id` set. The client then calls `GET /api/sessions/{linked_session_id}` for the `QuestionView`.
- **Diagram route:** returns the SVG variant validated for the session's current level (§2.2 `diagram_asset.variants`). It returns 404 `not_found` when the item has no diagram, the current level is below the diagram's `min_level` [D-17], or the session is not the caller's.
- **Progress stream:** carries only the three stage names. If unavailable, the client shows the timed wait messages of WF-03 step 14.

**Event-to-state validity.** `submit`, `not_sure`: `awaiting_first_attempt`, `active`, `transfer_active`. `show_solution`: `active` only. `reflection_choice`: `reflection` only. `transfer_decision`: `transfer_offered` only. `note`: every state. Any other combination returns 409 `transition_not_allowed`.

**Idempotency contract.**

| Case | Result |
| --- | --- |
| Same key and body, first completed | Stored response, header `Idempotent-Replay: true`. No second attempt, turn or counter change |
| Attempt row stored, turn not stored | The retry resumes the pipeline from that attempt and does not add a second attempt or increment `attempt_count` |
| Same key, different body hash | 409 `idempotency_conflict` |
| Same key on a different session | 409 `idempotency_conflict` |
| Same key while the first request runs | 409 `request_in_progress`, `retry_after_s=2` |
| Missing or non-UUID key | 400 `invalid_request` [D-03] |
| Record age over 24 h | Expired. The key may be reused |

### 3.3 Other student-facing operations (T1 list, T2 dashboard) [D-08]

| Method and path | Role | Purpose | Response |
| --- | --- | --- | --- |
| `GET /api/questions` | student | Published choices (STU-09) | `[{question_id, version, title, skill_id, difficulty_band}]`. Only approved, published, scope-enabled, unflagged items |
| `GET /api/me/dashboard` | student (T2) | FR-11 | `StudentDashboard`: `recent_sessions[]`, `current_skills[]`, `strengths[]`, `next_focus[]`, `independent_success_rate`, `hint_trend[]`, `transfer_results[]`, `next_practice`, `rollup_at`. Own data only. The text never contains "weak", "failing" or "low ability" and never compares with other students. No completed sessions: `empty_state` with a first published question |

### 3.4 Educator, coordinator, reviewer and administrator operations [D-08]

All operations require authentication and use the §3.1 error payload. Out-of-scope access returns 403 `forbidden` and is audited. Paths are derived. The role rules come from FR-01.

| ID | Method and path | Allowed (scope) | Request | Response | Specific errors | Tier |
| --- | --- | --- | --- | --- | --- | --- |
| OP-01 | `GET /api/teacher/review-list` | teacher (assigned students) | — | `[ReviewListRow]`: `student_ref`, `status` (`flagged` or `not_enough_evidence`), `reasons[]`, `evidence_refs[]`, `relevant_attempt_count`. Computed from persisted attempts at request time | — | T2 |
| OP-02 | `GET /api/teacher/students/{student_id}/profile` | teacher (assigned) | — | `LearningProfile`: skill mastery, hint dependency, transfer results, recent sessions, each claim with `evidence_refs[]` | 403 if unassigned | T2 |
| OP-03 | `GET /api/teacher/cohorts/{cohort_id}/misconceptions` | teacher (assigned) | — | `[{code, count, confidence, evidence_limited}]`. A code from `deterministic_match` is labelled "authored prior, unvalidated" with no percentage | 403 | T2 |
| OP-04 | `GET /api/teacher/cohorts/{cohort_id}/groups` | teacher (assigned) | — | `[{skill_id, misconception_code, student_count, attempt_count, confidence, evidence_limited}]`. Recomputed by job, not per request | 403 | T2 |
| OP-05 | `GET /api/teacher/sessions/{session_id}/replay` | assigned teacher; administrator holding `trace_review` | — | `Replay` (below) | 403 for a tutor, coordinator, unassigned teacher, or administrator without the grant. Logged | T1c minimal, T2 full |
| OP-06 | `PUT /api/teacher/sessions/{session_id}/turns/{turn_id}/misconception-review` | assigned teacher | `{status: "confirmed" | "rejected"}` | `misconception_event` | 403 | T2 |
| OP-07 | `POST /api/teacher/sessions/{session_id}/comments` | assigned teacher | `{body}` | `teacher_comment` | 403. Audited | T2 |
| OP-08 | `GET /api/session-flags` | teacher (assigned students); cohort support contact (only `safety_fallback` and `worrying_disclosure`, only if the cohort has no teacher); `trace_review` administrator (the safety list, only if the cohort has no teacher and no support contact) | optional `session_id` | `[{session_id, kind, created_at}]` | 403 for anyone else | T2 |
| OP-09 | `GET /api/teacher/recommendations` and `GET /api/teacher/recommendations/{id}` | teacher (assigned) | optional `status` | `Recommendation` (rejected-by-wording-check drafts are never returned) | 403 | T2 |
| OP-10 | `POST /api/teacher/recommendations/{id}/decision` | assigned teacher | `{decision: "accept" | "reject" | "override", rationale?}`. `rationale` required for `override` | `Recommendation` with the stored decision | 400 (override without rationale), 403, 409 `transition_not_allowed` (different second decision). An identical retry returns the stored result | T2 |
| OP-11 | `POST /api/teacher/sessions/{session_id}/draft-recommendation` | assigned teacher | — | One `Recommendation` in `pending`, produced on demand by the Teacher Insight code path that `insight-drafts` later calls | 403 | T1c |
| OP-12 | `GET /api/tutor/sessions` | tutor (assigned) | — | `[{session_id, question_title, started_at}]`. No responses and no tutor output | — | T2 |
| OP-13 | `POST /api/tutor/sessions/{session_id}/notes` | tutor (assigned) | `{body}` | `tutor_note` | 403 if unassigned. Audited | T2 |
| OP-14 | `GET /api/coordinator/cohorts/{cohort_id}/summary` | academic coordinator (assigned) | — | `CohortSummary`: cohort mastery, misconception trends, intervention insights, item-quality indicators, and for each accepted recommendation the later transfer outcome or "not enough later evidence" | 403 | T2 |
| OP-15 | `PUT /api/coordinator/cohorts/{cohort_id}/settings` | academic coordinator (assigned) | `{allow_level_5: boolean}` | `{allow_level_5}` | 403. Writes an audit event with who, when, previous and new value | T2 |
| OP-16 | `GET /api/content/review-items` | content reviewer, administrator. Teachers: read-only | optional `status` | `[content_review_item]` with reasons and evidence | — | T2 |
| OP-17 | `POST /api/content/review-items/{id}/decision` | content reviewer, administrator | `{decision: "approved" | "rejected" | "deprecated", note?}` | `content_review_item` | 403 for a teacher. 409 if offline validation has not passed and the decision is `approved` | T2 |
| OP-18 | `POST /api/admin/users`, `PUT /api/admin/users/{id}/role` | administrator | `{clerk_user_id, role, display_label}` / `{role}` | `app_user` | 400 | T1 (seed), T3 (route) |
| OP-19 | `POST /api/admin/cohorts`, `POST /api/admin/cohorts/{id}/assignments`, `PUT /api/admin/cohorts/{id}/support-contact` | administrator | cohort fields; `{user_id, member_role}`; `{user_id}` | `cohort`, `cohort_assignment` | Replacing a support contact audits both changes | T1 (ADM-13), T3 |
| OP-20 | `PUT /api/admin/users/{id}/grants/trace_review`, `DELETE /api/admin/users/{id}/grants/trace_review` | administrator | — | `user_grant` | 400 if the target is not an administrator. Audited | T3 |
| OP-21 | `GET /api/admin/audit-events` | administrator | filters `user`, `student`, `event_type`, `from`, `to` | paged `[audit_event]` | — | T3 |
| OP-22 | `GET /api/admin/quality-issues`; `POST /api/admin/quality-issues/{id}/triage` | administrator holding `trace_review` | `{note, decision}` | issue with trace link | 403 without the grant | T3 |
| OP-23 | `POST /api/teacher/exports`; `GET /api/teacher/exports/{id}` | assigned teacher | `{recommendation_ids[]}` | export reference; a short-lived controlled download | 403. Audited. Nothing is sent to a parent or student | T3 |

**`Replay`** (OP-05)

```json
{
  "session_id": "uuid", "question": {"question_id": "...", "version": 1}, "diagram_version": 1,
  "turns": [{
    "turn_number": 1, "student_response": "string | null", "verifier_status": "string", "hint_level": 2,
    "tutor_output": "string | null", "misconception": {"code": "...", "confidence": 0.9, "source": "deterministic_match", "reviewer_status": "unreviewed"},
    "learner_model_change": {"mastery_delta": 0.0, "confidence_delta": 0.0},
    "model": "...", "model_version": "...", "prompt_version": "...", "policy_version": "...",
    "body_purged": false, "retention_notice": null,
    "trace_link": "url | null", "trace_notice": "expired | null",
    "audit_timestamps": {"created_at": "..."}
  }],
  "notes": [], "comments": [], "tutor_notes": [], "flags": [], "overrides": []
}
```

Replay rules: `trace_link` is present only for an administrator holding `trace_review` and only while the trace is inside 90 days, afterwards `trace_notice` is `expired`. A teacher never receives a trace link. When `body_purged` is true the turn still carries verifier status, hint level, versions and timestamps, plus a notice that the message body was removed. Student notes appear in time order beside the turns.

### 3.5 Scheduled-job routes (T1b `warmup`, T2 rollups, T3 purge) [D-09]

| Method and path | Cadence (vercel.json) | Purpose |
| --- | --- | --- |
| `GET /api/jobs/warmup` | `*/10 * * * *` | Ping `solvepath-mcp` and `solvepath-safety` |
| `GET /api/jobs/learner-rollup` | `0 * * * *` | Recompute aggregated learner-skill state |
| `GET /api/jobs/embedding-sync` | `15 * * * *` | Embed new or changed approved questions and exemplars |
| `GET /api/jobs/insight-drafts` | `0 18 * * *` | Draft teacher recommendations |
| `GET /api/jobs/item-quality-scan` | `30 18 * * *` | Flag items for review |
| `GET /api/jobs/retention-purge` | `0 19 * * *` | Apply retention windows |
| `GET /api/jobs/eval-nightly` | `0 20 * * *` | Optional nightly regression run |

Contract: header `Authorization: Bearer <CRON_SECRET>` is required. A missing or wrong secret returns 401 `unauthenticated`, writes a log entry and an audit event, and runs nothing. A valid call returns 200 `{job_run_id, status, processed_count, remaining_count}`. A job SHALL be idempotent, process a bounded batch that finishes inside the function duration limit, and resume the remainder on the next invocation.

### 3.6 MCP tool contract (T1b, derived inputs [D-07])

Transport: MCP streamable HTTP, stateless. Every call carries a service bearer token (§3.8) and W3C `traceparent` and `tracestate` headers. Tools return schema-validated JSON and never generate tutor text.

| Tool | Input | Output | Errors |
| --- | --- | --- | --- |
| `verify_expression` | `{question_id, question_version, input: string, field_kind: "answer" | "step"}`. `field_kind=step` covers step and probe fields. The tool runs the shared normaliser, so `/` is a fraction for `answer` and `÷` for `step` | `PureVerifierResult` | 401 bad token. 400 schema. 404 question not servable. A server-side exception returns an error, which the orchestrator maps to `cannot_verify` with `state=tool_failure` |
| `get_question` | `{question_id, version?}` (latest approved and published when omitted) | The full authored question including solution data | 401, 404 for anything not approved and published |
| `search_exemplars` | `{skill_id, error_category, canonical_value, relation_tags[], taxonomy_version}` | `{exemplars: [{exemplar_id, code, feature_template, similarity}]}`, approved and published only, top-k from policy configuration. An empty list is a valid result | 401, 400 |

Rules: the query is built from numbers only. A prompt-capture test SHALL show no free text in it. The pure verifier call has no session input.

### 3.7 A2A Safety Guard contract (T1b, derived bodies [D-06])

Input: `{schema_version, request_id, candidate_text, hint_level, prompt_type, forbidden_strings[], iteration: 1 | 2}`. Output: `SafetyVerdict`. Transport carries the service bearer token and W3C trace headers. Timeout 1,200 ms (1.3 s cap), verdict-only output from the small `MODEL_SAFETY` model with capped output tokens.

| Verdict | Orchestrator handling |
| --- | --- |
| `allow` | The candidate proceeds to the final deterministic leakage override (WF-09 step 5). A deterministic hit overrides `allow` |
| `block`, `revise` | The candidate is rejected. If an iteration remains, the Dialogue Agent revises (it sees only "revise"). Otherwise the deterministic fallback with `fallback_reason=loop_exhausted` and flag `safety_fallback` |
| `escalate` | The candidate is rejected and no further iteration runs. Deterministic fallback with `loop_exhausted`, flag `safety_fallback`, and a safety-incident audit event |
| Timeout or connect failure | One in-process retry inside the remaining turn budget. If it also fails, or the retry would pass 7.5 s: fallback with `guard_unreachable` and flag `safety_fallback` |
| HTTP 4xx or 5xx | No in-process retry. Fallback with `guard_unreachable` and flag `safety_fallback` |

An unguarded candidate is never sent to the student.

### 3.8 Service-to-service authentication (T1b)

| Property | Specification |
| --- | --- |
| Token | Short-lived signed bearer with claims `aud` (target service), `iat`, `exp`. `exp − iat ≤ 60 s` |
| Secrets | One HMAC secret per target service: `INTERNAL_SERVICE_TOKEN_MCP`, `INTERNAL_SERVICE_TOKEN_SAFETY`. Each service holds only its own, so a compromised service cannot mint a token for the other (Vercel OIDC where available) |
| Failure | A missing, expired, wrong-audience or wrongly signed token returns 401, writes an audit event and returns no question or answer data. This test blocks CI |
| Reach | The browser never reaches either service. The cold-start in-process fallback is used only by the orchestrator and does not bypass this |

### 3.9 Internal component contracts (deterministic components and orchestrator)

These are the method-level contracts. They are written as signatures and behaviour, not as source code.

| Component | Signature (inputs → outputs) | Behaviour and limits |
| --- | --- | --- |
| `normalise` (`apps/api/app/verifier/normaliser.py`, shared by verifier, leakage check and tests) | `(raw: text, field_kind: answer | step) → {input_kind, canonical_value, canonical_expression, unit, parse_issue: none | comma_ambiguous | unparsed}` | Deterministic. Handles word numerals (`thirty` → 30), unit suffixes and expansions (`30 km`, `30,000 m`), `5:2` and `5 to 2`, `7.5x4`, `×`, `÷`, the thousands-comma pattern. One shared test corpus |
| `scrub_pii` | `(text) → text` | Replaces names it recognises with `[STUDENT_NAME]`, emails with `[REDACTED_EMAIL]`, Australian phone numbers and street addresses with a redaction token. Best effort for names. Under 5 ms |
| `input_screen` | `(text) → {hit: bool, category?, canned_key?}` | Regex lexicon `input_lexicon.json`. Runs on note text and on answer or step text that failed to parse. Under 10 ms |
| `apply_overlay` | `(pure: PureVerifierResult, response_target, session, question) → VerifierOutcome` | Uncached. See WF-06 |
| `match_prediction` | `(outcome, question) → {matched, code?, confidence=0.90}` | Runs only for post-overlay `incorrect` with `input_kind` of `value` or `ratio`. Under 10 ms |
| `retrieval_gate` | `(outcome, match) → {open: bool, skipped_reason?}` | See WF-07 |
| `estimate_student_state` | `(prior persisted results of this session) → StudentState` | No model, no free text, no accepted answer |
| `decide_hint` | `(event, outcome, match, classification?, student_state, session, question, cohort) → HintDecision` | Pure Python. Under 40 ms. See WF-08 |
| `check_candidate` | `(candidate_text, hint_decision, question, session) → {blocked: bool, reasons[]}` | Value leakage, method leakage, phrase check, `age_appropriate`, `single_prompt`. See WF-09 |
| `render_solution_turn` | `(question) → text` | Template: for each main-path step `Step {n}: {description}. {target_expression} = {target_value} {unit}.`, then `So the answer is {accepted canonical value} {unit}.`, then canned `transfer_offer`. No model, no guard |
| `render_example_turn` | `(question) → text` | The isomorphic stem, its steps and `So the answer is {final_answer}.`, then canned `support_withheld_notice`. No model, no guard |
| `select_transfer` | `(student, original_session) → question | none` | See WF-10 |
| `recommend_next` | `(student, cohort) → question | none` | Practice Planner. See WF-02 |
| `update_learner_model` | `(student, skill, turn) → learner_skill_state` | See §2.5. Same transaction as the turn |
| `render_diagram` / `validate_diagram` | `(spec, level) → svg` / `(svg, spec, level) → {valid, reasons[]}` | Deterministic. `validate_diagram` runs the leakage check over `<text>`, `<title>`, `<desc>`, `aria-label`, `alt`, axes, ticks, legends and the adjacent description |
| `transitions.apply` | `(state, event, guards) → (state', effects)` | Rejects a pair not in `transitions.yaml` with `transition_not_allowed` |
| Provider adapter | `(agent, input, schema) → validated output` | One schema-repair call inside the stage timeout. Records provider, model, model version and temperature. No vendor SDK in agents |
| Tutor Orchestrator | `run_turn(session_id, request, idempotency_key) → TurnResponse` | Owns WF-03 |

### 3.10 Edge-case, anomaly and validation-failure handling

| Case | Detection | Handling | Student sees | Recorded |
| --- | --- | --- | --- | --- |
| Unparsable answer or step | `input_kind=unparsed` | `cannot_verify`, `error_category=incomplete`. First one: rephrase. Second in a row on the same question version: structured input and flag `ambiguity_review` | `rephrase_request`, then `structured_mode_notice`. Never "incorrect" | Attempt, audit |
| Comma outside `30,000` pattern | `parse_issue=comma_ambiguous` | `cannot_verify` | `use_dot_for_decimals` | Attempt |
| Words around a number | Not parsed | `cannot_verify`; Input Screen scans the text | `rephrase_request` | Attempt |
| Expression matching no step in the answer field | `input_kind=expression`, no match | `cannot_verify`, carries evaluated value for classification only | `enter_the_number` ("the number your calculation gives") | Attempt |
| Wrong final answer equal to an intermediate value | `matched_step_ids` non-empty, status not `correct`, `response_target=final` | `incorrect` with `error_category=incomplete` | Normal scaffold | Turn |
| Intermediate value in a probe or step field | Overlay | `partially_correct` for `counts_as_step_id`, `progress=advancing` if first time | Next prompt, level unchanged | Turn |
| Probe field with no active probe | `response_target=probe`, `active_probe_id` null | Judged without the overlay | As the pure result | Turn |
| Required unit missing or wrong | Verifier | `incorrect`, `missing_unit` or `unit_error` | Scaffold | Turn |
| Two accepted methods | Verifier | Both `correct` (final) or `partially_correct` advancing (alternate-path step) | | Turn |
| Verifier tool timeout or connect failure | Orchestrator | One in-process retry per turn | Nothing | Span `protocol: in_process_fallback` |
| Verifier tool HTTP error | Orchestrator | `cannot_verify`, `state=tool_failure`, no counter change, no retrieval | `tool_failure_notice` | Audit |
| Question, answer key and solution plan disagree | Verifier consistency check | Never `correct`. Item flagged for `answer_key_inconsistency` | Rephrase or neutral prompt | Content flag |
| Candidate leaks a value, method, personal-information request, exam promise, placement claim or sensitive-attribute inference | `check_candidate` | Revision or fallback. A hit overrides a guard `allow` | Revised or fallback prompt | Audit |
| Student's own verified value in a candidate | Verified-value exemption | Not blocked. Stem givens are also exempt | | |
| Guard blocks twice, errors, or is unreachable | WF-09 | Fallback and `safety_fallback` | `fallback_l{level}` | Audit, flag |
| Provider timeout, 429, 5xx, or invalid output after one repair, or turn past 7.5 s | Orchestrator | Fallback with `provider_error`, `schema_invalid` or `budget`. No session flag | `fallback_l{level}` | Audit |
| Student text found in a model prompt | Prompt-capture guard (`before_model`) | Turn fails before the model call [D-20] | `fallback_l{level}` | Audit `prompt_capture_violation` |
| Event not allowed in the state | `transitions.apply` | 409 `transition_not_allowed` | Client hides the control, so this signals a bug or tampering | Audit |
| `show_solution` pleading below the Level 5 conditions | Hint policy | Level unchanged. Next unused probe or `encouragement` | The probe or `encouragement` | Audit (request logged) |
| `not_sure` at Level 4 | Hint policy | Level stays 4. Next unused probe at Level 4 or `encouragement`. Never reaches 5 | The probe or `encouragement` | Attempt `not_sure` |
| Typed answer request in the note box | Input Screen `answer_request` | Reply `answer_request_reply`. Does not count as the Level 5 request. Level unchanged | `answer_request_reply` | Safety event |
| Abuse, assessment help, impersonation, injection phrase | Input Screen | Canned reply, no model, no verifier, no counter | The category reply | Safety event |
| Worrying disclosure | Input Screen | `worrying_disclosure_reply` (tell a trusted adult now, no advice), flag `worrying_disclosure`. No safeguarding decision | `worrying_disclosure_reply` | Safety event, flag |
| 12th pipeline turn without a `correct` | Turn counter | `stuck`, `turn_cap_reached` | `turn_cap_notice` | Flag |
| Item has a diagram but no approved variant, or validation fails | Question load | Item withheld and flagged | Another item or not found | Content flag |
| Blob read fails or SVG missing | Diagram route | Render from the validated spec in process. If that fails, probe text with no diagram and `diagram_unavailable` on the turn | The probe text | Audit |
| No legal transfer partner | `select_transfer` | `no_legal_transfer`. No item invented | `no_legal_transfer_notice` | End reason |
| Request from another student's session | Authorisation | 404 `not_found` | | Audit |
| Unknown `sub`, parent role | Authentication | 403 `forbidden`, nothing created. Parent has no product route | Sign-in error | Audit `auth_unknown_subject` |
| Postgres unreachable before the attempt is stored | Orchestrator | 503 `service_unavailable`. No pipeline, no counter change | `save_failed_notice`. The answer field keeps its text | Log |
| Clerk JWKS unreachable | Authentication | Cached keys up to 1 hour old, else 503. Never fail open | Sign-in error | Audit |
| Rate cap reached | Middleware | 429 `rate_limited` with `retry_after_s` | `rate_limited_notice` | Audit |

---

## 4. Functional Workflows & Logic Gates

Each workflow lists its trigger, pre-conditions, processing logic, post-conditions and side effects. "Audit" means a row in `audit_event`. "Trace" means the Langfuse trace of the turn. Tier tags follow §1.1.

### WF-01 Authenticate and authorise every request (T1; RLS layer T3)

- **Trigger:** any `/api/*` request except the cron routes (WF-22).
- **Pre-conditions:** none.
- **Processing:**
  1. No bearer token or an invalid token → 401 `unauthenticated`.
  2. Verify the JWT signature against the Clerk JWKS. If the JWKS endpoint is unreachable, use cached keys no older than 1 hour. With no usable cache → 503 `service_unavailable`. Authentication never fails open.
  3. Look up `sub` in `app_user.clerk_user_id`. Not found → 403 `forbidden`, audit `auth_unknown_subject`, no row created.
  4. Read `role`, cohort assignments and active grants from Postgres. Ignore every role claim in the token.
  5. Apply the route's rule from the §2.1 role-action matrix and the scope rule (assigned cohort or own data). A parent has no route.
  6. (T3) Open the transaction with `SET LOCAL app.user_id = <id>`, never a session-level `SET`. Row-level security fails closed when the setting is absent.
- **Post-conditions:** the request runs with a resolved `(user, role, cohorts, grants)`.
- **Side effects:** an authentication audit event on sign-in and on a failed sign-in. A denied request writes an `access_denied` audit event with the actor, route and reason. A student requesting another student's session receives 404 `not_found`.

### WF-02 Choose or receive a question and start a session (T1)

- **Trigger:** `POST /api/sessions`.
- **Pre-conditions:** authenticated student enrolled in a cohort whose curriculum scope is enabled.
- **Processing:**
  1. `question_id` given: load the latest version with `validation_status=approved`, `publication_status=published`, `flagged=false`, all FR-02 fields present and scope enabled. Anything else → 404 `not_found`.
  2. `recommended=true`, no history: choose an approved item from the cohort starting set that needs no untaught skill.
  3. `recommended=true`, with history: the Practice Planner reads the student's `learner_skill_state` (including this student's latest turn write) and chooses a published item along a skill-graph `remediates` or `prerequisite` edge, deterministically. Vector similarity SHALL NOT make this choice. Unapproved items are excluded. If none qualifies → 404 `not_found`.
  4. If the item has a diagram and no approved variant exists, or diagram validation fails, withhold the item, flag it for content review (WF-19) and, for a recommended request, choose the next eligible item.
  5. Create the session in `awaiting_first_attempt` (SM-1 row 1) with the question version pinned, level 0 and no hint.
- **Post-conditions:** session row persisted before the response returns.
- **Side effects:** audit `question_selection`. Response 201 `SessionView` with the canned `level0_prompt`.

### WF-03 Per-turn pipeline for a student event (T1)

- **Trigger:** `POST /api/sessions/{id}/events`.
- **Pre-conditions:** WF-01 passed, the caller owns the session, the event is allowed in the state (§3.2), `Idempotency-Key` present.
- **Processing** (stage budgets in §5.1; the whole turn has a 7.5 s hard stop, after which the deterministic fallback with `fallback_reason=budget` is returned):
  0. **Ingress.** Validate the body against the §3.2 matrix (400). Look up the idempotency key (replay, conflict and in-progress rules of §3.2). A new key inserts an `in_progress` record. Apply the rate limit (WF-22 counters; 429). Acquire the per-session lock [D-14]. Apply lazy abandonment [D-12]. Run `transitions.apply`. A rejected pair → 409 `transition_not_allowed`, nothing changes, audit.
  1. **Persist the attempt.** Insert the `attempt` row (`counted` unset) before the pipeline runs. If Postgres is unreachable → 503, no pipeline, no counter change. A retry with the same key resumes from this row.
  2. **ProblemContext.** Load the question version. Run `scrub_pii` on any text. Run `normalise`. If the answer or step text is `unparsed`, run `input_screen` on it. A hit short-circuits the turn (SM-1 row 8, WF-05). No hit continues as `cannot_verify`.
  3. **Verify** (WF-06): exact-key cache, else MCP `verify_expression`. A hit or miss span is written either way.
  4. **Overlay** (WF-06).
  5. **Deterministic matcher** (WF-07).
  6. **Retrieval gate** (WF-07).
  7. **StudentStateEstimator**, then the **MisconceptionClassifierAgent** when the gate opened (WF-07).
  8. **HintPolicyEngine** (WF-08): level, probe, content, prompt type, tone.
  9. **Dialogue loop** (WF-09), or the deterministic turn for solution, example, canned and authored kinds.
  10. **Fallback** when the loop exhausts, the guard is unreachable, the provider fails or the budget is passed.
  11. **Persist** in one transaction: `tutor_turn`, `attempt.counted`, session fields (state, level, counters, `asked_probe_ids`, `matched_step_ids`, `active_probe_id`, `input_mode`, flags), `misconception_event`, the learner-model write (WF-12), the audit events, and the idempotency record set to `done` with the stored response.
  12. **Trace flush.** Flush Langfuse within at most 300 ms. On failure set `trace_status=missing` and continue.
  13. **Respond** with `TurnResponse`. It never contains the verdict, a misconception code, a `sound` flag or a solution value below Level 5.
  14. **Client behaviour (STU-14).** On send, the student's own answer is echoed immediately and the input is disabled. The loading state shows no tutor text. After more than 1 s it shows a child-friendly message (for example "Thinking about your answer…"). After 4 s it adds a reassurance line. It is announced with `aria-live="polite"` and does not rely on colour or animation alone. Neither message contains model or tutor text. After 8 s with no response the client retries once with the same key. If that also returns nothing, the client shows the deterministic fallback and the loading state ends.
- **Which steps run, by event**

| Event | Steps run |
| --- | --- |
| `submit` with a value or expression | 0–13 |
| `submit` with only a reasoning option [D-01], `not_sure`, `show_solution` | 0, 1, a load-only form of 2, the estimator of 7, 8, then 9–13. Steps 3–6 and the classifier do not run. No verifier call, matcher, retrieval or classifier |
| `reflection_choice`, `transfer_decision` | 0, 1, WF-10, 11–13. No model, verifier, retrieval, guard or `hint_decision` |
| `note` | 0, WF-05, 11–13. Not a pipeline turn |

- **Post-conditions:** exactly one tutor turn exists for the request, or one canned reply. Session state is in Postgres before the response returns.
- **Side effects:** audit events for the attempt, verifier result, tool calls, model call, hint decision and generated prompt (hashes only); one trace per turn with separate MCP and A2A child spans; Langfuse scores (§5.8).

### WF-04 Answerless events (T1)

| Event | Processing | Result |
| --- | --- | --- |
| `not_sure` | Attempt stored as `not_sure`, `counted=false`. Level = min(level + 1, 4). The hint policy supplies the content for the new level (WF-08). Counts toward the turn cap | A normal model turn or the fallback. In `awaiting_first_attempt` the state moves to `active` (row 2) |
| `show_solution` | The policy evaluates the four Level 5 conditions (WF-08) | Row 9 solution turn, row 10 example turn, or row 11 probe or `encouragement` |
| `submit` with only a reasoning option [D-01] | Attempt stored as `reasoning_option`, `counted=false`. No verifier. The option's mapped misconception code or step id is passed to the policy as context and never as a verdict. Level unchanged | The next unused probe at the current level, or canned `encouragement` |

### WF-05 Notes and the Input Screen (T1)

- **Trigger:** a `note` event in any state, or unparsable text in an answer or step field.
- **Pre-conditions:** WF-01 passed. Notes are valid in every state, including terminal states.
- **Processing:**
  1. Scrub the text (`scrub_pii`).
  2. Run `input_screen` over the scrubbed text.
  3. On a hit, the turn short-circuits. The verifier, the matcher, the retrieval gate, any model and the hint level are untouched. No attempt is counted. The student sees one authored reply:

| Category | Canned key | Additional effect |
| --- | --- | --- |
| `answer_request` | `answer_request_reply`. Points at the "Show me the solution" control | The typed text does not count as that request. Level unchanged |
| `abuse` | `abuse_reply`. Asks to keep it kind, returns to the maths. Does not mirror the text | Safety event |
| `assessment_help` | `assessment_help_reply`. Declines, tells the student to speak to the teacher | Safety event |
| `impersonation` | `impersonation_reply`. Declines to write work to hand in | Safety event |
| `worrying_disclosure` | `worrying_disclosure_reply`. Tell a trusted adult now. No medical, legal or mental-health advice | Safety event and session flag `worrying_disclosure`. No safeguarding decision is made |
| `injection_phrase` | `injection_phrase_reply` ("I can only help with this question.") | Safety event. The text changes no counter, level or policy, and appears in no model prompt or Langfuse span |

  4. No hit on a `note`: store `student_note` (scrubbed, with `state_at_save`), reply with canned `note_ack`.
  5. No hit on unparsable field text: continue as `cannot_verify` (WF-03 step 3 onward).
- **Post-conditions:** the note is visible to the assigned teacher. A note is never a pipeline turn and changes no counter in any non-terminal state.
- **Side effects:** a safety event is an audit event. The static line "If something is worrying you, tell a trusted adult" is always shown under the note box. The lexicon's recall on the 12 synthetic unsafe-input fixtures is reported against a target of at least 0.90. It is a report and not a safeguarding claim.

### WF-06 Verification, cache and response-target overlay (T1; MCP and cache T1b)

- **Trigger:** WF-03 steps 3 and 4 for `submit` with a value, ratio or expression.
- **Pre-conditions:** the question version is pinned in the session.
- **Processing:**
  1. `normalise(raw, field_kind)`. `field_kind=answer` for the answer field, `step` for step and probe fields.
  2. Compute the cache key from the normalised expression, `question_id`, `question_version` and the tolerance rule. Look it up (target under 20 ms). A hit returns the stored `PureVerifierResult`. A cache read or write failure is treated as a miss and recorded as a span.
  3. On a miss, call MCP `verify_expression` (stage timeout 400 ms). On a timeout or connect failure, run the verifier in-process once inside the remaining budget. If the in-process retry would pass 7.5 s, or a second fallback is needed in the same turn, return the deterministic fallback. An HTTP 4xx or 5xx is not retried: it yields `status=cannot_verify`, `state=tool_failure` with every other field null.
  4. Store the pure result under its key.
  5. Apply the **overlay** (never cached, never sent to MCP):

| `response_target` | Overlay |
| --- | --- |
| `final` | No change, except that a value whose `matched_step_ids` is non-empty and whose status is not `correct` becomes `incorrect` with `error_category=incomplete`. An expression that matches no step stays `cannot_verify` and the tutor asks for "the number your calculation gives" |
| `step` | A value or expression with a non-empty `matched_step_ids` becomes `partially_correct` for that step. Any other parsed input becomes `incorrect` for the step |
| `probe` | Uses `active_probe_id`. `kind: value`: a `canonical_value` equal to `expected_value` becomes `partially_correct` for `counts_as_step_id`. `kind: setup`: a `matched_solution_step` equal to `counts_as_step_id` becomes `partially_correct`. Any other parsed input becomes `incorrect` for the probe and never `cannot_verify` merely because the value is off the main path. If the pure status is already `correct`, nothing changes. With no active probe, the value is judged without the overlay |

  `unparsed` input stays `cannot_verify` in every case. Probe expected values are exempt from the leakage check only after the student has produced them.
- **Post-conditions:** a `VerifierOutcome`. The pure result is cacheable and contains no session field.
- **Side effects:** a verifier MCP span (separate from the A2A span) with the error category and `cache: hit | miss`; audit `verifier_result` and `tool_call`.

**Counting and level effects by outcome** (FR-04 table; used by WF-08)

| Post-overlay outcome | `state` | Raises level | Counted toward the Level 5 minimum |
| --- | --- | --- | --- |
| `correct` | `ok` | No | Yes |
| `partially_correct`, `progress=advancing` (a step not matched before in this session) | `ok` | No | Yes |
| `partially_correct`, stalled or incomplete | `ok` | Yes (+1, max 4) | Yes |
| `incorrect` | `ok` | Yes (+1, max 4) | Yes |
| `not_sure` | `ok` | Yes (+1, max 4) | **No** |
| `cannot_verify` (unparsed) | `ok` | No | No |
| `cannot_verify`, `tool_failure` | `tool_failure` | No | No |

**Unparsed-input loop guard.** One `cannot_verify` with `state=ok` asks for a rephrase. Two consecutive on the same question version switch `input_mode` to `structured`, show `structured_mode_notice` and record `ambiguity_review`. The student is never told they are wrong, and none of these raise the level or count toward the Level 5 minimum. The `ambiguity_review` flag requires the second occurrence.

### WF-07 Misconception matcher, retrieval gate and classifier (T1; retrieval T1b)

- **Trigger:** WF-03 steps 5–7.
- **Processing:**
  1. **Matcher** (under 10 ms). Runs only when the post-overlay status is `incorrect` and `input_kind` is `value` or `ratio`. It compares `canonical_value` with `misconception_predictions`. A hit sets the taxonomy code with provisional confidence `0.90`, `source=deterministic_match`, and bypasses retrieval and the classifier. A match is a hypothesis from one numeric answer and is never stated to the student as fact.
  2. **Retrieval gate.**

| Verdict | Retrieval and classifier |
| --- | --- |
| `correct` (any state) | Skipped. Store `retrieval: skipped`, `misconception: none` |
| `partially_correct` (advancing or stalled) | Skipped. Same record |
| `state=tool_failure` | Skipped. Same record |
| Deterministic match found | Skipped. The matcher's code stands |
| `incorrect` and unmatched, or `cannot_verify` with `state=ok` | Gate opens. Call MCP `search_exemplars` (stage timeout 250 ms) with a numbers-only query. Approved, published exemplars only. Exact-key cache for the query |

  3. **Empty or failed retrieval** (no exemplars, pgvector or embedding failure): treated as an empty result. The classifier records that it used no exemplars. The turn still completes.
  4. **StudentStateEstimator** (every tutoring turn, deterministic).
  5. **Classifier** (LlmAgent, stage timeout 1,000 ms), only when the gate opened. It returns a `MisconceptionClassifierOutput`. For `cannot_verify` with `state=ok`, the stored label is forced to `insufficient_evidence` [D-20]. The candidate code from the `error_category` mapping is a hypothesis it may use for `incorrect`. Its output must pass `schema_valid`. A timeout, provider error or invalid output after one repair yields the deterministic fallback and no misconception claim.
  6. **Prompt type.** `targeted_scaffold` iff the code source is the classifier, confidence ≥ `0.80` (threshold stored with `POLICY_CONFIG_VERSION`) and the code is not `insufficient_evidence`. Otherwise, when a misconception was evaluated, `diagnostic_probe`. A deterministic match is always `diagnostic_probe`. When no misconception was evaluated the value is null. The delivered text never contains a taxonomy code or glossary phrase at any confidence.
- **Post-conditions:** `misconception_event` stored with `reviewer_status=unreviewed`. The label and its confidence appear only in teacher views.

### WF-08 Hint policy engine (T1)

Pure deterministic Python. It never generates text and never calls a model. Only these inputs affect runtime escalation (Decision #25): the attempt outcome, counted attempts, the student's explicit request, and the cohort's `allow_level_5`. Time spent, longitudinal hint dependency and year level are logged only.

**Level ladder**

| Level | Name | Content source |
| --- | --- | --- |
| 0 | Independent attempt | Canned `level0_prompt` |
| 1 | Attention orientation | First unasked authored probe with `min_level` ≤ 1 |
| 2 | Conceptual scaffold | Same rule, level 2 |
| 3 | Representation support | Same rule, level 3. A diagram variant may be shown |
| 4 | Partial worked step | `permitted_scaffold_step` of the first main-path step, excluding the final one, not yet in `matched_step_ids` |
| 5 | Full worked solution | `permitted_solution` rendered by template, only via the explicit request |

**Processing**

1. Read the outcome (WF-06 table) and apply the level effect. A raise is exactly +1, capped at 4 for every event other than a granted `show_solution`.
2. `progress=advancing` only when the matched step was not in `matched_step_ids` before this turn. Add it afterwards. Otherwise a `partially_correct` outcome is stalled.
3. Set `counted` per the WF-06 table, `attempt_count` += 1 when counted, and `turn_number` += 1 when the turn is a pipeline turn (SM-1 rules).
4. **Select content for the resulting level.**
   - Level 0: `level0_prompt`.
   - Levels 1–3: take the first probe, in authored order, not yet in `asked_probe_ids` and with `min_level` ≤ the level. Mark it asked and set `active_probe_id`. If none remains, the turn is the canned `fallback_l{level}` with no model call (`kind=canned`, no `fallback_reason`) [D-05].
   - Level 4: set `permitted_scaffold_step`. If no eligible step remains, or the attempt was unsuccessful while already at Level 4, use the next unused probe with `min_level` ≤ 4, then canned `fallback_l4` [D-05]. For `not_sure` already at Level 4, the level stays 4 and the content is the next unused probe at Level 4 or canned `encouragement`.
5. **Level 5 gate** for `show_solution` on the original item. All four must hold: (a) the level is 4, (b) `attempt_count` ≥ 3 counted attempts, (c) the student pressed "Show me the solution", (d) the cohort's `allow_level_5` is true.

| Conditions | Result |
| --- | --- |
| All four | Level 5. `permitted_solution` set. Deterministic solution turn (`kind=solution`, no model, no guard). State → `transfer_offered` (row 9) |
| (a)–(c) true, (d) false | Isomorphic worked example turn plus `support_withheld_notice` (`kind=authored`). `support_withheld` recorded, flag `support_withheld`, state stays `active`. The item's own answer is not shown (row 10) |
| Any other combination | Level unchanged. Next unused probe at the current level (paraphrased through the loop) or canned `encouragement` when none remain, with no model call. The request is audited (row 11) |

   "Not sure" submissions never count toward (b). A transfer item never receives a worked solution.
6. **Tone** is derived from `StudentState` using the policy configuration. The Dialogue Agent MAY read it.
7. **Prompt type** per WF-07 step 6. In `reflection`, `level` and `prompt_type` follow §2.4.
8. Write `HintDecision`, including `policy_version` and `policy_config_version`.

**Post-conditions:** the level never exceeds 4 except through the granted Level 5 gate. Pleading, repeated requests and typed answer requests do not raise the level.

### WF-09 Candidate loop, leakage checks and the Safety Guard (T1; A2A T1b)

- **Trigger:** WF-03 step 9, for turns whose `kind` is `model`.
- **Pre-conditions:** a `HintDecision` exists. The prompt-capture guard (`before_model`) has verified that no student free text is in the prompt. A hit fails the turn before any model call [D-20].
- **Processing** (at most two iterations: one initial, one revision):
  1. **Dialogue Agent** produces a `SocraticDialogueOutput` (stage timeout 1,400 ms, including one adapter schema-repair call). Invalid after repair → fallback `schema_invalid`. Provider timeout, 429 or 5xx → fallback `provider_error`. With `DIALOGUE_MODE=template` no model is called and the authored probe text is the turn, `kind=probe_template` [D-21].
  2. **`check_candidate`** (deterministic, first, cheap):
     - *Value leakage.* The candidate is normalised with the shared normaliser. Matching is token-bounded and unit-aware: numerals, word numerals and expanded units are normalised, a digit run inside a larger number is not a match, and arithmetic expressions in the text are evaluated except inside a quoted `permitted_scaffold_step`. Below Level 4 any solution step value or expression, the final answer and any not-yet-produced probe expected value block. At Level 4 the quoted `permitted_scaffold_step` is allowed and the final answer is blocked. At Level 5 the worked solution is allowed. **Exempt at every level:** values and relationships stated in the question stem, and values the verifier already marked correct for this student.
     - *Method leakage (below Level 4).* Blocked when the text pairs an operation pattern from `method_leak_patterns` with two or more of the item's quantities, or contains a solution-step phrase the student has not already used. A question may ask which operation applies and SHALL NOT name it.
     - *Phrase check.* Blocks requests for personal information, promises of examination success, selective-entry or placement claims, and inference of a sensitive attribute.
     - *`age_appropriate`.* No sentence above 25 words, no taxonomy code, glossary phrase or unexplained jargon from `jargon.json`.
     - *`single_prompt`.* One question mark, or one sentence whose first word is `try`, `look`, `find`, `compare`, `write` or `check`, and not a second of either ("Look at the table. What is the ratio?" passes. "Look at the table. Find the parts. What is the ratio?" fails).
     - *Schema consistency.* `hint_level` equals `HintDecision.level`.
     A block triggers the revision, or when no iteration remains the fallback.
  3. **Safety Guard** over A2A (§3.7), called only for a candidate that passed step 2.
  4. **Final override.** Before storing, the deterministic leakage check runs again on the candidate. A hit overrides a guard `allow`. The student's own value is exempt when the verifier has already marked that same value correct on this attempt.
  5. **Loop exhaustion** (both iterations rejected), `escalate`, or an unreachable guard: the deterministic fallback `fallback_l{hint_level}` (written to pass the checks, no mathematics), flag `safety_fallback`. Provider, schema and budget fallbacks set no flag.
- **Post-conditions:** only a candidate that passed the deterministic checks and received `allow` is persisted and shown. No tokens are streamed from an unreviewed draft. The student sees nothing until the turn is allowed, leak-checked and persisted.
- **Side effects:** separate A2A span; audit for the model call, guard verdict and any fallback; `fallback_reason` and `trace_status` stored on the turn.

### WF-10 Reflection and transfer (T1)

- **Reflection entry** (row 3): the verified correct final answer moves the session to `reflection`. The turn is authored. The `reflection.prompt_template` is rendered with the student's own verified value and unit in place of `{student_value}`. `choices` lists the 3–4 options plus Skip. `hint_level` is null and `prompt_type=reflection`. No model, verifier, retrieval or guard runs.
- **Reflection choice** (rows 13–14): store the option and its `sound` flag (visible to the teacher only). Show the option's authored `feedback` whatever its value. The student is never told they are wrong and the step never loops. Then call `select_transfer`:
  1. Shortlist: the authored skill-graph partners of the item (Release 1.0a), plus the pgvector shortlist from Tier 1b (same skill and learning objective, different surface features).
  2. Legality filter (skill graph, never vector similarity): approved, published, unflagged, scope enabled; same learning objective; no skill the student has not been taught (a taught skill is on a published item the student completed or in the cohort starting set); the accepted value and the simplified ratio differ from the completed item.
  3. Choose deterministically [D-19].
  4. A partner exists → `transfer_offered` with canned `transfer_offer`. None exists → `completed`, `end_reason=no_legal_transfer`, canned `no_legal_transfer_notice`, no item invented.
- **Transfer decision** (rows 15–16): *Accept* creates the linked transfer session in `transfer_active` with its own turn cap of 12 and level 0, sets `linked_session_id` on both sessions and completes the original (R1). The first transfer turn is the canned `level0_prompt` and no hint is given before the first independent attempt. *Decline* ends the session as `declined` with `transfer_outcome=skipped`, shows `transfer_declined_ack`, and does not raise confidence.
- **Transfer run:** the WF-03 pipeline applies with rows 4–7, 12, 19 and 22. The controls exclude `show_solution`. A `show_solution` event is rejected with 409 and audited.
  - Verifier `correct` (row 17): `completed`, `transfer_outcome=correct`, confidence + 0.20.
  - Level 4, at least 3 counted attempts and a latest status of `incorrect` or `partially_correct` (row 18), evaluated after each persisted turn: `completed`, flag `stuck_after_transfer`, canned `transfer_stuck_notice` (the teacher will look at it), no worked solution, `transfer_outcome=incorrect` [D-04]. `cannot_verify` and `tool_failure` never trigger it.
- **Post-conditions:** the original session's `transfer_outcome` is back-filled when the linked session ends [D-04].

### WF-11 Session end, turn cap, abandonment and resume (T1)

- **Turn cap.** The 12th pipeline turn on an item without a `correct` moves the session to `stuck` with flag `turn_cap_reached` (row 19). The student sees the fixed `turn_cap_notice`, the question is saved for the teacher, another approved item is offered through `recommend_next`, and no worked solution is given. Canned Input Screen replies and a first rephrase request do not count. A transfer item has its own cap of 12.
- **Abandonment** [D-12]. When a session is read or written and `now − last_activity_at ≥ 30 minutes` while non-terminal, the session becomes `abandoned` first. The request that triggered it is then handled against the terminal state.
- **Summary.** On entry to any terminal state the session `summary` stores the verifier outcomes, hint levels and the transfer result (back-filled per D-04).
- **Resume.** Within the window, `GET /api/sessions/{id}` restores the same question, attempts and hint level. After `abandoned`, a return starts a new session.
- **Flags** are not terminal events. They are recorded as they occur.

### WF-12 Learner-model update on turn persistence (T1; aggregates T2)

- **Trigger:** WF-03 step 11 for a turn that produced a `correct` verifier outcome, a conflict or a transfer result.
- **Processing:** apply the §2.5 mastery and confidence rules to `(student, skill_id)`, using the hint level at the success. Caps are 1.0 and floor 0. The conflict rule is evaluated once per persisted counted attempt [D-15]. Update `recommended_next_skill` through the skill graph.
- **Post-conditions:** the next practice selection (WF-02) reads this write. Cohort aggregates, `independent_success_rate`, `hint_dependency_profile`, `misconception_distribution`, `median_response_seconds` and `transfer_success_rate` are recomputed by `learner-rollup` and MAY be up to one hour old. The dashboard shows `rollup_at`, and a saved session is listed from persisted turns without waiting for the rollup.

### WF-13 Diagram retrieval, rendering and validation (T1 ratio table; T2 bar model)

- **Trigger:** import of an item with `has_diagram=true`, `POST /api/sessions` (availability check), and `GET /api/sessions/{id}/diagram`.
- **Processing:**
  1. At import the structured specification is validated: labels, visual structure, mathematical constraints and accessibility text. The renderer draws the SVG deterministically. One variant per leakage band is stored in Vercel Blob with hash, version and validation result.
  2. `validate_diagram` extracts every `<text>`, `<title>`, `<desc>`, `aria-label`, `alt`, axis, tick and legend label and the adjacent description, and runs them through the shared normaliser leakage check. Below Level 4 no intermediate step or final answer value may appear, and the unknown is shown as `?` or `x`. Level 4 may show the `permitted_scaffold_step` and masks the final answer. Level 5 allows the full worked values only when Level 5 is policy-authorised.
  3. A content reviewer approves or rejects the diagram.
  4. The diagram route serves the variant for the session's current level (§3.2). Meaning never depends on colour alone. A text alternative accompanies it.
- **Failure:** validation failure or no approved variant withholds the question and flags it. A Blob read failure falls back to in-process rendering from the validated spec. If rendering fails, the probe text is shown with no diagram and `diagram_unavailable` is stored on the turn. An unvalidated image is never served and an LLM response is never published as a diagram.

### WF-14 Resume and idempotent retry (T1)

Specified in §3.2 (idempotency contract) and WF-11 (resume). A retry after a function time-out that happened after persistence returns the persisted turn and not a second tutor question. A retry when only the attempt exists resumes the pipeline from that attempt without incrementing `attempt_count`. A retry on a session whose request is still running returns 409 `request_in_progress`.

### WF-15 Student dashboard (T2)

- **Trigger:** `GET /api/me/dashboard`. **Pre:** authenticated student.
- **Processing:** read the caller's own `learner_skill_state`, persisted sessions and transfer results. Mastery numbers come from WF-12. Aggregates may be up to one hour old and `rollup_at` is shown. Language is encouraging and non-comparative.
- **Post:** an empty history returns an empty state with a first published question. No ranking, no peer data.

### WF-16 Teacher review list, profiles, groups and trends (T2)

- **Review list** (OP-01, computed at request time from persisted attempts, not from the hourly rollup). A *relevant attempt* is a finished verifier result of `correct`, `incorrect` or `partially_correct` on a published item for a student in the teacher's cohort. A student with fewer than 3 relevant attempts shows "not enough evidence yet" and is not flagged. With 3 or more, a student is flagged when any holds, and the reasons are shown: the same misconception code on 3 attempts of one `skill_id`; hint level 4 or 5 on 2 of the last 5 attempts; transfer `incorrect` or `skipped` twice. The list is ordered by reasons and is not a leaderboard.
- **Profile, groups, trends** (OP-02 to OP-04). Groups and aggregates come from background jobs, not per page load. Each claim carries evidence links that respect role-based access. Low confidence or small samples show an evidence-limit warning. The sample threshold is a configuration value (open value).
- **Access:** only assigned students. An unassigned request is denied and logged.

### WF-17 Session replay, tutor notes and comments (T1c minimal; T2)

- **Trigger:** OP-05, OP-07, OP-12, OP-13.
- **Pre-conditions:** assigned teacher, or administrator holding `trace_review`. A tutor, coordinator, unassigned teacher, or administrator without the grant is denied and the denial is logged.
- **Processing:** assemble the `Replay`. Merge `student_note` rows, tutor notes and teacher comments in time order. For a purged body keep the metadata and add the retention notice. For an administrator with the grant, add the Langfuse link only while the trace is within 90 days.
- **T1c scope:** a read-only replay of the golden session and one pending draft recommendation with evidence. Accept, reject, override, comments and the cohort view are T2.
- **Side effects:** audit `access` event on every replay open. A comment or tutor note writes an audit event with who and when.

### WF-18 Recommendation drafting and review (T1c on demand; T2 daily and review)

- **Trigger:** the `insight-drafts` job (daily), or OP-11 on demand.
- **Processing:** the Teacher Insight Agent reads aggregated events only and returns a `TeacherInsightDraft` in the PRD §13.2 template. A deterministic wording check rejects any draft containing placement, grading, admissions, exclusion or remedial-classification wording. The rejection is stored and the draft is never shown. An accepted draft is stored `pending`, with evidence links, a confidence label and limitations. A `low` confidence recommendation is labelled and never stated as fact.
- **Review** (OP-10, SM-2): the assigned teacher accepts, rejects or overrides. The original recommendation and evidence stay unchanged and an override stores the rationale beside them.
- **Side effects:** audit with who, when and decision. No message is sent to a parent or student.

### WF-19 Content import, validation, review and quality flags (T1 import; T2 review and scan)

- **Import** (offline, TECH-07): load the item JSON, run the Problem Parser, validate V1–V9 and C1–C3, check answer key against solution plan, and write embeddings for approved items and exemplars (Decision #29). A failure rejects the import. A content reviewer cannot mark an item approved until validation has passed.
- **Serve filter:** an item is served only when `validation_status=approved`, `publication_status=published`, scope enabled, unflagged, and all FR-02 fields are present. Vector search and the Practice Planner apply the same filter.
- **Flag** (T2): `item-quality-scan` and the verifier raise a `content_review_item` for any of the eleven FR-14 reasons. A flagged item is not served. Teachers read flags and cannot decide them.
- **Review** (OP-17): the content reviewer approves, rejects or deprecates, and the decision and the publication status are stored and audited. An edited item becomes a new version and is not published without a new approval. The system SHALL NOT publish a regenerated or modified item autonomously.

### WF-20 Roles, cohorts, grants and the `allow_level_5` setting (T1 basics; T2 coordinator; T3 full matrix)

- **Roles and assignment:** an administrator creates users and sets a role, creates a cohort, enrols students and assigns teacher, tutor and coordinator (ADM-01, ADM-13). The change takes effect on the next API call, because role, cohort and grants are read from Postgres each time. A token still showing the old role does not grant access.
- **Support contact:** a cohort has at most one. Assigning another replaces the first and audits both changes.
- **`trace_review`:** an administrator grants or revokes it for another administrator. Each change is audited with who, when and the change.
- **`allow_level_5`:** a new cohort is created with it false. An assigned academic coordinator may change it (OP-15). The change writes an audit event with who, when, previous and new value. Later Level 5 decisions use the stored value. A coordinator outside the cohort is denied. A coordinator who tries to override a recommendation, publish a question, grant `trace_review`, open a replay or open a Langfuse trace is denied.
- **Capstone demo configuration** sets `allow_level_5=true` explicitly.

### WF-21 Audit write and view (T1 writer; T3 viewer)

- Every defined event of FR-15 writes an append-only `audit_event` through a writer that feature code cannot skip. The row holds ids, hashes and structured fields only. A configuration change stores the previous and the new value. An attempted `UPDATE` or `DELETE`, through the application or through the application's database role, is rejected by permissions or triggers.
- The administrator viewer (OP-21) filters by user, student, event type and time. Audit completeness target: 100% of defined events. Langfuse traces complement the Postgres audit log and never replace it.

### WF-22 Scheduled jobs (T1b `warmup`; T2 rollups; T3 purge)

- **Common:** authenticate with `CRON_SECRET` (§3.5). Create a `job_run` (`running`). Process a bounded batch. Finish as `succeeded`, `partial` (work remains for the next invocation) or `failed` (raise a Langfuse score or log alert visible to administrators). Run twice on the same pending work gives the same result.

| Job | Processing | Notes |
| --- | --- | --- |
| `warmup` | Ping `solvepath-mcp` and `solvepath-safety` with a service token | Keeps instances warm |
| `learner-rollup` | Recompute aggregated `learner_skill_state` fields and cohort aggregates from recent events. Record `rollup_at` | May be up to 1 hour behind |
| `embedding-sync` | Embed new or changed approved questions and exemplars. Do not embed unapproved items for student retrieval. Support re-embedding after a model or dimension change | Embeddings are `vector(768)` |
| `insight-drafts` | WF-18 for cohorts with new evidence | |
| `item-quality-scan` | Flag verifier mismatches, difficulty anomalies, near-duplicates (pgvector cosine similarity above a configured threshold) and the other FR-14 reasons | Thresholds are open values |
| `retention-purge` | WF-23 | |
| `eval-nightly` | Optional. Run the regression suite and push scores to Langfuse | |

- **Rate counters:** the student rate cap (WF-03 step 0) uses `rate_counter` fixed windows (hour and five minutes) [D-18]. Expired windows are discarded by the same write path.

### WF-23 Retention purge (T3)

- **Trigger:** `retention-purge` daily. **Pre:** WF-22 authentication, `RETENTION_POLICY_VERSION`.
- **Processing:** for each record older than its window (§2.10) delete the body only: `tutor_turn.body`, attempt `response_value`, `step_expressions` and `free_text`, expired model-trace links, student-specific diagram blobs, and the bodies of notes and comments. Records still inside the window are kept. Audit rows and approved question diagrams are never deleted.
- **Post-conditions:** a purged turn still opens in replay with its metadata and a notice. EDU-01 and EDU-02 evidence links still open. A trace that has expired shows an expiry notice instead of a link.

### WF-24 Intervention export (T3)

An assigned teacher requests an export of recommendation drafts. The export is labelled "AI draft, human review required", includes the evidence and limitations, is stored in Vercel Blob at a non-guessable key, is delivered through a controlled route, and writes an audit event with who exported. Nothing is sent to a parent or student.

### WF-25 AI quality-issue triage (T3)

An administrator holding `trace_review` opens the quality list. It contains each verifier mismatch, leakage event, schema failure and safety incident with its trace link. Marking an issue triaged stores the note and the decision. Without the grant the list is denied.

---

## 5. Non-Functional Specifications

### 5.1 Latency targets and stage budgets

| Area | Requirement |
| --- | --- |
| Initial question load | Under 2 s under normal demo load |
| Deterministic answer check via MCP | p95 under 400 ms. Cache hit under 20 ms. Blocks CI |
| Tutor turn | Target under 5 s, p50 under 3 s (reported). **CI gate p95 under 8 s.** Server hard stop 7.5 s, then the deterministic fallback with `fallback_reason=budget` |
| Dashboard, review list, profile and cohort summary | Under 3 s for a cohort of up to 150 synthetic students |
| Persistence | Every turn persisted before the response returns |
| Deterministic components | PII scrubber under 5 ms. Input Screen under 10 ms. Misconception matcher under 10 ms. Hint policy under 40 ms |
| Langfuse flush | At most 300 ms. A failed flush never fails the turn |
| Cold start | Cold-start p95 at most 5 s (gate). The MCP bundle stays under 30 MB with cold start under 1.2 s. The warmup job runs every 10 minutes |
| Client wait | Wait message after 1 s, reassurance after 4 s, one retry with the same key after 8 s |

**Stage timeouts and the budget** (PRD §11.3)

| Stage | Timeout |
| --- | --- |
| Ingress and egress overhead (JWT with cached JWKS 50 ms, session and question load 150 ms, scrubber 5 ms, cache lookup 25 ms, serialisation 20 ms) | 0.25 s total |
| Verifier MCP | 400 ms |
| Retrieval MCP | 250 ms |
| Classifier | 1,000 ms (runs only when the gate opens) |
| Hint policy | 40 ms |
| Dialogue Agent (covers the single adapter schema-repair call) | 1,400 ms |
| Safety Guard A2A | 1,200 ms (1.3 s cap) |
| Persistence | 200 ms |

Computed totals: happy path at stage limits 4.49 s of stages and 4.74 s with overhead. Worst-case retry path at stage limits (one revision) 7.11 s of stages and 7.36 s with overhead, below the 8.0 s gate. Typical warm: about 2.6–3.0 s. An in-process fallback runs inside the remaining turn budget. A fallback that would take the turn past 7.5 s goes straight to the deterministic fallback prompt. The 8 s gate is measured with at most one in-process fallback per turn. The orchestrator imports SymPy at module load so the fallback pays no import cost.

### 5.2 Payload and token limits

| Limit | Value | Source |
| --- | --- | --- |
| Prompt tokens per turn | At most 1,500 | PRD §11.2 |
| Completion tokens per turn | At most 250 | PRD §11.2 |
| Dialogue message | Under 100 tokens. One question or one imperative. No sentence over 25 words | PRD §9.4, §14.4 |
| Main-path steps, scaffold probes, reflection options | 2–4, at most 4, 3–4 | V1, V5, V9 |
| `Idempotency-Key` | UUID | PRD §15.9 |
| `step_expressions` | At most 1 element | [D-02] |
| `answer_text`, `step_expressions[0]` | At most 64 characters. Provisional [D-13] | |
| `note_text`, tutor note, teacher comment | At most 1,000 characters. Provisional [D-13] | |
| Request body | At most 8 KiB. Provisional [D-13] | |
| Unzipped API bundle | At most 250 MB (blocks CI) | Decision #23 |
| SymPy-only MCP bundle | Under 30 MB | PRD §15.6 |

An oversize or over-length field returns 400 `invalid_request`. The provisional limits require product-owner sign-off, as for Decision #34.

### 5.3 Rate limits and caps

| Cap | Value | Behaviour |
| --- | --- | --- |
| Pipeline turns per question session | 12. A transfer session has its own 12 | At the cap: `stuck`, `turn_cap_reached`, `turn_cap_notice` (SM-1 row 19) |
| Turns per student | 60 per hour and 15 per 5 minutes | 429 `rate_limited` with `retry_after_s`. Fixed-window counter in Postgres (`rate_counter`), because serverless instances share no memory |
| Counting rule | Each accepted, non-replayed `POST /events` counts [D-18] | An idempotent replay, a `GET` and a cron call do not count |
| LLM calls per turn | Dialogue at most 2 iterations, one repair per call, classifier at most 1 | No free-form retry |
| Idempotency record | 24 h | |
| Session inactivity | 30 minutes | `abandoned` |
| Service token | At most 60 s | |
| JWKS cache | At most 1 h | |
| Demo monthly spend | USD 100 ceiling, alert at 80% (Langfuse cost budget). Defaults pending sign-off (Decision #34) | |

### 5.4 Concurrency and consistency

- Functions are stateless. Session state lives in Postgres and is read at the start of every request.
- Events with different keys on the same session are serialised by a per-session row lock, so attempt numbers, the level and the turn counter are never raced [D-14]. A second device editing the same turn at once is out of scope.
- The idempotency record and the stored response are written in the turn's persistence transaction (WF-03 step 11). A repeat with the same key is therefore either a replay, a resume or `request_in_progress`, and never a second attempt.
- Request handlers use the pooled Postgres connection string, with a small pool. Migrations use the unpooled string. Under row-level security (T3) identity is set per transaction with `SET LOCAL` so a pooled connection cannot leak it, and a pooled-connection leak test is required.
- Cron jobs are idempotent and batched. Two overlapping invocations on the same pending work produce the same result.
- Demo load: up to 10 concurrent synthetic students, and a cohort view over 150 synthetic students.
- A repeated identical expression on the same question version returns from the exact-key cache.

### 5.5 Error handling, retry budgets and degradation

**One rule:** no dependency failure may produce a verdict, an answer leak or model text that the Safety Guard has not allowed. The student is never told they are wrong because a system failed.

**Retry budgets**

| Dependency | Budget |
| --- | --- |
| LLM output | One schema repair, inside the stage timeout. Then the fallback |
| Dialogue loop | One revision (two candidates) |
| MCP and A2A | One in-process fallback per turn, only on timeout or connect failure. An HTTP 4xx or 5xx is never retried. A second fallback in one turn goes to the deterministic fallback prompt |
| Client | One retry after 8 s with the same idempotency key |
| Reads | May be retried. Student turn writes use the idempotency key |
| Cron | No in-job retry. The remainder resumes on the next invocation |

**Failure-state contract**

| Failure | Behaviour | Student sees | Recorded |
| --- | --- | --- | --- |
| Postgres unreachable before the attempt is stored | 503 `service_unavailable`, retryable. No pipeline, no counter change | `save_failed_notice`. The answer field keeps its text | Log, Langfuse error span |
| Postgres fails after the pipeline, before the turn is stored | 503, retryable. A retry with the same key resumes from the stored attempt or reruns from scratch if none was stored | Same | Log |
| Langfuse unavailable or flush fails | Turn proceeds. Flush waits at most 300 ms. `trace_status=missing` | Nothing | `trace_missing` counter. Replay shows "trace unavailable" |
| Provider timeout, 429, 5xx, or schema invalid after one repair | Deterministic fallback with `provider_error` or `schema_invalid`. Counts toward `fallback_rate`. No session flag | `fallback_l{level}` | Audit |
| Safety loop exhausted, or guard errors or is unreachable | Deterministic fallback with `loop_exhausted` or `guard_unreachable`, flag `safety_fallback` | `fallback_l{level}` | Audit, flag |
| Turn passes the 7.5 s hard stop | Deterministic fallback with `budget` | `fallback_l{level}` | Audit |
| MCP timeout or connect failure | One in-process retry per turn | Nothing | Span `protocol: in_process_fallback` |
| MCP returns an HTTP error | `cannot_verify`, `state=tool_failure`. No counter change. No retrieval | `tool_failure_notice` | Audit |
| Clerk JWKS unreachable | Cached keys up to 1 hour, else 503. Never fail open | Sign-in error | Audit |
| Blob unavailable or SVG missing | Render from the validated spec in process, else the probe text with no diagram and `diagram_unavailable`. Never an unvalidated image | The probe text | Audit |
| pgvector or the embedding call fails | Empty retrieval. The classifier records it used no exemplars and the label is `insufficient_evidence` | Nothing | Span |
| Cache read or write fails | Treated as a miss | Nothing | Span |
| Prompt-capture guard finds free text in a prompt | The turn fails before any model call [D-20] | `fallback_l{level}` | P0 audit `prompt_capture_violation`. CI blocks on the test |

**Failure ordering handled by the orchestrator** (PRD §9.7): provider quota or 429, tool timeout, schema invalid, retrieval empty, safety block, loop exhausted. Each writes an audit event. None becomes a free-form model retry.

**Degradation fallbacks:** the deterministic `fallback_l{level}` prompt (one question or one imperative, no mathematics, passes `age_appropriate`); the authored probe text when `DIALOGUE_MODE=template`; the in-process verifier and guard; the in-process SVG renderer; a retrieval miss; a cache miss.

### 5.6 Exact-key cache

| Kind | Key includes | Shared across students |
| --- | --- | --- |
| `verifier_result` | Normalised expression, `question_id`, `question_version`, tolerance rule | Yes |
| `exemplar_query` | Verifier error category, `skill_id`, taxonomy version, canonical numeric student value | Yes |
| `prompt_template` | Prompt id and Langfuse version label | Yes |

- The key is the SHA-256 of the canonical inputs. Lookup is exact. There is no fuzzy or nearest-neighbour matching.
- The verifier cache value is the pure result only. It never holds `progress`, hint level, retry counts, `response_target` or any session field. The response-target overlay is applied after the cache and is never cached.
- Student free text, names and transcripts are never keys or values.
- Every entry has a TTL (`expires_at`) so rule, taxonomy or prompt-version changes expire. The TTL values are open values. A hit or a miss always writes a trace span.

### 5.7 Security and privacy

| Requirement | Specification |
| --- | --- |
| Authentication | Every user authenticates through Clerk. Unauthenticated callers receive no student data |
| Authorisation | Role and cohort enforced in the FastAPI dependency layer (T1) and in Postgres RLS on student-scoped tables (T3). Least privilege. Hiding a control is not the control |
| Encryption | HTTPS everywhere. Encryption at rest through managed Postgres and Vercel Blob |
| Secrets | Only Vercel Environment Variables. None in the repository or the client bundle. `VITE_`-prefixed variables never hold a secret. Rotation every 90 days and after any suspected exposure |
| Data minimisation and synthetic data | No name or email in `app_user`. Public and preview environments hold synthetic students, names and attempts only |
| Free text | Scrubbed at ingress. In Release 1.0 it reaches no LLM prompt, no Langfuse span and no cache. A prompt-capture test proves it |
| Telemetry | Pseudonymous ids only. A masking function runs before any export |
| Audit | Append-only. No free text, no full prompt, no raw model output |
| Service endpoints | MCP and A2A require a valid service token (§3.8) |
| Blob access | Controlled routes. No guessable public URLs for student-specific exports |
| Retention | §2.10 windows applied by `retention-purge` |
| Dependency and secret scanning | `pip-audit`, `npm audit` and `gitleaks` run on every pull request. A high-severity finding or a detected secret fails the build |
| Tutor safety policy | Respectful, non-shaming language. No comparison with other students. No claim about intelligence, future success or placement suitability. No unnecessary personal-information request |
| High-stakes boundary | §1.4 |
| Real-learner prerequisites | Out of scope (§1.4) |

### 5.8 Observability and traceability

- One Langfuse trace per tutor turn (`session_id` = session id, `user_id` = pseudonymous student id), with one span per agent step and tool call. The MCP call and the A2A call are separate child spans under the turn trace. W3C `traceparent` and `tracestate` propagate on every HTTP call to `solvepath-mcp` and `solvepath-safety`.
- Trace metadata: `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment`. Prompts are versioned in Langfuse and a pinned label is used per environment.
- Every turn stores provider (`LLM_PROVIDER`), model, model version, temperature, prompt version, hint-policy version, policy-config version, tool results, `trace_id`, `trace_status` and `fallback_reason`.
- The Langfuse client is flushed before the function returns. A turn that changes a prompt or model runs the evaluation suite before deployment.
- Scores

| Score | Type | Gate |
| --- | --- | --- |
| `verifier_agreement` | Deterministic | At least 99% |
| `answer_leakage` | Deterministic | 0 on the critical set |
| `hint_policy_match` | Deterministic | At least 95%. Schema consistency plus the level invariants (no intermediate numbers on levels 0–3, only `permitted_scaffold_step` on Level 4, no final answer below Level 5) |
| `schema_valid` | Deterministic | 100% after the single repair |
| `single_prompt` | Deterministic | 100% |
| `trajectory_leakage_block` | Deterministic | 0 leaks across repeated pleading |
| `age_appropriate` | Deterministic | 100% of delivered turns. Flesch-Kincaid reported (target grade 6 or lower) |
| `fallback_rate` | Deterministic | At most 5% on the live-provider eval run (provisional) |
| `attempt_before_solution`, `early_answer_rate`, `transfer_offered`, `in_process_fallback_rate` | Deterministic | Reported |
| `socratic_quality`, `tone_safety` | Model-based | Reported. Never blocks |
| `human_rubric_*` | Manual | Reported |

### 5.9 Quality gates and evaluation

| Check | Threshold | Blocks |
| --- | --- | --- |
| `answer_leakage` on the critical set (15 direct-answer, 15 injection, 12 unsafe-input cases, adversarial paraphrases, at least 10 method-leak attacks) | 0 | Yes |
| `diagram_leakage` on generated SVG specifications | 0 | Yes |
| `schema_valid`, `single_prompt`, `age_appropriate` | 100% | Yes |
| `verifier_agreement` | At least 99% | Yes |
| `hint_policy_match` | At least 95% | Yes |
| Multi-turn trajectory leakage | 0 | Yes |
| Unauthorised access, and unauthenticated calls to MCP or A2A (`tests/authz`, at least 9 Tier 1 cases) | 0 successes | Yes |
| Unapproved question or diagram delivered; invalid diagram published; teacher override without audit row | 0 | Yes |
| Misconception prompt type vs confidence (`diagnostic_probe` for a deterministic match, confidence below 0.80 or `insufficient_evidence`) | 0 violations | Yes |
| Verifier p95 | Under 400 ms | Yes |
| Tutor-turn p95 | Under 8 s | Yes |
| `fallback_rate` (live) | At most 5% | Yes |
| API bundle and cold start | At most 250 MB, p95 at most 5 s | Yes |
| Content validation V1–V9, C1–C3, contract and OpenAPI drift, story sync, FSM table parity | Pass | Yes |
| C4 (every canned key `reviewed`) | Pass | Gate B tag only |
| Demo availability | At least 99% successful API requests | Reported |
| Parse-failure rate on synthetic-student set | Above 5% is reported as a UX defect | Reported |
| Misconception accuracy | Agreement with human review at 0.80 provisional, on 60 gold cases (T2). Reported as **unvalidated** if no educator labels at least 30 of them | Reported |
| Independent leak oracle (at least 20 held-out paraphrase leaks, periodic model and human audit) | Any miss is a P0 defect added to the normaliser corpus | Reported |

The critical set is the direct-answer, injection and unsafe-input cases. The launch suite has at least 150 unique labelled cases, one primary category each, with at least one case in every PRD §14.1 category. The Tier 1 gate has 42 critical cases plus the golden trajectory.

**Where gates run**

| Gate | Pull request (replay fixtures) | Nightly and before release (live provider) |
| --- | --- | --- |
| Deterministic stages: verifier, matcher, retrieval gate, hint policy, leakage and phrase checks, Input Screen, fallback, FSM | Blocks | Blocks |
| `answer_leakage`, `diagram_leakage`, trajectory leakage, `single_prompt` on fixtures | Blocks | Blocks |
| `schema_valid`, `hint_policy_match`, `age_appropriate` | Blocks (fixtures) | Blocks (live output) |
| `fallback_rate`, tutor-turn p95, verifier p95 | Not measured | Blocks |
| Authorisation, content validation, contract drift, story sync, bundle size, cold start | Blocks | Blocks |
| Independent leak oracle, `socratic_quality`, `tone_safety` | Not run | Reported |

A change to a prompt, the hint policy or the model configuration also runs the live column before merge. The golden trajectory `test_demo_trajectory.py` has a replay mode (blocking on every pull request, recorded schema-valid LLM fixtures, deterministic stages always real) and a live mode (nightly and before release). Provider tiers: the primary provider must pass 100% of the Release 1.0 gates. An alternate provider must keep `answer_leakage = 0` and reach `schema_valid` of at least 95% with automatic fallback on any parse failure.

### 5.10 Availability, accessibility, deployment and operations

| Area | Requirement |
| --- | --- |
| Availability | At least 99% successful API requests on the demo (reported) |
| Backup and recovery | Neon point-in-time recovery. Demo targets RPO 24 h, RTO 4 h. Not a production claim |
| Accessibility | WCAG 2.1 AA target for the practice screen. Keyboard operation, labelled controls, sufficient contrast, text alternatives for diagrams, no colour-only meaning, accessible equation display, `aria-live="polite"` on the wait state. `axe` runs in CI. Charts have text alternatives |
| Devices | iPad Safari 16 and later, current Chrome and Edge, 768 px tablet viewport minimum. Phone layout best effort |
| Hosting | Four Vercel projects: `solvepath-web`, `solvepath-api`, `solvepath-mcp`, `solvepath-safety`. The web project rewrites `/api/:path*` to the API project (same origin, no CORS). The API stays container-portable |
| Environments | Development, Preview (own database and Langfuse credentials), Production (synthetic data only) |
| Vercel plan | Pro, so hourly cron is available |
| CI/CD | GitHub Actions `ci.yml`, `eval.yml`, `deploy-preview.yml`, `deploy-prod.yml`, `content-validate.yml`. Vercel Git integration deploys, with Actions as the required quality gate |
| Deployment limits | Cron frequency, function duration and bundle size depend on the Vercel plan and are to be confirmed against current documentation before schedules are finalised |
| Incident response | The runbook documents incident reporting, access revocation and data deletion |
| Configuration | `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION`, `RETENTION_POLICY_VERSION`, `DIALOGUE_MODE`, `LLM_PROVIDER`, `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING`, `LLM_TIMEOUT_SECONDS`, service-token and cron secrets, Clerk and Langfuse settings |

---

## 6. Requirements Traceability Matrix

Every Functional Requirement ID in `PRD.md` §8 maps to the SPEC sections, entities, interfaces and workflows that implement it.

| FR ID | PRD title | Tier | Entities and data contracts (§2) | Interfaces (§3) | Workflows (§4) | Non-functional (§5) |
| --- | --- | --- | --- | --- | --- | --- |
| FR-01 | Authentication and role-based access | T1 slice, T2 reviewer and coordinator surfaces, T3 RLS and full matrix | §2.1 `app_user`, `user_grant`, `cohort`, `cohort_assignment`, role-action matrix | §3.1 error codes, §3.4 OP-18 to OP-20 and role scoping of all OP rows, §3.8 | WF-01, WF-20 | §5.4 (RLS `SET LOCAL`), §5.7, §5.9 (`tests/authz`) |
| FR-02 | Question delivery | T1 (10 items), T2 (40 items, reviewer queue) | §2.2 `question`, SM-3, V1–V9, `diagram_asset`, skill graph | §3.2 `POST /api/sessions`, §3.3 `GET /api/questions`, §3.6 `get_question`, OP-16, OP-17 | WF-02, WF-19 | §5.9 (unapproved delivery 0), §5.1 (load under 2 s) |
| FR-03 | Student attempt capture | T1 | §2.3 `attempt`, `student_note`, `tutor_turn`; §2.2 authored text registry; §2.10 attempt input validation | §3.2 `TurnRequest` and allowed-fields matrix, §3.9 `scrub_pii`, `input_screen`, `normalise`, §3.10 | WF-03, WF-04, WF-05 | §5.2, §5.7 (free text boundary) |
| FR-04 | Deterministic mathematics verification | T1 (MCP and cache T1b) | §2.4 `PureVerifierResult`, `VerifierOutcome`, error-category and relation-tag mappings, pure-status table | §3.6 `verify_expression`, §3.9 `apply_overlay`, `match_prediction` | WF-06, WF-07 (matcher), WF-04 | §5.1 (400 ms, cache under 20 ms), §5.5, §5.6, §5.9 |
| FR-05 | Socratic tutoring workflow | T1 | §2.3 `tutoring_session`, `session_flag`, `idempotency_key`; §2.8 SM-1 | §3.2 all five routes, controls by state, idempotency contract, §3.9 `transitions.apply`, Orchestrator | WF-03, WF-04, WF-10, WF-11, WF-14 | §5.1, §5.3 (turn cap), §5.4 |
| FR-06 | Hint policy | T1 | §2.4 `HintDecision`; §2.2 `scaffold_probes`, `method_leak_patterns`, `isomorphic_worked_example`; §2.1 `cohort.allow_level_5` | §3.9 `decide_hint`, `check_candidate`, `render_solution_turn`, `render_example_turn` | WF-08, WF-09 | §5.5, §5.8 (`hint_policy_match`), §5.9 |
| FR-07 | Misconception classification | T1 (calibration T2) | §2.2 taxonomy, `misconception_exemplar`; §2.3 `misconception_event`; §2.4 `MisconceptionClassifierOutput`; SM-8 | §3.6 `search_exemplars`, OP-03, OP-06 | WF-07 | §5.1 (classifier 1,000 ms), §5.9 (prompt-type check, calibration) |
| FR-08 | Learner model | T1 turn-time, T2 aggregates | §2.5 `learner_skill_state`, mastery rules | §3.3 dashboard, §3.9 `update_learner_model`, `recommend_next` | WF-12, WF-02, WF-15 | §5.1 (persisted before response), §5.4 |
| FR-09 | Diagram support | T1 ratio table, T2 bar model | §2.2 `diagram_asset`, SM-4 | §3.2 `GET /api/sessions/{id}/diagram`, §3.9 `render_diagram`, `validate_diagram` | WF-13 | §5.5 (Blob failure), §5.9 (`diagram_leakage`), §5.10 (accessibility) |
| FR-10 | Transfer question | T1 | §2.3 `tutoring_session.linked_session_id`, `transfer_outcome`; SM-1 rows 13–18; V8; skill graph | §3.2 `transfer_decision`, §3.9 `select_transfer` | WF-10, WF-11 | §5.3 (transfer turn cap), §5.9 |
| FR-11 | Student dashboard | T2 | §2.5 `learner_skill_state` | §3.3 `GET /api/me/dashboard` | WF-15 | §5.1 (under 3 s), §5.10 (accessible charts) |
| FR-12 | Teacher dashboard | T1c one draft, T2 | §2.6 `recommendation`, `review_flag`, `content_review_item`; SM-2 | §3.4 OP-01 to OP-04, OP-08 to OP-11, OP-14, OP-15 | WF-16, WF-18, WF-20 (`allow_level_5`) | §5.1 (under 3 s for 150 students) |
| FR-13 | Session replay | T1c minimal, T2, T3 retention | §2.6 `teacher_comment`, `tutor_note`; §2.3 `tutor_turn`, `student_note`; §2.10 retention | §3.4 OP-05 to OP-07, OP-12, OP-13, `Replay` | WF-17, WF-23 | §5.7 (retention), §5.8 (trace links) |
| FR-14 | Content quality and item assurance | T2 | §2.6 `content_review_item`; SM-3, SM-5; §2.2 `question_embedding` | §3.4 OP-16, OP-17 | WF-19, WF-22 (`item-quality-scan`) | §5.9 |
| FR-15 | Auditability | T1 slice, T3 viewer | §2.7 `audit_event` | §3.4 OP-21 | WF-21 and the audit side effects of every workflow | §5.7, §5.8 |
| FR-16 | Background processing | T1b `warmup`, T2 rollups, T3 purge | §2.7 `job_run`, `cache_entry`, `rate_counter`; SM-7 | §3.5 | WF-22, WF-23 | §5.3, §5.4, §5.5 |

