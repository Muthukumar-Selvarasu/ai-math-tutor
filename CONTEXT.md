# SolvePath — Project Context (CONTEXT.md)

Distilled from `PRD.md` (v1.3.18), `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`. Upstream source for later tool-specific files (`CLAUDE.md`, Cursor rules). No value here is new: **Stated** = fixed by a source. **TBD/Open** = sources defer it; do not decide it. If this file and a source disagree, the source wins; fix this file.

---

## 1. Project Mission & Domain Context

### 1.1 Mission
- **Product:** SolvePath, a multi-agent, evidence-driven **Socratic mathematics tutor**. It helps students *think*, not just get answers.
- **Market / scope:** Australian Years 5–6 learners preparing for selective-entry style tests. Curriculum: ratio, proportion, scale/maps, simple rates and unit rate, multiplicative comparison, percentages only where tied to proportional reasoning. Ratio items map to the Year 7 ratio code with the Year 6 foundation code beside it.
- **Problem:** static question banks, generic hints, immediate worked solutions that invite copying, score-only reports, no "why" of an error, no transfer measure. Teachers cannot review reasoning, see recurring misconceptions, or spot hint-dependent students, and need AI that makes no high-stakes decisions.
- **Goals:** Socratic prompt before any answer; deterministic maths verification; misconception labels for teachers; deterministic adaptive hints; learner-model evidence (mastery, hint dependency, time, attempts, transfer); teacher visibility; safe operation (RBAC, audit, human approval).
- **Release 1.0 is a structured-input tutor** (controls, not open chat). Free text is only a note for the teacher; no model reads it.
- **Release tiers:** T1 = P0 (Release 1.0a/1.0, Gates A/B/C), T2 = P1 (Release 1.1), T3 = P2 (Release 1.2). Release 1.0 needs ≥ 10 approved items (40 at 1.1), 42 critical eval cases plus the golden trajectory, minimal teacher replay (T1c).
- **Users / roles (enum):** `student`, `parent` (no route exists), `tutor`, `teacher`, `academic_coordinator`, `content_reviewer`, `administrator`. Grant: `trace_review`.

### 1.2 Non-goals (never build)
No grading of formal assessments, placement/admissions/exclusion/remedial classification, diagnosis of learning difficulty, welfare or safeguarding decisions, parent/student messaging, mental-health/medical/legal advice, exam-success promises, autonomous content publication or question generation, open ReAct loop, free text to any model, handwriting/voice/LMS/native apps/multi-language/IRT/leaderboards.

### 1.3 Vocabulary

