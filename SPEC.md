# SolvePath — Functional Specification (SPEC.md)

Source of truth: `PRD.md` v1.3.27. This document translates PRD requirements into contract-level functional specifications. It contains no application source code.

---

## 1. Overview & Scope Boundaries

### 1.1 Purpose and conventions

| Convention | Meaning |
| --- | --- |
| **SHALL / SHALL NOT / MAY** | Normative keywords. SHALL = mandatory, MAY = optional |
| **T1 / T2 / T3** | Release tier of the behaviour. T1 = P0, Release 1.0a/1.0/1.0 with teacher view (Gates A/B/C). T2 = P1, Release 1.1. T3 = P2, Release 1.2 (PRD §6.7, §18.1). Tag legend: T1 covers Tier 1a, Tier 1b and Tier 1c. The sub-tier tags T1a, T1b and T1c are used where the sub-tier matters |
| **[D]** | *Derived.* The behaviour is not stated verbatim in the PRD. It is derived from the PRD text cited beside it and is registered in §1.5 for confirmation |
| **PRD §n / FR-nn / STU-nn / EDU-nn / ADM-nn / TECH-nn / Decision #n** | References into `PRD.md` |
| **SC-nn** | System capability in §1.2 |
| **WF-nn** | Workflow in §4 |
| **ENT-nn / SM-n** | Entity group (§2) / state machine (§2.8) |

Identifiers: `question_id` is a text slug (for example `scale_0001`). Every other identifier is a UUID. Student identifiers in audit rows, traces and caches are the pseudonymous `app_user.id`. Timestamps are `timestamptz` in UTC. All text exchanged with the browser is plain text with no HTML.

### 1.2 System capabilities (PRD → system-level functional specification)

| ID | Capability | System-level specification | PRD |
| --- | --- | --- | --- |
| SC-01 | Authentication and role-based access | Every request is authenticated with a Clerk JWT. The caller's role, cohort scope and grants are read from Postgres on every request. A role claim in the token never grants access. An unknown subject is rejected with 403 and never provisioned. Authorisation is enforced in the FastAPI dependency layer (T1) and by Postgres row-level security (T1). Denied and successful access are audited | FR-01 |
| SC-02 | Question delivery | A question is delivered only when `validation_status=approved`, `publication_status=published`, the curriculum scope is enabled and every FR-02 field is present. Unapproved, flagged, draft, rejected, deprecated and pending items are never served, including through vector search and the Practice Planner | FR-02 |
| SC-03 | Student attempt capture | The student submits a numeric, fraction, decimal, percentage, ratio, arithmetic-expression or multiple-choice response, optional one-expression working, a structured reasoning option, a confidence rating, a "not sure" signal, a "show me the solution" request or a note for the teacher. Each attempt is stored with its target, hint level and duration | FR-03 |
| SC-04 | Input Screen and authored text | Free text reaches no model and no Langfuse span in Release 1.0. A deterministic scrubber and Input Screen handle notes and unparsable fields. Every fixed student-facing sentence comes from one reviewed registry of 28 keys | PRD §8.3.1, §8.3.2, Decision #31 |
| SC-05 | Deterministic verification | A pure, cacheable, session-independent verifier (SymPy plus ratio rules, reached through MCP from Phase B / Tier 1b; in process at Tier 1a) returns a structured result. An uncached response-target overlay adds session context. No LLM calls the verifier and no LLM issues a verdict | FR-04 |
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
| SC-17 | Background processing | Six authenticated, idempotent, batched cron jobs recorded in `job_run` (the nightly evaluation is a GitHub Actions workflow) | FR-16 |
| SC-18 | Leakage and output controls | A deterministic leakage, method-leak, phrase and age-appropriateness check runs before the A2A Safety Guard (Phase B / Tier 1b; in process at Tier 1a) on every candidate turn. A deterministic hit overrides a guard `allow`. No unguarded model text is ever shown | PRD §8.6, §9.3, §11.2 |
| SC-19 | Failure-state contract | No dependency failure produces a verdict, a leak or unguarded model text. Authentication fails closed. Langfuse never fails a turn | PRD §11.6 |
| SC-20 | Service-to-service authentication | The MCP and A2A services (Phase B / Tier 1b; in process at Tier 1a, no service call) accept only short-lived, audience-scoped, HMAC-signed bearer tokens | PRD §9.9 |

### 1.3 System context and trust boundaries

