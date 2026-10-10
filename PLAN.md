# SolvePath delivery plan

**Status:** Phase 0 design is written. Application code has not started.
**Source of truth:** [PRD.md](PRD.md) draft v1.3.18. If this plan and the PRD disagree, the PRD wins. Task ids are defined in PRD section 6.8.
**Operating rules:** [AGENTS.md](AGENTS.md)
**Course scope:** FDE weeks 1, 2, 3, 4, and 6. Voice (week 5) and Demo Day (week 7) are out of this capstone.

This file is the build order. Requirements, schemas, and thresholds stay in the PRD.

---

## 1. Current state

| Item | State |
| --- | --- |
| PRD, agent contract, course review | Written |
| `apps/web`, `apps/api` | Not created |
| Question bank, taxonomy files, eval cases | Not created |
| Postgres, Blob, Langfuse, Vercel projects | Not provisioned |
| GitHub Actions | Not added |

Phase 0 exits when the skeleton runs, not when another document is added.

---

## 2. What "done" means

A public demo uses synthetic students only. The pipeline blocks on the numbers in PRD section 14.5:

| Check | Gate |
| --- | --- |
| Answer leakage on the critical set | 0 (canonical normaliser, stem givens exempt) |
| Diagram leakage on generated SVG specs | 0 (text labels and bar values mask intermediate/final answers below Level 5) |
| Schema validity | 100% (Gemini Flash primary provider) |
| Verifier agreement on supported types | at least 99% |
| Hint-policy match | at least 95% (schema-consistency + level invariant checks) |
| Verifier latency | p95 under 400 ms via MCP |
| Fallback rate | at most 5% of turns on the live-provider eval run (PRD 14.5) |
| Age-appropriate wording | 100% of delivered turns (sentence length, glossary and jargon terms) |
| Tutor-turn latency | p95 under 8 s (budget with overhead: 4.74 s happy path, 7.36 s retry path; typical warm ~2.6–3.0 s; p50 target under 3 s, reported) |

Model-based scores for tone and Socratic quality are reported. They do not block a merge.

### Explicit release cut line

- **Release 1.0a then 1.0 (Tier 1 Demo Gate — Strict MVP Capstone Target — Phases 0–2, 103–135 engineering hours plus about 32 h of content; Tier 1a in-process core 55–70 h passes by hour 70, Tier 1b protocols, retrieval, cache and tracing 40–55 h, Tier 1c minimal teacher replay and one draft 8–10 h, first to cut; PRD 18.1 and 21.1):** The single-turn tutoring vertical slice on ratio problems. Includes practice UI, SymPy verifier via MCP (with in-process cold-start fallback), shared normaliser (`normaliser.py`), 10 core seed items, deterministic misconception matcher (< 10 ms, confidence 0.90, collision-free), parallel student-state and misconception classifier, hint policy (0–5), Socratic dialogue agent, cheap deterministic leakage check first inside the loop, ratio-table diagram leakage check (bar model is Tier 2), authored `scaffold_probes` verified before the main path, signed service-to-service tokens for MCP and A2A, input PII scrubber (free text reaches no LLM), A2A safety guard, 42 critical gate eval cases, demo config `allow_level_5=true`, and Langfuse tracing with W3C `traceparent` propagation. Built with **Gemini Flash only**.
- **Release 1.1 (Tier 2 Educator Operations — Phase 3, ~55–70 engineering hours plus about 48 h of content):** Teacher cohort dashboard, full replay and comments, bar-model diagrams, draft interventions, teacher overrides, 40-item question bank, 60 human-reviewed gold calibration cases across 4 error clusters, background crons (`learner-rollup`, `insight-drafts`, `warmup`), and secondary provider adapter (OpenRouter/vLLM).
- **Release 1.2 (Tier 3 Governance & Showcase — Phases 4–5, ~30–40 hours):** Retention purge, 150-case eval benchmark, educator validation session (20–30 turns), threat model, and demo.

---

## 3. Course weeks mapped onto phases