| Term | Meaning |
| --- | --- |
| Hint levels 0–5 | 0 independent attempt · 1 attention orientation · 2 conceptual scaffold · 3 representation support · 4 partial worked step (`permitted_scaffold_step`) · 5 full worked solution (`permitted_solution`) |
| Pipeline turn | A turn counted toward the 12-turn cap (`tutoring_session.turn_number`). Distinct from `tutor_turn.turn_number` (per-session ordinal of persisted rows) |
| Counted attempt | `attempt.counted=true`; only substantive attempts. Counts toward the Level 5 minimum of 3 |
| Verifier `status` | `correct` · `incorrect` · `partially_correct` · `cannot_verify`. `state`: `ok` · `tool_failure` (state, never a status) |
| `PureVerifierResult` | Session-independent, cacheable verifier output. **Overlay** (`apply_overlay`) adds `response_target` (`final`/`step`/`probe`) and session context; never cached |
| Input kind | `value` · `ratio` · `expression` · `unparsed` |
| Expression | Judged by **form** against step `target_expression`; never evaluated into a final answer |
| Misconception taxonomy (closed, 13) | `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, `answer_guessing`, `insufficient_evidence` |
| Hypothesis vs verdict | Misconception codes are teacher-only hypotheses; they never reach the student and never alter correctness |
| Probe | Authored `scaffold_probes` entry (≤ 4 per item); policy picks the first unasked with `min_level` ≤ level |
| Authored vs generated | Reflection, transfer offer, Level 4–5 content, canned text, diagrams, fallbacks are authored/templated, not generated |
| Canned registry | `content/safety/canned_responses.json`, 28 keys, status `draft`/`reviewed` |
| Input Screen | Deterministic lexicon check (`content/safety/input_lexicon.json`); categories `answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase` |
| Skill graph | Postgres `graph_node`/`graph_edge`; edges `prerequisite`, `indicates`, `remediates`. Graph decides legality; vectors only shortlist/tie-break |
| Turn kinds | `model`, `probe_template`, `authored`, `canned`, `fallback`, `solution` |
| Fallback reasons | `loop_exhausted`, `guard_unreachable`, `provider_error`, `schema_invalid`, `budget` |
| Session flags | `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached` (≤ 1 per `(session_id, kind)`) |
| Events | `submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision`, `note` |
| Prompt types | `targeted_scaffold`, `diagnostic_probe`, `reflection` |
| Cohort setting | `allow_level_5` (default `false`; capstone/self-study cohorts set `true`); only runtime teacher-owned policy input |

### 1.4 Business invariants
1. Tutor asks before telling: one focused question or imperative per turn, age-appropriate, non-shaming, no comparison with other students.
2. No model issues a verdict, a hint level, a route, a tool choice or a state transition.
3. No solution value/method below the level that permits it (Level 4 may quote only `permitted_scaffold_step`; never the final answer below 5).
4. Level 5 only via all four: hint level 4 · ≥ 3 counted attempts · explicit "Show me the solution" control · `allow_level_5=true`; original item only. A transfer item never gets a worked solution.
5. Quoting values given in the question stem, and values already verified correct for the student, is exempt from leakage blocking.
6. Escalation inputs are only: attempt outcome, counted attempts, explicit solution request, `allow_level_5`. Time, history, year level, pleading, typed requests never change the level (Decision #25).
7. Synthetic students only in every public/preview environment; no name/email in `app_user`.

---

## 2. System Boundaries & Invariant Contracts

### 2.1 Out of scope (SPEC §1.4, PRD §7.2)
Everything in §1.2, plus: algebraic expressions with a variable (not enabled), real-learner deployment (consent flow, deletion path, paid/Vertex tier, Sydney region, customer Langfuse), parent route, self-service registration, per-student policy overrides, timed/exam mode, student-authored content, automatic prompt rollback/A/B routing, external SIEM, separate graph database, caching raw student free text.

### 2.2 Hint escalation (Decision #18; FR-04/FR-06)

| Outcome | Raises level | Counted |
| --- | --- | --- |
| `correct` | No | Yes |
| `partially_correct`, `progress=advancing` (new matched step) | No | Yes |
| `partially_correct`, stalled/incomplete | Yes (+1, cap 4) | Yes |
| `incorrect` | Yes (+1, cap 4) | Yes |
| `not_sure` | Yes (+1, cap 4); no verifier/matcher/retrieval/classifier | No |
| `cannot_verify` (`state=ok`) or `tool_failure` | No | No |

Two consecutive `cannot_verify` (`state=ok`) on one question version → `input_mode=structured`, flag `ambiguity_review`. `allow_level_5=false` → isomorphic worked example + `support_withheld_notice`, flag `support_withheld`, item answer not shown. Level 1–3 with no unused probe, or Level 4 unsuccessful with none left → canned `fallback_l{level}`, no model.

### 2.3 Session FSM (SM-1)
- Source of truth: `apps/api/app/fsm/transitions.yaml` (loaded at runtime); parity with SPEC checked by `tests/fsm/test_table.py`. `transitions.apply` is the **only** place state changes. Unlisted (state, event) → 409 `transition_not_allowed`, no change, independent-transaction audit.
- States: `awaiting_first_attempt`, `active`, `reflection`, `transfer_offered`, `transfer_active`; terminal `completed`, `declined`, `stuck`, `abandoned`.
- Key rows: first submit/`not_sure` → `active` · verifier `correct` on final → `reflection` (authored; no model/verifier/retrieval/guard) · reflection choice → `transfer_offered`, or `completed` (`no_legal_transfer`) · accept → original `completed`, new linked session in `transfer_active` (R1) · decline → `declined` (`transfer_outcome=skipped`) · transfer `correct` → `completed` · transfer Level 4 ∧ ≥ 3 counted ∧ latest `incorrect`/`partially_correct` → `completed` + `stuck_after_transfer` · 12th pipeline turn without `correct` → `stuck` + `turn_cap_reached` (no worked solution) · 30 min idle → `abandoned` (lazy, `ended_at = last_activity_at + 30 min`) · Input Screen hit / note → same state.
- Pipeline-turn cap rows: 4, 6, 9, 10, 11, 22 count; 5, 7, 8, 21 do not. `show_solution` in `transfer_active` → 409 + audit.
- Controls by state (client renders only `tutor.controls`): `awaiting_first_attempt`/`transfer_active` = answer, steps, options, not_sure, note (no `show_solution`); `active` = all six; `reflection` = choices + Skip + note; `transfer_offered` = Accept/Decline + note; terminal = read-only summary, "Next question", note.
- Aggregate invariants: pinned `question_version` never changes; `current_hint_level` changes only via `decide_hint` output, never > 4 except the granted Level 5 turn; terminal session accepts no write except the `transfer_outcome` back-fill (same TX that ends the linked session).
- Other lifecycles: SM-2 recommendation `pending → accepted|rejected|overridden` (override needs rationale; different second decision → 409); SM-3 question publication (`imported → approved → published`, flag ⇒ unservable, edit ⇒ new version); SM-6 idempotency `in_progress → done`; SM-7 job run `running → succeeded|partial|failed`; SM-8 misconception review `unreviewed → confirmed|rejected` (assigned teacher only).

### 2.4 Verifier contract
- Pure result fields: `schema_version`, `status`, `state`, `confidence`, `input_kind`, `canonical_value` (exact decimal string), `unit`, `canonical_expression`, `matched_solution_step`, `path_id`, `matched_step_ids`, `error_category` (closed enum: `none|arithmetic|unit_error|missing_unit|incomplete|additive_difference_match|reversed_ratio_match|inverse_operation_match|unknown_numeric_discrepancy`), `relation_tags`, `accepted_answer`, `explanation_constraints`.
- `error_category` → candidate code (hypothesis only): additive → `ratio_additive_interpretation`; reversed → `ratio_reversal`; inverse_operation → `scale_direction_error`; unit_error → `unit_conversion_error`; arithmetic → `arithmetic_error_after_correct_setup`; `missing_unit`/`incomplete` → none; `unknown_numeric_discrepancy` → `insufficient_evidence`.
- Cache key = SHA-256(normalised expression, `question_id`, `question_version`, tolerance rule). Value = pure result only.
- Overlay: `final` (a non-correct value equal to an intermediate step → `incorrect`, `error_category=incomplete`), `step`, `probe` rules per PRD FR-04. `unparsed` stays `cannot_verify` always.
- Input rules: dot decimals only; comma valid only as thousands separator in the `30,000` pattern, else `cannot_verify` + `use_dot_for_decimals`. `×`/`÷` always operators; `x` between numerals = `×`; `/` = fraction in answer field, `÷` in step/probe field. Word numerals and unit suffixes normalised. One shared normaliser (`app/verifier/normaliser.py`) for verifier and leakage check.
- Matcher: only for post-overlay `incorrect` with `input_kind` `value`/`ratio`; match → confidence 0.90, `source=deterministic_match`, `diagnostic_probe`, skips retrieval/classifier. Classifier `targeted_scaffold` only at confidence ≥ 0.80 and code ≠ `insufficient_evidence`; threshold stored with `POLICY_CONFIG_VERSION`.
- Retrieval gate opens only for post-overlay `incorrect` without match, or `cannot_verify` with `state=ok` (stored label forced to `insufficient_evidence`). Query = numbers only.

### 2.5 Content validation (offline import; must never be bypassed)
- **V1** 2–4 main-path steps, final step has no `permitted_scaffold_step` · **V2** no accepted value as literal in scaffold step (except expression inside `permitted_scaffold_step`), probe template, other item's isomorphic example, diagram label · **V3** no prediction collisions · **V4** accepted value ≥ 2 digits or `answer_requires_unit` · **V5** ≤ 4 probes, probe value/expression consistency · **V6** non-empty `method_leak_patterns` · **V7** alternate paths reach `accepted_answer_spec` · **V8** legal transfer partner exists · **V9** reflection block (≤ 1 question, one `{student_value}`, 3–4 options, ≥ 1 `sound:true`).
- **C1** 28 canned keys · **C2** sentences ≤ 25 words, ≤ 1 question mark, no digits/taxonomy code/jargon · **C3** each `fallback_l{n}` exactly one question or imperative, no mathematics · **C4** all keys `reviewed` (`pytest -m release`, Gate B tag only).
- Serve filter (everywhere incl. vectors, planner): `approved ∧ published ∧ ¬flagged ∧ scope enabled ∧ FR-02 complete`. Published `question` versions are immutable; an edit creates a new version.

### 2.6 Core data & API contracts
- IDs: `question_id` text slug (e.g. `scale_0001`); all else UUID; student id in audit/traces/caches = pseudonymous `app_user.id`; timestamps `timestamptz` UTC; browser text is plain text, no HTML.
- Tables (named in sources): `app_user`, `user_grant`, `cohort`, `cohort_assignment`, `question`, `diagram_asset`, `graph_node`, `graph_edge`, `misconception_exemplar`, `question_embedding` (`vector(768)`), `tutoring_session`, `attempt`, `tutor_turn`, `student_note`, `session_flag`, `misconception_event`, `idempotency_key`, `rate_counter`, `cache_entry`, `learner_skill_state`, `recommendation`, `teacher_comment`, `tutor_note`, `content_review_item`, `audit_event`, `job_run`, `intervention_export`.
- `tutoring_session` lease fields: `lease_holder`, `lease_expires_at`, `lease_stage` (`checking|preparing|done`).
- Attempt PK = UUIDv5(session id, `Idempotency-Key`) (DD-03). `tutor_turn` is written for every answer-bearing event (incl. canned replies like `rephrase_request`); none for Input Screen hits or note acks (DD-02). `tutor_turn` and `attempt` columns follow PRD §10.7; new data goes in JSON fields before new columns.
- Error payload: single shape; codes seen: 400 `invalid_request`, 401 `unauthenticated`, 403 `forbidden`, 404 `not_found`, 409 `request_in_progress` (`retry_after_s=2`) / `idempotency_conflict` / `transition_not_allowed`, 429 `rate_limited` (`retry_after_s`), 503 `service_unavailable`. `X-Request-Id` on every response. `Idempotency-Key` (UUID) required on events; replay returns stored response with `Idempotent-Replay: true`; records live 24 h.
- Student asking for another student's session → 404 (ownership inside repository query) + audit `access_denied`.
- `TurnResponse` carries no verdict, code, `sound` flag, or solution value below Level 5.
- Request limits (provisional, need owner sign-off): body ≤ 8 KiB; `answer_text`/`step_expressions[0]` ≤ 64 chars; notes/comments ≤ 1,000 chars; `confidence_rating` provisional 1–5.
- Learner model (WF-12, Decision #21): Level 0 success +0.15 mastery; Levels 1–3 +0.05; Levels 4–5 +0; cap 1.0; successful transfer +0.20 confidence; conflict (≥ 1 `correct` and ≥ 1 `incorrect`/`partially_correct` in last 3 counted attempts on a skill) −0.10 confidence, floor 0; applied once per persisted counted attempt; new skill state starts 0.0. Mastery rules versioned behind `update_learner_model`.
- Retention (`RETENTION_POLICY_VERSION`): `tutor_turn.body` 90 d (null) · `attempt` payload fields 365 d (deleted) · notes/comments 365 d (body deleted) · Langfuse traces 90 d · student-specific blobs 90 d · `audit_event` and approved question diagrams never deleted.

### 2.7 Transaction & concurrency contracts (never bypass)
- Per turn: **TX-A** (short: lock session `FOR UPDATE`, lazy abandonment, SAVEPOINT {idempotency insert, rate counter, lease check, `transitions.apply`, attempt insert, take lease}, commit) → unlocked pipeline (≤ 7.5 s) → **TX-B** (`UPDATE … WHERE lease_holder = key`; 0 rows ⇒ rollback + 409; writes turn, attempt.counted, session fields, events, learner write, flags, audit, idempotency `done` + stored response, clear lease).
- Order at TX-A: 429 check before `transitions.apply`.
- Rejection audits (403/404/409/429/token failures) go in an independent transaction.
- Retry with expired lease and existing attempt resumes from the stored attempt; no second attempt, `attempt_count` untouched before TX-B.
- Rate limits: 60/hour and 15/5 min per student, counted per accepted non-replayed `POST /events`. Pipeline cap 12 per session (a transfer session has its own 12). Session inactivity 30 min.

### 2.8 Quality gates (block merge)
`answer_leakage` = 0 · `diagram_leakage` = 0 · trajectory leakage = 0 · `schema_valid`/`single_prompt`/`age_appropriate` 100% · `verifier_agreement` ≥ 99% · `hint_policy_match` ≥ 95% · 0 authorisation failures (≥ 9 Tier 1 `tests/authz` cases, incl. unauthenticated MCP/A2A) · 0 unapproved question/diagram delivered · 0 prompt-type-vs-confidence violations · verifier p95 < 400 ms · tutor-turn p95 < 8 s · `fallback_rate` ≤ 5% (live) · API bundle ≤ 250 MB, cold-start p95 ≤ 5 s · V1–V9, C1–C3, contract/OpenAPI drift, story sync, FSM parity pass.

---

## 3. Architectural Topology & Implementation Conventions

### 3.1 Stance
**Deterministic workflow harness with bounded LLM stages**, not an agent mesh. Table-driven FSM decides what may happen, fixed pipeline decides order, schema-bound model calls only phrase text.

Rules A1–A5: (A1) orchestrator is the only component talking to browser, MCP, A2A, LLM provider, Blob and Postgres for a student; (A2) every dependency failure degrades to a deterministic result (never a verdict, leak or unguarded model text); (A3) all durable state in Postgres (+ Blob refs), functions stateless; (A4) authorisation decided in Postgres every request, only token `sub` trusted; (A5) verifier result pure and cacheable, session applied in an uncached overlay.

### 3.2 Deployable units (monorepo, four Vercel projects)

| Unit | Root / entrypoint | Notes |
| --- | --- | --- |
| `solvepath-web` | `apps/web` (static) | React SPA, untrusted. Rewrites `/api/:path*` to API (same origin, no CORS). Renders only `tutor.controls` |
| `solvepath-api` | `apps/api` / `api/index.py` | FastAPI + ADK orchestrator, routers, cron routes. Unzipped bundle ≤ 250 MB |
| `solvepath-mcp` | `apps/api` / `mcp_server.py` | Tools `verify_expression`, `search_exemplars`, `get_question`. Bundle < 30 MB, cold start < 1.2 s. **No ADK, pandas, torch, transformers.** Holds solution data. Callers: orchestrator only |
| `solvepath-safety` | `apps/api` / `a2a_safety.py` | Verdict-only A2A guard. No domain-data read access. Callers: orchestrator only |
| Data / objects / telemetry | Neon Postgres + pgvector · Vercel Blob · Langfuse Cloud | Pooled string for requests, unpooled for migrations |

Repo layout (PRD §16.1; module names beyond SPEC-named ones are logical/indicative): `apps/web/src/{features/{student,educator,admin},lib}`, `apps/api/{api/index.py,mcp_server.py,a2a_safety.py,app/{main.py,core,routers,agents,verifier,policy,learner_model,diagrams,db,jobs},tests,pyproject.toml,vercel.json}`, `content/{questions,misconceptions,safety,eval,seed}`, `docs/{adr,threat-model.md,runbook.md}`, `scripts/{sync_stories.py,seed_synthetic.py}`, `.github/workflows/`.

### 3.3 Layers of `apps/api` (dependencies point downward only)

| Layer | Contents | May depend on |
| --- | --- | --- |
| L0 Contracts | `contracts` (Pydantic v2, single source of truth), enums, error payload | — |
| L1 Edge | request-id, auth (Clerk JWT/JWKS), scope resolution, audit middleware, rate limiter, idempotency gate, error mapper | L0, L6 |
| L2 Routers | student/educator/coordinator/reviewer/admin/jobs. Parse, authorise, delegate. **No business rules** | L0, L1, L3 |
| L3 Application services | `run_turn` orchestrator, session/transfer/dashboard/review/content/admin services, job runners. Own transactions | L0, L4, L5, L6 |
| L4 Deterministic engines | `transitions.apply`, `normalise`, `scrub_pii`, `input_screen`, pure verifier, `apply_overlay`, `match_prediction`, `retrieval_gate`, `estimate_student_state`, `decide_hint`, `check_candidate`, `render_solution_turn`, `render_example_turn`, `select_transfer`, `recommend_next`, `update_learner_model`, `render_diagram`/`validate_diagram`, wording check | L0 only. Pure: no I/O, no model calls, clock only via injected `now` |
| L5 Agent layer | ADK `SequentialAgent` pipeline, `LoopAgent`, `BaseAgent` wrappers, three `LlmAgent`s, callbacks | L0, L4, L7 |
| L6 Persistence | repositories (scope + serve filter built in), unit-of-work with mandatory audit writer, exact-key cache store, rate-counter store, RLS context setter (T3) | L0 |
| L7 Adapters | MCP client, A2A client (both with in-process fallback), provider adapter, Blob client, Clerk JWKS client, Langfuse exporter + masking | L0 |

Shared code allowed in MCP/Safety bundles: `contracts` subset (Pydantic only); `verifier` (SymPy + mpmath only; **no ADK, SQLAlchemy models or provider adapter**); narrow read repo; `embed` (plain HTTP, no vendor SDK); service-token verifier; `app.safety.service`. `app.verifier.service` and `app.safety.service` are the **same modules** used over HTTP and for the in-process fallback.

### 3.4 Communication
- Everything that gates a student-visible turn is **synchronous**. Async only: Langfuse export (flush ≤ 300 ms), cron jobs, optional progress stream (`text/event-stream`, stage names only). No queue, no worker on the student path.
- Orchestrator → MCP/A2A: MCP streamable HTTP (stateless) / A2A HTTP, HMAC service bearer, W3C `traceparent`/`tracestate`.
- Fixed pipeline (one `SequentialAgent`): 1 `ProblemContext` → 2 `MathVerifier` → 3 `DeterministicMisconceptionMatcher` → 4 `RetrievalGate` → 5 `StudentStateEstimator` (+ `MisconceptionClassifierAgent` if gate open) → 6 `HintPolicyEngine` → 7 `LoopAgent[SocraticDialogue → DeterministicLeakCheck → SafetyGuard]` (≤ 2 iterations, then final deterministic override) → 8 `fallback_l{level}`.
- Turn deadline: 7.5 s hard stop; stage timeout = `min(stage_timeout, remaining)`; do-not-start rule; revision gate needs 1.4 s + 1.2 s + 200 ms remaining; 200 ms persistence reserve; at most one in-process fallback per turn.
- Question load on the hot path: repository directly (DD-05, 150 ms ingress budget). Verification always via MCP (cache → MCP → in-process).

### 3.5 Patterns to follow
Workflow harness not ReAct · table-driven FSM · functional core / imperative shell · pure result + uncached overlay · bounded loop with deterministic gate first (a deterministic hit always beats guard `allow`) · fail-closed fallback ladder ending in authored mathematics-free text · ports and adapters · proxy with in-process fallback · policy as versioned data (`HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION`, Langfuse prompts, `canned_responses.json`, `input_lexicon.json`, `jargon.json`) · authored over generated content · closed enum + schema validation (reject, never guess-repair) · idempotent receiver with session lease · unit of work with mandatory audit · exact-key cache-aside · repository with built-in scoping · lazy state normalisation (abandonment) · resumable batch jobs (`FOR UPDATE SKIP LOCKED`, work derived from data) · skill graph as curriculum memory · contract-first (`contracts.py` → OpenAPI → web types) · append-only audit ledger · callbacks as guards.

Key decisions (DD-xx): DD-01 lease + TX-A/TX-B · DD-02 turn-row rule · DD-03 UUIDv5 attempt id · DD-04 ADK as execution engine only (state rebuilt from Postgres each request) · DD-05 repo question load · DD-06 Postgres only shared store · DD-07 pure verifier behind MCP with in-process fallback · DD-08 safety as A2A service + deterministic first line · DD-09 persist then flush Langfuse (`trace_status` corrective update) · DD-11 authored reflection · DD-12 linked transfer session · DD-13 role checks in dependencies, scope in repositories, RLS (T3) defence in depth · DD-14 separate DB roles per deployable · DD-15 abandonment in request path · DD-16 cursorless jobs.

Irreversible (change only by new version/migration): pseudonymous `app_user.id` keys; immutable `question` versions; append-only audit schema; `vector(768)`; 13-value taxonomy (extend by migration + `taxonomy_version`); public API contract (`TurnRequest`/`TurnResponse`/error payload); `tutor_turn`/`attempt` column set; four-deployable split; hint ladder invariants; deterministic mastery rules.

### 3.6 Anti-patterns / smells (forbidden)

**Agent & model:** model chooses tool/route/verdict/level/transition; open ReAct loop; student free text in any prompt, Langfuse span, cache key or value; streaming or storing a draft before check + guard + override; free-form model retry; LLM agent holding a tool client, repository or accepted answer; misconception code reaching the student or altering correctness; LLM-generated diagrams, questions, reflection or transfer text on the student path.

**Architecture:** upward imports (L4 importing L5/L6/L7); SQL outside L6; vendor SDKs/HTTP clients outside L7; business rules in routers; DB session bypassing the unit-of-work audit writer; ADK `DatabaseSessionService` as record; ADK/SQLAlchemy models/provider adapter in the shared verifier module; second shared store (Redis, in-memory, graph or vector DB) without superseding DD-06; fuzzy/semantic cache; verifier cache values holding `progress`, level, retry count or `response_target`; state change outside `transitions.apply`; hard-coded provider, model id, URL or threshold.

**Persistence/concurrency:** DB connection held across MCP/A2A/LLM calls; session-level Postgres state (`SET` instead of `SET LOCAL`, session advisory locks, prepared-statement reliance); migrations via pooled string or from a request handler; stored cron cursor or advisory lock; `UPDATE`/`DELETE` on `audit_event`; free text, full prompt or raw model output in audit rows; write to a terminal session except `transfer_outcome` back-fill; mutating a published `question` version; using `tutor_turn.turn_number` for the cap.

**Security:** trusting any token claim except `sub`; fail-open on JWKS, service-token or cron-secret checks; secret in repo, `VITE_` variable, client bundle, log or trace; shared service-token secret across MCP and Safety, or signing secret in the verifying service; guessable public URL for student-specific Blob objects; real student data in public/preview environments.

**Delivery:** CORS configuration; handwritten web types for API shapes; changing a prompt, hint policy or model configuration without running the evaluation suite; bundle growth past 250 MB / 30 MB (MCP must not gain ADK, pandas, torch, transformers); Vercel-specific APIs in L0–L6; unpinned `google-adk`, MCP SDK, A2A SDK, Gemini model id or embedding model once the Phase 0 ADR exists.

---

## 4. Technology Stack & Operational Constraints

### 4.1 Stack

| Layer | Stated choice | Version |
| --- | --- | --- |
| Backend | Python, FastAPI (async endpoints), Pydantic v2, SQLAlchemy 2.x, Alembic | Python **3.12**; FastAPI, Alembic **TBD** (Phase 0 ADR) |
| Agents | Google ADK (`SequentialAgent`, `LoopAgent`, `LlmAgent`, `BaseAgent`, callbacks); MCP (streamable HTTP, stateless) and A2A as separate entrypoints | Exact pins **TBD** (Decision #30): `google-adk`, MCP SDK, A2A SDK |
| Maths | SymPy, mpmath | **TBD** |
| Frontend | TypeScript, Vite SPA, React 18, React Router, TanStack Query, Tailwind CSS, KaTeX, Clerk SDK, accessible primitives (Radix named as example) | React 18.x; others **TBD** |
| Data | PostgreSQL on Neon + pgvector (`CREATE EXTENSION IF NOT EXISTS vector;` in first Alembic migration); cache = `cache_entry` table; skill graph = Postgres edges | — |
| Storage | Vercel Blob (diagram SVGs, imports, exports) | — |
| LLM | Provider adapter via `LLM_PROVIDER`: Gemini (default), OpenRouter (alternate), vLLM (later swap). Embeddings `vector(768)` from `MODEL_EMBEDDING` | Model ids **TBD** |
| Identity | Clerk (identity proof only; role/scope from Postgres) | — |
| Observability | Langfuse Cloud, OTLP, OpenTelemetry/OpenInference for ADK | — |
| Jobs / hosting / CI | Vercel Cron → `/api/jobs/*`; Vercel Pro, four projects; GitHub Actions gate, Vercel Git integration deploys | Node 20 in CI |
| **Not named (choose at implementation)** | Postgres driver, HTTP client, OpenAPI→TypeScript generator, import-linter tool, logging format/sink, compute/memory sizing | — |

Open: structured-output route (ADK `output_schema` vs adapter JSON mode; Phase 0 spike, Decision #27); deploy spike (≤ 4 h) decides whether API/MCP/Safety move to containers (Railway/Docker, three daemon processes; base image, Dockerfile, memory/CPU **TBD**); repo licence (A3).

### 4.2 Local setup & commands (only those the sources name)
Prereqs: Python 3.12 venv, Node 20, `npm`, `vercel` CLI, `gitleaks`, Git; accounts: Vercel (Pro), Neon, Clerk, Langfuse Cloud, Google AI Studio key (or Vertex), GitHub. No version manager is mandated.

1. `pip install -e "apps/api[dev]"`
2. `npm install` in `apps/web`
3. `vercel env pull` → `.env.local` (Development environment; own Neon dev branch/database; **no local Postgres container**)
4. `alembic upgrade head` with `DATABASE_URL_UNPOOLED` (shared environments: CI only)
5. `scripts/seed_synthetic.py` (users from `content/seed/users.json`; `BOOTSTRAP_ADMIN_CLERK_ID` read by the seed script only)

| Purpose | Command / tool |
| --- | --- |
| Python lint / types | Ruff, mypy |
| Web lint / types | ESLint, `tsc` |
| Critical tests | `pytest apps/api/tests -m "critical"` |
| Authz tests | `tests/authz` (≥ 9 Tier 1 cases) |
| Other groups | unit, schema, verifier, FSM table parity (`tests/fsm/test_table.py`), content validation, `tests/contract` (OpenAPI/web-type drift) |
| Release check | `pytest -m release` (C4; not on PRs) |
| Smoke | `pytest apps/api/tests/smoke --base-url <url>` |
| Story sync | `scripts/sync_stories.py --check` |
| Scans | `pip-audit`, `npm audit`, `gitleaks` (fail on high severity / secret) |
| Accessibility | `axe` on the practice screen |
| Evaluation | `eval.yml` against the Langfuse dataset |
| Dev server / web build / web test commands | **Not defined in sources** — defined when tooling is created |

CI workflows: `ci.yml` (PR), `eval.yml` (PR touching `apps/api/app/agents`, `policy`, `verifier`, prompts, `content/eval`; nightly), `deploy-preview.yml`, `deploy-prod.yml` (merge to `main`), `content-validate.yml` (PR touching `content/questions`).

### 4.3 Resource ceilings

| Resource | Value |
| --- | --- |
| Turn | 7.5 s hard stop; tutor-turn p95 < 8 s (CI) |
| Stage timeouts | verifier 400 ms · retrieval 250 ms · classifier 1,000 ms · hint policy 40 ms · dialogue 1,400 ms (incl. one repair) · guard 1,200 ms (1.3 s cap) · persistence 200 ms · ingress load 150 ms · cache lookup 25 ms target · overhead 0.25 s |
| Matcher / `scrub_pii` / `input_screen` | < 10 ms / < 5 ms / < 10 ms |
| Tokens per turn | ≤ 1,500 prompt, ≤ 250 completion; dialogue < 100 tokens, no sentence > 25 words (budget split between agents and Safety output cap: Open) |
| LLM calls per turn | Dialogue ≤ 2 iterations; classifier ≤ 1; one schema repair per call |
| Rate / cap / idempotency / token / JWKS | 60 h & 15 per 5 min · 12 turns/session · 24 h · service token ≤ 60 s · JWKS cache ≤ 1 h |
| Bundles | API ≤ 250 MB unzipped, cold-start p95 ≤ 5 s; MCP < 30 MB, cold start < 1.2 s |
| Function duration | Sample `maxDuration: 60`; session lease > 7.5 s + 200 ms and < `maxDuration` (lease config name **TBD**) |
| Load | 10 concurrent synthetic students; cohort view over 150 students < 3 s |
| Cron (Pro; confirm vs Vercel limits) | `warmup` 10 min · `learner-rollup` hourly · `embedding-sync` hourly :15 · `insight-drafts` 18:00 · `item-quality-scan` 18:30 · `retention-purge` 19:00 · `eval-nightly` 20:00 |
| Spend | USD 100/month ceiling across Vercel, Neon, Langfuse, provider; alert at 80% (pending sign-off, #34) |
| Backup / client | Neon PITR, RPO 24 h, RTO 4 h (demo defaults) · iPad Safari 16+, current Chrome/Edge, ≥ 768 px, WCAG 2.1 AA target |
| Pending confirmation | Vercel plan limits, USD ceiling, provisional payload limits |

### 4.4 Environment variables
`APP_ENV`, `DATABASE_URL`*, `DATABASE_URL_UNPOOLED`*, `BLOB_READ_WRITE_TOKEN`*, `LLM_PROVIDER`, `GOOGLE_API_KEY`* (or Vertex: `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`), `OPENROUTER_API_KEY`* (only if openrouter), `VLLM_BASE_URL` (only if vllm), `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING` (values TBD), `LANGFUSE_PUBLIC_KEY`*, `LANGFUSE_SECRET_KEY`*, `LANGFUSE_HOST`, `LANGFUSE_PROMPT_LABEL`, `CRON_SECRET`*, `INTERNAL_SERVICE_TOKEN_MCP`*, `INTERNAL_SERVICE_TOKEN_SAFETY`*, `DIALOGUE_MODE` (`llm`|`template`), `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, `AUTH_SECRET_KEY`*, `BOOTSTRAP_ADMIN_CLERK_ID` (seed only), `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION`, `RETENTION_POLICY_VERSION`, `LLM_TIMEOUT_SECONDS`, session lease duration (name TBD), `VITE_API_BASE_URL`, `VITE_AUTH_PUBLISHABLE_KEY`. (* = secret.) TeacherInsightAgent model variable and timeout: Open.

### 4.5 Security & secret hygiene
- Secrets only in Vercel Environment Variables (Development/Preview/Production; mark Sensitive). `.env*` git-ignored; `.env.example` lists names only. Only `VITE_*` reaches the browser and never holds a secret.
- Preview uses separate database and Langfuse credentials from Production. GitHub Secrets hold only CI deploy credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, project ids, per-env DB URLs for migrations) and CI-time eval keys.
- HMAC service bearer: `aud`, `iat`, `exp`, `exp − iat ≤ 60 s`; one secret per target; API holds both signing secrets; MCP holds only `INTERNAL_SERVICE_TOKEN_MCP`; Safety only `INTERNAL_SERVICE_TOKEN_SAFETY`; verifiers never sign. Missing/expired/wrong-aud/bad-sig → 401 + audit, no data. Browser never reaches MCP/Safety.
- Cron: `Authorization: Bearer CRON_SECRET`; mismatch → 401, log + audit, nothing runs.
- DB roles: API pooled (`INSERT`-only on `audit_event`, rejecting triggers); MCP read-only on question/exemplar/embedding tables + audit insert; Safety audit-insert only; migrations role from CI only; T3: RLS with `SET LOCAL app.user_id` per transaction, fail closed.
- Rotate secrets every 90 days and after suspected exposure. Dev/Preview/Production data synthetic only.
- Telemetry: pseudonymous ids only; masking function before Langfuse export; no free text in any span. Audit rows hold ids, hashes, structured fields only.
- HTTPS everywhere; W3C trace headers on every HTTP hop to MCP/Safety; student-specific Blob objects via controlled routes only; diagram route uses CSP `default-src 'none'`, `Cache-Control: private`.

---

## 5. Agent & Tool Execution Ground Rules

### 5.1 Agent inventory
Exactly **three** runtime LLM agents: AG-06, AG-08, AG-11. No LLM student-state agent in Release 1.0 (Decision #32). `ParallelAgent` not used. No peer messaging; hand-off only through ADK state keys.

| ID | Agent | Type | Responsibility |
| --- | --- | --- | --- |
| AG-00 | `TutorOrchestrator` (`run_turn`) | Deterministic | Owns the turn: transitions, lease, ADK run, persistence, response |
| AG-01 | `ProblemContextAgent` | BaseAgent | Load pinned question, `scrub_pii`, `normalise`, Input Screen |
| AG-02 | `MathVerifierAgent` | BaseAgent | Cache → MCP → in-process; `apply_overlay` |
| AG-03 | `DeterministicMisconceptionMatcher` | BaseAgent | Match authored `misconception_predictions` |
| AG-04 | `RetrievalGate` | BaseAgent | Gate + `search_exemplars` (numbers only) |
| AG-05 | `StudentStateEstimator` | BaseAgent | `repeated_wrong_value`, `consecutive_unsuccessful`, `previous_progress` from persisted results |
| AG-06 | `MisconceptionClassifierAgent` | LLM (`MODEL_CLASSIFIER`, `MisconceptionClassifierOutput`) | Label unmatched numeric error from the closed taxonomy, citing exemplars; ≤ 1×/turn, 1,000 ms |
| AG-07 | `HintPolicyEngine` | BaseAgent | Level, probe, content, prompt type, `tone`, `turn_kind`; < 40 ms; reads `allow_level_5` from Postgres each turn |
| AG-08 | `SocraticDialogueAgent` | LLM (`MODEL_TUTOR`, `SocraticDialogueOutput`) | Phrase one bounded prompt; one question or imperative starting `try/look/find/compare/write/check`; < 100 tokens; `hint_level` = `HintDecision.level` |
| AG-09 | `DeterministicLeakCheck` (`check_candidate`) | Rule step | Value leakage, method leakage (< L4), forbidden phrases, jargon, single-prompt, schema consistency; re-run as final override |
| AG-10 | `SafetyGuard` (`solvepath-safety`, `MODEL_SAFETY`) | A2A service | `allow`/`block`/`revise`/`escalate` + optional `reason_code`; verdict-only; 1,200 ms |
| AG-11 | `TeacherInsightAgent` (`TeacherInsightDraft`) | LLM, cron/on demand | Evidence-linked draft for teacher review; wording check; stored `pending` or `rejected`. Not on the student path |
| SV-01/02/03 | `DiagramService`, `PracticePlanner` (`recommend_next`), `ProblemParser` (offline; LLM-vs-deterministic mode Open) | Deterministic services | — |

### 5.2 State keys (each key: one writer)
`problem_context` (AG-01) · `verifier_result`, `verifier_outcome` (AG-02) · `misconception_match` (AG-03) · `retrieval` (AG-04) · `exemplars` (AG-04; read only by AG-06) · `classification` (AG-06) · `student_state` (AG-05) · `hint_decision` (AG-07; AG-08 gets allow-listed subset: level, prompt type, `tone`, `permitted_scaffold_step` at L4 only) · `candidate`, `guard_verdict`, `turn` (loop steps). ADK state is rebuilt from Postgres per request and discarded.

LLM isolation: AG-08 never reads `exemplars`, accepted answer, retrieval corpus, free text, chat history, or any guard verdict beyond the word "revise". AG-06 never reads the tutor draft or accepted answer. Revision iteration receives the same inputs plus only "revise" (never the blocked draft or reasons).

### 5.3 Tools & permissions
- Tools are called only by deterministic steps; no LLM agent holds a tool client. `before_tool` enforces the allow-list; violation → deterministic fallback + audit.
- Matrix: `verify_expression` ← AG-02 only; `search_exemplars` ← AG-04 only; `get_question` ← tool consumers/import tests only (not hot path); A2A SafetyGuard ← AG-00 safety loop only; SQL ← AG-00 (L6) and AG-01 question load; Blob ← AG-00 diagram route only; `transitions.apply`, `select_transfer`, `render_*_turn`, `update_learner_model`, `recommend_next` ← AG-00 only.
- All tool results schema-validated; schema-invalid = tool failure for that call.
- MCP: `verify_expression` 400 ms (timeout/connect → one in-process fallback; HTTP 4xx/5xx → no retry, `cannot_verify` + `tool_failure`); `search_exemplars` 250 ms (any failure → empty result, turn continues, valid); A2A 1,200 ms (timeout/connect → one in-process retry else `guard_unreachable`; HTTP error → `guard_unreachable`).
- `verify_expression` input: `question_id`, `question_version`, `input`, `field_kind` (`answer`|`step`); never session input.
- LLM call interface: provider adapter `(agent, input, schema) → validated output`; records provider, model, model version, temperature, `prompt_version`. Only code that calls a model; applies prompt/completion caps. Prompts fetched from Langfuse by id + `LANGFUSE_PROMPT_LABEL`, cached as `prompt_template`; fetch failure with no cache → deterministic fallback.
- Callbacks: `before_model` (no student free text in any prompt; violation → fail turn before model call, `fallback_l{level}`, `fallback_reason` null, P0 audit `prompt_capture_violation`) · `before_tool` (allow-list) · `after_model` (schema, leak-check hand-off, span metadata).

### 5.4 Handoffs & routing
- Route decided by event + state, never a model. Event → steps: `submit` value/ratio/expression → 1–8 · correct final → 1–2 then authored reflection · first unparsed → 1–2 canned `rephrase_request`/`use_dot_for_decimals`/`enter_the_number` · second unparsed → `structured_mode_notice` + `ambiguity_review` (pipeline turn counted, no level change) · Input Screen hit → step 1 only, canned reply, no `tutor_turn`, safety audit · `not_sure` → 1,5,6 + loop · `show_solution` → 1,6; solution/example turns authored (no model/guard) · `reflection_choice`/`transfer_decision` → `select_transfer`/transfer creation · `note` → `scrub_pii`, `input_screen` · MCP HTTP error → step 2, canned `tool_failure_notice`.
- Dialogue loop: `before_model` guard → iteration 1 {AG-08 → AG-09 → AG-10 (only if AG-09 passed) → final override} → iteration 2 only if revision gate allows (else `budget`). Blocked/`revise` at iteration 1 → revise; at 2 → `loop_exhausted` + `safety_fallback`. `escalate` → no iteration 2, `loop_exhausted`, safety-incident audit. Only a candidate that passed AG-09, got `allow`, and passed the override is persisted or shown.
- Non-model turn kinds (`solution`, `authored`, `canned`, `probe_template`, `fallback`) skip loop and guard. `DIALOGUE_MODE=template` ⇒ no model call on the student path (`kind=probe_template`).
- Concurrency: one in-flight event per session (lease); other key during a live lease → 409 `request_in_progress`.

### 5.5 Non-negotiable behaviour rules
1. No agent states a verdict, misconception code, `sound` flag or solution value to the student below Level 5.
2. LLM output is a versioned Pydantic schema (`schema_version`); out-of-enum/schema output is rejected after **one** adapter repair, never fixed by guessing.
3. Student-facing language: respectful, non-shaming, no comparison, no claim about intelligence/future success/placement, no request for personal information.
4. No agent publishes content, changes a learner record, role or setting, or contacts a parent/student. Agents never escalate to a person mid-turn; escalation = recorded flag or pending item.
5. Each agent records `prompt_version`, `policy_version`, model metadata; audit rows hold hashes, never bodies.
6. TeacherInsight drafts: no placement/grading/admissions/exclusion/remedial wording, no diagnosis, no parent/student message; evidence = source event ids; low confidence labelled as such; a draft failing the wording check is stored `rejected` and never shown.
7. Verifier: an expression is never evaluated into a final answer; no model calls the verifier.

### 5.6 Fallback ladder (all end in authored, mathematics-free text; never a verdict, leak or unguarded model text)

| Condition | Result | `fallback_reason` | Flag |
| --- | --- | --- | --- |
| Verifier MCP timeout/connect | One in-process verify, continue | — | — |
| Second fallback needed, or would cross 7.5 s | `fallback_l{level}` | `budget` | — |
| Verifier MCP HTTP error | `tool_failure_notice` | — | — |
| Retrieval or cache failure | Empty retrieval / cache miss, continue | — | — |
| Classifier timeout/invalid | `fallback_l{level}`, no misconception claim | per cause | — |
| Provider timeout/429/5xx | `fallback_l{level}` | `provider_error` | No |
| Schema invalid after one repair | `fallback_l{level}` | `schema_invalid` | No |
| Both candidates rejected, or `escalate` | `fallback_l{level}` | `loop_exhausted` | `safety_fallback` |
| Guard unreachable (after one in-process retry) / HTTP error | `fallback_l{level}` | `guard_unreachable` | `safety_fallback` |
| Prompt-capture violation | `fallback_l{level}` | null | No; P0 audit |
| 7.5 s exceeded | `fallback_l{level}` | `budget` | No |
| No unused probe (L1–3) / L4 unsuccessful with none left | canned `fallback_l{level}`, `kind=canned` | null | No |
| Postgres down before attempt stored | 503, `save_failed_notice`, answer kept | — | — |
| Postgres fails at TX-B | 503, retry resumes from stored attempt | — | — |
| Langfuse failure | Turn continues, `trace_status=missing` | — | — |
| Blob/SVG failure | In-process render, else probe text + `diagram_unavailable` | — | — |
| JWKS unreachable, no usable cache | 503, never fail open | — | — |

Handling order: provider quota/429, tool timeout, schema invalid, retrieval empty, safety block, loop exhausted. Each writes an audit event; none becomes a free-form retry. At most one in-process fallback per turn.

### 5.7 Memory & context budget
- Tiers: working (ADK state, one request) · session (Postgres rows) · learner (`learner_skill_state`; turn-time fields at TX-B, aggregates by hourly `learner-rollup`, ≤ 1 h stale, `rollup_at` shown) · curriculum (`question`, graph) · retrieval (pgvector) · cache (`cache_entry`: `verifier_result`, `exemplar_query`, `prompt_template`; exact keys, `expires_at` TTL values Open, no free text) · policy as versioned data · evidence (`audit_event` authoritative; Langfuse supplementary, 90 d).
- Context minimisation by construction: allow-listed keys only, no history or transcripts; numbers-only retrieval query (`skill_id`, `error_category`, canonical value, `relation_tags`, taxonomy version); exemplar-query cache key = `error_category`, `skill_id`, taxonomy version, canonical numeric value; prompt-template key = prompt id + Langfuse version label.
- Open parameters (configure in policy config, don't invent): exemplar top-k, cache TTLs, `tone` value set, near-duplicate cosine and difficulty-anomaly thresholds, evidence-limit sample threshold, "strengths and next focus" computation, group confidence, split of the 1,500/250 token budget, Safety Guard output cap.

### 5.8 Human-in-the-loop (recorded, never waited on)
Safety `escalate` / loop exhausted / guard unreachable → `safety_fallback` flag + audit → assigned teacher (else cohort support contact, else administrator with `trace_review`) · `worrying_disclosure` → flag + canned "tell a trusted adult" reply, no system safeguarding decision · two unparsed → `ambiguity_review` · 12th turn → `turn_cap_reached` · stuck after transfer → flag · Level 5 withheld → `support_withheld` → academic coordinator may change `allow_level_5` (audited, applies to next decision) · misconception hypothesis → `reviewer_status=unreviewed`, teacher confirms/rejects · Teacher Insight draft → `pending` → assigned teacher accepts/rejects/overrides · verifier mismatch/leakage/schema failure/answer-key inconsistency → content reviewer · cron `failed` → administrator.

### 5.9 Observability of coordination
One Langfuse trace per turn (`session_id` = session id, `user_id` = pseudonymous student id), one span per agent step and tool call; MCP/A2A child spans. Metadata: `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment`. Turn record stores provider, model, model version, temperature, prompt/policy versions, tool results, `trace_id`, `trace_status`, `cache_status`, `fallback_reason`. Flush ≤ 300 ms before return; failure ⇒ `trace_status=missing` + `trace_missing` counter; never fails a turn. Counters: `trace_missing`, `fallback_rate`, `in_process_fallback_rate`.

---

## 6. AI Coding Assistant Derivation Directives

### 6.1 Source discipline
1. Read the cited source section before editing; this file is a digest, not authority. Priority when sources differ: later-amending text wins as the docs state (SPEC R1 amends PRD §8.5.1 row 15; DESIGN §4.4 records owner-approved SPEC interpretations; TECHNICAL/AGENTS only restate). Unresolved conflict → ask, do not choose.
2. Never invent a tool, service, library, version, model id, threshold, TTL, route, column or env var that the sources do not name. For an item marked TBD/Open, ask or leave it configurable; do not pick a value.
3. Module names beyond SPEC-named ones (`app/fsm`, `app/contracts.py`, `app/verifier/normaliser.py`, `app.verifier.service`, `app.safety.service`, `mcp_server.py`, `a2a_safety.py`) are logical/indicative (DESIGN §1.4); match the layout in §3.2 and do not restructure it.
4. Prompt text is not stored in the repo; runtime prompts live in Langfuse (pinned by `LANGFUSE_PROMPT_LABEL`). Do not paste prompts into code.

### 6.2 Where each kind of change goes
- Schema crossing a boundary → `contracts.py` only (L0); regenerate OpenAPI/web types, never hand-write API types.
- Correctness/policy rule → a pure L4 function with injected `now`; unit-testable without DB or model.
- SQL → L6 repository (scope and serve filter embedded); writes via unit-of-work with audit writer.
- Vendor SDK, HTTP client, MCP/A2A client, Blob, JWKS, Langfuse → L7 adapter.
- State change → `transitions.yaml` + `transitions.apply`; update the SPEC table parity in the same change.
- Routers parse/authorise/delegate only.
- Student-visible fixed text → `canned_responses.json` (28 keys; obey C1–C3); never inline strings.
- Thresholds, provider/model ids, URLs, TTLs → configuration or versioned policy data, never literals.
- MCP/Safety bundle code imports only the shared modules listed in §3.3.

### 6.3 Change-control rules
- Any change to a prompt, hint policy or model configuration ⇒ run the evaluation suite (replay and live gates) before merge. A change to `google-adk`, the A2A SDK, the MCP SDK, the Gemini model id or `MODEL_EMBEDDING` re-runs the §14.5 gates.
- Never mutate a published `question` version; edit = new version in `imported` state.
- Never add an `UPDATE`/`DELETE` path to `audit_event`; never put free text, full prompts or raw model output in audit rows.
- Migrations: Alembic only, unpooled string, from CI for shared environments; never from a request handler.
- Taxonomy or `vector(768)` changes need a migration plus version bump (`taxonomy_version`) / re-embedding path.
- Keep story acceptance criteria in `user-story.md`; PRD §6 criteria are generated by `scripts/sync_stories.py` (CI fails on diff) — do not hand-edit generated criteria.
- Do not run or add destructive operations against shared databases, Blob or Langfuse; use synthetic data only.

### 6.4 Code-style rules (only what the sources fix)
- Python 3.12; async FastAPI endpoints; Pydantic v2 models for every cross-boundary shape; SQLAlchemy 2.x; type-checked with mypy and linted with Ruff. TypeScript + React 18 function-based SPA; ESLint + `tsc`; Tailwind CSS; KaTeX for maths rendering; web renders only server-provided `tutor.controls` and never trusts its own copy of state.
- Closed enums (`Literal`/Pydantic enums) for taxonomy, `error_category`, verdict, status, event, state, flags; reject out-of-set values.
- UTC `timestamptz`; UUID ids except `question_id` slug; plain text only toward the browser.
- One error payload via the error mapper; no ad-hoc error shapes.
- Config only from environment variables (§4.4); no Vercel-specific API below L7/entrypoints.
- Ruff/mypy/ESLint rule sets, formatter, naming conventions and docstring/comment policy are **not specified** in the sources; follow the tool configuration once it exists and the surrounding code. Do not invent a style guide.

### 6.5 Testing expectations (from sources)
- Critical tests are marked `critical` (`pytest -m "critical"`); release-only checks marked `release`.
- Deterministic stages are tested with real code; LLM stages in PR use recorded schema-valid fixtures (replay mode); the golden trajectory `test_demo_trajectory.py` has replay (PR) and live (nightly/release) modes.
- Mandatory tests that already have a named home: prompt-capture test, connection-leak test (T3), unauthenticated MCP/A2A calls, FSM table parity, contract/OpenAPI drift, import-boundary (import-linter-style, enforces DESIGN §1.4 rules 1–4; tool TBD), bundle size.
- Do not write tests, stubs or source code unless the task asks for it.

### 6.6 Negative constraints (prevent hallucinated refactors)
- Do not "simplify" the two-transaction + lease turn into one transaction, add a lock held across external calls, or add a queue, cache layer, Redis, graph DB or vector DB.
- Do not collapse MCP/A2A into in-process-only calls, merge the four entrypoints, or share one service-token secret.
- Do not make the Hint Policy, verifier, matcher, leak check or FSM LLM-driven, and do not let an LLM agent import a repository, MCP client, vendor SDK or read the accepted answer.
- Do not add streaming of tutor text, free-form retries, fuzzy/semantic caching, new hint-level inputs (time, history, year level, typed requests), a parent route, or Level 5 paths outside the four-condition gate.
- Do not render misconception codes, verifier verdict internals or `sound` flags to students; do not name taxonomy codes or glossary phrases in student text.
- Do not use `tutor_turn.turn_number` for the cap; do not change state outside `transitions.apply`; do not write to terminal sessions except the `transfer_outcome` back-fill.
- Do not add CORS, handwritten API types, `SET` (use `SET LOCAL`), session advisory locks, or prepared-statement reliance.
- Do not rename enum values, error codes, state names, event names, cron job names or env vars listed here.
- Do not commit, stage or push, and do not edit `PRD.md`, `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md` or `README.md` unless the task explicitly says so.