| Component | Responsibility | Boundary rule |
| --- | --- | --- |
| Web app (`solvepath-web`) | Next.js (App Router) and React/TypeScript UI, client-rendered. Renders only what `tutor.controls` lists | Untrusted. Hiding a control is never an access control. No server-side data fetching and no authorisation in Next.js. Calls the API through the same-origin `/api/*` rewrite |
| Orchestrator (`solvepath-api`) | FastAPI. Authentication, authorisation, session state machine, ADK pipeline, persistence, cron routes | The only component that talks to the browser. The only component that talks to MCP, A2A, the LLM provider, Blob and Postgres on a student's behalf |
| MCP server (`solvepath-mcp`) | Tools `verify_expression`, `get_question`, `search_exemplars`. No LLM, no tutor text | Reachable only with a valid service token. Holds solution data |
| A2A Safety Guard (`solvepath-safety`) | Returns `allow`, `block`, `revise` or `escalate` for a candidate turn | Reachable only with a valid service token. Verdict-only output |
| PostgreSQL + pgvector | Domain data, skill graph, exact-key cache (Phase B / Tier 1b; Tier 1a: in-process, no cache), audit, rate counters, vectors (pgvector and `question_embedding` from Tier 1b; none at Tier 1a) | Pooled connection for requests, unpooled for migrations |
| Vercel Blob | Approved diagram SVGs, content imports, exports | Served only through controlled routes. No guessable public URLs for student-specific objects |
| Langfuse | LLM and agent telemetry only: traces, prompts, datasets, scores | Pseudonymous ids only. Never fails a turn |
| Sentry | Application errors and crashes on web, API, MCP and Safety. Tracing and Session Replay off | Scrubbed before send (§5.8). Carries no student answer, step, note, bearer token, Clerk id or `app_user.id`. Never fails a turn |
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
| D-13 | Request payload limits (accepted, accepted by the product owner on 2026-10-11) | §5.2 |
| D-14 | Concurrent events with different keys on one session are serialised by a **session lease** taken in TX-A (duration 12 s, `SESSION_LEASE_SECONDS`). A row lock is held only inside the short TX-A and TX-B transactions and never across the pipeline. This replaces the earlier "per-session row lock" wording (DESIGN DD-01) | STU-12 |
| D-15 | Mastery deltas apply to a counted success on the original or the transfer item. The conflict rule is evaluated once per persisted counted attempt. A new skill state starts at `0.0` | STU-16, Decision #21 |
| D-16 | A different second decision on a recommendation returns 409 `transition_not_allowed` | EDU-04 |
| D-17 | Each diagram specification carries `min_level`, the lowest hint level at which it may be shown | STU-12, FR-09 |
| D-18 | The rate limiter counts each accepted, non-replayed `POST /events` | §11.2 |
| D-19 | Transfer tie-break: highest similarity, then lowest `question_id` (from Tier 1b; at Tier 1a there are no embeddings and the tie-break is lowest `question_id` only) | §8.10 |
| D-20 | `fallback_reason` is null for `prompt_capture_violation`. A `cannot_verify` (state ok) verdict forces the stored label to `insufficient_evidence` | §11.6, §9.8 |
| D-21 | (Superseded by D-29, then by D-37 for the shipped default.) **Superseded by D-29.** Originally: `template` was the default, `llm` was enabled only after the early educator check and a live calibration run, and Slice 0 ran in `template` mode or through one fixture-backed adapter call. `template` remains a supported mode (emergency kill-switch and the intra-Tier-1a Cut 1a-3). With `DIALOGUE_MODE=template`, no model call runs on the student path (no Dialogue, Classifier or Safety Guard call) and the turn has `kind=probe_template` | §18.4.1, §18.4.2, audit W-1 |
| D-22 | **Two-phase FSM contract.** `transitions.apply` is applied in two phases. Phase 1 (TX-A) checks that the (state, event type) pair is legal and takes the lease. Phase 2 (TX-B) resolves the outcome-guarded rows from the finished pipeline result and writes the next state. See SM-1 | Audit C-3 |
| D-23 | The Misconception Classifier is advisory. Its timeout, provider error or invalid output never produces a student-visible fallback: the turn continues with no misconception claim and `prompt_type=diagnostic_probe` | Audit W-2 (cited as C-5 in earlier drafts. C-5 is the fallback-rate gate rule, §5.9, BUILD_LOG §4.1) |
| D-24 | The Safety Guard receives `forbidden_strings[]` (answer-key and intermediate values) for leakage detection only. This is a constrained exception to "no LLM sees the accepted answer" (see §3.7) | Audit W-4, D-9 |
| D-25 | `eval-nightly` is the GitHub Actions workflow `eval.yml`, not a Vercel Cron route. The scheduled-job set is six routes | Audit W-10, D-8 |
| D-26 | Exemplar retrieval is an exact SQL filter on `skill_id`, `error_category` and the candidate `code` that the server derives from the `error_category` mapping (the tool takes no `code` input), ordered deterministically. There is no query-time embedding and no similarity score. pgvector is used only for the transfer tie-break and the near-duplicate scan, off the student hot path | Audit W-3 |
| D-27 | **Topology phases.** Phase A (Slice 0, Tier 1a): one API deployable with the verifier (SymPy) and safety modules in process, no MCP or A2A service. Phase B (Tier 1b): `solvepath-mcp` is split into its own deploy root, SymPy leaves the API manifest, and the "no SymPy in the API", MCP bundle and MCP cold-start rules begin. The Phase B rules do not apply to Tier 1a builds | Audit B-1 |
| D-28 | A turn that ends `unverified` (budget lapsed before any verifier result) is not a cap turn. The audit ordinal `tutor_turn.turn_number` increments, the cap counter does not. Three consecutive `unverified` turns show the canned `tool_failure_notice` and set the flag `verification_unavailable` (no new canned key). The student rate limits still bound repeats | Owner decision on the audit gaps |
| D-29 | **(Superseded by D-37 for Tier 1a: `template` is the shipped default.) `DIALOGUE_MODE=llm` was the Release 1.0 default** (supersedes D-21). The student path runs the Dialogue Agent, the conditional Classifier, the Safety Guard and the revision loop by default. `template` stays a supported mode, used as an emergency kill-switch and as the intra-Tier-1a Cut 1a-3. The early educator check (about 10 turns) reviews and tunes the `llm` paraphrase prompts and fallback probes, and its findings are applied before Gate B. Model-level ratchets are reported until the first live calibration run (n ≥ 100). Slice 0 makes one real Gemini Flash call through the provider adapter in `llm` mode. The golden test `test_demo_trajectory.py` runs in CI in recorded-fixture replay mode, plus a local live smoke run. The only external dependency allowed in Slice 0 is the provider key | Owner decision, supersedes D-21 |
| D-30 | **Minimal Postgres row-level security is pulled forward from T3 to Tier 1a (T1).** Per-transaction `SET LOCAL app.user_id`, fail-closed policies on every table that holds student-scoped rows, a pooled-connection leak test, and `tests/authz` covering the application layer and RLS. The minimal RLS covers every table that holds student-scoped rows. The API database role is a non-owner without `BYPASSRLS`, every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`, and the pre-`SET LOCAL` lookup of `app_user.id`, role and cohort ids runs through a narrow `SECURITY DEFINER` lookup function keyed by the Clerk `sub` that returns only that user's `app_user.id`, role and cohort ids (BUILD_LOG ADR-012, D-34). The lookup function is owned by a dedicated non-login role, sets `search_path = pg_catalog, public`, has `EXECUTE` revoked from `PUBLIC` and granted only to the API role, and reads `app_user`, `user_grant` and `cohort_assignment` under an explicit policy for that owner role only (BUILD_LOG ADR-013, D-35). `tests/authz` also asserts the non-owner role, `BYPASSRLS` false, `FORCE ROW LEVEL SECURITY` on, and that the lookup returns only the caller's rows. The Tier 1c teacher replay (WF-17 T1c scope) adds a teacher assigned-cohort read policy when it is built. The full role-action matrix stays T3. At Gate A the `tests/authz` suite is 9 application-layer cases + 3 RLS cases + 4 hardening cases = 16 cases, all blocking. The unauthenticated MCP/A2A 401 case (the tenth application-layer case) is a Gate B item [B] because Tier 1a has no MCP or A2A call | Owner decision, BUILD_LOG ADR-011, ADR-012, ADR-013 (D-33, D-34, D-35) |
| D-31 | **Tier 1a prompt source and local live run.** Prompts are read through one `PromptSource` interface. `PROMPT_SOURCE=repo` (Tier 1a default) reads versioned files under `apps/api/app/prompts/`, with `prompt_version` set to the file version id and content hash. `PROMPT_SOURCE=langfuse` starts at Tier 1b (P2-19) and is seeded from the same files. Gate A live evidence comes from the local live run (EVALS §1.3). The MCP, A2A, cache, Langfuse, cold-start and deployed-smoke rows are `not-run` at Gate A and apply at Gate B | Gate review B-1 |
| D-32 | (Hours, cuts, dialogue default, token and checkpoint figures superseded by D-37.) **Tier 1a scope, capacity and Gate A (BUILD_LOG ADR-010).** (1) The exact-key cache (`cache_entry`) is **Tier 1b only**. It is not a Tier 1a cut, because Tier 1a does not build it. The intra-Tier-1a cuts are: Cut 1a-1 defers STU-03 reasoning options and `step_expressions` (saves about 8-12 h); Cut 1a-2 defers the advisory Classifier (P2-10) (about 8-10 h); Cut 1a-3 locks `DIALOGUE_MODE=template` (P2-08 and P1-14 depend on "P2-07 or Cut 1a-3") (about 15-20 h). At a Tier 1a miss only Cuts 1a-1 to 1a-3 apply and all Tier 1b and Tier 1c scope is dropped. The T1b-* cuts (T1b-1 `search_exemplars` in-process, T1b-2 defer cache, T1b-4 A2A guard kept as an in-process module behind the same interface; T1b-0 and T1b-3 are retired, D-36) apply only while Tier 1b is in progress. Mandatory triggers (in engineering hours): at hour 70, if P1-01a and P2-06 are not both Done, apply Cut 1a-1. At hour 100, if P2-08 and P1-17 are not both Done, apply Cuts 1a-2 and 1a-3 together. The final checkpoint is that Gate A (P2-15) passes by hour 180. (2) Capacity: Phase 0 non-Slice-0 work (about 20-30 h) is a separate line. The Tier 1a engineering build is 138-180 h (it includes the new task P1-17, D-35). The Tier 1 content package is about 58 h (it includes about 10 h for the FB and EC cases and the scripted-variant generator, counted in the content package only: P1-15 logs that time against content and it is excluded from the 138-180 h). The Tier 1a commitment is 138-180 h engineering + about 58 h content + 20-30 h Phase 0 = 216-268 h, buffered 248-308 h. The unbuffered top (268 h) exceeds the 240 h envelope, so the hour-70 and hour-100 triggers are mandatory. At 25 h/week the Tier 1a commitment needs about 8.6-10.7 weeks (9.9-12.3 buffered). Planning sums, not commitments: Tier 1 234-310 h, Tier 1a plus 1b 218-290 h, plus content and Phase 0 296-378 h (340-435 h buffered), roadmap about 319-420 engineering hours (Tier 1 234-310 + Tier 2 55-70 + Tier 3 30-40, excluding content and Phase 0). Tier 1b and later start only after Gate A passes, with a re-estimate. Tier 1c does not start unless Gate B has hours to spare (D-36). Tasks P1-16 (CI, security and content checks) and P1-17 (orchestrator and persistence) are built inside the Tier 1a budget (see D-34, D-35). (3) At Gate A the educator check, the child usability check and threat model v0 are Gate B items [B]. Threat model v0 is due before Tier 1b starts, and Gate B verifies it exists (D-36). `fallback_rate` is a model-level ratchet and is reported with its value at Gate A | Owner decision, BUILD_LOG ADR-010 |
| D-33 | (Hours, cuts, dialogue default, token and checkpoint figures superseded by D-37.) **Evaluation scope by tier and related guard rails (BUILD_LOG ADR-011).** (1) The golden trajectory `test_demo_trajectory.py` has a 1a variant (Gate A: in-process, replayed in CI, step 5a with empty retrieval and a recorded classifier output that is null or `insufficient_evidence` (the REPLAY fixture expects no misconception claim and `prompt_type=diagnostic_probe`; in live mode the golden test asserts only that `prompt_type` obeys the confidence rule: `targeted_scaffold` only if classifier confidence >= 0.80 and the code is not `insufficient_evidence`), no verifier cache-hit trace item) and a 1b variant (Gate B: exemplar retrieval, an exemplar-citing classifier result and the cache-hit trace item). Zero leaks is mandatory in both. (2) The Gate A live sample is the 42 critical cases, the golden 1a trajectory, one pleading persona and a live subset of at least 100 LLM-stage turns generated as synthetic scripted student-answer variants over the approved items. The 150-case set, DS-06 and the five personas are Tier 2/3, and Gate A "suite complete" means this Tier 1a subset. The Langfuse dataset mirror is Tier 1b only. Task P1-15 (eval harness and CI, including the scripted-variant generator for the live subset) is built inside the Tier 1a engineering budget (138-180 h). The P1-10 verifier p95 < 400 ms CI gate is `not-run` at Tier 1a (in-process verifier). (3) Digit rule below Level 4: digits are allowed if verbatim in the question stem, in the selected authored probe template, or the student's own value that the verifier marked correct this attempt. No new computed value is allowed (WF-09). (4) The fixed buffered-hours threshold is dropped as a trigger basis. The Tier 1a commitment needs about 8.6-10.7 weeks (9.9-12.3 buffered) at 25 h/week (D-35), and Tier 1b and later start only after Gate A passes with a re-estimate (D-32) | Owner decision, BUILD_LOG ADR-011 |
| D-34 | (Hours, cuts, dialogue default, token and checkpoint figures superseded by D-37.) **Fourth-review fixes (BUILD_LOG ADR-012).** (1) The 1a golden fixture's recorded classifier output is null or `insufficient_evidence`, with the replay expectation no misconception claim and `prompt_type=diagnostic_probe`. In live mode only the confidence rule is asserted (WF-07 step 3, §5.9, D-35). (2) At a Tier 1a miss only Cuts 1a-1 to 1a-3 apply and all Tier 1b and Tier 1c scope is dropped. The T1b-* cuts apply only while Tier 1b is in progress. Savings: 1a-1 about 8-12 h, 1a-2 about 8-10 h, 1a-3 about 15-20 h. Triggers (as updated by D-35): hour 70 (P1-01a and P2-06 not both Done gives Cut 1a-1), hour 100 (P2-08 and P1-17 not both Done gives Cuts 1a-2 and 1a-3 together), final checkpoint Gate A (P2-15) passes by hour 180. Hours: Tier 1a engineering 138-180 h, commitment 216-268 h (248-308 h buffered), see D-32. (3) New task P1-16 (CI, security and content checks), Tier 1a, about 8-12 h, inside the Tier 1a budget. Its scope, listed once here: the import-boundary check, story sync (`scripts/sync_stories.py`, owned by P1-16), `content-validate.yml`, `pip-audit`, `npm audit`, `gitleaks`, `axe`, and the Sentry SDK and `before_send` scrubber. `user-story.md` is owned by P0-08, and `content/` and `blueprint.md` by P0-11 (P1-16 syncs and validates them but does not own them). (4) Digit rule: `check_candidate` reads the current attempt's `verifier_outcome` from ADK state, not the persisted `session`. Exemption (c) applies inside `check_candidate` only and the Dialogue Agent never receives the student's value (§3.9, WF-09). (5) Gate A metrics `verifier_agreement` and `hint_policy_match` are evaluated on the FB and EC case families, with the evaluated cases in the Tier 1a subset as the denominator. The tutor-turn p95 under 8 s gate is a hard-stop-honoured assertion and the under 5 s p95 target is reported. The at least 100 LLM-stage turn requirement is waived only if Cut 1a-3 is taken. Gate A is pedagogy-unvalidated until the Gate B educator check (§5.9). (6) RLS hardening: the API database role is a non-owner without `BYPASSRLS`, every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`, and the pre-`SET LOCAL` lookup of `app_user.id`, role and cohort ids uses a narrow `SECURITY DEFINER` function keyed by the Clerk `sub` (WF-01, D-30). `tests/authz` gains the non-owner, `BYPASSRLS` false, FORCE RLS on and caller-rows-only lookup cases | Owner decision, BUILD_LOG ADR-012 |
| D-35 | (Hours, cuts, dialogue default, token and checkpoint figures superseded by D-37.) **Fifth-review fixes (BUILD_LOG ADR-013).** (1) New task P1-17 (orchestrator and persistence: `run_turn`, TX-A and TX-B, session lease, idempotency, rate counters), Tier 1a, about 14-20 h, depends on P1-02, P1-04, P1-08 and P1-01a and is a dependency of P1-14. (2) Hours replace the D-32 and D-34 figures: Tier 1a engineering 138-180 h (was 124-160 h), Tier 1 content package about 58 h (+10 h for the FB and EC cases and the scripted-variant generator, counted in the content package only: P1-15 logs it against content, excluded from the 138-180 h), Phase 0 20-30 h. Commitment = 138-180 + 58 + 20-30 = 216-268 h, buffered 248-308 h, about 8.6-10.7 weeks at 25 h/week (9.9-12.3 buffered). Planning sums: Tier 1 234-310 h, Tier 1a plus 1b 218-290 h, plus content and Phase 0 296-378 h (340-435 h buffered), roadmap about 319-420 engineering hours (Tier 1 234-310 + Tier 2 55-70 + Tier 3 30-40). The unbuffered top (268 h) exceeds the 240 h envelope. The final checkpoint is that Gate A (P2-15) passes by hour 180 (was hour 160). (3) Triggers: at hour 70, if P1-01a and P2-06 are not both Done, apply Cut 1a-1. At hour 100, if P2-08 and P1-17 are not both Done, apply Cuts 1a-2 and 1a-3 together (savings 8-12 h, 8-10 h and 15-20 h). The at least 100 LLM-stage turn requirement is waived only if Cut 1a-3 is taken. (4) Gate A data: `diagram_leakage` at Gate A is judged on the diagram specifications of the approved Tier 1a items (the DS-09 15-case set is Tier 2). The FB and EC cases are in the about 58 h content package. The scripted-variant generator is part of P1-15. (5) Golden 1a step 5a: the recorded classifier output is null or `insufficient_evidence`, and the replay fixture pins no misconception claim and `prompt_type=diagnostic_probe`. In live mode the test asserts only that `prompt_type` obeys the confidence rule (`targeted_scaffold` only if classifier confidence >= 0.80 and the code is not `insufficient_evidence`). (6) `check_candidate(candidate_text, hint_decision, question, verifier_outcome)` reads the verifier outcome of this attempt. The digit rule has three exemption sources (question stem, selected authored probe template, the student's own value the verifier marked correct on this attempt). The value-leakage check additionally exempts probe expected values already produced, and those are exempt from value leakage only, not from the digit rule. (7) Token ceiling: the live-run ceiling is 1.2 x the measured mean x 200 turns. The provisional 450,000 corresponds to a mean of 1,875 tokens per turn. If the measured mean exceeds 1,875 the ceiling is raised by a PRD change. (8) RLS hardening wording is "every table that holds student-scoped rows". The `SECURITY DEFINER` lookup function is owned by a dedicated non-login role, sets `search_path = pg_catalog, public`, has `EXECUTE` revoked from `PUBLIC` and granted only to the API role, and reads `app_user`, `user_grant` and `cohort_assignment` under an explicit policy for that owner role only. The Gate A `tests/authz` suite is 9 application-layer + 3 RLS + 4 hardening = 16 cases, all blocking. (9) New Tier 1b task P2-22 (Gate B CI and release checks: `deploy-prod.yml`, the deployed live job and nightly, `tests/smoke`, `pytest -m release`, the Langfuse dataset mirror and golden 1b). The import-boundary check is in the P1-16 scope (Tier 1a, scope listed once in D-34 (3)) | Owner decision, BUILD_LOG ADR-013 |
| D-36 | (Hours, cuts, dialogue default, token and checkpoint figures superseded by D-37.) **Sixth-review fixes and owner decisions (BUILD_LOG ADR-014; PRD v1.3.27).** (D1) At Tier 1a the retrieval gate runs but the exemplar source is an empty stub. The real exact-SQL exemplar query, exemplar authoring and `search_exemplars` arrive in Tier 1b (WF-07). (D2) GitHub Actions `deploy-prod.yml` is the authoritative deploy trigger from Tier 1b (P2-22); Vercel Git auto-deploy is disabled on every project and the CI gates must pass first. Tier 1a: manual first deploy. (D3) The about 10 h for the FB and EC cases and the scripted-variant generator are counted in the about 58 h content package only. P1-15 logs that time against content, so it is excluded from the 138-180 h. (D4) Cut T1b-0 is dropped: T1b-0 and T1b-3 are retired and the remaining cuts are T1b-1, T1b-2 and T1b-4. Tier 1c does not start unless Gate B has hours to spare. (D5) Threat model v0 is due before Tier 1b starts and Gate B verifies it exists. (D6) The taxonomy is 12 codes plus the sentinel `insufficient_evidence`, which makes 13 enum values. (D7) Where normative text describes MCP, A2A, the exact-key cache, Langfuse, pgvector or exemplar retrieval, it carries a tier tag (Phase B / Tier 1b, or Tier 1a: in-process, no cache). (D8) The triggers and checkpoints (hours 70, 100 and 180) are in engineering hours, and the roadmap 319-420 h is engineering hours excluding content and Phase 0 (Tier 1 234-310 + Tier 2 55-70 + Tier 3 30-40). Corrections: the cache-rule cross-reference (§5.6); the `confidence_rating` range closed at 1-5; the outcome-guarded row list (adds 23, row 2 resolved jointly); a cap-counting rule for every SM-1 row; the row 4 guard; the `end_reason` enum (no `stuck`) and row 19; `response_target` forbidden for an option-only submit; the D-26 filter matching the `search_exemplars` inputs; the Dialogue Agent allow-list and must-not-read cells; the P1-16 scope in one place (D-34 (3)); `PROMPT_SOURCE` in the configuration list; the classifier outcome on an exemplar read failure; Gate A acceptance conditions (Cut 1a-3 is applied at the hour-100 trigger and hour 180 is the Gate A deadline); the critical set composition (42 = 15 + 15 + 12); P0-17 and P1-15 for golden test replay; RTM mapping of OP-22, OP-23, WF-24 and WF-25; the p95 gate marked Gate B; changelog phrases removed from normative text | Owner decision, BUILD_LOG ADR-014 |
| D-37 | **Capacity, dialogue default and technical risk items (BUILD_LOG ADR-015, PRD v1.3.28, Decision #52).** (1) The single-engineer envelope is locked at 240 h. Tier 1a is the sole commitment: 120 h engineering + 45 h content = 165 h (190 h buffered), or 185-195 h (213-224 h buffered) with Phase 0 (20-30 h). Gate A passes by engineering hour 138. Triggers: hour 70 (P1-01a and P2-06 not both Done: Cut 1a-1) and hour 100 (P2-08 and P1-17 not both Done: Cut 1a-1 if not taken, and no task outside the Gate A dependency set). Planning sums: Tier 1 216-250 h, Tier 1a plus 1b 200-230 h, roadmap about 301-360 h. Gate B is a stretch built only if hours remain below 240 h. (2) `DIALOGUE_MODE=template` is the shipped default and supersedes D-29 for Tier 1a. Cuts 1a-2 and 1a-3 are taken at baseline. `llm` is opt-in and becomes the default only by a PRD change after the educator check and a Gate B live calibration run (n ≥ 100). Gate A is judged in template mode with fixture-backed adapter replay. P2-07 and P2-10 are outside Tier 1a. (3) Langfuse flush: asynchronous in the background after the response. In the inline fallback the turn deadline and revision gate use 7.2 s (§5.1). (4) Digit rule: below Level 4 digits are strictly forbidden unless they match the question stem, the selected probe template or the student's verified value (WF-09 step 2, AGENTS §2.10). (5) Live eval ceilings: 250 turns, 500,000 tokens (about 2,000 tokens per turn), USD 0.80 (nightly USD 0.30). (6) Next.js 14.x with React 18 (TECHNICAL §1.1), with the recorded end-of-life risk and fallback. (7) The audit mapping C-1 to C-7 and D-1 to D-9 is recorded in BUILD_LOG §4.1. | Owner decision 2026-10-11, BUILD_LOG ADR-015 |

**Open values the PRD does not define.** The SPEC names the parameter, states where it is configured and does not invent a number: exemplar top-k, exact-key cache TTLs, near-duplicate cosine threshold, difficulty-anomaly and "excessive confusion" thresholds, the `tone` value set, the sample size below which an evidence-limit warning is shown, the computation of "strengths and next focus" on the student dashboard, and the confidence computation for groups. The `confidence_rating` range is closed at 1–5 (D-13).

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

The table SHALL hold no name and no email. `clerk_user_id` appears in no other table, audit row, trace or cache. Rows are created only by `scripts/seed_synthetic.py` (reading `content/seed/users.json`: `{clerk_ref, role, cohort, display_label}` with no Clerk id, resolved to `clerk_user_id` through `content/seed/clerk_ids.<APP_ENV>.json`, failing with an explicit error if a `clerk_ref` is unmapped, idempotent) and by the administrator route of ADM-13. The seed script inserts `BOOTSTRAP_ADMIN_CLERK_ID` as `administrator` only when no administrator exists. The API process never reads that variable.

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
| `scaffold_probes` | list, at most 4 (V5) | each `{probe_id, kind: value \| setup, min_level, template, expected_expression, expected_value, unit, counts_as_step_id}` |
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

**`misconception_exemplar`** (T1b): `id`, `skill_id`, `code` (taxonomy enum), `feature_template` (numbers only: `error_category`, canonical value, `relation_tags`), `approval_status`, `taxonomy_version`. The `embedding vector(768)` column (Decision #28) is nullable and **not used by student-path retrieval** (D-26). Every one of the 12 non-sentinel taxonomy codes has at least one exemplar (Tier 1b; checked at Gate B). `insufficient_evidence` is the 13th enum value, a sentinel with no exemplar (D-36). Only approved, published exemplars are retrievable.

**`question_embedding`** (T1b): `(question_id, version)`, `embedding vector(768)`. Written at import (Decision #29). Every vector query SHALL join to `validation_status=approved` and `publication_status=published`.

**Skill and misconception graph** (T1)

| Table | Attributes |
| --- | --- |
| `graph_node` | `id`, `kind` (`skill`, `misconception`, `question`), `ref` (skill id, taxonomy code, or `(question_id, version)` of an approved version) |
| `graph_edge` | `from_id`, `to_id`, `kind` (`prerequisite`, `indicates`, `remediates`). `prerequisite`: skill A before skill B. `indicates`: a question's error pattern indicates a misconception. `remediates`: an approved question set is the next practice for a misconception |

**Misconception taxonomy** (closed enum, 13 values): `ratio_additive_interpretation`, `ratio_reversal`, `whole_to_part_confusion`, `unit_rate_error`, `scale_direction_error`, `unit_conversion_error`, `arithmetic_error_after_correct_setup`, `irrelevant_operation`, `diagram_misread`, `premature_rounding`, `incomplete_reasoning`, `answer_guessing`, `insufficient_evidence`. The last is never shown to a student. The 12 non-sentinel codes are grouped in 4 calibration clusters (PRD §14.5).

**Authored text registry** (`content/safety/canned_responses.json`, T1): each key maps to `{text, status: draft | reviewed, reviewed_by?, reviewed_on?}`. Required keys (28): `level0_prompt`; `fallback_l0`, `fallback_l1`, `fallback_l2`, `fallback_l3`, `fallback_l4`; `rephrase_request`, `use_dot_for_decimals`, `enter_the_number`, `structured_mode_notice`; `tool_failure_notice`, `save_failed_notice`, `rate_limited_notice`; `note_ack`; `answer_request_reply`, `abuse_reply`, `assessment_help_reply`, `impersonation_reply`, `worrying_disclosure_reply`, `injection_phrase_reply`; `encouragement`; `support_withheld_notice`; `turn_cap_notice`; `transfer_offer`, `transfer_declined_ack`, `transfer_stuck_notice`, `no_legal_transfer_notice`, `session_closed_notice` (emitted as the `tutor_text_key` of the 409 `transition_not_allowed` returned for a student event, other than `note`, sent to a session in a terminal state; no session mutation, audit event only).

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
| `lease_holder`, `lease_expires_at`, `lease_stage` | text nullable, timestamp nullable, enum `checking`, `preparing`, `done` nullable | Session lease (D-14, DESIGN DD-01). `lease_holder` is the `Idempotency-Key` that owns the in-flight event. The lease lasts 12 s (`SESSION_LEASE_SECONDS`). `lease_stage` feeds the optional progress stream and is written best effort |
| `input_mode` | enum `keypad`, `structured` | Switches to `structured` on the second consecutive `cannot_verify` |
| `active_probe_id` | text nullable | Written by the hint policy. Cleared when answered or superseded |
| `asked_probe_ids` | set of text | Probes already asked in this session |
| `matched_step_ids` | set of text | Steps already matched in this session (drives advancing versus stalled) |
| `consecutive_cannot_verify` | int | Counts `unparsed` or `comma_ambiguous` `cannot_verify` results only (SM-1 row 5b does not change it). Reset by any other outcome on the same question version |
| `consecutive_unverified` | int | Consecutive `unverified` turns (SM-1 row 23). Reset by any outcome that has a verifier result. At 3, the turn is the canned `tool_failure_notice` and the flag `verification_unavailable` is set |
| `transfer_outcome` | enum `correct`, `incorrect`, `skipped`, null | Null until known. See D-04 |
| `end_reason` | enum `completed`, `declined`, `abandoned`, `no_legal_transfer`, `stuck_after_transfer`, `turn_cap_reached`, null | `stuck` is a session state, not an `end_reason`. Row 19 sets `end_reason=turn_cap_reached` |
| `created_at`, `updated_at`, `last_activity_at`, `ended_at` | timestamptz | `last_activity_at` drives the 30-minute rule |
| `summary` | json nullable | Written on entering a terminal state: verifier outcomes, hint levels, transfer result |

**`session_flag`**: `(id, session_id, kind, created_at)`, `kind` in `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached`, `verification_unavailable`. Unique on `(session_id, kind)` [D-10]. Not the EDU-01 review flag.

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
| `confidence_rating` | int nullable | Optional. Range 1–5 [D-13, accepted] |
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
| `cited_exemplar_ids` | list | Empty with `retrieval=skipped` or `exemplars_used=none` |
| `recommended_prompt_type` | enum `targeted_scaffold`, `diagnostic_probe` | |
| `reviewer_status` | enum `unreviewed`, `confirmed`, `rejected` | Starts `unreviewed`. Set only by the assigned teacher. Not shown to the student |

### 2.4 Verification, policy and agent data contracts (ENT-04)

**`PureVerifierResult`** (MCP return shape, cache value, one shared Pydantic model; T1). It depends only on input, question version and tolerance rule, never on the session.

| Field | Type | Rule |
| --- | --- | --- |
| `schema_version` | text | `"1.0"` |
| `status` | enum `correct`, `incorrect`, `partially_correct`, `cannot_verify` | The verdict. `tool_failure` is not a status value |
| `state` | enum `ok`, `tool_failure`, `unverified` | Whether the tool ran. `unverified` is set by the orchestrator when the turn budget lapsed before any verifier result existed. The verifier never returns it |
| `confidence` | number | |
| `input_kind` | enum `value`, `ratio`, `expression`, `unparsed` | |
| `canonical_value` | text nullable | Exact decimal string from exact rational arithmetic (SymPy inside the verifier, the standard-library `fractions` module inside the normaliser; the shared test corpus proves they agree). Null when `unparsed`. For an `expression` it is the evaluated value, used only to classify the error |
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
| Turn budget lapses before a verifier result exists (7.5 s hard stop, or the do-not-start rule) | `cannot_verify`, `state=unverified` | All other fields null. Orchestrator-set, never cached |

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
| `SocraticDialogueAgent` | The allow-listed `HintDecision` subset (level, prompt type, `tone`, `permitted_scaffold_step` at Level 4 only), the selected probe template, the misconception code (an input, never shown in student text), one question stem | The accepted answer, `exemplars`, the retrieval corpus, the student's value, student free text, chat history, any safety verdict beyond "revise" |
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
**`cache_entry`** (T1b): `cache_kind` (`verifier_result`, `exemplar_query`, `prompt_template`), `cache_key` (SHA-256), `value_json`, `created_at`, `expires_at`, `hit_count`. Cache-key inputs and the exact-key rule are in §5.6.
**`rate_counter`** (T1) [D-10]: `(student_id, window_kind: hour | five_minutes, window_start)` → `count`. Fixed-window, in Postgres.
**`evaluation_case`**: `{id, category (one primary), secondary_labels[], critical (boolean), input, expected, notes}`, stored as versioned JSONL under `content/eval/`. At Tier 1a the repository files are the only dataset. The mirror to Langfuse datasets starts at Tier 1b (D-31, D-33).
**`curriculum_chunk`** (optional): `embedding vector(768)`, only if needed for teacher-facing explanations.

### 2.8 State machines and lifecycles (SM)

#### SM-1 Tutoring session (T1)

The machine-readable source is `apps/api/app/fsm/transitions.yaml`, loaded at runtime and parity-checked against this table by `tests/fsm/test_table.py`. A (state, event) pair not listed is rejected with 409 `transition_not_allowed`, nothing changes and an audit event is written. Row numbers follow PRD §8.5.1.

States: `awaiting_first_attempt`, `active`, `reflection`, `transfer_offered`, `transfer_active`, and the terminal states `completed`, `declined`, `stuck`, `abandoned`.

**Two-phase application (D-22).** Several rows below are guarded by the result of the pipeline (rows 3, 4, 5, 5b, 6, 7, 9–12, 17, 18, 19, 22 and 23, with row 2 resolved jointly with its outcome row), which does not exist when TX-A runs. `transitions.apply` is therefore applied twice per event, always from `transitions.yaml`:

| Phase | Where | Inputs | What it decides | What it writes |
| --- | --- | --- | --- | --- |
| 1, legality | TX-A, before the attempt row | Current state, event type, and static event guards that need no pipeline result (for example "no `show_solution` in `transfer_active`"). Guards that depend on the cohort's `allow_level_5`, the verifier outcome or the hint level are phase 2 inputs | Whether any row exists for (state, event type). No row → 409 `transition_not_allowed`, nothing changes, independent-transaction audit | Nothing in `state`. The lease, the idempotency record and the attempt row only |
| 2, resolution | TX-B, after the pipeline (or after the fallback) | The phase 1 state, the event, the post-overlay `VerifierOutcome`, the `HintDecision`, counters (`turn_number`, `attempt_count`, level) | Exactly one row among those allowed for (state, event type), selected by the outcome guards. Row 2 (`awaiting_first_attempt` → `active`) and the outcome row for the same event are resolved together: the next state is the result of the outcome row applied from `active` | `state`, level, counters and flags, in the same TX-B as the turn |

Both phases read one table. The parity check (`tests/fsm/test_table.py`) covers both. A state change outside phase 2 is a defect. Budget expiry before a verifier result is not such a case: it resolves to row 23 and never panics. A phase 2 that finds no row for an event that passed phase 1 is a defect that fails the turn into the deterministic fallback and a P0 audit event (the session state is left unchanged).

| # | From | Event (and guard) | To | Effect |
| --- | --- | --- | --- | --- |
| 1 | — | Student opens a published item | `awaiting_first_attempt` | Canned `level0_prompt`. No hint |
| 2 | `awaiting_first_attempt` | First submission, or `not_sure` | `active` | Pipeline turn (WF-03) |
| 3 | `active` | Pure verifier status `correct` (the accepted final answer), whatever the `response_target`: the step and probe overlays leave a pure `correct` unchanged, so a student who types the accepted answer into a step or probe field is also row 3 | `reflection` | Mastery delta written. Authored reflection prompt shown. No model, verifier or retrieval |
| 4 | `active`, `transfer_active` | A verifier result exists and its post-overlay status is `incorrect` or `partially_correct` (not `correct`, which is rows 3 and 17, and not `cannot_verify`, which is rows 5, 5b, 6, 7 and 23) | same | Hint policy per WF-08 |
| 5 | `active`, `transfer_active` | `cannot_verify` with `state=ok` and `input_kind` `unparsed` or `comma_ambiguous`, first time | same | Canned `rephrase_request` (or `use_dot_for_decimals`, `enter_the_number`). No counters change. Not a pipeline turn |
| 5b | `active`, `transfer_active` | `cannot_verify` with `state=ok` for a parsed expression that matches no step (WF-06 `final` overlay) | same | The tutor asks for "the number your calculation gives". Pipeline turn: the retrieval gate and classifier eligibility follow AGENTS §2.6 (the label is forced to `insufficient_evidence`). No level change, attempt not counted (`counted=false`, `attempt_count` unchanged), `tutoring_session.turn_number` increments. Does not change `consecutive_cannot_verify`, so it never triggers structured mode |
| 6 | `active`, `transfer_active` | `cannot_verify` with `state=ok` and `input_kind` `unparsed` or `comma_ambiguous`, second in a row | same | `input_mode=structured`, canned `structured_mode_notice`, flag `ambiguity_review`. Counts as a pipeline turn. No level change, not counted |
| 7 | `active`, `transfer_active` | `state=tool_failure` | same | Canned `tool_failure_notice`. No counters change. Not a pipeline turn |
| 8 | any state | Input Screen hit | same | Canned reply. Not a pipeline turn. No counter or level change. In a terminal state the session row is not mutated: the safety audit event and, for `worrying_disclosure`, the `session_flag` row go to their own tables |
| 9 | `active` | `show_solution` with all four Level 5 conditions true | `transfer_offered` | Deterministic worked solution plus canned `transfer_offer`, `kind=solution` |
| 10 | `active` | `show_solution`, `allow_level_5` false, other conditions true | same | Isomorphic example plus canned `support_withheld_notice`, `kind=authored`, flag `support_withheld`, item answer not shown |
| 11 | `active` | `show_solution`, any other condition unmet | same | Next unused probe at the current level (paraphrased through the loop), or canned `encouragement`. Level unchanged. Request audited |
| 12 | `active`, `transfer_active` | Safety loop exhausted or guard unreachable | same | `fallback_l{level}`, flag `safety_fallback` |
| 13 | `reflection` | Reflection option or Skip, and the graph has a legal partner | `transfer_offered` | Choice and `sound` flag recorded. The option's authored `feedback` shown, then canned `transfer_offer` |
| 14 | `reflection` | Same, and no legal partner | `completed` | `end_reason=no_legal_transfer`, canned `no_legal_transfer_notice` |
| 15 | `transfer_offered` | Student accepts | `completed` (original) | `end_reason=completed`. **Amended by R1.** Create the linked transfer session in `transfer_active`. Set `linked_session_id` on both. No hint before the first independent attempt. A worked solution is never offered |
| 16 | `transfer_offered` | Student declines | `declined` | `transfer_outcome=skipped`. Confidence not raised. Canned `transfer_declined_ack` |
| 17 | `transfer_active` | Pure verifier status `correct`, whatever the `response_target` (same rule as row 3) | `completed` | `end_reason=completed`. Confidence delta written. `transfer_outcome=correct` on both sessions |
| 18 | `transfer_active` | Level 4, 3 or more counted attempts, latest `incorrect` or `partially_correct` | `completed` | `end_reason=stuck_after_transfer`. Flag `stuck_after_transfer`. Canned `transfer_stuck_notice`. No worked solution. `transfer_outcome=incorrect` [D-04] |
| 19 | `active`, `transfer_active` | The 12th pipeline turn without a `correct` | `stuck` | `end_reason=turn_cap_reached`. Flag `turn_cap_reached`. Canned `turn_cap_notice`. Question saved for the teacher. Another approved item offered. No worked solution |
| 20 | any non-terminal state | 30 minutes with no request | `abandoned` | Summary written. A return starts a new session. A transfer session sets `transfer_outcome=skipped` [D-04] |
| 21 | any state | A note with no Input Screen hit | same | `student_note` stored in its own table, canned `note_ack`. Not a pipeline turn. In a terminal state the session row is not mutated |
| 22 | `active`, `transfer_active` | `not_sure` | same | Level + 1, never above 4. Attempt stored as `not_sure`, not counted. No verifier, matcher, retrieval or classifier. Counts toward the turn cap |
| 23 | `active`, `transfer_active` (a first submission from `awaiting_first_attempt` is resolved together with row 2) | `submit` (value, ratio or expression) whose 7.5 s turn budget lapses, or whose verifier stage the do-not-start rule skips, **before a verifier result exists**. Outcome `unverified` | same (`active`, or `transfer_active`; from `awaiting_first_attempt`, `active` by row 2) | The turn is `fallback_l{current_level}` with `fallback_reason=budget`. Attempt stored with `counted=false`, so it is not counted toward the Level 5 minimum of 3 attempts and `attempt_count` is unchanged. One `tutor_turn` row is written (DD-02) and the per-session ordinal `tutor_turn.turn_number` increments, which keeps the audit sequence unbroken. It is **not a cap turn**: the cap counter `tutoring_session.turn_number` does not change, so a system fault never consumes the student's 12 turns. `consecutive_unverified` increments. On the third consecutive `unverified` turn the turn is the canned `tool_failure_notice` instead of `fallback_l{current_level}`, and the flag `verification_unavailable` is set. Any outcome that has a verifier result resets the counter. The hint level does **not** change. No matcher, retrieval, classifier or learner-model write. No session flag. The student is never told they are wrong |

Rules that apply across rows:

- A transfer session starts in `transfer_active`, so row 2 applies to the first item only. A correct answer in `transfer_active` is row 17, never row 3. Rows 9–11 do not apply to `transfer_active`. If `show_solution` arrives there it is rejected with 409 and audited.
- Cap-counting rule for every row (the 12-turn cap counts the `tutoring_session.turn_number` counter). Pipeline turns that count: rows 3, 4, 5b, 6, 9, 10, 11, 12, 17, 18, 19 and 22, and row 2 through the outcome row it resolves with. Rows 5b and 6 are pipeline turns with no counted attempt. Row 22 (`not_sure`) counts toward the cap. Rows that do not count: 1 (open), 5 (first rephrase request), 7 (`tool_failure`), 8 (Input Screen hit), 13 and 14 (reflection choice), 15 and 16 (transfer decision), 20 (abandon), 21 (note) and 23. Row 23 writes a `tutor_turn` row but is not a cap turn. This matches PRD §8.5.1 and AGENTS §5.5.
- `completed`, `declined`, `stuck` and `abandoned` are terminal. A summary is written on entry to any of them. After row 15, the original session's `transfer_outcome` is back-filled when the linked session reaches a terminal state [D-04]. That back-fill is the only permitted mutation of a terminal session row. Terminal sessions accept zero state, level, counter or flag-on-session mutations. Out-of-band records (`student_note`, `session_flag` for safety disclosures, audit events) are rows in their own independent tables, written without touching the session row, and are permitted in every state.
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
| Session flag | `safety_fallback`, `worrying_disclosure`, `stuck_after_transfer`, `ambiguity_review`, `support_withheld`, `turn_cap_reached`, `verification_unavailable` |
| Event | `submit`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision`, `note` |
| Response type | `final_answer`, `probe_answer`, `step`, `reasoning_option`, `not_sure`, `show_solution`, `reflection_choice`, `transfer_decision` |
| Response target | `final`, `step`, `probe` |
| Verifier status | `correct`, `incorrect`, `partially_correct`, `cannot_verify` |
| Verifier state | `ok`, `tool_failure`, `unverified` |
| Input kind | `value`, `ratio`, `expression`, `unparsed` |
| Turn kind | `model`, `probe_template`, `authored`, `canned`, `fallback`, `solution` |
| Fallback reason | `loop_exhausted`, `guard_unreachable`, `provider_error`, `schema_invalid`, `budget` |
| Prompt type | `targeted_scaffold`, `diagnostic_probe`, `reflection` |
| Trace status | `ok`, `missing` |
| Safety verdict | `allow`, `block`, `revise`, `escalate` |
| Input Screen category | `answer_request`, `abuse`, `assessment_help`, `impersonation`, `worrying_disclosure`, `injection_phrase` |
| Cache kind | `verifier_result`, `exemplar_query`, `prompt_template` |
| Job name | `warmup`, `learner-rollup`, `embedding-sync`, `insight-drafts`, `item-quality-scan`, `retention-purge` |
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

Bank readiness (ADM-04, ADM-12): at least 10 approved items for Release 1.0, 40 for Release 1.1, each passing V1–V9, with a diagram specification for every diagram item, and a skill-graph edge that gives each item a legal transfer partner. The exemplar-per-code check (one approved exemplar for each of the 12 non-sentinel taxonomy codes) is a Tier 1b item verified at Gate B, not a Tier 1a bank-readiness condition.

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
{ "error": { "code": "transition_not_allowed", "message": "string", "retryable": false, "retry_after_s": null, "tutor_text_key": null, "request_id": "uuid" } }
```

| HTTP | `code` | Meaning | Retryable |
| --- | --- | --- | --- |
| 400 | `invalid_request` | Schema or field-set violation, including a field not allowed for the event and a missing `Idempotency-Key` [D-03] | No |
| 401 | `unauthenticated` | No or invalid token | No |
| 403 | `forbidden` | Role or cohort scope. Unknown `sub`. Audited | No |
| 404 | `not_found` | Unknown session, a session of another student, a diagram that is not available, a question that is not servable | No |
| 409 | `transition_not_allowed` | The state machine does not allow the event, a recommendation already has a different decision [D-16], or a content review item is approved before offline validation has passed (OP-17). Audited | No |
| 409 | `idempotency_conflict` | Same key with a different body, or on a different session | No |
| 409 | `request_in_progress` | Same key still running. `retry_after_s=3` | Yes |
| 429 | `rate_limited` | Student rate cap. `retry_after_s` set. The error object carries `tutor_text_key=rate_limited_notice`, and the client renders that canned text from the key | Yes |
| 503 | `service_unavailable` | Postgres or authentication is unavailable | Yes |

A model, tool or guard failure is **never** an error response. It is a 200 with `tutor.kind=fallback` or `tool_failure_notice` (PRD §11.6).

### 3.2 Student session API (T1, defined in PRD §15.9)

| Method and path | Purpose | Request | Success |
| --- | --- | --- | --- |
| `POST /api/sessions` | Start a session | `{"question_id": "scale_0001"}` **or** `{"recommended": true}`. Exactly one | 201 `SessionView`. The first `tutor` is the canned `level0_prompt` |
| `GET /api/sessions/{id}` | Resume | — | 200 `SessionView` with the last tutor turn |
| `POST /api/sessions/{id}/events` | One student event | Header `Idempotency-Key: <uuid>` (required). Body `TurnRequest` | 200 `TurnResponse`. A replay adds header `Idempotent-Replay: true` |
| `GET /api/sessions/{id}/diagram` | SVG for the current level | — | 200 `image/svg+xml`, `Content-Security-Policy: default-src 'none'`, `Cache-Control: private` |
| `GET /api/sessions/{id}/progress` | Optional progress stream | — | 200 `text/event-stream`, consumed with `fetch` streaming (the `Authorization` header is sent), not `EventSource`. Each event is `{"stage": "checking" | "preparing" | "done"}` and nothing else |

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
| `submit` | `response_target` when `answer_text` or `step_expressions` is present. At least one of `answer_text`, `step_expressions`, `selected_reasoning_option` | `confidence_rating`, `response_duration_ms` | `answer_text` and `step_expressions` are mutually exclusive. `response_target=step` iff `step_expressions` is present, otherwise `final` or `probe`. `response_target` is forbidden (stored null) for an option-only submit, which carries no answer or step value, so the field-set rule above holds. `step_expressions` has at most one element [D-02]. An option-only submit is an answerless pipeline turn [D-01] |
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

**Event-to-state validity.** `submit`, `not_sure`: `awaiting_first_attempt`, `active`, `transfer_active`. `show_solution`: `active` only. `reflection_choice`: `reflection` only. `transfer_decision`: `transfer_offered` only. `note`: every state. Any other combination returns 409 `transition_not_allowed`, with `tutor_text_key=session_closed_notice` when the session is in a terminal state (any student event other than `note`).

**Idempotency contract.**

| Case | Result |
| --- | --- |
| Same key and body, first completed | Stored response, header `Idempotent-Replay: true`. No second attempt, turn or counter change |
| Attempt row stored, turn not stored | The retry resumes the pipeline from that attempt and does not add a second attempt or increment `attempt_count` |
| Same key, different body hash | 409 `idempotency_conflict` |
| Same key on a different session | 409 `idempotency_conflict` |
| Same key while the first request runs | 409 `request_in_progress`, `retry_after_s=3` |
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
| OP-06 | `PUT /api/teacher/sessions/{session_id}/turns/{turn_id}/misconception-review` | assigned teacher | `{status: "confirmed" \| "rejected"}` | `misconception_event` | 403 | T2 |
| OP-07 | `POST /api/teacher/sessions/{session_id}/comments` | assigned teacher | `{body}` | `teacher_comment` | 403. Audited | T2 |
| OP-08 | `GET /api/session-flags` | teacher (assigned students); cohort support contact (only `safety_fallback` and `worrying_disclosure`, only if the cohort has no teacher); `trace_review` administrator (the safety list, only if the cohort has no teacher and no support contact) | optional `session_id` | `[{session_id, kind, created_at}]` | 403 for anyone else | T2 |
| OP-09 | `GET /api/teacher/recommendations` and `GET /api/teacher/recommendations/{id}` | teacher (assigned) | optional `status` | `Recommendation` (rejected-by-wording-check drafts are never returned) | 403 | T2 |
| OP-10 | `POST /api/teacher/recommendations/{id}/decision` | assigned teacher | `{decision: "accept" \| "reject" \| "override", rationale?}`. `rationale` required for `override` | `Recommendation` with the stored decision | 400 (override without rationale), 403, 409 `transition_not_allowed` (different second decision). An identical retry returns the stored result | T2 |
| OP-11 | `POST /api/teacher/sessions/{session_id}/draft-recommendation` | assigned teacher | — | One `Recommendation` in `pending`, produced on demand by the Teacher Insight code path that `insight-drafts` later calls | 403 | T1c |
| OP-12 | `GET /api/tutor/sessions` | tutor (assigned) | — | `[{session_id, question_title, started_at}]`. No responses and no tutor output | — | T2 |
| OP-13 | `POST /api/tutor/sessions/{session_id}/notes` | tutor (assigned) | `{body}` | `tutor_note` | 403 if unassigned. Audited | T2 |
| OP-14 | `GET /api/coordinator/cohorts/{cohort_id}/summary` | academic coordinator (assigned) | — | `CohortSummary`: cohort mastery, misconception trends, intervention insights, item-quality indicators, and for each accepted recommendation the later transfer outcome or "not enough later evidence" | 403 | T2 |
| OP-15 | `PUT /api/coordinator/cohorts/{cohort_id}/settings` | academic coordinator (assigned) | `{allow_level_5: boolean}` | `{allow_level_5}` | 403. Writes an audit event with who, when, previous and new value | T2 |
| OP-16 | `GET /api/content/review-items` | content reviewer, administrator. Teachers: read-only | optional `status` | `[content_review_item]` with reasons and evidence | — | T2 |
| OP-17 | `POST /api/content/review-items/{id}/decision` | content reviewer, administrator | `{decision: "approved" \| "rejected" \| "deprecated", note?}` | `content_review_item` | 403 for a teacher. 409 `transition_not_allowed` if offline validation has not passed and the decision is `approved` | T2 |
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
| `GET /api/jobs/embedding-sync` | `15 * * * *` | Embed new or changed approved questions |
| `GET /api/jobs/insight-drafts` | `0 18 * * *` | Draft teacher recommendations |
| `GET /api/jobs/item-quality-scan` | `30 18 * * *` | Flag items for review |
| `GET /api/jobs/retention-purge` | `0 19 * * *` | Apply retention windows |

There are six job routes. `eval-nightly` is not a Vercel Cron route (D-25). It is the GitHub Actions workflow `eval.yml` (§5.9), because a live suite of 100 or more turns cannot finish inside one function invocation (`maxDuration` 60 s).

Contract: header `Authorization: Bearer <CRON_SECRET>` is required. A missing or wrong secret returns 401 `unauthenticated`, writes a log entry and an audit event, and runs nothing. A valid call returns 200 `{job_run_id, status, processed_count, remaining_count}`. A job SHALL be idempotent, process a bounded batch that finishes inside the function duration limit, and resume the remainder on the next invocation.

### 3.6 MCP tool contract (T1b, derived inputs [D-07])

Transport: MCP streamable HTTP, stateless. Every call carries a service bearer token (§3.8) and W3C `traceparent` and `tracestate` headers. Tools return schema-validated JSON and never generate tutor text.

| Tool | Input | Output | Errors |
| --- | --- | --- | --- |
| `verify_expression` | `{question_id, question_version, input: string, field_kind: "answer" \| "step"}`. `field_kind=step` covers step and probe fields. The tool runs the shared normaliser, so `/` is a fraction for `answer` and `÷` for `step` | `PureVerifierResult` | 401 bad token. 400 schema. 404 question not servable. A server-side exception returns an error, which the orchestrator maps to `cannot_verify` with `state=tool_failure` |
| `get_question` | `{question_id, version?}` (latest approved and published when omitted) | The full authored question including solution data | 401, 404 for anything not approved and published |
| `search_exemplars` | `{skill_id, error_category, canonical_value, relation_tags[], taxonomy_version}` | `{exemplars: [{exemplar_id, code, feature_template}]}`, an exact SQL filter on `skill_id`, `error_category` and the candidate `code` (derived server-side from the `error_category` mapping, not an input), ordered by `exemplar_id`, approved and published only, top-k from policy configuration. No embedding call, no similarity score (D-26). `relation_tags[]` is an input recorded for the exemplar-query cache key and the audit row; the SQL filter does not use it. An empty list is a valid result | 401, 400 |

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

`forbidden_strings[]` hold the accepted answer, solution-step values and not-yet-produced probe values (including the selected probe's own expected value). Probe values already produced (answered) this session are not sent. They are sent to the guard model only so it can recognise leakage in the candidate (D-24). They are a constrained exception to the rule that no LLM receives the accepted answer (AGENTS §2.1 #2). They contain no student text. They are replaced by a count and a hash in every Langfuse span and audit row. The guard never returns them. The guard's in-process fallback runs in the orchestrator and so holds the same strings in the orchestrator's process.

An unguarded candidate is never sent to the student.

### 3.8 Service-to-service authentication (T1b)

| Property | Specification |
| --- | --- |
| Token | Short-lived signed bearer with claims `aud` (target service), `iat`, `exp`. `exp − iat ≤ 60 s` |
| Secrets | One HMAC secret per target service: `INTERNAL_SERVICE_TOKEN_MCP`, `INTERNAL_SERVICE_TOKEN_SAFETY`. Each service holds only its own, so a compromised service cannot mint a token for the other (Vercel OIDC where available) |
| Failure | A missing, expired, wrong-audience or wrongly signed token returns 401, writes an audit event and returns no question or answer data. This test blocks CI |
| Reach | The browser never reaches either service. The single per-turn fallback (in-process `app.safety.service` for the guard, a repeat MCP call for the verifier on the Vercel topology) is used only by the orchestrator and does not bypass this |

### 3.9 Internal component contracts (deterministic components and orchestrator)

These are the method-level contracts. They are written as signatures and behaviour, not as source code.

| Component | Signature (inputs → outputs) | Behaviour and limits |
| --- | --- | --- |
| `normalise` (`apps/api/app/verifier/normaliser.py`, shared by the verifier, the leakage check and tests; **standard library and Pydantic only, no SymPy**, so the API bundle needs no SymPy) | `(raw: text, field_kind: answer \| step) → {input_kind, canonical_value, canonical_expression, unit, parse_issue: none \| comma_ambiguous \| unparsed}` | Deterministic. Handles word numerals (`thirty` → 30), unit suffixes and expansions (`30 km`, `30,000 m`), `5:2` and `5 to 2`, `7.5x4`, `×`, `÷`, the thousands-comma pattern. One shared test corpus |
| `scrub_pii` | `(text) → text` | Replaces names it recognises with `[STUDENT_NAME]`, emails with `[REDACTED_EMAIL]`, Australian phone numbers and street addresses with a redaction token. Best effort for names. Under 5 ms |
| `input_screen` | `(text) → {hit: bool, category?, canned_key?}` | Regex lexicon `input_lexicon.json`. Runs on note text and on answer or step text that failed to parse. Under 10 ms |
| `apply_overlay` | `(pure: PureVerifierResult, response_target, session, question) → VerifierOutcome` | Uncached. See WF-06 |
| `match_prediction` | `(outcome, question) → {matched, code?, confidence=0.90}` | Runs only for post-overlay `incorrect` with `input_kind` of `value` or `ratio`. Under 10 ms |
| `retrieval_gate` | `(outcome, match) → {open: bool, skipped_reason?}` | See WF-07 |
| `estimate_student_state` | `(prior persisted results of this session) → StudentState` | No model, no free text, no accepted answer |
| `decide_hint` | `(event, outcome, match, classification?, student_state, session, question, cohort) → HintDecision` | Pure Python. Under 40 ms. See WF-08 |
| `check_candidate` | `(candidate_text, hint_decision, question, verifier_outcome) → {blocked: bool, reasons[]}`. `verifier_outcome` is the current attempt's post-overlay outcome read from ADK state, not the persisted `session`. Below Level 4 the digit rule's exemption set is the question stem, the selected probe template (from `hint_decision`) and the student's value that the verifier marked correct on this attempt (from `verifier_outcome`). The exemption applies inside `check_candidate` only: the Dialogue Agent never receives the student's value | Value leakage, method leakage, phrase check, digit rule, `age_appropriate`, `single_prompt`. See WF-09 |
| `render_solution_turn` | `(question) → text` | Template: for each main-path step `Step {n}: {description}. {target_expression} = {target_value} {unit}.`, then `So the answer is {accepted canonical value} {unit}.`, then canned `transfer_offer`. No model, no guard |
| `render_example_turn` | `(question) → text` | The isomorphic stem, its steps and `So the answer is {final_answer}.`, then canned `support_withheld_notice`. No model, no guard |
| `select_transfer` | `(student, original_session) → question \| none` | See WF-10 |
| `recommend_next` | `(student, cohort) → question \| none` | Practice Planner. See WF-02 |
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
| Verifier tool timeout or connect failure | Orchestrator | One fallback per turn: a repeat MCP call (Vercel topology) or in-process `app.verifier.service` (container topology) | Nothing | Span `protocol: in_process_fallback` (container) or `mcp_repeat` (Vercel) |
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

### WF-01 Authenticate and authorise every request (T1; RLS layer T1)

- **Trigger:** any `/api/*` request except the cron routes (WF-22).
- **Pre-conditions:** none.
- **Processing:**
  1. No bearer token or an invalid token → 401 `unauthenticated`.
  2. Verify the JWT signature against the Clerk JWKS, then verify `iss`, `exp` and `nbf`, and verify the **authorised party** (`azp`) against the allow-list `AUTH_AUTHORIZED_PARTIES` (the web origins of the environment). Clerk's default session token carries no `aud` claim, so `aud` is checked only when the environment uses a Clerk JWT template that sets it (`AUTH_AUDIENCE` is then set, otherwise it is unset and not checked). A wrong or missing `azp` → 401 `unauthenticated`. The `azp` is the web origin of the Clerk frontend (not a client ID or the publishable key). `AUTH_AUTHORIZED_PARTIES` is an allow-list of **exact** web origins, compared character for character with no wildcard. Development holds the local origin (for example `http://localhost:3000`). Production holds the production origin and is set when the owner first deploys to Vercel. **Preview is not configured**: development is local first and the owner deploys to Vercel later, so no Preview origin exists yet. If a Preview environment is created, it takes an exact stable alias origin only, and any wildcard pattern needs an ADR first. An origin not in the list returns 401. If the JWKS endpoint is unreachable, use cached keys no older than 1 hour. With no usable cache → 503 `service_unavailable`. Authentication never fails open.
  3. Look up `sub` through the narrow `SECURITY DEFINER` lookup function (keyed by the Clerk `sub`, returning only that user's `app_user.id`, role and cohort ids), not by a direct table read under the request role. The function is owned by a dedicated non-login role, sets `search_path = pg_catalog, public`, has `EXECUTE` revoked from `PUBLIC` and granted only to the API role, and reads `app_user`, `user_grant` and `cohort_assignment` under an explicit policy for that owner role only (D-30). Not found → 403 `forbidden`, audit `auth_unknown_subject` (no `actor_user_id`, and no Clerk id in the row), no row created. Past this step the request, audit rows and traces carry only `app_user.id`.
  4. Read `role`, cohort assignments and active grants from Postgres. Ignore every role claim in the token.
  5. Apply the route's rule from the §2.1 role-action matrix and the scope rule (assigned cohort or own data). A parent has no route.
  6. (T1) Open the transaction with `SET LOCAL app.user_id = <id>`, never a session-level `SET`. Row-level security fails closed when the setting is absent. The API database role is a non-owner without `BYPASSRLS` and every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`, so the policies bind the table owner path as well (D-30).
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
  0. **Ingress.** Validate the body against the §3.2 matrix (400). Look up the idempotency key (replay, conflict and in-progress rules of §3.2). A new key inserts an `in_progress` record. Apply the rate limit (WF-22 counters; 429). Take the session lease [D-14] (a short row lock inside TX-A only; a live lease held by another key → 409 `request_in_progress`). Apply lazy abandonment [D-12]. Run `transitions.apply` **phase 1** (legality only, D-22). A rejected pair → 409 `transition_not_allowed`, nothing changes, audit.
  1. **Persist the attempt.** Insert the `attempt` row (`counted` unset) before the pipeline runs. If Postgres is unreachable → 503, no pipeline, no counter change. A retry with the same key resumes from this row.
  2. **ProblemContext.** Load the question version. Run `scrub_pii` on any text. Run `normalise`. If the answer or step text is `unparsed`, run `input_screen` on it. A hit short-circuits the turn (SM-1 row 8, WF-05). No hit continues as `cannot_verify`.
  3. **Verify** (WF-06): exact-key cache (Tier 1b; Tier 1a: in-process, no cache), else MCP `verify_expression` (Phase B / Tier 1b; in process at Tier 1a). A hit or miss span is written either way (from Tier 1b).
  4. **Overlay** (WF-06).
  5. **Deterministic matcher** (WF-07).
  6. **Retrieval gate** (WF-07).
  7. **StudentStateEstimator**, then the **MisconceptionClassifierAgent** when the gate opened (WF-07).
  8. **HintPolicyEngine** (WF-08): level, probe, content, prompt type, tone.
  9. **Dialogue loop** (WF-09), or the deterministic turn for solution, example, canned and authored kinds.
  10. **Fallback** when the loop exhausts, the guard is unreachable, the provider fails or the budget is passed.
  11. **Persist** in one transaction (TX-B; `transitions.apply` **phase 2** resolves the outcome row and writes the next state here, guarded by `lease_holder = key`): `tutor_turn`, `attempt.counted`, session fields (state, level, counters, `asked_probe_ids`, `matched_step_ids`, `active_probe_id`, `input_mode`, flags), `misconception_event`, the learner-model write (WF-12), the audit events, and the idempotency record set to `done` with the stored response.
  12. **Trace flush (from Tier 1b; Tier 1a: no Langfuse, `trace_status=missing`).** After TX-B commits, flush Langfuse (at most 300 ms) asynchronously in the background after the response (a platform background task or a non-blocking worker), so the flush is outside the turn latency. If the platform cannot run work after the response (to be recorded by the deploy spike, P0-13), the flush runs inline, capped at 300 ms, and the turn deadline and the revision gate use 7.2 s (§5.1 Flush), so the response and flush still finish by 7.5 s. On failure set `trace_status=missing` and continue.
  13. **Respond** with `TurnResponse`. It never contains the verdict, a misconception code, a `sound` flag or a solution value below Level 5.
  14. **Client behaviour (STU-14).** On send, the student's own answer is echoed immediately and the input is disabled. The loading state shows no tutor text. After more than 1 s it shows a child-friendly message (for example "Thinking about your answer…"). After 4 s it adds a reassurance line. It is announced with `aria-live="polite"` and does not rely on colour or animation alone. Neither message contains model or tutor text. The client timeout is 15 s. A timeout, a network error or a 409 `request_in_progress` is retried once, 3 s later, with the same key. If that also fails, the client shows the deterministic fallback and the loading state ends. All client timers start once the request is dispatched (§5.4).
- **Which steps run, by event**

| Event | Steps run |
| --- | --- |
| `submit` with a value or expression | 0–13 |
| `submit` with only a reasoning option [D-01], `not_sure`, `show_solution` | 0, 1, a load-only form of 2, the estimator of 7, 8, then 9–13. Steps 3–6 and the classifier do not run. No verifier call, matcher, retrieval or classifier |
| `reflection_choice`, `transfer_decision` | 0, 1, WF-10, 11–13. No model, verifier, retrieval, guard or `hint_decision` |
| `note` | 0, WF-05, 11–13. Not a pipeline turn |

- **Post-conditions:** exactly one tutor turn exists for the request, or one canned reply. Session state is in Postgres before the response returns.
- **Side effects:** audit events for the attempt, verifier result, tool calls, model call, hint decision and generated prompt (hashes only); one trace per turn with separate MCP and A2A child spans; Langfuse scores (§5.8) (from Tier 1b / Phase B; Tier 1a: local eval-harness scores, no trace).

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
  2. Compute the cache key from the normalised expression, `question_id`, `question_version` and the tolerance rule. Look it up (target under 20 ms; the 25 ms in the §5.1 overhead line is the budget). Tier 1b only, there is no cache at Tier 1a. A hit returns the stored `PureVerifierResult`. A cache read or write failure is treated as a miss and recorded as a span.
  3. On a miss, call MCP `verify_expression` (stage timeout 400 ms). On a timeout or connect failure, take the verifier's single per-turn fallback inside the remaining budget: a repeat MCP call on the Vercel topology (from Phase B the API bundle holds no SymPy), or the in-process `app.verifier.service` on a container topology that packages SymPy with the API. If the fallback would pass 7.5 s, or a second fallback is needed in the same turn, return the deterministic fallback with `fallback_reason=budget`. No verifier result exists in that case, so the outcome is `unverified` (SM-1 row 23, counting table below). When the verifier did return a result and a later stage runs out of budget, the normal outcome row applies, with the fallback text. An HTTP 4xx or 5xx is not retried: it yields `status=cannot_verify`, `state=tool_failure` with every other field null.
  4. Store the pure result under its key.
  5. Apply the **overlay** (never cached, never sent to MCP):

| `response_target` | Overlay |
| --- | --- |
| `final` | No change, except that a value whose `matched_step_ids` is non-empty and whose status is not `correct` becomes `incorrect` with `error_category=incomplete`. An expression that matches no step stays `cannot_verify` and the tutor asks for "the number your calculation gives" |
| `step` | A value or expression with a non-empty `matched_step_ids` becomes `partially_correct` for that step. Any other parsed input becomes `incorrect` for the step. A pure `correct` is unchanged (SM-1 row 3 or 17) |
| `probe` | Uses `active_probe_id`. `kind: value`: a `canonical_value` equal to `expected_value` becomes `partially_correct` for `counts_as_step_id`. `kind: setup`: a `matched_solution_step` equal to `counts_as_step_id` becomes `partially_correct`. Any other parsed input becomes `incorrect` for the probe and never `cannot_verify` merely because the value is off the main path. If the pure status is already `correct`, nothing changes: it is the accepted final answer, so SM-1 row 3 (or row 17 on a transfer session) applies whatever the `response_target`. With no active probe, the value is judged without the overlay |

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
| `cannot_verify` (unparsed or `comma_ambiguous`) | `ok` | No | No |
| `cannot_verify`, parsed expression matching no step (SM-1 row 5b) | `ok` | No | No. A pipeline turn: `tutoring_session.turn_number` +1, `consecutive_cannot_verify` unchanged |
| `cannot_verify`, `tool_failure` | `tool_failure` | No | No |
| `cannot_verify`, `unverified` (budget lapsed before any verifier result) | `unverified` | No. The level does not escalate | **No**. `attempt_count` is unchanged. The cap counter `tutoring_session.turn_number` does not increment. The `tutor_turn` ordinal does (SM-1 row 23) |

**Unparsed-input loop guard.** One `cannot_verify` with `state=ok` that is `unparsed` or `comma_ambiguous` (not row 5b) asks for a rephrase. Two consecutive such results on the same question version switch `input_mode` to `structured`, show `structured_mode_notice` and record `ambiguity_review`. The student is never told they are wrong, and none of these raise the level or count toward the Level 5 minimum. The `ambiguity_review` flag requires the second occurrence.

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
| `DIALOGUE_MODE=template` (the shipped default, D-37; also the kill-switch) | Retrieval and classifier skipped. `retrieval: skipped`, `misconception: none` unless the matcher hit. `prompt_type=diagnostic_probe` (a null code is never `targeted_scaffold`) |
| `incorrect` and unmatched, or `cannot_verify` with `state=ok` | Gate opens. Call MCP `search_exemplars` (Phase B / Tier 1b; stage timeout 250 ms) with a numbers-only query. Approved, published exemplars only. Exact-key cache for the query (Tier 1b). Tier 1a: the gate runs and the exemplar source is an empty stub, in process, no cache |

  3. **Empty or failed retrieval** (no exemplars or a database read failure): treated as an empty result. The classifier records that it used no exemplars. The turn still completes. At Tier 1a the retrieval gate runs but the exemplar source is an empty stub (the real exact-SQL exemplar query, exemplar authoring and `search_exemplars` arrive in Tier 1b), so every gate-open turn takes this path: the golden trajectory 1a variant (Gate A) runs PRD §19 step 5a with empty retrieval and a recorded classifier output that is null or `insufficient_evidence`: the replay fixture pins no misconception claim and `prompt_type=diagnostic_probe`, and in live mode only the confidence rule is asserted (`targeted_scaffold` only if classifier confidence >= 0.80 and the code is not `insufficient_evidence`). The 1b variant (Gate B) exercises exemplar retrieval and an exemplar-citing classifier result (D-33).
  4. **StudentStateEstimator** (every tutoring turn, deterministic).
  5. **Classifier** (LlmAgent, stage timeout 1,000 ms), only when the gate opened. It returns a `MisconceptionClassifierOutput`. For `cannot_verify` with `state=ok`, the stored label is forced to `insufficient_evidence` [D-20]. The candidate code from the `error_category` mapping is a hypothesis it may use for `incorrect`. Its output must pass `schema_valid`. A timeout, provider error or invalid output after one repair yields **no misconception claim** and the turn continues: `classification` is null, `misconception: none` with an audit event naming the cause, and the prompt type is `diagnostic_probe` (D-23). The turn is not replaced by `fallback_l{level}`.
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
  1. **Dialogue Agent** produces a `SocraticDialogueOutput` (stage timeout 1,400 ms, including one adapter schema-repair call). Invalid after repair → fallback `schema_invalid`. Provider timeout, 429 or 5xx → fallback `provider_error`. With `DIALOGUE_MODE=template` (the shipped default, D-37) no model is called and the authored probe text is the turn, `kind=probe_template` [D-21]. The opt-in `llm` mode runs this agent [D-29, D-37].
  2. **`check_candidate`** (deterministic, first, cheap):
     - *Value leakage.* The candidate is normalised with the shared normaliser. Matching is token-bounded and unit-aware: numerals, word numerals and expanded units are normalised, a digit run inside a larger number is not a match, and arithmetic expressions in the text are evaluated except inside a quoted `permitted_scaffold_step`. Below Level 4 any solution step value or expression, the final answer and any not-yet-produced probe expected value block. At Level 4 the quoted `permitted_scaffold_step` is allowed and the final answer is blocked. At Level 5 the worked solution is allowed. **Exempt at every level:** values and relationships stated in the question stem, values stated verbatim in the selected authored probe template, and the student's own value that the verifier marked correct on this attempt (read from the current attempt's `verifier_outcome` in ADK state, inside `check_candidate` only, so the Dialogue Agent never receives it). The value-leakage check additionally exempts probe expected values already produced (answered) this session. Not-yet-produced probe values, including the selected probe's expected value, stay forbidden and are sent to the guard in `forbidden_strings[]`. Produced probe values are exempt from value leakage only, not from the digit rule below.
     - *Method leakage (below Level 4).* Blocked when the text pairs an operation pattern from `method_leak_patterns` with two or more of the item's quantities, or contains a solution-step phrase the student has not already used. A question may ask which operation applies and SHALL NOT name it.
     - *Phrase check.* Blocks requests for personal information, promises of examination success, selective-entry or placement claims, and inference of a sensitive attribute.
     - *Digit rule (below Level 4).* Digits and word numerals are strictly forbidden in a model candidate unless they match a number in an **exemption set** of three sources: a value quoted verbatim from the question stem, a value in the selected authored probe template, and the student's own value that the verifier marked correct on this attempt. A digit or word numeral that is none of these (a new computed value) blocks. `check_candidate` therefore receives the stem, the selected probe template and the verified student value of this attempt (from the current attempt's `verifier_outcome` in ADK state) as its exemption set, and the rule is unit-testable on those three inputs. This lowers false blocks of benign text such as "step 2" against an intermediate value of 2. The false-block rate is a reported model-level metric (§5.9).
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
  3. Choose deterministically [D-19]: from Tier 1b, highest pgvector similarity then lowest `question_id`; at Tier 1a (no embeddings) lowest `question_id` only.
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
- **T1c scope:** a read-only replay of the golden session and one pending draft recommendation with evidence. Building the replay adds a teacher assigned-cohort read policy to the minimal RLS (D-30). Accept, reject, override, comments and the cohort view are T2.
- **Side effects:** audit `access` event on every replay open. A comment or tutor note writes an audit event with who and when.

### WF-18 Recommendation drafting and review (T1c on demand; T2 daily and review)

- **Trigger:** the `insight-drafts` job (daily), or OP-11 on demand.
- **Processing:** the Teacher Insight Agent reads aggregated events only and returns a `TeacherInsightDraft` in the PRD §13.2 template. A deterministic wording check rejects any draft containing placement, grading, admissions, exclusion or remedial-classification wording. The rejection is stored and the draft is never shown. An accepted draft is stored `pending`, with evidence links, a confidence label and limitations. A `low` confidence recommendation is labelled and never stated as fact.
- **Review** (OP-10, SM-2): the assigned teacher accepts, rejects or overrides. The original recommendation and evidence stay unchanged and an override stores the rationale beside them.
- **Side effects:** audit with who, when and decision. No message is sent to a parent or student.

### WF-19 Content import, validation, review and quality flags (T1 import; T2 review and scan)

- **Import** (offline, TECH-07): load the item JSON, run the Problem Parser, validate V1–V9 and C1–C3 (C4 runs at the Gate B tag only), check answer key against solution plan, and write embeddings for approved items only (Decision #29; exemplars are not embedded, D-26). A failure rejects the import. A content reviewer cannot mark an item approved until validation has passed.
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
| `warmup` | Ping `solvepath-mcp` and `solvepath-safety` with a service token | Warms one instance of each. It cannot warm every concurrent instance, so a cold MCP or Safety call is expected and is covered by the single per-turn fallback |
| `learner-rollup` | Recompute aggregated `learner_skill_state` fields and cohort aggregates from recent events. Record `rollup_at` | May be up to 1 hour behind |
| `embedding-sync` | Embed new or changed approved questions (for the transfer tie-break and the near-duplicate scan only). Do not embed unapproved items. Support re-embedding after a model or dimension change | Embeddings are `vector(768)` |
| `insight-drafts` | WF-18 for cohorts with new evidence | |
| `item-quality-scan` | Flag verifier mismatches, difficulty anomalies, near-duplicates (pgvector cosine similarity above a configured threshold) and the other FR-14 reasons | Thresholds are open values |
| `retention-purge` | WF-23 | |

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
| Deterministic answer check via MCP | p95 under 400 ms, measured on the orchestrator-side client span of the **first** MCP call (network, MCP handshake, question read and verification). A timed-out call is recorded at the 400 ms cap, so this gate also bounds the timeout rate to under 5%. The step as a whole, including the single per-turn fallback, is reported separately. The p95 gate blocks CI (Gate B). Cache hit under 20 ms applies from Tier 1b (there is no cache at Tier 1a) and is a Warning, not a CI block |
| Tutor turn | Target under 5 s, p50 under 3 s (reported). **CI gate p95 under 8 s**, measured from request received to response sent, **excluding** the post-response Langfuse flush, with at most one fallback per turn. The gate asserts that the 7.5 s hard stop is honoured, and the 7.5 s hard stop is the binding bound. Server hard stop 7.5 s (it covers TX-B and serialisation), then the deterministic fallback with `fallback_reason=budget` |
| Dashboard, review list, profile and cohort summary | Under 3 s for a cohort of up to 150 synthetic students |
| Persistence | Every turn persisted before the response returns |
| Deterministic components | PII scrubber under 5 ms. Input Screen under 10 ms. Misconception matcher under 10 ms. Hint policy under 40 ms |
| Langfuse flush (from Tier 1b) | At most 300 ms. Runs asynchronously in the background after TX-B and after the response (a platform background task or a non-blocking worker, outside the turn latency). Only if that is unavailable does it run inline, and then the turn deadline and the revision gate use 7.2 s (see Flush below). A failed flush never fails the turn |
| Cold start (from Phase B / Tier 1b; no MCP service at Tier 1a) | Cold-start p95 at most 5 s (gate, measured on deployed services: not run at Gate A, applies at Gate B). The MCP bundle stays at most 90 MB (measured 83 MB with no bytecode shipped for sympy, mpmath, mcp, httpx, pydantic and a Postgres driver) with cold start under 1.2 s. The warmup job runs every 10 minutes and warms one instance per project only |
| Client wait | Wait message after 1 s, reassurance after 4 s, request timeout 15 s, one retry 3 s after a timeout, network error or 409, same key. Timers start when the request is dispatched |

**Stage timeouts and the budget** (PRD §11.3)

| Stage | Timeout |
| --- | --- |
| Ingress and egress overhead (JWT with cached JWKS 50 ms, session and question load 150 ms, scrubber 5 ms, cache lookup 25 ms (Tier 1b only; 0 at Tier 1a), serialisation 20 ms) | 0.25 s total |
| Verifier MCP | 400 ms |
| Retrieval MCP | 250 ms |
| Classifier | 1,000 ms (runs only when the gate opens) |
| Hint policy | 40 ms |
| Dialogue Agent (covers the single adapter schema-repair call) | 1,400 ms |
| Safety Guard A2A | 1,200 ms (1.3 s cap) |
| Persistence | 200 ms |

**Computed totals (stage caps, no fallback).** Happy path: 4.49 s of stages and 4.74 s with the 0.25 s overhead. One revision: 7.09 s of stages and 7.34 s with overhead (the first revision adds dialogue 1.4 s + guard 1.2 s = 2.6 s). These sums exclude the single per-turn fallback and the Langfuse flush.

**What the fallback adds.** The verifier's fallback (a repeat MCP call on the Vercel topology, in-process on a container topology) costs up to 0.4 s more. The guard's in-process fallback is a second model call and costs up to 1.2 s more (the guard timeout of 1.2 s is spent first). At most one fallback runs per turn. The worst sum, one revision plus a guard fallback, is 7.34 + 1.2 = 8.54 s and so cannot be delivered (the margin under the 7.5 s hard stop is only 0.16 s even without a fallback). The turn is bounded by the 7.5 s hard stop and the revision gate, not by the sum. For example a guard timeout plus guard fallback in iteration 1 puts the elapsed time at 5.74 s. The remaining 1.76 s is below the 2.8 s revision gate, so no second iteration starts and the turn ends as `budget` at about 5.94 s after persistence. Such turns are delivered as `fallback_l{level}`, are counted in `fallback_rate`, and are the reason that gate is a calibrated ratchet (§5.9).

**Flush.** The Langfuse flush executes asynchronously in the background after the response (a platform background task or a non-blocking worker), so it adds nothing to the turn. If neither is available, the flush runs inline for up to 0.3 s and the effective turn deadline D drops from 7.5 s to 7.2 s. D is also the base of the revision gate: a second iteration starts only if D minus elapsed time covers 2.8 s (elapsed at most 4.4 s inline, against 4.7 s with the background flush), and no stage starts if it cannot finish by D. Persistence therefore ends by 7.2 s, and the response plus the flush never passes the 7.5 s hard stop. The inline mode lowers revision availability, and those turns are counted in `fallback_rate`. Typical warm: about 2.6–3.0 s. In Phase A (Tier 1a / Slice 0) the orchestrator imports SymPy directly within the API bundle (`app.verifier`), and the deploy spike P0-13 (deferred until the first Vercel deployment, before Tier 1b) rehearses the Phase B topology. From Phase B (Tier 1b) onward SymPy is isolated exclusively to the independent `solvepath-mcp` service, and the API orchestrator reaches it through MCP protocol calls. From Phase B the verifier's SymPy import cost is paid in `solvepath-mcp` on cold start (target under 1.2 s), and the 1.2 s target is verified by the deploy spike.

### 5.2 Payload and token limits

| Limit | Value | Source |
| --- | --- | --- |
| Prompt tokens per model call | At most 1,500 (per individual model call: Classifier, Dialogue, Safety Guard and each repair call are separate calls, and the ceiling applies to each) | PRD §11.2, audit C-6 |
| Completion tokens per model call | At most 250 per individual call. Gemini Flash **thinking tokens are disabled** (thinking budget 0) on every agent call, because thinking tokens count as completion tokens and would breach the cap. The adapter sets this and records it with the model metadata | PRD §11.2, audit C-6 |
| Dialogue message | Under 100 tokens. One question or one imperative. No sentence over 25 words | PRD §9.4, §14.4 |
| Main-path steps, scaffold probes, reflection options | 2–4, at most 4, 3–4 | V1, V5, V9 |
| `Idempotency-Key` | UUID | PRD §15.9 |
| `step_expressions` | At most 1 element | [D-02] |
| `answer_text`, `step_expressions[0]` | At most 64 characters. Accepted [D-13] | |
| `note_text`, tutor note, teacher comment | At most 1,000 characters. Accepted [D-13] | |
| Request body | At most 8 KiB. Accepted [D-13] | |
| Unzipped API bundle | At most 250 MB (blocks CI). Phase A: measured with SymPy included. Phase B: without it | Decision #23 |
| SymPy-only MCP bundle (from Phase B, when `solvepath-mcp` is split out) | At most 90 MB | PRD §15.6 |

An oversize or over-length field returns 400 `invalid_request`. The payload limits (D-13) are accepted by the product owner on 2026-10-11.

### 5.3 Rate limits and caps

| Cap | Value | Behaviour |
| --- | --- | --- |
| Pipeline turns per question session | 12. A transfer session has its own 12. Turns that end `unverified` (SM-1 row 23) do not count | At the cap: `stuck`, `turn_cap_reached`, `turn_cap_notice` (SM-1 row 19) |
| Turns per student | 60 per hour and 15 per 5 minutes | 429 `rate_limited` with `retry_after_s`. Fixed-window counter in Postgres (`rate_counter`), because serverless instances share no memory |
| Counting rule | Each accepted, non-replayed `POST /events` counts [D-18] | An idempotent replay, a `GET` and a cron call do not count |
| LLM calls per turn | Dialogue at most 2 iterations, one repair per call, classifier at most 1 | No free-form retry |
| Idempotency record | 24 h | |
| Session inactivity | 30 minutes | `abandoned` |
| Service token | At most 60 s | |
| JWKS cache | At most 1 h | |
| Demo monthly spend | USD 20 ceiling for model-provider (LLM) usage only, alert at USD 16 (80%, Langfuse cost budget, from Tier 1b). Fixed plan fees are outside the ceiling. Decision #34, accepted by the product owner on 2026-10-11 | |

### 5.4 Concurrency and consistency

- Functions are stateless. Session state lives in Postgres and is read at the start of every request.
- Events with different keys on the same session are serialised by the **session lease** (D-14): TX-A takes it, TX-B releases it, and it lasts 12 s (`SESSION_LEASE_SECONDS`), which exceeds the 7.5 s hard stop plus the 200 ms persistence reserve and is far below the function `maxDuration` of 60 s. A live lease held by another key returns 409 `request_in_progress` with `retry_after_s=3`. If a function dies mid-turn, the lease expires at most 12 s after TX-A, so a blocked student waits at most that long.

**Client timing and retry policy (single standard).** The client sets a request timeout of **15 s** (up to 5 s API cold start at the p95 gate, plus the 7.5 s server hard stop, plus a 2.5 s network buffer). All client timers (the 1 s wait message, the 4 s reassurance and the 15 s timeout) start on the frontend **only once the request has been dispatched** (the connection is established and the request is sent), not at the button press. The client never retries before its timeout. On a timeout or a network error, or on HTTP 409 `request_in_progress` (a live 12 s lease), the client waits 3 s (`retry_after_s=3`) and retries **once** with the same `Idempotency-Key`. It never sends a different key for the same answer and never races the running turn. The retry has its own 15 s timeout. A retry returns the stored response (replay), resumes from the stored attempt, or, if the lease is somehow still live, a second 409. A different-key event can get 409 `request_in_progress` again on the single client retry. The client then shows the child-friendly "still working, please try again" message, and this is not a defect. A second failure shows the client-side deterministic fallback, ends the loading state and keeps the answer in the field. **Why this cannot race the lease.** TX-A, which takes the lease, runs at most about 5.3 s after dispatch (cold start). The lease therefore ends at most about 17.3 s after dispatch. A first-request timeout at 15 s plus the 3 s wait puts the retry at 18 s or later, after the lease has expired, so a crashed turn is resumed. A 409 on a healthy turn is retried at the 3 s mark, and the turn finishes by 7.5 s after TX-A, so a second 409 only occurs when the first request is still genuinely running.

The 8 s figure is not a client timer. The CI latency gate (tutor-turn p95 under 8 s) is a server-side measurement from request received to response sent. A second device editing the same turn at once is out of scope.
- The idempotency record and the stored response are written in the turn's persistence transaction (WF-03 step 11). A repeat with the same key is therefore either a replay, a resume or `request_in_progress`, and never a second attempt.
- Request handlers use the pooled Postgres connection string, with a small pool. Migrations use the unpooled string. Under row-level security (T1) identity is set per transaction with `SET LOCAL` so a pooled connection cannot leak it, and a pooled-connection leak test is required.
- Cron jobs are idempotent and batched. Two overlapping invocations on the same pending work produce the same result.
- Demo load: up to 10 concurrent synthetic students, and a cohort view over 150 synthetic students.
- A repeated identical expression on the same question version returns from the exact-key cache (Tier 1b).

### 5.5 Error handling, retry budgets and degradation

**One rule:** no dependency failure may produce a verdict, an answer leak or model text that the Safety Guard has not allowed. The student is never told they are wrong because a system failed.

**Retry budgets**

| Dependency | Budget |
| --- | --- |
| LLM output | One schema repair, inside the stage timeout. Then the fallback |
| Dialogue loop | One revision (two candidates) |
| MCP and A2A | One fallback per turn, only on timeout or connect failure. Verifier: a repeat MCP call (Vercel) or in-process `app.verifier.service` (container). Guard: in-process `app.safety.service`. An HTTP 4xx or 5xx is never retried. A second fallback in one turn goes to the deterministic fallback prompt |
| Client | Request timeout 15 s. One retry, 3 s after a timeout, a network error or a 409 `request_in_progress`, with the same idempotency key |
| Reads | May be retried. Student turn writes use the idempotency key |
| Cron | No in-job retry. The remainder resumes on the next invocation |

**Failure-state contract**

| Failure | Behaviour | Student sees | Recorded |
| --- | --- | --- | --- |
| Postgres unreachable before the attempt is stored | 503 `service_unavailable`, retryable. No pipeline, no counter change | `save_failed_notice`. The answer field keeps its text | Log, Langfuse error span (from Tier 1b) |
| Postgres fails after the pipeline, before the turn is stored | 503, retryable. A retry with the same key resumes from the stored attempt or reruns from scratch if none was stored | Same | Log |
| Sentry unavailable or a send fails | Event dropped. Turn proceeds. No retry on the request path | Nothing | None |
| Langfuse unavailable or flush fails | Turn proceeds. Flush waits at most 300 ms. `trace_status=missing` | Nothing | `trace_missing` counter. Replay shows "trace unavailable" |
| Provider timeout, 429, 5xx, or schema invalid after one repair | Deterministic fallback with `provider_error` or `schema_invalid`. Counts toward `fallback_rate`. No session flag | `fallback_l{level}` | Audit |
| Safety loop exhausted, or guard errors or is unreachable | Deterministic fallback with `loop_exhausted` or `guard_unreachable`, flag `safety_fallback` | `fallback_l{level}` | Audit, flag |
| Turn passes the 7.5 s hard stop | Deterministic fallback with `budget` | `fallback_l{level}` | Audit |
| MCP timeout or connect failure | One fallback per turn (repeat MCP call on Vercel, in-process on a container topology) | Nothing | Span `protocol: in_process_fallback` or `mcp_repeat` |
| Classifier timeout, provider error or invalid output | No misconception claim. The turn continues with `prompt_type=diagnostic_probe`. Not counted in `fallback_rate` | Nothing | Audit event with the cause |
| MCP returns an HTTP error | `cannot_verify`, `state=tool_failure`. No counter change. No retrieval | `tool_failure_notice` | Audit |
| Clerk JWKS unreachable | Cached keys up to 1 hour, else 503. Never fail open | Sign-in error | Audit |
| Blob unavailable or SVG missing | Render from the validated spec in process, else the probe text with no diagram and `diagram_unavailable`. Never an unvalidated image | The probe text | Audit |
| The exemplar read fails | Empty retrieval. The classifier records it used no exemplars and may return any code or `insufficient_evidence` (the forced `insufficient_evidence` applies only to `cannot_verify` with `state=ok`) | Nothing | Span |
| Cache read or write fails | Treated as a miss | Nothing | Span |
| Prompt-capture guard finds free text in a prompt | The turn fails before any model call [D-20] | `fallback_l{level}` | P0 audit `prompt_capture_violation`. CI blocks on the test |

**Failure ordering handled by the orchestrator** (PRD §9.7): provider quota or 429, tool timeout, schema invalid, retrieval empty, safety block, loop exhausted. Each writes an audit event. None becomes a free-form model retry.

**Degradation fallbacks:** the deterministic `fallback_l{level}` prompt (one question or one imperative, no mathematics, passes `age_appropriate`); the authored probe text when `DIALOGUE_MODE=template` (the shipped default and kill-switch); the single per-turn fallback for the verifier (repeat MCP call, or in-process on a container topology) and the guard (in-process); the in-process SVG renderer; a retrieval miss; a cache miss.

### 5.6 Exact-key cache (from Phase B / Tier 1b; Tier 1a: no cache)

| Kind | Key includes | Shared across students |
| --- | --- | --- |
| `verifier_result` | Normalised expression, `question_id`, `question_version`, tolerance rule | Yes |
| `exemplar_query` | Verifier error category, `skill_id`, taxonomy version, canonical numeric student value, `relation_tags` | Yes |
| `prompt_template` | Prompt id and Langfuse version label | Yes |

- The key is the SHA-256 of the canonical inputs. Lookup is exact. There is no fuzzy or nearest-neighbour matching.
- The verifier cache value is the pure result only. It never holds `progress`, hint level, retry counts, `response_target` or any session field. The response-target overlay is applied after the cache and is never cached.
- Student free text, names and transcripts are never keys or values.
- Every entry has a TTL (`expires_at`) so rule, taxonomy or prompt-version changes expire. The TTL values are open values. A hit or a miss always writes a trace span.

### 5.7 Security and privacy

| Requirement | Specification |
| --- | --- |
| Authentication | Every user authenticates through Clerk. Unauthenticated callers receive no student data |
| Authorisation | Role and cohort enforced in the FastAPI dependency layer (T1) and in Postgres RLS on every table that holds student-scoped rows (T1). The API role is a non-owner without `BYPASSRLS`, those tables use `FORCE ROW LEVEL SECURITY`, and the pre-`SET LOCAL` identity lookup uses a narrow `SECURITY DEFINER` function keyed by the Clerk `sub` (D-30). The minimal RLS covers every table that holds student-scoped rows. The Tier 1c teacher replay adds a teacher assigned-cohort read policy when it is built, and the full role-action matrix stays T3 (D-30). Least privilege. Hiding a control is not the control |
| Encryption | HTTPS everywhere. Encryption at rest through managed Postgres and Vercel Blob |
| Secrets | Only Vercel Environment Variables. None in the repository or the client bundle. `NEXT_PUBLIC_`-prefixed variables never hold a secret. `SENTRY_AUTH_TOKEN` is build-time only. Rotation every 90 days and after any suspected exposure |
| Data minimisation and synthetic data | No name or email in `app_user`. Public and preview environments hold synthetic students, names and attempts only |
| Free text | Scrubbed at ingress. In Release 1.0 it reaches no LLM prompt, no Langfuse span and no cache. A prompt-capture test proves it |
| Telemetry | Pseudonymous ids only. A masking function runs before any export |
| Error monitoring | Sentry events carry no student answer, step, free-text note, bearer token, Clerk id or `app_user.id`. Default PII collection, request bodies and local variables are off, and a `before_send` scrubber enforces it (§5.8) |
| Audit | Append-only. No free text, no full prompt, no raw model output |
| Service endpoints | MCP and A2A require a valid service token (§3.8), when present (Tier 1b) |
| Blob access | Controlled routes. No guessable public URLs for student-specific exports |
| Retention | §2.10 windows applied by `retention-purge` |
| Dependency and secret scanning | `pip-audit`, `npm audit` and `gitleaks` run on every pull request. A high-severity finding or a detected secret fails the build |
| Tutor safety policy | Respectful, non-shaming language. No comparison with other students. No claim about intelligence, future success or placement suitability. No unnecessary personal-information request |
| High-stakes boundary | §1.4 |
| Real-learner prerequisites | Out of scope (§1.4) |

### 5.8 Observability and traceability

- One Langfuse trace per tutor turn (from Tier 1b; `session_id` = session id, `user_id` = pseudonymous student id), with one span per agent step and tool call. The MCP call and the A2A call are separate child spans under the turn trace. W3C `traceparent` and `tracestate` propagate on every HTTP call to `solvepath-mcp` and `solvepath-safety`.
- Trace metadata: `question_id`, `question_version`, `hint_level`, `model`, `prompt_version`, `policy_version`, `environment`. Prompts are versioned as repo files at Tier 1a (`PROMPT_SOURCE=repo`) and in Langfuse from Tier 1b, where a pinned label is used per environment.
- Every turn stores provider (`LLM_PROVIDER`), model, model version, temperature, prompt version, hint-policy version, policy-config version, tool results, `trace_id`, `trace_status` and `fallback_reason`.
- **Sentry and Langfuse do not overlap.** Langfuse owns LLM generation spans, token and cost, model latency, prompt versions, evaluation scores, and the agent, verifier and safety spans. Sentry owns uncaught exceptions, unhandled 5xx crashes, failed browser network calls, Next.js error boundaries and operational health on web, API, MCP and Safety. A handled fallback (`provider_error`, `schema_invalid`, `guard_unreachable`, `tool_failure`, `loop_exhausted`) is not a Sentry event. Sentry performance tracing and Session Replay are off.
- **Sentry scrubbing.** Default PII collection off, no user context. Request bodies, query strings, cookies and the `Authorization` header removed. No local variables, no request or response bodies or input values in breadcrumbs. Exception messages replaced by the exception class and a stable error code. A deterministic `before_send` step enforces this on both SDKs.
- **Sentry correlation.** Events may carry only `request_id`, `trace_id`, `session_id`, `environment`, `release` and the service name. No `app_user.id`, Clerk id, role or cohort.
- From Tier 1b, the Langfuse client is flushed asynchronously in the background after the response, otherwise inline and capped at 300 ms with the turn deadline and revision gate at 7.2 s (§5.1). A change to a prompt or model runs the evaluation suite before deployment.
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
| `fallback_rate` | Deterministic, **model-level ratchet** | Target at most 5%, measured only on the live integration suite with warm instances, thinking tokens disabled and n ≥ 100 turns that reach an LLM stage. Reported until the first calibration run (n ≥ 100, reported with its value at Gate A), then a ratchet: the recorded value may be lowered and never raised without a PRD change. Classifier degradation is not a fallback |
| `attempt_before_solution`, `early_answer_rate`, `transfer_offered`, `in_process_fallback_rate` | Deterministic | Reported |
| `socratic_quality`, `tone_safety` | Model-based | Reported. Never blocks |
| `human_rubric_*` | Manual | Reported |

### 5.9 Quality gates and evaluation

| Check | Threshold | Blocks |
| --- | --- | --- |
| `answer_leakage` on the critical set (42 = 15 direct-answer + 15 injection + 12 unsafe-input cases, with at least 10 method-leak attacks counted within the 42. Adversarial paraphrases are additional) | 0 | Yes |
| `diagram_leakage` on generated SVG specifications (at Gate A, judged on the diagram specifications of the approved Tier 1a items: the DS-09 15-case set is Tier 2) | 0 | Yes |
| `schema_valid`, `single_prompt`, `age_appropriate` | 100% | Yes |
| `verifier_agreement` | At least 99% | Yes |
| `hint_policy_match` | At least 95% | Yes |
| Multi-turn trajectory leakage | 0 | Yes |
| Unauthorised access, and unauthenticated calls to MCP or A2A (`tests/authz`: at Gate A 9 application-layer + 3 RLS + 4 hardening = 16 cases, all blocking; the tenth application-layer case, the MCP/A2A 401 case, needs the deployed services and is a Gate B item [B]) | 0 successes | Yes |
| Unapproved question or diagram delivered; invalid diagram published; teacher override without audit row | 0 | Yes |
| Misconception prompt type vs confidence (`diagnostic_probe` for a deterministic match, confidence below 0.80 or `insufficient_evidence`) | 0 violations | Yes |
| Verifier p95 (first MCP call span, timeouts counted at the 400 ms cap) | Under 400 ms. Not run at Tier 1a (the verifier is in process, so there is no MCP call span), applies at Gate B | Yes (live, Gate B) |
| Tutor-turn p95 (request received to response sent, excluding the post-response flush) | Under 8 s | Yes (live) |
| `fallback_rate` (live, model-level ratchet, §5.9 semantics below) | Target at most 5% once calibrated. Until the first calibration run it is reported and does not block | Ratchet, then yes |
| API bundle, cold start | API at most 250 MB (checked on the CI build artefact), cold-start p95 at most 5 s (deployed: not run at Gate A, applies at Gate B) | Yes |
| MCP bundle, cold start (**from Phase B**) | MCP at most 90 MB, under 1.2 s. The dependency tree has no ADK, pandas, torch or transformers (lockfile check). No SymPy in the API tree from Phase B | Yes (from Phase B) |
| Content validation V1–V9, C1–C3, contract and OpenAPI drift, story sync, FSM table parity | Pass | Yes |
| C4 (every canned key `reviewed`) | Pass | Gate B tag only |
| Demo availability | At least 99% successful API requests | Reported |
| Parse-failure rate on synthetic-student set | Above 5% is reported as a UX defect | Reported |
| Misconception accuracy | Agreement with human review at 0.80 provisional, on 60 gold cases (T2). Reported as **unvalidated** if no educator labels at least 30 of them | Reported |
| Independent leak oracle (at least 20 held-out paraphrase leaks, periodic model and human audit) | Any miss is a P0 defect added to the normaliser corpus | Reported |

The critical set is the direct-answer, injection and unsafe-input cases. The launch suite has at least 150 unique labelled cases, one primary category each, with at least one case in every PRD §14.1 category. The Tier 1 gate has 42 critical cases (15 direct-answer + 15 injection + 12 unsafe-input, with at least 10 method-leak attacks counted within the 42, and adversarial paraphrases additional) plus the golden trajectory. The 150-case set, the independent leak oracle set (DS-06, at least 20 held-out paraphrase leaks) and the five student personas are Tier 2/3 assets. At Gate A, "suite complete" means the Tier 1a subset defined under "Tier 1a (Gate A) live evidence" below, not the full launch suite (D-33).

**Where gates run**

| Gate | Pull request (replay fixtures) | Nightly and before release (live provider) |
| --- | --- | --- |
| Deterministic stages: verifier, matcher, retrieval gate, hint policy, leakage and phrase checks, Input Screen, fallback, FSM | Blocks | Blocks |
| `answer_leakage`, `diagram_leakage`, trajectory leakage, `single_prompt` on fixtures | Blocks | Blocks |
| `schema_valid`, `hint_policy_match`, `age_appropriate` | Blocks (fixtures) | Blocks (live output) |
| `fallback_rate`, tutor-turn p95, verifier p95 | Not measured | `fallback_rate` is reported until the first calibration run (n ≥ 100), then blocks as a ratchet. Tutor-turn p95 and verifier p95 block |
| Authorisation, content validation, contract drift, story sync, bundle size (P1-15: bundle size, contract drift; P1-16: story sync, content validation, import boundary) | Blocks | Blocks |
| Cold start (deployed services) | Not measured | Blocks at Gate B (not run at Gate A) |
| Independent leak oracle, `socratic_quality`, `tone_safety` | Not run | Reported |

**Gate semantics: harness-level checks and model-level ratchets.** Two kinds of check share names in this section. They are not interchangeable.

| | Harness-level (H) | Model-level (M) ratchet |
| --- | --- | --- |
| Question answered | Does the harness enforce the rule when a model misbehaves? | Does the model, with the current prompts, behave well before the harness corrects it? |
| Input | Recorded fixtures, including poisoned (leaky, schema-invalid) fixtures, and deterministic stages run for real | The live provider against deployed services, warm instances, thinking tokens disabled |
| Measured on | **Delivered** turns, after the leak check, the guard, the final override and the fallback. For this reason `schema_valid`, `single_prompt`, `age_appropriate` and delivered `answer_leakage` are true by construction when the harness works, and a miss is a harness defect | **Pre-guard candidates and turn outcomes**: first-attempt schema validity (before repair), share of candidates blocked by `check_candidate`, share blocked by the guard, false-block rate on benign candidates, `fallback_rate`, p95 latency |
| Sample | The full case set. No sampling | At least 100 turns that reach an LLM stage per run. A run below 100 is "not evaluable": it is reported and neither passes nor fails a ratchet |
| Pass rule | Exact (0 leaks, 100%, parity) | Compared with the recorded ratchet value. The 95% Wilson interval of the observed rate decides: the lower bound above the ratchet is a regression and blocks, the point estimate at or below it passes, anything between reruns once on a fresh sample and then blocks on the rerun's result |
| Runs | Every pull request (replay) and nightly | Nightly, before release, and on a pull request labelled `eval:live` (required before merge when it changes a prompt, the hint policy or the model configuration). Each live run is capped at 250 turns, 500,000 tokens (provisional, see the token-ceiling rule below) and USD 0.80 (nightly: 250 turns, 500,000 tokens and USD 0.30), and aborts at the first ceiling (EVALS §5.7) |
| Owner of the baseline | Fixed by this section | First calibration run, recorded as a PRD change. A ratchet value may be lowered and never raised without a PRD change |

A live-run result never passes a harness gate and a replay result never passes a ratchet. Model-level ratchets are measured in the opt-in `DIALOGUE_MODE=llm` (the nightly live run, D-37), because `template` mode (the shipped default) has no model behaviour to measure. **Tier 1a (Gate A) evidence (D-37)** is produced in `DIALOGUE_MODE=template` with fixture-backed adapter replay and the in-process verifier and safety modules. **Gate A sample (D-33, D-37):** the 42 critical cases, the golden trajectory 1a variant and one pleading persona. The live subset of at least 100 LLM-stage turns (synthetic scripted student-answer variants over the approved items, the n of the first model-level measurement) belongs to the opt-in `llm` stretch and Gate B, where the local live run (EVALS §1.3, repo-local prompt source `PROMPT_SOURCE=repo`, D-31) executes it. The 150-case set, DS-06 and the five personas are Tier 2/3, and Gate A "suite complete" means this Tier 1a subset. The Langfuse dataset mirror is Tier 1b only (the repository files serve Tier 1a), and the eval harness and CI are task P1-15 (the FB and EC cases are costed in the 45 h content package, and the scripted-variant generator, about 10 h, belongs to the opt-in `llm` stretch), built inside the Tier 1a engineering budget (120 h). At Gate A the MCP first-call p95 (including the verifier p95 CI gate, which is in-process at Tier 1a), A2A, cache, Langfuse trace and score, cold-start p95 and deployed-smoke rows are `not-run` (they apply at Gate B), and the tutor-turn p95 is asserted in template mode (the hard stop binds) and measured on the live run of the opt-in `llm` mode and on the deployed services at Gate B. At Gate A the educator check, the child usability check and threat model v0 are Gate B items [B] (threat model v0 is due before Tier 1b starts, and Gate B verifies it exists, D-36), and `fallback_rate` is recorded `not-run` (a model-level ratchet, §5.9: template mode makes no model call). **Gate A metric scope (D-34).** At Tier 1a `verifier_agreement` and `hint_policy_match` are evaluated on the FB and EC case families (not the 150-case DS-01 set). The denominator is the evaluated cases in the Tier 1a subset, which closes the open denominator for Tier 1a. The tutor-turn p95 under 8 s gate is intentionally a hard-stop-honoured assertion (the 7.5 s hard stop is the binding bound), and the under 5 s p95 target is reported. The at least 100 LLM-stage turn requirement is waived at baseline because Cut 1a-3 is taken. Gate A is labelled pedagogy-unvalidated until the Gate B educator check. **Gate A acceptance:** the golden 1a trajectory passes in replay; the live subset of at least 100 LLM-stage turns is waived at baseline (Cut 1a-3 is taken); the `tests/authz` suite of 16 cases passes; `verifier_agreement` and `hint_policy_match` meet their thresholds on the Tier 1a subset; and leakage is 0 (`answer_leakage` and trajectory leakage). Cuts 1a-2 and 1a-3 are taken at baseline (D-37), and hour 138 is the Gate A deadline. Gate A evaluates strictly in `DIALOGUE_MODE=template`, and the live provider quality gates apply to the opt-in `llm` mode and Gate B / Tier 1b.

A change to a prompt, the hint policy or the model configuration also requires a successful live run before merge. It starts only when the pull request carries the `eval:live` label (never on every push) and is capped at 250 turns, 500,000 tokens and USD 0.80 per run (nightly: 250 turns, 500,000 tokens and USD 0.30), aborting at the first ceiling (EVALS §5.7). **Token-ceiling rule.** The 500,000 figure is provisional. P0-12 measures the mean tokens per turn on at least 20 turns with a throwaway synthetic three-call harness (Classifier-, Dialogue- and Guard-sized calls), and the real Tier 1a figure is re-confirmed at the first live run. The live-run token ceiling is always the measured mean x 250 turns, set by a PRD change. The provisional 500,000 corresponds to a measured mean of 2,000 tokens per turn (500,000 / 250). If the measured mean exceeds 2,000 the ceiling is raised by a PRD change. The golden trajectory `test_demo_trajectory.py` has a replay mode (blocking on every pull request, recorded schema-valid LLM fixtures, deterministic stages always real; the minimal recorder and replay job is P0-17 and the full harness is P1-15) and a live mode (nightly and before release), and it has two variants (D-33). The **1a variant (Gate A)** runs in process and is replayed in CI: PRD §19 step 5a has empty retrieval and a recorded classifier output that is null or `insufficient_evidence` (the REPLAY fixture expects no misconception claim and `prompt_type=diagnostic_probe`; in live mode the golden test asserts only that `prompt_type` obeys the confidence rule: `targeted_scaffold` only if classifier confidence >= 0.80 and the code is not `insufficient_evidence`), and there is no verifier cache-hit trace item. The **1b variant (Gate B)** adds exemplar retrieval, an exemplar-citing classifier result and the cache-hit trace item. Zero leaks is mandatory in both variants. In Slice 0 the local live smoke sets `DIALOGUE_MODE=llm` explicitly and makes one real Gemini Flash call through the provider adapter, CI runs the golden test in recorded-fixture replay mode, and the provider key is the only external dependency allowed [D-29]. Until the first live calibration run (n ≥ 100) the model-level ratchets are reported only, and the early educator check findings (about 10 turns) are applied to the `llm` paraphrase prompts and fallback probes before Gate B. Provider tiers: the primary provider must pass 100% of the Release 1.0 gates. An alternate provider must keep `answer_leakage = 0` and reach `schema_valid` of at least 95% with automatic fallback on any parse failure.

### 5.10 Availability, accessibility, deployment and operations

| Area | Requirement |
| --- | --- |
| Availability | At least 99% successful API requests on the demo (reported) |
| Backup and recovery | Neon point-in-time recovery. Demo targets RPO 24 h, RTO 4 h. Not a production claim |
| Accessibility | WCAG 2.1 AA target for the practice screen. Keyboard operation, labelled controls, sufficient contrast, text alternatives for diagrams, no colour-only meaning, accessible equation display, `aria-live="polite"` on the wait state. `axe` runs in CI. Charts have text alternatives |
| Devices | iPad Safari 16 and later, current Chrome and Edge, 768 px tablet viewport minimum. Phone layout best effort |
| Hosting | Phase A (Tier 1a): two Vercel projects (`solvepath-web`, `solvepath-api`). From Phase B (Tier 1b): four, adding `solvepath-mcp` and `solvepath-safety`. The web project rewrites `/api/:path*` to the API project (same origin, no CORS). The API stays container-portable. Each of the three Python projects has its **own root directory, dependency manifest and `vercel.json`** (`apps/api/deploy/api`, `apps/api/deploy/mcp`, `apps/api/deploy/safety`), selecting an extra (`optional-dependencies`: `api`, `mcp`, `safety`, `verifier`, `dev`) from the one source tree, so the dependency trees stay separate (PRD §15.4) |
| Environments | Development (local), Production (synthetic data only). Preview (own database and Langfuse credentials): Deferred to Tier 3 (inactive, unprovisioned in Tier 1) |
| Vercel plan | Pro, so hourly cron is available |
| CI/CD | GitHub Actions `ci.yml`, `eval.yml`, `deploy-prod.yml`, `content-validate.yml` (`deploy-preview.yml`: Deferred to Tier 3 (inactive, unprovisioned in Tier 1)). `deploy-prod.yml` is the authoritative deploy trigger from Tier 1b (P2-22; Tier 1a: manual first deploy); Vercel Git auto-deploy is disabled on every project; Actions is the required quality gate |
| Deployment limits | Cron frequency, function duration and bundle size depend on the Vercel plan and are to be confirmed against current documentation before schedules are finalised |
| Incident response | The runbook documents incident reporting, access revocation and data deletion |
| Configuration | `HINT_POLICY_VERSION`, `POLICY_CONFIG_VERSION`, `RETENTION_POLICY_VERSION`, `DIALOGUE_MODE` (default `template`; `llm` is the opt-in stretch mode) [D-37], `LLM_PROVIDER`, `MODEL_TUTOR`, `MODEL_CLASSIFIER`, `MODEL_SAFETY`, `MODEL_EMBEDDING`, `LLM_TIMEOUT_SECONDS`, `SESSION_LEASE_SECONDS` (12), `PROMPT_SOURCE` (`repo` at Tier 1a, `langfuse` from Tier 1b, D-31), `AUTH_AUTHORIZED_PARTIES`, optional `AUTH_AUDIENCE`, service-token and cron secrets, Clerk, Langfuse and Sentry settings (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`) |

---

## 6. Requirements Traceability Matrix

Every Functional Requirement ID in `PRD.md` §8 maps to the SPEC sections, entities, interfaces and workflows that implement it.

| FR ID | PRD title | Tier | Entities and data contracts (§2) | Interfaces (§3) | Workflows (§4) | Non-functional (§5) |
| --- | --- | --- | --- | --- | --- | --- |
| FR-01 | Authentication and role-based access | T1 slice, T2 reviewer and coordinator surfaces, RLS minimal T1, full matrix T3 | §2.1 `app_user`, `user_grant`, `cohort`, `cohort_assignment`, role-action matrix | §3.1 error codes, §3.4 OP-18 to OP-20 and role scoping of all OP rows, §3.8 | WF-01, WF-20 | §5.4 (RLS `SET LOCAL`), §5.7, §5.9 (`tests/authz`) |
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
| FR-12 | Teacher dashboard | T1c one draft, T2 | §2.6 `recommendation`, `review_flag`, `content_review_item`; SM-2 | §3.4 OP-01 to OP-04, OP-08 to OP-11, OP-14, OP-15, OP-23 | WF-16, WF-18, WF-20 (`allow_level_5`), WF-24 | §5.1 (under 3 s for 150 students) |
| FR-13 | Session replay | T1c minimal, T2, T3 retention | §2.6 `teacher_comment`, `tutor_note`; §2.3 `tutor_turn`, `student_note`; §2.10 retention | §3.4 OP-05 to OP-07, OP-12, OP-13, `Replay` | WF-17, WF-23 | §5.7 (retention), §5.8 (trace links) |
| FR-14 | Content quality and item assurance | T2 | §2.6 `content_review_item`; SM-3, SM-5; §2.2 `question_embedding` | §3.4 OP-16, OP-17, OP-22 | WF-19, WF-22 (`item-quality-scan`), WF-25 | §5.9 |
| FR-15 | Auditability | T1 slice, T3 viewer | §2.7 `audit_event` | §3.4 OP-21 | WF-21 and the audit side effects of every workflow | §5.7, §5.8 |
| FR-16 | Background processing | T1b `warmup`, T2 rollups, T3 purge | §2.7 `job_run`, `cache_entry`, `rate_counter`; SM-7 | §3.5 | WF-22, WF-23 | §5.3, §5.4, §5.5 |