| Course week | Built in | Proof |
| --- | --- | --- |
| 1. Harness and system design | Phases 0–1 | State machine, SymPy before any tutor sentence, timeouts, one trace per turn |
| 2. Subagents | Phase 2 | Isolated agent state, versioned hint policy and prompt packs, fallback after two safety blocks |
| 3. Retrieval, cache, graph, evals | Phases 2 and 4 | Retrieval only when the verifier is not correct; deterministic expression cache; Postgres skill graph; declared gates |
| 4. MCP, A2A, ADK | Phase 2 | MCP tools for SymPy and retrieval; A2A Safety Guard; separate spans with W3C traceparent |
| 6. Customer and measurement | Phases 0, 3, and 5 | Customer discovery interviews, brief, teacher override, handover, operational measures |

---

## 4. Phases

Durations are the PRD estimates. They assume one builder.

### Slice 0 — Walking skeleton (first, about 15–20 hours; PRD 18.4.1)

**Exit:** the PRD section 19 golden trajectory (`test_demo_trajectory.py`) passes locally with 0 leaks. The early educator check then runs on those turns, shown as authored probe text and as the model paraphrase (PRD 18.4.2).

- One local process: FastAPI, in-process SymPy verifier, in-process hint policy, one Gemini Flash call
- 3 seed items: `scale_0001` (the map-scale item), its transfer partner `scale_0003`, and `scale_0002`, plus a minimal practice page with a math keypad. Section 19 step 13 needs the legal transfer partner, and V8 needs every item to have one inside the bank
- Slice 0 handles only the events Section 19 uses: `submit`, `reflection_choice` and `transfer_decision`. The full state machine (`not_sure`, `show_solution`, `note`, the 409 rule) arrives in Sprint 1 (S1.4), which replaces the inline Slice 0 transitions while the golden test stays green
- No Clerk, MCP, A2A, Langfuse, pgvector, cache, or Vercel yet. Add each later and keep the golden test green.

### Phase 0 — Bootstrap (1 week)

**Exit:** customer discovery completed, CI on the empty skeleton, the deploy spike, provider spike and graph-and-retrieval decision recorded as ADRs (ADR-001 to ADR-004), and Slice 0 green. Infrastructure follows Slice 0.

- Customer discovery interviews: 2–3 conversations with upper-primary / selective-entry educators. Ask which assessment and year the programme targets (assumption A1)
- Deploy spike (at most 4 h): throwaway Vercel function with `google-adk`, SymPy, MCP and A2A SDKs. Record bundle size (budget 250 MB) and cold start, and confirm the MCP and A2A transports run statelessly on a serverless function. On failure, move to a container host before Tier 1b (PRD 18.4)
- Version-pin ADR: Gemini Flash model id, `MODEL_EMBEDDING` (768 dimensions), `google-adk`, A2A and MCP SDK versions (PRD 22.1 #28, #30)
- Low-fidelity wireframes for the practice screen and Tier 1c replay; item blueprint approved (`content/questions/blueprint.md`); threat model v0 before Tier 1b (TECH-55)
- Monorepo from PRD section 16.1, including `mcp_server.py` and `a2a_safety.py` entrypoints
- Lint, format, pre-commit, and `ci.yml`
- Provider spike (at most 4 h): Socratic schema on Gemini Flash and OpenRouter through ADK; pass is at least 9 of 10 schema-valid; otherwise the alternate uses adapter JSON mode with Pydantic validation (PRD 18.4)
- One-page customer brief (PRD section 15.8): synthetic Years 5–6 tutoring programme, and the decisions the system will not make
- **After Slice 0 is green, one at a time:** Neon Postgres with pgvector and the first Alembic migration (`app_user` with its role, cohorts and memberships, skills, questions, question versions, sessions, attempts, `tutor_turn`, `student_note`, `idempotency_key`, session flags, learner skill state, `rate_counter`, audit events). Exemplars, graph edges, cache and job runs follow with their features, Vercel Blob, Langfuse project, the four Vercel projects (`solvepath-web`, `solvepath-api`, `solvepath-mcp`, `solvepath-safety`), and environment variables from PRD section 16.2

Design work already in the PRD (personas, curriculum scope, hint ladder, metrics) is not redone here.

### Phase 1 — Tutor foundation (1–2 weeks)

**Exit:** a student can submit an answer or selected reasoning option on one approved ratio item, and SymPy returns a structured verdict with tests.

- JWT verification, Postgres role and cohort checks, audit middleware: the Tier 1 slices of ADM-01 and ADM-02 (TECH-02, TECH-03), and the `tests/authz` set (TECH-53)
- Deterministic Input PII Scrubber and the Input Screen with its lexicon and canned replies (TECH-42)
- Shared canonical normaliser (`apps/api/app/verifier/normaliser.py`) for word numerals, units, and ratio forms
- Question schema with `misconception_predictions`, structured steps, isomorphic examples, import path, and 10 core seed items that pass content validation V1–V9 (TECH-07, TECH-47)
- React practice screen with the keypad and the controls of PRD 8.3.1, resume and idempotency (TECH-08), on the contract of PRD 15.9 with generated OpenAPI and contract tests (TECH-56). The session state machine loaded from `transitions.yaml` and parity-checked against the PRD 8.5.1 table, with table-driven tests (TECH-52). Cohort create, enrol and starting set (TECH-48)
- SymPy ratio and proportion rules, called directly in tests now and through MCP in Phase 2
- Hint-policy engine as pure Python with table-driven tests (levels 0–5; advancing progress does not raise level; "I am not sure" excluded from level 5 minimum; `allow_level_5` default false)

### Phase 2 — Socratic intelligence (1–2 weeks)

**Exit:** one tutoring turn matches the PRD section 9.3 pipeline on the map problem, including a blocked leak and post-solution reflection.

- ADK `SequentialAgent` and safety `LoopAgent` (max 1 retry, 2 attempts total) (TECH-11)
- Gemini Flash integration via provider adapter, with provider and model stored on the turn (TECH-09; OpenRouter/vLLM deferred to Tier 2)
- MCP server: `verify_expression`, `get_question`, `search_exemplars` (with in-process fallback) and its own span (TECH-10)
- Signed service-to-service tokens for `solvepath-mcp` and `solvepath-safety`, one HMAC secret per target service, audience check, 60-second expiry, 401 plus an audit event on a missing, expired, wrong-audience or other-service token (TECH-50, PRD 9.9), with `tests/authz/test_service_tokens.py`
- Deterministic misconception matcher (< 10 ms, confidence 0.90, collision-free) on question predictions; skips LLM classifier when matched
- Retrieval gate and deterministic expression cache (pure evaluation cached; session progress dynamic) (TECH-12)
- Skill and misconception graph for transfer selection and next practice
- Deterministic `StudentStateEstimator` (TECH-38) and the misconception classifier, conditional when the gate opens (TECH-15)
- Post-solution reflection state (`state=reflection`) with the item's authored reflection prompt and structured options, and no model, verifier or retrieval (PRD 8.5.1, V9)
- `not_sure` and `show_solution` events that skip pipeline steps 2 to 5, and the deterministic Level 5 solution and withheld-example turns (PRD 9.3)
- The remaining rows of the failure table (PRD 11.6) that need MCP, A2A, Langfuse and the provider, with fault-injection tests
- 42 critical evaluation gate cases (the Tier 1 subset of TECH-27) passing with 0 leaks, plus golden demo trajectory test (`test_demo_trajectory.py`) and the pleader, advancing, persistent-misconception, Level 5 positive and Level 5 withheld personas (PRD 14.6)
- Socratic dialogue agent (< 100 tokens, 1 prompt)
- Cheap deterministic leakage check (values and per-item method patterns) executed **FIRST** inside the candidate loop; level-dependent checks (stem givens exempt)
- A2A Safety Guard (TECH-14; 1,200 ms stage timeout, 1.3 s hard cap; PRD §11.3). If it blocks twice or times out, deterministic fallback is what the student sees
- Learner-model deltas on the turn (TECH-16), Practice Planner (TECH-36), transfer item (TECH-13), session summary and stuck flag (TECH-44), loading state and 8 s client timeout (TECH-45), turn cap and Postgres rate limiter (TECH-54)
- Langfuse trace with separate MCP and A2A spans, provider, model, prompt version, and the section 14.5 scores (TECH-04, TECH-43)
- Deterministic ratio-table diagram renderer for the Level 3 representation, the diagram specs of the ten items, the diagram leakage guard, and the `GET /api/sessions/{id}/diagram` route (TECH-17, PRD FR-09, 15.9)
- CI gate wiring: every Tier 1 row of PRD 14.5 as a blocking check, `eval.yml` and `content-validate.yml` of PRD 17.1, and the replay-versus-live matrix, proved by a deliberately leaky fixture pull request that fails (TECH-40, the Tier 1 slice of ADM-08)

**Tier 1c (only after Gate B passes, PRD 18.2):** the deterministic placement, grading and admissions wording check with the on-demand pending draft for the golden session (TECH-35), and the read-only replay of one assigned session (TECH-49).

### Early educator check (after Slice 0 is green, before Gate B; PRD 18.4.2)

**Exit:** one practising educator has scored about 10 recorded synthetic turns, and the prompt set, fallback prompts, Input Screen replies, `age_appropriate` threshold and `DIALOGUE_MODE` are set from that feedback. About 1 hour of their time. It does not block starting Tier 1b, and Gate B needs it done or a signed ADR.

### Phase 3 — Teacher operations (1 week)

**Exit:** a teacher can replay the Phase 2 session and override a draft without deleting the original evidence.

- Student profile, cohort dashboard, session replay with trace links
- Intervention drafts and the review queue
- Cron jobs: `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync`, `eval-nightly`, each recorded in `job_run` (`warmup` already runs from Tier 1b; initial embeddings are written at content import, PRD 22.1 #29)

### Phase 4 — Governance (1 week)

**Exit:** the section 14.5 gates fail a deliberately leaky change in GitHub Actions.

- Authorisation tests, prompt-injection tests, answer-leakage tests
- Eval set grown to at least 150 labelled cases (ADM-10), mirrored to a Langfuse dataset
- 60-case human-reviewed gold benchmark for classifier confidence calibration
- Audit viewer, retention policy, and `retention-purge`
- Latency and cost visible per turn

### Phase 5 — Deploy and hand over (1 week)

**Exit:** the section 19 scenario runs on the synthetic production environment, and the handover pack exists.

- Production deploy of web, orchestrator, MCP, and safety (or container co-location ADR)
- Threat model, architecture diagram, evaluation report, runbook
- Educator review session: 20–30 synthetic student traces evaluated by a practicing mathematics tutor
- Customer case study using the section 15.8 measures
- Demo recording of the map scenario (6–8 minutes)

---

## 5. First working session and Sprint 1

Tasks are in order. Each has a timebox, its inputs, an output and an exit test. If a task passes 1.5 times its timebox, stop and re-plan it. Do not start the teacher dashboard.

### Prerequisites (before D1)

| # | Item | Owner | Needed by |
| --- | --- | --- | --- |
| P1 | `content/questions/blueprint.md` approved | Product owner | D6 |
| P2 | Gemini API key from Google AI Studio (free tier is allowed for synthetic data only) | Engineer | D3 |
| P3 | OpenRouter key | Engineer | D3 |
| P4 | A Vercel account for the spike (Pro is needed before the cron jobs of Tier 1b) | Engineer | D2 |
| P5 | Sign-off on PRD Decisions #31, #32 and #34, and assumptions A1 to A3 | Product owner | Sprint 1 |
| P6 | Neon, Clerk and Langfuse accounts, and the Clerk test users listed in `content/seed/users.json` | Engineer | Sprint 1 |
| P7 | Toolchain: `python3.12` (the default `python3` on this machine is 3.14, so always use `python3.12`), Node 20 or newer, `gitleaks` (`brew install gitleaks`) and `pip-audit` (`python3.12 -m pip install pip-audit` inside the venv) | Engineer | D1 |

### Phase 0 tasks

| Task | Timebox | Output | Exit test |
| --- | --- | --- | --- |
| **D1** Repo hygiene and skeleton (TECH-01) | 2 h | `.gitignore` fixed, monorepo from PRD 16.1, `ci.yml` with lint, `gitleaks`, `pip-audit`, `npm audit`, `scripts/sync_stories.py --check` (the script follows the contract in PRD 6.1, and D1 restores it first if the working tree lacks it) | CI is green on the empty skeleton, and a planted fake secret fails it. Plant a GitHub-token-shaped string (`ghp_` plus 36 alphanumerics), not the AWS example key, which gitleaks allow-lists |
| **D2** Vercel deploy spike | 4 h | ADR-001: bundle size against 250 MB, cold start, and whether MCP streamable-HTTP and A2A run statelessly | The ADR states pass or the container-host decision |
| **D3** Provider spike and version pins | 4 h | ADR-002 (structured-output route) and ADR-003 (model id, `MODEL_EMBEDDING`, `google-adk`, MCP and A2A SDK versions) | At least 9 of 10 canned prompts schema-valid on the alternate, or the fallback route is recorded |
| **D10** ADR-004: why the skill graph is Postgres tables and why exemplar retrieval keeps pgvector (REVIEW 6.2, PRD Decisions #5 and #33) | 1 h | `docs/adr/004-graph-and-retrieval.md` | The ADR states the reasons and the cost. It is off the Slice 0 path and must exist before Tier 1b |

### Slice 0 tasks (about 19 h, PRD 18.4.1)

| Task | Timebox | Output | Exit test |
| --- | --- | --- | --- |
| **D4** Normaliser and leakage checks | 4 h | `normaliser.py` (word numerals, units, the dot and `30,000` comma rule, the operator rules of PRD FR-04), the token-bounded, unit-aware value matcher, and the method-pattern regex pass of PRD 8.6, with a shared corpus | The corpus passes, including `7,5` giving `cannot_verify`, `30` not matching `300`, `450/5` read as division in a step field, and an operation word paired with two item quantities blocked below Level 4 |
| **D5** Hint-policy engine (TECH-06) | 2 h | Pure Python, table-driven, with `decide()` and `select_probe(probes, level, asked_ids)` (PRD FR-06 probe selection) | Tests cover the FR-04 table, Decisions #18, #19 and #45, and probe order, including the `fallback_l{level}` case when none is left |
| **D6** Three Slice 0 items (`scale_0001`, `scale_0003`, `scale_0002`) and the V1–V9 validator subset | 2 h | JSON items. `scale_0001` has the probes `one_cm_probe`, `two_cm_probe` and `seven_half_probe`. Every item has predictions, patterns and a `reflection` block. Transfer partners are `scale_0001`↔`scale_0003` and `scale_0002`↔`scale_0003`, and the blueprint must carry both pairs | The validator passes all three, including V8 inside this three-item bank |
| **D7** In-process verifier (TECH-05, TECH-51) | 4 h | `PureVerifierResult`, the expression rule and the response-target overlay | The expression and overlay criteria of STU-11 pass as unit tests, including `7.5 × 4` giving `partially_correct` |
| **D8** Slice 0 endpoint and page | 5 h | `POST /api/sessions` and `POST /api/sessions/{id}/events` from PRD 15.9 returning the `SessionView`, `QuestionView` and `TutorTurn` shapes and handling the `submit`, `reflection_choice` and `transfer_decision` events, a keypad page with the controls by state, and `canned_responses.json` with all 28 keys as `draft` placeholder sentences that pass C2 and C3 (Section 8.3.2), so C1 holds from D8 on | A manual run of `11.5 km` returns a Level 1 probe |
| **D9** Golden trajectory (replay) | 2 h | `test_demo_trajectory.py` with recorded fixtures, using the control events of PRD section 19 | Steps 1 to 13 pass with 0 leaks, and the early educator check can then start (PRD 18.4.2) |

### How D1 to D10 depend on each other

The table order is the default. The **Needs** column is the rule, and a task may start once its needs are met. D2, D3 and D10 do not gate D4 to D9, so they can be interleaved with them.

| Task | Needs | Feeds | Where it sits in the architecture (PRD 9.3) |
| --- | --- | --- | --- |
| D1 | P7 | Every later task, because CI, `.gitignore` and `sync_stories.py` guard every commit | Repository and CI |
| D2 | D1, P4 | The Tier 1b hosting decision (Vercel or a container host) | Deployment topology (PRD 15.4) |
| D3 | D1, P2, P3 | D8 (the model call and structured-output route), the Phase 2 provider adapter | Provider adapter (PRD 9.6) |
| D4 | D1 | D6 (V2 and V4 use the matcher), D7 (the verifier parses with the normaliser), D9 (the leakage check) | Shared normaliser, used by step 2 and the step 7 checks |
| D5 | D1 | D8 and D9 | Step 6, `HintPolicyEngine` |
| D6 | D4, P1 | D7 (fixtures), D8 (questions served), D9 | Question data and content validation (PRD 10.3, 10.3.1) |
| D7 | D4, D6 | D8 | Step 2, `MathVerifierAgent` and the overlay |
| D8 | D3, D5, D6, D7 | D9 | Orchestrator, the contract subset (PRD 15.9) and the practice page |
| D9 | D4 to D8 | The early educator check and Sprint 1 | Golden trajectory (PRD 14.6, 19) |
| D10 | D1 | Tier 1b | Architecture decision record |

### Which task creates which test

Paths are under `apps/api/`. Every test named in REVIEW §10 has an owner here, and a task is not done until its tests exist and pass.

| Test | Created by |
| --- | --- |
| `tests/verifier/test_normaliser.py`, `tests/leakage/test_matcher.py`, `tests/leakage/test_method_patterns.py` | D4 |
| `tests/policy/test_hint_policy.py` | D5 |
| `tests/content/test_item_rules.py` (V1–V9), `tests/content/test_reflection.py` | D6, extended in S1.6a |
| `tests/verifier/test_pure_status.py`, `test_expressions.py`, `test_overlay.py` | D7 |
| `tests/test_demo_trajectory.py` | D9 |
| `tests/authz/test_unknown_subject.py`, `tests/seed/test_seed_synthetic.py`, and the Postgres and JWKS rows of `tests/failure/test_failure_table.py` | S1.2 |
| `tests/authz/` (the 9 cases) | S1.3 |
| `tests/fsm/test_table.py` | S1.4 |
| `tests/contract/test_session_view.py`, `tests/contract/test_idempotency.py`, `tests/contract/test_openapi_drift.py`, `tests/db/test_records.py` | S1.5 |
| `tests/content/test_registry.py` (C1–C3 and the `release` marker for C4) | S1.6b |
| `tests/safety/test_input_screen.py`, `tests/safety/test_prompt_capture.py` | S1.8 |
| `tests/pipeline/test_gate.py`, `test_answerless_events.py`, `test_authored_turns.py`, and the remaining rows of `tests/failure/test_failure_table.py` | Phase 2 |
| `tests/authz/test_service_tokens.py` | Phase 2, service tokens (TECH-50) |
| `tests/diagram/test_render.py`, `tests/diagram/test_leakage.py` | Phase 2, diagram renderer (TECH-17) |
| A deliberately leaky fixture pull request that must fail `eval.yml` | Phase 2, CI gate wiring (TECH-40) |

### Sprint 1 (Phase 1, after Slice 0 is green; about 30 h)

| Task | Timebox | Tasks / stories | Done when |
| --- | --- | --- | --- |
| **S1.1** Neon and migration 1 | 3 h | TECH-02 | `alembic upgrade head` creates the tables listed in Phase 0 including `app_user` (unique `clerk_user_id`), and the audit table rejects UPDATE and DELETE |
| **S1.2** Clerk JWT, `app_user` mapping, role and cohort dependencies, audit writer, `scripts/seed_synthetic.py` | 5 h | TECH-02, TECH-03; ADM-06 | Role comes from Postgres, an unknown subject gets 403 and creates no row, the seed script is idempotent and creates the bootstrap administrator once, the JWKS rule of PRD 11.6 holds, and a failed sign-in writes an audit event |
| **S1.3** Tier 1 authorisation tests | 3 h | TECH-53 | The 9 cases of PRD 14.5 pass in CI |
| **S1.4** State machine from the table | 4 h | TECH-52; STU-12, STU-18, STU-01 | Every row of PRD 8.5.1 (rows 1–22) has a test, an unlisted pair returns 409, `transitions.yaml` matches the PRD table (parity test), and a test proves every event in the controls-by-state table has a row |
| **S1.5** Contract models, OpenAPI, idempotency | 4 h | TECH-56; STU-12 | `SessionState`, `TutorTurn`, `QuestionView`, `SessionView`, the diagram route and `tutor_turn`, `student_note`, `idempotency_key` (PRD 10.7) exist. Replay, conflict and in-progress cases pass, and `tests/contract` fails the build on drift |
| **S1.6** Import and validation for the ten items | 4 h | TECH-07; ADM-04, ADM-12 | V1–V9 run on every item, the offline collision checks pass, and C1–C3 pass on the D8 `draft` registry. Split for early start: S1.6a is V1–V9 and needs nothing else, S1.6b is C1–C3 and the import path |
| **S1.7** Session and attempt persistence and resume | 4 h | TECH-08; STU-01, STU-12 | A resumed session shows the same question, level and attempt count |
| **S1.8** PII scrubber, Input Screen and the final registry wording | 3 h | TECH-42; STU-10 | Every unsafe-input fixture gets its reply, event and flag, the 28 `draft` placeholders are replaced with final wording that still passes C1–C3, and the prompt-capture test passes. Entries become `reviewed` after the early educator check, and C4 is checked at the Gate B tag, not here |

After Sprint 1 follow Phase 2 (PRD 18.4). Add Postgres-backed work only after Slice 0 stays green.

---

## 6. Out of this plan

- Voice tutoring
- A second search-style product, video retrieval, or a separate graph database
- Grading, placement, admissions, exclusion, or parent messages
- Parent accounts, native mobile apps, and a full LMS integration
- Handwritten-work recognition and unreviewed generated questions
- Caching student free text

Parent, content-reviewer, and coordinator consoles wait until the student turn and the teacher replay exist.

---

## 7. Launch checklist
The full list is PRD section 21.

### Tier 1 Demo Gate (Release 1.0 — Strict MVP Cut Line):
Mirrors PRD section 21.1. If the two differ, the PRD wins.
- At least 10 approved core ratio questions (full step trees, collision-free misconception predictions, isomorphic examples, SVG specs)
- 42 critical gate cases (15 direct-answer, 15 injection, 12 unsafe input) at 0 leaks, plus `test_demo_trajectory.py` green
- SymPy verifier via MCP under 400 ms, with in-process fallback
- Probe answers verified: the response-target overlay checks the student's answer to each tutor probe against its authored expected value, and an expression such as `7.5 × 4` is `partially_correct`, never `correct`
- MCP and A2A reject unauthenticated calls with 401; free text reaches no LLM prompt or Langfuse span
- Minimal teacher replay and one draft recommendation show the golden session (Tier 1c, cut first)
- Child usability check done, or recorded as not done in an ADR signed by the product owner
- Input Screen answers every unsafe-input fixture; "Show me the solution" is the only Level 5 request
- Session state machine table-tested; content validation V1–V9 passes; `tests/authz` passes; threat model v0 exists
- Early educator check done and applied, or a signed ADR that it was not
- Hint levels 0–5 enforced on the server; advancing progress does not raise level; "I am not sure" excluded from Level 5 minimum
- Leakage and ratio-table diagram leakage suites at 0 on the critical set (stem givens exempt)
- Correct and advancing (`partially_correct`) attempts skip exemplar retrieval; `incorrect` attempts open the gate and cite exemplar ids
- Every key in `canned_responses.json` is `reviewed` (C4), checked at the Gate B tag with `pytest -m release`
- A repeated expression on the same question version is a cache hit on the trace
- Input PII scrubber at ingress; student session data persisted in Postgres
- One Langfuse trace per turn with separate MCP and A2A spans and W3C `traceparent`
- Gemini Flash passes all section 14.5 gates; the provider adapter is in place for a second provider (run in Tier 2)
- Demo configuration sets `allow_level_5 = true`
- Synthetic data only; secrets only in Vercel environment variables

### Tier 2 Full Platform Launch:
- 40 approved ratio questions across full curriculum breadth
- 10+ granular misconception taxonomy labels
- 150-case evaluation suite in CI
- 60 human-reviewed gold calibration cases across 4 error clusters
- Gemini and one alternate provider (OpenRouter or vLLM) have both run the same schemas
- Teacher dashboard, replay view, and teacher override UI
- Nightly and hourly cron jobs running idempotently
- External educator validation of 20–30 recorded session turns completed
