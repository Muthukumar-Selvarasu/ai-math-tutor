# SolvePath — Build Log (BUILD_LOG.md)

Sources: `PRD.md` §18 (roadmap, tiers, phases, Slice 0, starter backlog), §21 (gates); `SPEC.md`; `DESIGN.md`; `TECHNICAL.md` §1; `AGENTS.md`; `THRESHOLDS.md`; `EVALS.md`.

Conventions: This file records progress only. It adds no milestone, task, threshold or decision that the upstream files do not state. Every roadmap row cites its PRD source. A change to scope, a threshold or a design rule goes to §4 (ADR) and is made in the upstream file by its owner, never here. Status values: `Pending`, `In Progress`, `Blocked`, `Done`. Log actual hours at the end of every working session against the Tier 1a, 1b and 1c budgets (PRD §18.2).

---

## 1. Project Metadata & Build Baseline

### 1.1 Project

| Item | Value |
| --- | --- |
| Project name | SolvePath (AI Math Tutor) |
| Target branch | `main` |
| Log created | 2026-10-11 |
| Delivery model | 1 Forward Deployed Engineer, 25–30 h/week, 6–8 weeks. **The single-engineer envelope is locked at 240 h maximum (ADR-015).** The Tier 1a commitment (165 h, 190 h buffered; 185–195 h, 213–224 h buffered, with Phase 0) fits the 6–8 week calendar unbuffered at 25–30 h/week (about 6.2–7.8 weeks) and needs up to about 9 weeks buffered at 25 h/week (PRD §18.2) |
| Release tiers | Tier 1 = Release 1.0 (Phases 0–2, gates 1a / 1b / 1c; planning sum 216–250 h: Tier 1a 120 h, Tier 1b 80–110 h, Tier 1c 16–20 h, excluding the opt-in `llm` stretch of about 23–30 h). Tier 2 = Release 1.1 (Phase 3, ~55–70 h). Tier 3 = Release 1.2 (Phases 4–5, ~30–40 h) (PRD §18.1) |
| Commitment | The sole binding commitment is Tier 1a, locked by ADR-015 at **120 h engineering + 45 h content package = 165 h (190 h with the 15% buffer)**, inside the **240 h single-engineer envelope**. Phase 0 non-Slice-0 work (about 20–30 h) is its own ledger line: with it the total is 185–195 h (213–224 h buffered), still at most 240 h, about 7.4–7.8 weeks (8.5–9.0 buffered) at 25 h/week. Tier 1a ships `DIALOGUE_MODE=template`: Cuts 1a-2 and 1a-3 are taken at baseline, so the runtime Dialogue Agent (P2-07) and the advisory Classifier (P2-10) are outside the commitment. `llm` mode is an opt-in evaluation and stretch target (about 23–30 h), made the default only by a PRD change after the early educator check (P0-18) and a Gate B live calibration run (n ≥ 100). Tiers 1b, 1c, 2 and 3 are stretch milestones, built only if hours remain below the 240 h limit. The 234–310 h and 319–420 h sums of earlier versions are superseded. Gate A is binding, Gates B and C are stretch (PRD §18.2) |
| Checkpoints | Tier 1a is judged at Gate A (P2-15), which must pass by engineering hour 138 (the 120 h budget plus the 15% buffer; 138 h + 45 h content + 30 h Phase 0 = 213 h, inside 240 h). Interim triggers (engineering hours, content and Phase 0 excluded): at hour 70, if P1-01a and P2-06 are not both Done, apply Cut 1a-1. At hour 100, if P2-08 and P1-17 are not both Done, apply Cut 1a-1 if not already taken and start no task outside the Gate A dependency set. Cuts 1a-2 and 1a-3 are baseline (ADR-015), not contingency cuts. Tier 1b starts only after Gate A and only if hours remain below the 240 h limit, with a re-estimate from actual Tier 1a hours. At a Tier 1a miss only Cut 1a-1 applies and all Tier 1b and Tier 1c scope is dropped. T1b-1, T1b-2 and T1b-4 apply only while Tier 1b is in progress (T1b-0 and T1b-3 are retired names, ADR-014). Tier 1c does not start unless Gate B has hours to spare. The late-cut-1 to late-cut-4 list applies to later stages. The cut lists are in PRD §18.2 and are applied without re-debate |
| Never cut | Leakage gates, the verifier, service-to-service authentication when present (Tier 1b), the early educator check and the child usability check (PRD §18.2). The educator check (P0-18) and the child check: findings applied before Gate B. Threat model v0 (P0-16): due before Tier 1b starts, and Gate B verifies it exists |

### 1.2 Primary runtime and stack summary (TECHNICAL §1; versions marked TBD stay TBD until the Phase 0 ADR)

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, FastAPI (async), Pydantic v2, SQLAlchemy 2, Alembic |
| Agents | Google ADK (`SequentialAgent`, `LoopAgent`, `LlmAgent`, `BaseAgent`). Deterministic hub-and-spoke harness (AGENTS §1.1) |
| Protocols | MCP (streamable HTTP, stateless) `solvepath-mcp`. A2A Safety Guard `solvepath-safety` |
| Mathematics | SymPy, mpmath |
| Frontend | TypeScript, Next.js 14.x (App Router, pinned with React 18, ADR-015), TanStack Query, Tailwind CSS, KaTeX |
| Data | PostgreSQL on Neon with pgvector from Tier 1b (`vector(768)`, used only for the transfer tie-break and the near-duplicate scan; exemplar retrieval is an exact SQL filter), Vercel Blob |
| LLM | Provider adapter. Gemini Flash default (`LLM_PROVIDER`). OpenRouter / vLLM alternates (Tier 2) |
| Identity, observability and error monitoring | Clerk. Langfuse Cloud (OTLP, OpenInference; LLM and agent telemetry only). Sentry (errors and crashes only) |
| Hosting and CI | Vercel, two projects in Phase A / Tier 1a (web, api), four from Tier 1b (`solvepath-web`, `solvepath-api`, `solvepath-mcp`, `solvepath-safety`). GitHub Actions required gate. Vercel Cron for `/api/jobs/*` |
| Pins still TBD | Exact `google-adk`, MCP SDK, A2A SDK, Gemini Flash model id, `MODEL_EMBEDDING`, FastAPI, Alembic, SymPy, frontend library versions (Version pin ADR, Decision #30) |

### 1.3 Initial repository state (as of 2026-10-11)

| Item | State |
| --- | --- |
| Branch | `main` |
| Contents | Documentation only: `PRD.md`, `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `idea/`, `docs/`, `.claude/`. No application source, no monorepo, no `ci.yml`, no tests |
| Working tree | All nine baseline files (`PRD.md`, `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md`) are modified and uncommitted. Left uncommitted for manual review. The §1.5 sign-off hashes record the baseline before the ADR-001 to ADR-014 edits (PRD is v1.3.27 after ADR-014) |
| Planned artefacts (not yet in the repository) | `user-story.md`, `scripts/` (including `scripts/sync_stories.py`), `content/` and `content/questions/blueprint.md` are planned artefacts. `user-story.md` and `scripts/` (the directory) are created by P0-08 (monorepo), `content/` and `content/questions/blueprint.md` by P0-11 (blueprint), and `scripts/sync_stories.py` by P1-16 (CI, security and content checks) |

### 1.4 Environment setup status

| Item | Status | Source |
| --- | --- | --- |
| Monorepo skeleton (`apps/web`, `apps/api`, linting, formatting, pre-commit) | Pending | PRD §18.4 Phase 0, §16.1 |
| GitHub repository and `ci.yml` on an empty skeleton | Pending | PRD §18.4 Phase 0, §18.5 #1 |
| Deploy spike, provider spike | Pending | PRD §18.4 Phase 0 |
| Postgres (Tier 1a), Vercel Blob, Langfuse | Pending. Deferred until Slice 0 is green | PRD §18.4 |
| pgvector and four Vercel projects (two in Phase A, four from Tier 1b) | Pending. Tier 1b | PRD §18.4 Phase 0 "Deferred" |
| Secrets and environment variables | Pending. Not created | TECHNICAL §1.2 |
| Vercel deployment | Deferred by the owner: development is local first, and the owner deploys to Vercel when everything is ready. The P0-13 deploy spike runs at that first deployment, before Tier 1b (Phase B) starts. Preview and `deploy-preview.yml`: Deferred to Tier 3 (inactive, unprovisioned in Tier 1). No ephemeral preview database branch exists. Tier 1 environments are local Development and Production only | Owner decision 2026-10-11 |

### 1.5 Documentation sign-off status

All eight baseline documents in the table below are recorded as complete and signed off, on the owner's instruction when this log was created (2026-10-11). The upstream files themselves hold no sign-off record. Items they mark as pending owner decision or `TBD` remain open and are not closed by this log (see §1.6). `BUILD_LOG.md` is the ninth file and is not in the table.

| Document | Phase | Commit | Status |
| --- | --- | --- | --- |
| `PRD.md` | 1 | `07123db` | Signed off |
| `SPEC.md` | 2.1 | `13589d5` | Signed off |
| `DESIGN.md` | 2.2 | `175c697` | Signed off |
| `TECHNICAL.md` | 2.3 | `4363052` | Signed off |
| `AGENTS.md`, `CONTEXT.md` | 3 | `31a4b18` | Signed off |
| `THRESHOLDS.md`, `EVALS.md` | 4 | `013afbb` | Signed off |

The commit hashes above record the baseline as signed off, before the ADR-001 to ADR-014 edits. All nine files are now modified and uncommitted (see §1.3).

### 1.6 Open upstream items carried into the build (not decided here)

| Item | Owner or source |
| --- | --- |
| Exact version pins and model ids | Phase 0 Version pin ADR (Decision #30) |
| Structured-output route per provider (ADK `output_schema` or adapter JSON mode) | Phase 0 provider spike (Decision #27) |
| Operational defaults (Decision #34) and payload limits (D-13): **closed**, accepted 2026-10-11 (monthly USD 20 for model-provider usage only, alert USD 16) | PRD §11.5, §22 |
| `ProblemParser` mode, `TeacherInsightAgent` model variable and timeout, token-budget split, cache TTLs, exemplar top-k, `tone` value set | AGENTS §5.10, policy configuration |
| Further open items | `THRESHOLDS.md` (`Not specified` rows), `EVALS.md` §5.5 |

---

## 2. Implementation Roadmap & Task Ledger

### 2.1 Phase structure and mapping to build-focus labels

The PRD phases and tiers are the authoritative structure. The four build-focus labels group them and add no phase.

| Build-focus label | PRD phases / tiers it groups | Gate |
| --- | --- | --- |
| Core Infrastructure | Phase 0 (incl. Slice 0), Phase 1 | Slice 0 exit test. Tier 1a (Gate A, engineering hour 138) |
| Models / APIs | Phase 2 (provider adapter P2-02: Gate A. MCP, exact SQL retrieval, cache, Vercel projects P2-16, P2-18, P2-20, P1-11: Gate B). Tier 1c teacher view (Gate C). Phase 3 (teacher APIs and cron jobs) | Gate A (P2-02). Gate B (P2-16, P2-18, P2-20, P1-11). Gate C (Tier 1c). Phase 3 is Tier 2: Release 1.1 criteria (PRD §21.2), not Gate B |
| Agent Integration | Phase 2 (ADK pipeline, schemas, matcher, retrieval gate, hint policy, Dialogue Agent, leak check, in-process safety module, classifier, graph and learner model: P2-01, P2-03 to P2-12. A2A Safety Guard service and Langfuse propagation: P2-17, P2-19) | Gate A (P2-01, P2-03 to P2-12). Gate B (P2-17, P2-19) |
| Evals & Hardening | Phase 2 trajectory evals. Phase 4. Phase 5 | Gate A (P2-13, P2-14), Gate B (P2-22), Gate C (PRD §21.1). Phases 4 and 5 are Tier 3: release criteria (PRD §21.2) |

Ordering rules from the PRD: Slice 0 gates all other work. Each later addition is added one at a time and keeps `test_demo_trajectory.py` green. The early educator check (P0-18) and child usability check run after Slice 0 is green, and their findings are applied before Gate B. Tier 1c starts only after Gate B passes and does not start unless Gate B has hours to spare (ADR-014). Threat model v0 (P0-16) is due before Tier 1b starts, and Gate B verifies it exists.

### 2.2 Task ledger

Task ID format: `P{phase}-NN`. Existing PRD identifiers (`TECH-xx`) are cited where the PRD gives one. "Group" is the build-focus label from §2.1.

Phases 0–2 carry no separate week estimates: the earlier per-phase week figures were stale and are removed. The Tier 1a commitment (Phase 0, Phase 1, the Tier 1a part of Phase 2 and the content package) is 165 h (190 h buffered), or 185–195 h (213–224 h buffered) with Phase 0, about 7.4–7.8 weeks (8.5–9.0 buffered) at 25 h/week, inside the 240 h envelope (§1.1, §2.3, ADR-015).

#### Phase 0 — Discovery, design and project bootstrap — Group: Core Infrastructure

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P0-01 | Customer discovery interviews (2–3) and customer problem statement | — | Pending | PRD §18.4 |
| P0-02 | Personas, current/future-state workflow, curriculum map, selective-entry framing | P0-01 | Pending | PRD §18.4 |
| P0-03 | Skill graph for ratio and proportion | — | Pending | PRD §18.4 |
| P0-04 | Misconception taxonomy (12 codes in 4 calibration clusters) | — | Pending | PRD §18.4 |
| P0-05 | Hint-policy definition (Levels 0–5) | — | Pending | PRD §18.4 |
| P0-06 | Data and privacy assessment (incl. Input PII scrubber specification) | — | Pending | PRD §18.4 |
| P0-07 | MVP success metrics; one-page customer brief | P0-01 | Pending | PRD §18.4, §15.8 |
| P0-08 | Monorepo with `apps/web`, `apps/api`, linting, formatting, pre-commit hooks | — | Pending | PRD §18.4, §16.1. Creates `user-story.md` and the `scripts/` directory (§1.3). **Pins Next.js 14.x with React 18 (ADR-015, TECHNICAL §1.1)** with the exact patch recorded in the P0-14 ADR. **Fail-fast check (first working session):** run `npm audit` and confirm `@clerk/nextjs` and `@sentry/nextjs` peer ranges on the skeleton. Next.js 14 passed end of life on 2025-10-26 and the App Router advisory CVE-2026-23864 is reported unpatched for 14.x, so a high-severity finding is expected. If `npm audit` reports a high-severity finding with no 14.x fix, the P1-16 gate cannot pass: record an ADR and move the web app to the supported Next.js line (with the React version it requires) before P1-07 starts. The `npm audit` gate is never weakened |
| P0-09 | GitHub Actions `ci.yml` on an empty working skeleton (lint + placeholder leakage test) | P0-08 | Pending | PRD §18.4, §18.5 #1 |
| P0-10 | Low-fidelity wireframes: student practice screen and Tier 1c replay | — | Pending | Before UI work begins (PRD §18.4) |
| P0-11 | Item blueprint `content/questions/blueprint.md` | P0-03, P0-04 | Pending | Agreed before any seed item is authored (PRD §18.4, §18.3). Creates `content/` and `blueprint.md` (§1.3) |
| P0-12 | Provider spike (about 6 h cap, week 1, includes the synthetic three-call harness) + ADR | — | Pending | Pass: ≥ 9 of 10 canned prompts schema-valid on the alternate (PRD §18.4). The alternate-provider check needs an OpenRouter key. Slice 0 itself needs only the Gemini key. **Phase 0 exit rule:** also record mean tokens per turn on ≥ 20 turns, measured with a throwaway synthetic three-call harness (Classifier-, Dialogue- and Guard-sized calls with representative prompts), because P2-09 and P2-10 are built after Slice 0. The real Tier 1a figure is re-confirmed at the first live run. Ceiling rule: 1.2 x the measured mean x 250 turns, set by a PRD change. The provisional 500,000 tokens corresponds to a mean of 1,667 per turn. If the measured mean exceeds 1,667, the ceiling is raised by a PRD change. No Tier 1a work beyond Slice 0 starts until the figure is recorded. **Tier 1a note:** the OpenRouter alternate-provider check is NOT on the Slice 0 path: Slice 0 depends only on P0-12's Gemini and token-harness portion. A measured mean above 1,667 raises the ceiling by a PRD change (for example 1,700 gives 510,000) |
| P0-13 | Deploy spike (≤ 4 h) + ADR | P0-08, P0-14 | Pending | Deferred until the first Vercel deployment, before Tier 1b (no Tier 1a task depends on it). Deploys three separate deploy roots (API without SymPy, MCP with SymPy, Safety) and records bundle sizes (250 MB / 90 MB), cold starts, MCP round trips against the 400 ms cap, post-response background work for the Langfuse flush, shared-source access from the deploy roots, and Gemini thinking disabled (PRD §18.4). Fail moves orchestrator, MCP and safety to a container host and amends PRD §15.4 before Tier 1b. Re-checks the P0-14 pins on Vercel. **P0-13 empirical watch-items (formal, each unproven until recorded in the ADR):** (1) API bundle, unzipped, at most 250 MB (Phase A with SymPy, Phase B without it); (2) cold-start p95 at most 5.0 s; (3) post-response telemetry flush behaviour in serverless execution (fallback: inline flush with the turn deadline and revision gate lowered to 7.2 s); (4) MCP protocol HTTP handshake and round-trip overhead against the 400 ms cap (including stateless MCP/A2A operation); (5) Gemini Flash provider API behaviour with thinking explicitly disabled (fallback: lower token ceiling). **Action trigger (fail-closed):** if item 1 or item 2 fails empirical verification, the documented container-topology fallback (DESIGN DD-07: orchestrator, MCP and safety services on a container host, for example Docker on Railway) is triggered immediately, with no dependency-trimming debate and no redesign of the services. Item 4, as already stated in PRD §18.4, also moves the services to the container host. Items 3 and 5 take their stated fallbacks with no topology change. Every outcome is recorded as an ADR and PRD §15.4 is amended before Tier 1b starts. **Note:** the spike rehearses the Phase B topology (API without SymPy, MCP with SymPy, Safety), while Phase A (Slice 0, Tier 1a) bundles SymPy in the API. |
| P0-14 | Version pin ADR (model ids, `MODEL_EMBEDDING`, ADK, A2A, MCP SDK) | P0-12 | Pending | Decision #30. Records SDK sizes by a local `pip install --target --no-compile`. Does not depend on P0-13: the deploy spike stays deferred to the first Vercel deployment (before Tier 1b) and re-checks the pins on Vercel |
| P0-15 | ADRs for the locked stack | P0-14 | Pending | PRD §18.4 |
| P0-16 | Threat model v0 (≤ 3 h) | — | Pending | TECH-55. Due before Tier 1b starts. Gate B verifies it exists (gates P2-16 and P2-17) |
| P0-17 | Slice 0 walking skeleton: FastAPI, in-process SymPy verifier, in-process hint policy, one Gemini Flash call (real, via a thin in-process provider-adapter call that P2-02 later generalises into the full adapter), 3 seed items (`scale_0001/2/3`), events `submit` / `reflection_choice` / `transfer_decision`, minimal practice page with keypad | P0-05, P0-08, P0-09, P0-11, P0-12 | Pending | PRD §18.4.1. About 15–20 h. The only external dependency in Slice 0 is the provider key. P0-17 owns a minimal fixture recorder and the replay CI job (`ci.yml` from P0-09), so the exit test has an owner before P1-15. CI runs `test_demo_trajectory.py` in recorded-fixture replay mode (deterministic), plus a local live smoke that sets `DIALOGUE_MODE=llm` explicitly (the shipped default is `template`, ADR-015). P0-14 formalises the version pins afterwards. Exit test: replay green with 0 leaks and the live smoke passes. Gates all other work. The full FSM table of PRD §8.5.1 (TECH-52) replaces the inline transitions in P1-08 |
| P0-18 | Early educator check (~10 turns, Socratic rubric) and child usability check (~20 min) | P0-17 | Pending | PRD §18.4.2. Findings applied before Gate B (not a Gate A item). Reviews and tunes the `llm` prompts (`DIALOGUE_MODE=template` is the shipped default, ADR-015 and SPEC D-37, and `llm` is the opt-in mode under review). Ratchets are reported until the first calibration run (n ≥ 100). If no child is reachable, record in an ADR signed by the product owner |

#### Phase 1 — Tutor foundation — Group: Core Infrastructure (Tier 1a)

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P1-01 | Authentication and role scaffolding (Clerk JWT, RBAC dependencies, audit middleware) | P0-17, P1-02 | Pending | Added after Slice 0 is green (PRD §18.5 #7) |
| P1-02 | Postgres and Alembic schema migrations (no pgvector at Tier 1a) | P0-17 | Pending | Deferred until Slice 0 is green. No pgvector extension and no `question_embedding` table at Tier 1a: the Tier 1b `question_embedding` migration (with `CREATE EXTENSION IF NOT EXISTS vector;`) is owned by P2-18. Owns ALL Tier 1a schema migrations, including `tutoring_session`, `attempt`, `tutor_turn`, `learner_skill_state`, `student_note`, `session_flag`, `misconception_event` and any other student-scoped table. Tasks that write or read tables (P1-09, P1-12, P1-17, P2-06, P2-11, P2-12) depend on P1-02. A task that later adds a table (P1-12, P2-12) supplies its definition and registers it in the P1-01a table registry |
| P1-01a | Postgres RLS minimal: per-transaction `SET LOCAL app.user_id`, fail-closed policies on student-scoped tables, pooled-connection leak test. `tests/authz` covers app layer and RLS | P1-01, P1-02 | Pending | Tier 1a. About 6–8 h (SPEC D-30). RLS hardening: the API database role is non-owner and has no `BYPASSRLS`, tables use `FORCE ROW LEVEL SECURITY`, the auth lookup is a `SECURITY DEFINER` function keyed by the Clerk `sub`, then `SET LOCAL`. The function is owned by a dedicated non-login role, has `search_path = pg_catalog, public`, has `EXECUTE` revoked from `PUBLIC` and is granted only to the API role. Every table that holds student-scoped rows uses `FORCE ROW LEVEL SECURITY`, applied through a table registry, and the 16-case authz suite enumerates every registered table. Tables added later (P1-12, P2-12) must register. `tests/authz` at Gate A is 16 cases: 9 app-layer, 3 RLS and 4 hardening. The MCP and A2A 401 case is a Gate B case (P2-17) outside the 9 Gate A app-layer cases. Remaining RLS breadth moves to P4-01 |
| P1-03 | Deterministic Input PII scrubber and `input_screen` engine | P0-06 | Pending | PRD §18.4. Owns the `scrub_pii` and `input_screen` engine code (AGENTS §3.5). The lexicon and canned-reply content is P1-06 (the engine is tested against a fixture lexicon until then) |
| P1-04 | Question-bank schema (steps, predictions, isomorphic examples) and import tooling | P1-02 | Pending | TECH-07 |
| P1-05 | 10 validated core seed ratio questions with collision-free predictions | P0-11, P1-04 | Pending | PRD §18.3 (about 2 days). Passes V1–V9 |
| P1-06 | Jargon list, Input Screen lexicon, canned replies (28 keys) | P1-05 | Pending | PRD §18.3 2a/2b. C1–C3. All keys `reviewed` at Gate B (C4). The authored files are checked by `content-validate.yml` (P1-16) |
| P1-07 | Student practice interface in React (keypad, reasoning options, wait states) | P0-10 | Pending | PRD §18.4. Shrinks under Cut 1a-1 (reasoning options deferred, keypad kept). The `axe` check on this screen is owned by P1-16 |
| P1-08 | Session state machine (table-driven FSM, `transitions.apply`) | P0-17 | Pending | TECH-52 |
| P1-09 | Answer submission (numeric, ratio, reasoning options) | P1-02, P1-08 | Pending | PRD §18.4. Boundary with P1-17: P1-09 owns the answer-submission endpoint and request validation and routes the event. P1-17 persists the attempt and turn (TX-A and TX-B). Shrinks under Cut 1a-1 (reasoning options and `step_expressions` deferred) |
| P1-10 | Deterministic ratio/proportion verifier (SymPy) with shared normaliser, developed in-process first | P0-17 | Pending | PRD §18.4. Verifier p95 < 400 ms (CI gate): not-run at Tier 1a (in-process SymPy, no MCP hop), applies at Gate B on MCP |
| P1-12 | Basic event logging (Postgres append-only `audit_event`) | P1-02 | Pending | PRD §18.4. Supplies its table definition to P1-02 and registers any student-scoped table in the P1-01a registry |
| P1-13 | Deterministic diagram renderer with leakage guard (Level 3 ratio table only in Tier 1) | P1-05 | Pending | PRD §18.1 Tier 1a |
| P1-14 | **Tier 1a checkpoint** (in-process core passes. Gate A, P2-15, passes by engineering hour 138, was hour 180) | P1-01 to P1-10, P1-12, P1-13, P1-15, P1-16, P1-17 (incl. P1-01a), P2-04 to P2-06, P2-08, P2-09, P2-11, P2-12 | Pending | P2-07 (Dialogue Agent) and P2-10 (Classifier) are outside the Tier 1a baseline (ADR-015: Cuts 1a-3 and 1a-2 taken at baseline, `DIALOGUE_MODE=template`). The exact-key cache P1-11 is Tier 1b and is not a dependency. Interim triggers (mandatory, engineering hours): at hour 70, if P1-01a and P2-06 are not both Done, apply Cut 1a-1. At hour 100, if P2-08 and P1-17 are not both Done, apply Cut 1a-1 if not already taken and start no task outside this dependency set. Fail: apply Cut 1a-1 and drop all Tier 1b and Tier 1c scope. T1b-1, T1b-2 and T1b-4 apply only while Tier 1b is in progress (PRD §18.2, ADR-014). Authored probe templates are owned by P1-05 and P2-06 |
| P1-15 | Eval harness and CI: `eval.yml`, `eval-live-local` job, bundle-size and contract-drift CI checks. Extends the minimal fixture recorder and replay CI job built by P0-17 (does not build the first recorder) | P0-09, P0-17 | Pending | Tier 1a. Full harness. Built inside the Tier 1a 120 h budget. Owns the `before_model` prompt-capture CI test, `eval.yml` and the Tier 1a `eval-nightly` workflow. The FB/EC cases are authored inside the 45 h content package. The scripted-variant generator (about 10 h) belongs to the opt-in `llm` stretch and is outside the commitment (ADR-015). At Tier 1a P1-15 runs the bundle-size check in `ci.yml` by building the artefact with `pip install --target` (no Vercel), so CI measures that build artefact and the 250 MB check applies at Gate A. The deployed bundle check is `not-run` until Tier 1b. The story-sync and Sentry-scrubber checks moved to P1-16. Dependency of P1-14, P2-13 and P2-14 |
| P1-16 | CI, security and content checks: `scripts/sync_stories.py --check`, `content-validate.yml`, `pip-audit`, `npm audit`, `gitleaks`, `axe` on the practice screen, Sentry SDK and `before_send` scrubber on web and API | P0-09, P0-17, P1-05, P1-06, P1-07 | Pending | Tier 1a. About 8–12 h, inside the Tier 1a 120 h budget. Owns the import-boundary check. Dependency of P1-14. Creates `scripts/sync_stories.py`. `user-story.md` is created by P0-08, and `content/` and `blueprint.md` by P0-11 (§1.3). Depends on P1-07 (`axe`), P1-05 and P1-06 (`content-validate`) |
| P1-17 | Orchestrator and persistence (`run_turn`, TX-A and TX-B persistence, session lease, idempotency, rate counters) | P1-02, P1-04, P1-08, P1-01a | Pending | Tier 1a. About 14–20 h, inside the Tier 1a 120 h budget. Lease 12 s, idempotency record 24 h, rate limits 60 per hour and 15 per 5 minutes per student (AGENTS §4.6). Dependency of P1-14. Boundary with P1-09: P1-17 persists the attempt and turn (TX-A and TX-B), the lease, idempotency and rate counters. P1-09 validates and routes the event. Reads and writes tables owned by P1-02. Owns `render_solution_turn` and `render_example_turn` (authored text from the question, no model, no guard) |

#### Phase 2 — Socratic intelligence

| Task ID | Group | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P2-01 | Agent Integration | Google ADK per-turn pipeline (`SequentialAgent` + bounded `LoopAgent`, isolated context per agent) | P1-10, P1-08, P0-14 | Pending | AGENTS §1.1, §5.1. P0-14 pins the ADK version |
| P2-02 | Models / APIs | Primary provider integration (Gemini Flash) and provider adapter interface | P0-14 | Pending | Generalises the thin in-process provider-adapter call built in P0-17 into the full adapter. Secondary provider evaluation is P3-10 |
| P2-03 | Agent Integration | Structured agent schemas (Pydantic, versioned) | P1-04 | Pending | AGENTS §2.1 rule 3 |
| P2-04 | Agent Integration | Deterministic misconception matcher (< 10 ms, 0.90 confidence) | P1-05 | Pending | AG-03 |
| P2-05 | Agent Integration | Retrieval gate; deterministic student-state estimator | P2-01 | Pending | AG-04, AG-05. Tier 1a: the retrieval gate runs but the exemplar source is an empty stub (ADR-014). The real exact-SQL exemplar query, authoring and `search_exemplars` arrive in Tier 1b (P2-18 owns the SQL filter) |
| P2-06 | Agent Integration | Hint-policy engine (Levels 0–5; isomorphic worked example on withheld Level 5) | P0-05, P2-01, P1-02, P1-04, P1-05 | Pending | AG-07. < 40 ms. Reads the cohort `allow_level_5` from Postgres each turn. Also owns the canned-text registry code (loads `canned_responses.json`, authored in P1-06, and serves canned keys such as `encouragement` and `fallback_l{level}`). The isomorphic worked example for a withheld Level 5 is authored by P1-04 (schema) and P1-05 (content) and rendered here |
| P2-07 | Agent Integration | Socratic Dialogue Agent (< 100-token prompts) | P2-02, P2-03, P2-06 | Pending | AG-08. **Outside the Tier 1a baseline (Cut 1a-3 is taken at baseline, ADR-015).** Opt-in `llm` stretch (about 15–20 h), built after Gate A only if hours remain below the 240 h limit. `DIALOGUE_MODE=template` is the shipped default: the authored probe templates are owned by P1-05 (authoring) and P2-06 (selection). `llm` becomes the default only by a PRD change after the early educator check (P0-18) tunes the prompts and a Gate B live calibration run (n ≥ 100). When built it owns the authored prompt files in `apps/api/app/prompts/` (`PROMPT_SOURCE=repo`), with P2-08 owning the check text. Digit rule: below Level 4 a digit is forbidden unless it appears in the question stem, in the selected authored probe template or is the student's verified-correct value. No new computed value is permitted |
| P2-08 | Agent Integration | Deterministic leak check (value and method) | P2-06 | Pending | AG-09. Built in Tier 1a and exercised by unit tests and poisoned fixtures. In template mode no model text exists at runtime (authored text is validated offline: V2, V9, C2, C3). Applies the digit rule: below Level 4 a digit is forbidden unless it is in the stem, in the selected authored probe template, or is the student's verified-correct value. No new computed value |
| P2-09 | Agent Integration | Safety module, in-process behind the A2A interface | P2-08 | Pending | Tier 1a form of AG-10 |
| P2-10 | Agent Integration | Conditional misconception classifier | P2-02, P2-05 | Pending | AG-06. Advisory. Outside the Tier 1a baseline (Cut 1a-2 is taken at baseline, ADR-015). Opt-in `llm` stretch (about 8–10 h) built with P2-07, or in Tier 1b |
| P2-11 | Agent Integration | Skill and misconception graph seeded for ratio skills; transfer item selection (`select_transfer`) and next practice | P0-03, P1-02, P1-05 | Pending | Authored graph partners until the pgvector transfer tie-break arrives in 1b |
| P2-12 | Agent Integration | Learner-model delta (`update_learner_model`) | P1-02, P2-11 | Pending | Tier 1a |
| P2-13 | Evals & Hardening | 42 critical eval cases (15 direct-answer, 15 prompt-injection, 12 unsafe-input, ≥ 10 method-leak) | P1-06, P1-15 | Pending | PRD §18.3 (about 3 days). 0-leak CI gate. Owns the poisoned-fixture tests (with P2-08 for the leak check). Gate A live sample (run by P2-15): the 42 critical cases, golden 1a, one pleading persona, judged in `DIALOGUE_MODE=template` with fixture-backed adapter replay. The live subset of ≥ 100 LLM-stage turns is waived at baseline (Cut 1a-3 is taken, ADR-015) and applies only to the opt-in `llm` stretch and Gate B. The golden 1a classifier expectation is pinned to the replay fixture (see P2-14). Gate A is labelled pedagogy-unvalidated until the Gate B educator check (P0-18) |
| P2-14 | Evals & Hardening | Multi-turn trajectory evals: golden demo trajectory, simulated pleading student | P2-01, P1-15 | Pending | PRD §18.4 Phase 2. The golden trajectory here is the 1a variant: in-process, recorded-fixture replay, step 5a empty retrieval, no cache-hit trace item. The recorded classifier output in the 1a golden replay fixture is null or `insufficient_evidence`, and the replay expectation is no misconception claim with `prompt_type=diagnostic_probe`. That expectation is pinned to the replay fixture only. In live mode the test asserts that `prompt_type` obeys the confidence rule (`targeted_scaffold` only for a classifier code at confidence ≥ 0.80 that is not `insufficient_evidence`, otherwise `diagnostic_probe`). The 1b variant (exemplar citation and cache-hit) is a Gate B item attached to P2-21 and the Tier 1b tasks |
| P2-15 | **Gate A** (Release 1.0a) | In-process core demonstrable | P1-14, P1-01a, P2-13, P2-14 | Pending | PRD §21.1. **Gate A is judged in `DIALOGUE_MODE=template` with fixture-backed adapter replay (ADR-015).** Acceptance: the 42 critical cases, the golden 1a trajectory in replay, one pleading persona (template mode), the 16-case `tests/authz` suite (9 app-layer, 3 RLS, 4 hardening, P1-01a), `verifier_agreement` and `hint_policy_match` on the Tier 1a subset (FB and EC families), and leakage 0. The Dialogue Agent requirement, the live Gemini Flash provider-gate row, the ≥ 100 LLM-stage live subset and the model-level ratchets (including `fallback_rate`, recorded `not-run` because template mode makes no model call) are not Gate A items: they apply to the opt-in `llm` mode and Gate B. The educator check (P0-18) and the child check: findings applied before Gate B. Threat model v0 (P0-16): due before Tier 1b starts, Gate B verifies it exists. None is a Gate A item. The 1a golden replay fixture records a null or `insufficient_evidence` classifier output (no classifier runs in template mode): no misconception claim and `prompt_type=diagnostic_probe`. `diagram_leakage` at Gate A is judged on the diagram specs of approved Tier 1a items (DS-09 is Tier 2). DS-06, the five personas and the 150-case set are Tier 2/3. Gate A is labelled pedagogy-unvalidated until the Gate B educator check (P0-18). Gate A (this task) passes by engineering hour 138. |
| P2-16 | Models / APIs | MCP server: `verify_expression`, `get_question`, `search_exemplars` with the single per-turn fallback (repeat MCP call on Vercel) | P1-10, P2-18, P0-16, P0-13 | Pending | Tier 1b. SymPy packaged only in this bundle (≤ 90 MB). `search_exemplars` wraps the exact SQL filter owned by P2-18. Cut T1b-1 may keep `search_exemplars` in-process. Owns the verifier p95 < 400 ms CI gate on MCP. P0-16 is due before Tier 1b starts |
| P2-17 | Agent Integration | A2A Safety Guard service (`solvepath-safety`) with service-token authentication | P2-09, P0-16 | Pending | Tier 1b. Owns the MCP and A2A 401 authz case (unauthenticated-call test), a Gate B case outside the 9 Gate A app-layer cases (P1-01a). P0-16 is due before Tier 1b starts. Cut T1b-4 does not remove it: the guard stays an in-process module behind the same interface, with no A2A call |
| P2-18 | Models / APIs | Exact SQL filter exemplar retrieval; exemplar per taxonomy label | P1-02, P2-05 | Pending | Tier 1b. Owns the exact SQL exemplar filter, the exemplar authoring and the data behind `search_exemplars` (P2-16). At Tier 1a the exemplar source is an empty stub (ADR-014). pgvector only for the transfer tie-break and the near-duplicate scan (embedding sync via `MODEL_EMBEDDING`). Also owns the Tier 1b Alembic migration that creates `question_embedding` (`vector(768)`) with `CREATE EXTENSION IF NOT EXISTS vector;` (no pgvector at Tier 1a) |
| P2-19 | Agent Integration | Langfuse traces and scores; W3C `traceparent` propagation across MCP and A2A | P2-16, P2-17 | Pending | Tier 1b |
| P2-20 | Models / APIs | Four Vercel projects with env vars (Development and Production only. Preview, with ephemeral per-PR database branches, is Deferred to Tier 3 (inactive, unprovisioned in Tier 1) and is created only by a later owner decision) and `warmup` job | P0-13 | Pending | Tier 1b. Each addition keeps the golden test green. The GitHub Actions `deploy-prod.yml` (P2-22) is the authoritative deploy trigger. Vercel Git auto-deploy is disabled on all four projects (ADR-014) |
| P1-11 | Models / APIs | Deterministic expression cache (exact key) | P1-02, P1-10 | Pending | Tier 1b (moved out of Tier 1a). PRD §18.4. Deferrable under cut T1b-2 (defer cache). Tier 1a calls SymPy in process directly |
| P2-21 | **Gate B** (Release 1.0) | Tier 1 demo gate | P2-16 to P2-20, P2-22, P1-11 (unless T1b-2), P0-18, P0-16 | Pending | PRD §21.1. All canned-reply keys `reviewed` (C4). Tier 1b starts only after Gate A (P2-15), with a re-estimate from actual Tier 1a hours. Gate B item: the golden 1b variant (exemplar citation and cache-hit trace item), attached to this gate and the Tier 1b tasks. P1-11 is a dependency, and the cache-hit Gate B item applies, only if cut T1b-2 was not taken (P1-11 built) |
| P2-22 | Evals & Hardening | Gate B CI and release checks: `deploy-prod.yml`, the `deployed-services` live job and nightly, `tests/smoke`, `pytest -m release`, the Langfuse dataset mirror, golden 1b | P1-15, P2-19, P2-20 | Pending | Tier 1b. Dependency of P2-21. Owns the deployed nightly live run (`eval.yml` and the local `eval-nightly` at Tier 1a are P1-15). Not on the Tier 1a path. No separate hours estimate: Tier 1b is re-estimated at its start (§2.3) |

#### Tier 1c — Minimal teacher view (Release 1.0, 16–20 h) — Group: Models / APIs

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| T1c-01 | Read-only replay of one session for the assigned teacher | P2-21 | Pending | TECH-49. Does not start until Gate B passes. Tier 1c does not start unless Gate B has hours to spare (ADR-014). Adds a teacher assigned-cohort read policy to the minimal RLS (the full matrix stays P4-01) |
| T1c-02 | One on-demand pending draft recommendation with evidence (Teacher Insight code path later reused by `insight-drafts`) | P2-21 | Pending | No accept/override UI, no dashboard, no cron |
| T1c-03 | **Gate C** (Release 1.0 with teacher view) | T1c-01, T1c-02 | Pending | PRD §21.1. Demo ends on a real teacher-facing result |

#### Phase 3 — Teacher operations, Tier 2 / Release 1.1 (1 week) — Group: Models / APIs

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P3-01 | Student learning profile | T1c-03 | Pending | PRD §18.4 |
| P3-02 | Cohort dashboard | P3-01 | Pending | PRD §18.4 |
| P3-03 | Session replay with Langfuse trace links for authorised roles | T1c-01 | Pending | PRD §18.4 |
| P3-04 | Intervention recommendation cards with step evidence; accept/reject/override UI; teacher override | T1c-02 | Pending | PRD §18.4 |
| P3-05 | Item-quality review queue | P1-04 | Pending | PRD §18.4 |
| P3-06 | Vercel Cron jobs: `learner-rollup`, `insight-drafts`, `item-quality-scan`, `embedding-sync` (`warmup` exists from P2-20; the nightly evaluation is the GitHub Actions workflow `eval.yml`, not a cron job. `eval.yml` and `eval-nightly` at Tier 1a are P1-15, and the deployed nightly live run is P2-22) | P2-20 | Pending | PRD §18.4 |
| P3-07 | Bar-model diagrams | P1-13 | Pending | PRD §18.1 Tier 2 |
| P3-08 | Question bank expanded to 40 approved items | P1-05 | Pending | TECH-07. About 3 days |
| P3-09 | 60 human-reviewed gold calibration cases across 4 error clusters | P3-08 | Pending | External educator labels ≥ 30 (about 3 h). Otherwise accuracy reported as unvalidated. DS-06 and the five-persona set are Tier 2 deliverables |
| P3-10 | Secondary provider adapter and evaluation (OpenRouter / vLLM) | P2-02, P0-12 | Pending | Tier 2 task (the second-provider deferral is not in the Tier 1b cut list). Late-cut-2 |

#### Phase 4 — Governance and reliability, Tier 3 / Release 1.2 (1 week) — Group: Evals & Hardening

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P4-01 | Remaining RLS breadth and the full role-based authorisation matrix (the minimal RLS is P1-01a in Tier 1a) | P1-01a | Pending | PRD §18.4 |
| P4-02 | Audit-event viewer | P1-12 | Pending | Late-cut-3 |
| P4-03 | Full 150-case benchmark harness in GitHub Actions and Langfuse datasets | P2-13, P3-09 | Pending | Late-cut-1: fall back to 42 critical + §14.1 category minimum (benchmark 150 to 42 critical). The 150-case set is Tier 3 |
| P4-04 | Model / prompt traceability end to end | P2-19 | Pending | PRD §18.4 |
| P4-05 | Monitoring dashboard (Langfuse dashboards, Vercel logs and alerts) | P2-19 | Pending | PRD §18.4 |
| P4-06 | Error handling and retry policy | P2-01 | Pending | PRD §18.4 |
| P4-07 | `retention-purge` job and retention policy | P1-02 | Pending | Late-cut-3 |
| P4-08 | Coordinator cohort tooling | P3-02 | Pending | Late-cut-4 |

#### Phase 5 — Deployment and showcase (1 week) — Group: Evals & Hardening

| Task ID | Component / Module | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-01 | Production deployment on Vercel with synthetic data | P2-20 | Pending | PRD §18.4 |
| P5-02 | Complete CI/CD pipeline with eval and security gates | P0-09, P4-03 | Pending | PRD §18.4 |
| P5-03 | Educator validation gate: external educator reviews 20–30 recorded turns (about 2 h) | P2-21 | Pending | PRD §18.2 |
| P5-04 | Threat model (final) | P0-16 | Pending | PRD §18.4 |
| P5-05 | Architecture diagram; evaluation report; operating runbook | P4-03 | Pending | PRD §18.4 |
| P5-06 | 6–8 minute demo video | P5-01 | Pending | PRD §18.4, §19 |
| P5-07 | Customer case study and handover brief | P0-07 | Pending | PRD §18.4 |
| P5-08 | GitHub README and setup documentation | P5-01 | Pending | PRD §18.4 |
| P5-09 | Release criteria check (Release 1.1 and 1.2) | P5-01 to P5-08 | Pending | PRD §21.2 |

### 2.3 Hours ledger (PRD §18.2 budgets)

| Budget | Planned | Actual | Notes |
| --- | --- | --- | --- |
| Phase 0 (non-Slice-0) | about 20–30 h (planned) | 0 | Provider spike, version pin ADR, ADRs, personas, graph, taxonomy, hint-policy definition, privacy assessment, blueprint, wireframes and the other P0 tasks. Separate from the Tier 1a engineering hours. The educator check and child check findings are applied before Gate B. Threat model v0 is due before Tier 1b starts and Gate B verifies it exists |
| Slice 0 | 15–20 h | 0 | Inside the 120 h Tier 1a engineering budget |
| Tier 1a | 120 h (planned; Gate A checkpoint at hour 138 = 120 h + 15%) | 0 | Locked by ADR-015. Mandatory interim triggers (no debate, engineering hours): at hour 70, if P1-01a and P2-06 are not both Done, apply cut 1a-1. At hour 100, if P2-08 and P1-17 are not both Done, apply cut 1a-1 if not already taken and start no task outside the Gate A dependency set. Log each trigger here. A cut frees only the hours not yet spent on its scope. Final checkpoint: Gate A (P2-15) passes by engineering hour 138 (was hour 180 before ADR-015; the plan includes P1-01a at about 6–8 h, P1-16 at about 8–12 h and P1-17 at about 14–20 h). The exact-key cache P1-11 is Tier 1b. **Baseline scope reductions (ADR-015, formerly contingency cuts 1a-3 and 1a-2):** `DIALOGUE_MODE=template` is the shipped default, so runtime LLM paraphrasing P2-07 (about 15–20 h) is outside the commitment, and the advisory Classifier P2-10 (about 8–10 h) is deferred. **Remaining contingency cut, 1a-1:** defer STU-03 reasoning options and `step_expressions` (keep keypad and answer parsing; the tasks that shrink are P1-07 and P1-09), saves about 8–12 h. At a Tier 1a miss only 1a-1 applies and all Tier 1b and Tier 1c scope is dropped. Never cut: verifier, leakage gates, `tests/authz`, 42 critical cases, golden trajectory, service-to-service authentication when present (Tier 1b), educator and child checks (PRD §18.2; their findings are applied before Gate B) |
| Tier 1b | 80–110 h | 0 | Stretch. Starts only after Gate A and only if hours remain below the 240 h limit. Re-estimate from actual Tier 1a hours at its start. Cut list: T1b-1, T1b-2, T1b-4. T1b-0 (teacher view) is dropped and T1b-0 and T1b-3 are retired names (ADR-014) |
| Opt-in `llm` stretch | about 23–30 h (P2-07 15–20, P2-10 8–10) plus about 10 h for the scripted-variant generator | 0 | ADR-015. Not in the commitment. Built after Gate A only if hours remain below the 240 h limit. `llm` becomes the default only by a PRD change after the early educator check (P0-18) and a Gate B live calibration run (n ≥ 100) |
| Tier 1c | 16–20 h | 0 | Dropped, with all Tier 1b scope, if Gate A is not passed by engineering hour 138. Tier 1c does not start unless Gate B has hours to spare (ADR-014) |
| Tier 1 content package | 45 h (owner-locked, ADR-015) | 0 | Covers the 10 seed items, jargon list, Input Screen lexicon and canned replies, the 42 critical cases and the FB/EC cases behind `hint_policy_match` and `verifier_agreement`. The itemised estimate in PRD §18.3 is about 48 h before rounding, and the difference is absorbed in the 15% buffer (KI-7). The scripted-variant generator (about 10 h) moved to the opt-in stretch. **Tier 1a commitment = 120 h engineering + 45 h content = 165 h (190 h with the 15% buffer).** With Phase 0 (20–30 h) the total is 185–195 h (213–224 h buffered), at most 240 h, about 7.4–7.8 weeks (8.5–9.0 buffered) at 25 h/week. Tier 1a plus 1b 200–230 h (engineering only). Plus content and Phase 0 265–305 h (305–351 h buffered), above the 240 h envelope, so Tier 1b is built only with hours remaining. Tier 1 planning sum 216–250 h. Roadmap planning sum about 301–360 h (Tier 1 216–250, Tier 2 55–70, Tier 3 30–40), engineering only, excluding the opt-in stretch, content and Phase 0. Tier 2 content stays about 48 h |
| Tier 2 | 55–70 h (+ about 48 h content) | 0 | Best effort |
| Tier 3 | 30–40 h | 0 | Best effort |

---

## 3. Execution & Daily Work Log Format

### 3.1 Entry template

Append new entries below Entry 0, newest last. Never edit a past entry. Correct it with a new entry.

```text
### Entry NNN — <short title>
| Field | Value |
| --- | --- |
| Timestamp | YYYY-MM-DD HH:MM (local, with timezone) |
| Engineer / Agent | <name or agent id and model> |
| Scope Worked | <Task IDs from §2.2> |
| Changes Made | <files, modules, migrations, configuration. Commit hashes once committed> |
| Test / Verification Run | <command, suite, result. Include golden-test status and any eval gate result> |
| Blockers | <none, or what blocks and who owns the unblock> |
| Hours | <session hours, for the §2.3 ledger> |
```

Update the §2.2 status of every task named in Scope Worked in the same session.

### 3.2 Log

### Entry 0 — Documentation & Design Baseline Complete

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Baseline only. No §2.2 task started |
| Changes Made | Created `BUILD_LOG.md`. Recorded Phase 1–4 artifacts as complete: Phase 1 `PRD.md` (`07123db`). Phase 2.1 `SPEC.md` (`13589d5`). Phase 2.2 `DESIGN.md` (`175c697`). Phase 2.3 `TECHNICAL.md` (`4363052`). Phase 3 `AGENTS.md` and `CONTEXT.md` (`31a4b18`). Phase 4 `THRESHOLDS.md` and `EVALS.md` (`013afbb`) |
| Test / Verification Run | None. No application code exists |
| Blockers | None for starting Phase 0. Open upstream items in §1.6 remain open |
| Hours | 0 |

### Entry 001 — Final gate pass documentation remediation

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P1-01a added and P4-01 narrowed in §2.2) |
| Changes Made | Applied ADR-004 across the baseline documents. `BUILD_LOG.md`: hours ledger, checkpoint hour 148, P0-13, P0-17, P0-18, P1-01a, P2-07, P2-15, P4-01, ADR-004 |
| Test / Verification Run | None. No tests run. No application code exists |
| Blockers | None |
| Hours | 0 |

### Entry 002 — Second gate review fixes (B-1, B-2)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started |
| Changes Made | Applied ADR-005: `SPEC.md` (§5.9 hour-148, D-31), `EVALS.md` §1.3 local live-run row, `PRD.md` prompt-source bullet, `PROMPT_SOURCE` variable and Gate A checklist, `AGENTS.md` §3.6, `TECHNICAL.md`, `THRESHOLDS.md` bundle row, ADR-005 |
| Test / Verification Run | None. Grep for `hour-140` and `hour 140` shows only the PRD v1.3.20 changelog row |
| Blockers | None |
| Hours | 0 |

### Entry 003 — Remaining review items closed (ADR-006)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started |
| Changes Made | Applied ADR-006: live-run ceilings 200 turns / 450,000 tokens / USD 0.80 in `PRD.md`, `SPEC.md`, `EVALS.md`, `THRESHOLDS.md`, `TECHNICAL.md`, `CONTEXT.md`. Interim cut triggers in `PRD.md` §18.2 and the §2.3 ledger. Bundle estimate notes in `THRESHOLDS.md` and `TECHNICAL.md`. Audit traceability §4.1 |
| Test / Verification Run | Grep for `160 turns`, `350,000`, `USD 0.60` and `2,190` shows only historical ADR rows |
| Blockers | Original audit report needed to map C-1, C-2, C-4 and D-1 to D-7 |
| Hours | 0 |

### Entry 004 — Independent re-review fixes (ADR-010)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P1-11 moved to Tier 1b, P0-14 and P2-08 dependencies changed, P0-12, P0-13, P1-14, P2-10, P2-15, P2-18 notes updated in §2.2) |
| Changes Made | Applied ADR-010 across the baseline documents: `PRD.md` (v1.3.23), `SPEC.md` (D-32), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`. `BUILD_LOG.md`: §1.1 commitment and never-cut rows, P0-12 to P0-16, P1-11, P1-14, P2-07, P2-08, P2-10, P2-15, P2-18, P2-21, §2.3 ledger (Phase 0 line, cuts 1a-1 to 1a-3, hours), ADR order (ADR-008 before ADR-009), ADR-010 |
| Test / Verification Run | None. No tests run. No application code exists. Grep for `164–196`, `189–225` and `pgvector exemplar retrieval` in `BUILD_LOG.md` shows no current-state hit (only the superseded-figure text in ADR-010 and this entry). Dependency check on the §2.2 task table found no path from P1-14 or P2-15 to P0-13 or any Tier 1b task |
| Blockers | None |
| Hours | 0 |

### Entry 005 — Third independent re-review fixes (ADR-011)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P1-15 added, P0-17, P1-14, P2-13, P2-14, P2-15, P2-21, T1c-01 and cut names updated in §2.2) |
| Changes Made | Applied ADR-011 across the baseline documents: `PRD.md` (v1.3.24), `SPEC.md` (D-33), `EVALS.md`, `THRESHOLDS.md`, `AGENTS.md`, `CONTEXT.md`. `BUILD_LOG.md`: §1.1 duration and checkpoint rows, §1.2 pgvector, §1.3 working tree, §1.5 note, §2.2 notes and dependencies, §2.3 ledger, ADR-001 to ADR-004 status wording, ADR-011 |
| Test / Verification Run | None. No tests run. No application code exists. Grep for `cut order`, `hour 240` and `only uncommitted` in `BUILD_LOG.md` shows no current-state hit (only historical text in ADR rows and entries). Dependency re-trace of P1-14 and P2-15 including P1-15 found no path to P0-13, P0-16, P0-18, P1-11 or any of P2-16 to P2-21 |
| Blockers | None |
| Hours | 0 |

### Entry 006 — Fourth independent re-review fixes (ADR-012)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P1-16 added. P0-17, P1-01a, P1-14, P1-15, P2-02, P2-13, P2-14, P2-15 and the Phase 0–2 headings updated in §2.2) |
| Changes Made | Applied ADR-012 across the baseline documents: `PRD.md` (v1.3.25), `SPEC.md` (D-34), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`. `BUILD_LOG.md`: §1.1 hours, commitment and checkpoint rows, §1.3 planned artefacts row and ADR range, §1.5 document count, §2.2 intro and Phase 0–2 headings, P0-17, P1-01a, P1-14, P1-15, new P1-16, P2-02, P2-13, P2-14, P2-15, §2.3 ledger (Tier 1a, Tier 1c, content package lines), ADR-009 to ADR-011 status wording, ADR-012 |
| Test / Verification Run | None. No tests run. No application code exists. Dependency re-trace of P1-14 and P2-15 including P1-15 and P1-16 found no path to P0-13, P0-16, P0-18, P1-11 or any of P2-16 to P2-21 |
| Blockers | None |
| Hours | 0 |

### Entry 007 — Fifth independent re-review fixes (ADR-013)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (new P1-17 and P2-22. P1-02 dependency added to P1-01, P1-09, P2-11 and P2-12. P0-12, P1-01a, P1-14, P1-15, P1-16, P2-13, P2-14, P2-15, P2-17, P2-21 updated in §2.2) |
| Changes Made | Applied ADR-013 across the baseline documents: `PRD.md` (v1.3.26), `SPEC.md` (D-35), and the fixes by their owners in `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`. `BUILD_LOG.md`: §1.1 delivery, tier, commitment and checkpoint rows, §1.3 and §1.5 ADR range, §2.1 gate row, §2.2 intro, new tasks P1-17 and P2-22, the task notes above, §2.3 ledger (Tier 1a, Tier 1c, content package lines), ADR-002, ADR-005, ADR-006, ADR-009 and ADR-012 status wording, ADR-013, new §5.1 known-issues register |
| Test / Verification Run | None. No tests run. No application code exists. Transitive dependency closure recomputed from the §2.2 table. P1-14 (39 tasks): P0-03, P0-04, P0-05, P0-06, P0-08, P0-09, P0-10, P0-11, P0-12, P0-14, P0-17, P1-01, P1-01a, P1-02, P1-03, P1-04, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P1-12, P1-13, P1-15, P1-16, P1-17, P2-01, P2-02, P2-03, P2-04, P2-05, P2-06, P2-07, P2-08, P2-09, P2-10, P2-11, P2-12. P2-15 (42 tasks) is the P1-14 set plus P1-14, P2-13 and P2-14 (P2-13 adds P1-06 and P1-15, P2-14 adds P2-01 and P1-15, all already in the set). Neither closure contains P0-13, P0-16, P0-18, P1-11, any T1c task or any of P2-16 to P2-22. Cuts 1a-2 and 1a-3 defer P2-10 and P2-07 to Tier 1b, which only removes dependencies |
| Blockers | None |
| Hours | 0 |

### Entry 008 — Full-coverage review fixes (ADR-014)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P0-08, P0-11, P0-12, P0-16, P0-17, P0-18, P1-01a, P1-02, P1-06, P1-07, P1-09, P1-12, P1-14, P1-15, P1-16, P1-17, P2-01, P2-05, P2-06, P2-07, P2-13, P2-15, P2-16, P2-17, P2-18, P2-20, P2-22, T1c-01 and P3-06 updated in §2.2) |
| Changes Made | Applied ADR-014 across the baseline documents: `PRD.md` (v1.3.27), `SPEC.md` (D-36), and the fixes by their owners in `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`. `BUILD_LOG.md`: §1.1 checkpoint and never-cut rows, §1.3 ADR range and planned artefacts, §1.5 note, §2.1 gate column and ordering rules, the §2.2 notes and dependencies above, §2.3 ledger (Phase 0, Tier 1a, 1b, 1c and content package lines), ADR-013 status wording, ADR-014 |
| Test / Verification Run | None. No tests run. No application code exists. Transitive dependency closure recomputed from the §2.2 table. P1-14 (39 tasks): P0-03, P0-04, P0-05, P0-06, P0-08, P0-09, P0-10, P0-11, P0-12, P0-14, P0-17, P1-01, P1-01a, P1-02, P1-03, P1-04, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P1-12, P1-13, P1-15, P1-16, P1-17, P2-01, P2-02, P2-03, P2-04, P2-05, P2-06, P2-07, P2-08, P2-09, P2-10, P2-11, P2-12. P2-15 (42 tasks) is the P1-14 set plus P1-14, P2-13 and P2-14. P0-14 stays in both closures through P2-01 and P2-02. Neither closure contains P0-13, P0-16, P0-18, P1-11, any T1c task or any of P2-16 to P2-22 (P2-16 now depends on P2-18, which is Tier 1b and outside both closures) |
| Blockers | None |
| Hours | 0 |


### Entry 009 — Gate review remediation (ADR-015)

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-11 |
| Engineer / Agent | Muthukumar Selvarasu / Claude (Sonnet 5.5) |
| Scope Worked | Documentation only. No §2.2 task started (P0-08, P0-12, P0-17, P1-14, P1-15, P1-16, P1-17, P2-07, P2-08, P2-10, P2-13, P2-15 updated in §2.2) |
| Changes Made | Applied ADR-015: `BUILD_LOG.md` §1.1, §1.2, §2.1, §2.2, §2.3, §4 (ADR-015, ADR status wording), §4.1 (audit mapping), §5.1 (KI-1 closed, KI-2, KI-3 updated, KI-7 and KI-8 added). `PRD.md` v1.3.28 (§15.1, §18.1, §18.2, §18.3 text, §18.4, §21.1, Decision #1, #26, #52, changelog). `SPEC.md` D-37 and §5.1, §5.9, WF-09, configuration. `TECHNICAL.md` §1.1, §2.4, §2.6, §4.1, §4.3. `DESIGN.md`, `AGENTS.md` §1.3, §2.8, §2.10, §4.6, `THRESHOLDS.md`, `EVALS.md`, `CONTEXT.md` |
| Test / Verification Run | None. No tests run. No application code exists. Verification by search over the nine files: no remaining current-state hit for the superseded hour figures (138–180, 216–268, 248–308, hour 180), the superseded ceilings (200 turns, 450,000, 1,875), the `llm` release default, or the stage-start 7.2 s wording. Historical rows (ADR table, entries, PRD decision rows 46 to 51 and changelog rows) keep the earlier figures and are marked superseded |
| Blockers | None for starting P0-08. KI-7 and KI-8 are open with stated checks |
| Hours | 0 |

---

## 4. Architectural Decision Records (ADRs) & Divergence Log

Record a decision here when implementation forces a choice the upstream files leave open, or when the build diverges from them. A divergence is not applied until the owner changes the named upstream file (a threshold change is a PRD change, PRD §14.5). Required ADRs named by the PRD (provider spike, deploy spike, version pin, and the child-usability exception) are logged here when produced.

| ADR ID | Date | Decision Summary | Upstream File Impacted (`SPEC.md` / `DESIGN.md`) | Rationale | Trade-offs |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-004, ADR-006 and ADR-008.** Pre-build audit remediation: MCP bundle limit 90 MB; recalculated latency budget (fallback and flush accounted, p95 definitions); token ceiling per model call with thinking disabled; three deploy roots with separate manifests and SymPy only in MCP; two-phase `transitions.apply`; session lease fixed at 12 s; terminal-state rule (own-table records permitted); Classifier advisory; guard `forbidden_strings` exception; Clerk `azp` verification and per-environment seeding; `eval-nightly` is GitHub Actions only; `fallback_rate` is a post-calibration ratchet; harness-level versus model-level gate semantics (n ≥ 100) | `PRD.md` (v1.3.20), `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `THRESHOLDS.md`, `EVALS.md`, `CONTEXT.md` | Audit findings C-1 to C-7, W-2, W-4, W-5, W-6, W-8 to W-12, D-1 to D-9. Measured wheel sizes showed 30 MB was unreachable for SymPy. The latency sum had omitted the single fallback and the flush | W-1 (template is the default dialogue mode), W-3 (exact SQL filter for exemplars, pgvector off the hot path) and C-7 (2x re-baseline, Tier 1a only commitment) were applied in a second pass on the owner's answers |
| ADR-002 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-004 and ADR-008.** Final pre-build gate remediation (B-1 to B-5) and owner answers: phased topology (SymPy in the API for Phase A, split at Phase B); FSM row 23 `unverified` (not a cap turn, `consecutive_unverified`, `verification_unavailable`); client timeout 15 s with one retry after 3 s; Clerk `azp` exact-origin allow-list; live-eval ceilings 120 turns, 250,000 tokens, USD 0.50 with the `eval:live` label; monthly model-provider ceiling USD 20 (alert USD 16); D-13 accepted | `PRD.md` (v1.3.21), `SPEC.md`, `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `THRESHOLDS.md`, `EVALS.md`, `CONTEXT.md` | Final gate review NO-GO blockers B-1 to B-5. Owner answers on 2026-10-11 | Preview has no `azp` origin: development is local first and the owner deploys to Vercel later. The token mean per turn is still to be measured at P0-12 |
| ADR-003 | 2026-10-11 | **Accepted, superseded by ADR-015 and ADR-004 and ADR-006 for the eval ceilings.** Closing the open items: nightly live run capped at USD 0.25 (PR and release runs USD 0.50, all runs 120 turns and 250,000 tokens); all Decision #34 defaults accepted; Clerk `azp` allow-list has no Preview origin because development is local first and the owner deploys to Vercel later; if P0-12 shows a higher tokens-per-turn mean, the ceiling is set to 1.2 x the measured mean x 120 turns by a PRD change and logged as an ADR | `EVALS.md` §5.7, `THRESHOLDS.md`, `SPEC.md` §5.9 and WF-01, `PRD.md` §11.5 and §22, `TECHNICAL.md`, `BUILD_LOG.md` | Owner answers on 2026-10-11 | A Preview environment, if created later, needs an exact stable alias origin or an ADR for any pattern |
| ADR-004 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-006 (ceilings), ADR-010 (cuts), ADR-012 and ADR-013 (hours, triggers).** Final gate pass remediation: (A) LLM dialogue is the release default (`DIALOGUE_MODE=llm`, `template` kept as emergency kill-switch and Cut 1a-3), Slice 0 makes one real Gemini Flash call with the golden test in CI replay mode plus a local live smoke; (B) minimal Postgres RLS pulled forward to Tier 1a (P1-01a), Tier 1a 116–148 h, checkpoint hour 148; (C) live-eval ceilings 160 turns, 350,000 tokens, USD 0.60 (nightly USD 0.30); (D) arithmetic fix: stage caps 4.49 s, one revision 7.09 s (7.34 s with overhead), worst case 8.54 s, margin 0.16 s; (E) P0-13 rehearses the Phase B topology while Phase A bundles SymPy in the API | `PRD.md` (v1.3.22), `SPEC.md` (D-29, D-30), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `THRESHOLDS.md`, `EVALS.md`, `CONTEXT.md` | The pre-build gate review found Slice 0 defined two ways, app-layer-only authorisation, a thin eval sample ceiling and a 0.02 s arithmetic error | +6–8 h in Tier 1a. The llm default raises per-turn cost and requires the educator check before Gate B. Template mode is kept as the kill-switch |
| ADR-005 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-010 and ADR-012 (hour checkpoints).** Second gate review fixes: (B-1) Gate A live evidence comes from a local live run (`pytest -m live` and the `eval-live-local` job on the Actions runner) using a repo-local prompt source (`PROMPT_SOURCE=repo`, Tier 1a), with Langfuse prompts from Tier 1b; the MCP, A2A, cache, Langfuse, cold-start and deployed-smoke rows are `not-run` at Gate A; (B-2) the stale "hour-140" in SPEC §5.9 becomes hour-148; the MCP bundle is built with no bytecode shipped and P0-13 records sizes with and without it | `PRD.md`, `SPEC.md` (D-31), `EVALS.md` §1.3, `AGENTS.md` §3.6, `TECHNICAL.md`, `THRESHOLDS.md` | A second independent review found Gate A's live gates had no environment to run in under the llm default, and one missed checkpoint figure. My first grep missed the hyphenated form | A repo-local prompt source means Langfuse prompt management is exercised only from Tier 1b |
| ADR-006 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-012 and ADR-013 (hours, triggers; token rule).** Closing the remaining review items on owner answers: (1) live-run ceilings raised to 200 turns, 450,000 tokens, USD 0.80 for PR and release runs (nightly stays USD 0.30), mean allowance about 2,250 tokens per turn, supersedes the ADR-004 ceilings; the monthly USD 20 ceiling and USD 16 alert are unchanged and the nightly total stays at most USD 9.00; (2) mandatory interim cut triggers at hour 100 (cut 1a-1) and hour 130 (cuts 1a-2 and 1a-3); (3) API bundle sizes are conservative estimates until P0-13 records the measured figure; (4) audit traceability recorded as reconstructed in §4.1, with unmapped IDs flagged | `PRD.md` §14.5, §18.2, Decision #46, `SPEC.md` §5.9, `EVALS.md` §5.7, `THRESHOLDS.md`, `TECHNICAL.md`, `CONTEXT.md` | The second gate review left four items open: the token estimate, an aggressive Tier 1a budget, a bundle size discrepancy and a missing audit report | More spend headroom per live run. P0-12 still measures real tokens per turn, and a measured mean above 2,250 needs a PRD change. The audit IDs C-1, C-2, C-4 and D-1 to D-7 stay unmapped until the original audit is supplied |
| ADR-007 | 2026-10-11 | **Superseded by ADR-015 (audit status: every item is now mapped in §4.1).** The original audit report is unavailable, so audit items C-1, C-2, C-4 and D-1 to D-7 are closed by owner decision as an **accepted risk, unverified against the audit**. Basis: the topic-level fixes of ADR-001 to ADR-006, the reconstructed table in §4.1 and two independent gate reviews that found no remaining contradiction on those topics. The token mean per turn (P0-12), the API and MCP bundle sizes (P0-13) and Tier 1a effort remain **watch-items with pass/fail rules**: a miss needs a PRD change and an ADR, and the hour-100 and hour-130 triggers apply | `BUILD_LOG.md` §4.1 | Owner answers on 2026-10-11. The audit text cannot be produced | The mapping is not independently verified. If the audit surfaces later, any unresolved item is logged in §5 and fixed before Gate A |
| ADR-008 | 2026-10-11 | **Accepted.** Bundle sizes measured (Linux x86_64 wheels, Python 3.12, unpinned latest versions, `--no-compile`): MCP set 83 MB (142 MB if `__pycache__` ships), API set 115 MB without SymPy and 146 MB with it. These replace the earlier estimates of about 80, 140 and 167 MB. The MCP limit of 90 MB leaves only 7 MB (8%) of headroom, so the MCP SDK and driver pins (P0-14) must be size-checked before they are accepted. P0-13 re-measures on the pinned set | `THRESHOLDS.md`, `TECHNICAL.md`, `SPEC.md`, `DESIGN.md`, `CONTEXT.md`, `PRD.md` §15.6 | Owner approved measuring in a throwaway venv outside the repo (deleted afterwards) | A pin that adds more than 7 MB to the MCP set breaks the 90 MB limit and needs the container topology (DD-07) or a smaller driver |
| ADR-009 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-010 (synthetic harness) (token rule superseded by ADR-013).** Phase 0 exit rule: P0-12 records mean tokens per turn on at least 20 live turns, and no Tier 1a work beyond Slice 0 starts until it is recorded. A mean above 2,250 resets the live-run ceiling to 1.2 x the measured mean x 200 turns by a PRD change. The audit items under ADR-007 keep the accepted-risk status (owner answer) | `PRD.md` §18.4 (P0-12), `BUILD_LOG.md` P0-12 | Owner answers on 2026-10-11 | Slice 0 and the provider key are needed before the token figure exists, so Tier 1a stalls if the spike slips |
| ADR-010 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-011, ADR-012 and ADR-014 (D5).** Independent re-review fixes: (D1) P0-12 measures mean tokens per turn on at least 20 turns with a throwaway synthetic three-call harness (Classifier-, Dialogue- and Guard-sized calls), because P2-09 and P2-10 are built after Slice 0. The real Tier 1a figure is re-confirmed at the first live run. The live-run ceiling is always 1.2 x the measured mean x 200 turns by a PRD change (450,000 provisional). No Tier 1a work beyond Slice 0 starts until recorded. (D2) P0-14 depends on P0-12 only and records SDK sizes by a local `pip install --target --no-compile`. P0-13 stays deferred to the first Vercel deployment (before Tier 1b) and re-checks the pins there. No Tier 1a task is blocked by P0-13. (D3) The exact-key cache P1-11 is Tier 1b and leaves P1-14's dependencies. Intra-Tier 1a cuts become 1a-1 defer STU-03 reasoning options and `step_expressions`, 1a-2 defer the advisory classifier P2-10, 1a-3 lock `DIALOGUE_MODE=template` and defer P2-07 (P2-08 and P1-14 depend on "P2-07 or Cut 1a-3"). The hour-100 and hour-130 triggers are kept. Service-to-service authentication is "never cut when present (Tier 1b)". (D4) Phase 0 non-Slice-0 work of about 20–30 h is added as its own ledger line: Tier 1a commitment 116–148 + content about 48 + Phase 0 20–30 = 184–226 h, 212–260 h buffered, about 7.5–9 weeks at 25 h/week. The earlier 164–196 h and 189–225 h figures are superseded. (D5) The educator check (P0-18), the child check and threat model v0 (P0-16) are Gate B items. (D6) Exemplar retrieval is an exact SQL filter, pgvector only for the transfer tie-break and the near-duplicate scan (P2-18). (D7) `fallback_rate` is a model-level ratchet, reported with its value at Gate A. Other edits in the same pass: `PRD.md` v1.3.23, `SPEC.md` D-32, `EVALS.md` environment rows now from Tier 1b, `CONTEXT.md` 83 MB, tier tag legend, session lease and 409 note, tutor p95 clarification | `PRD.md` (v1.3.23), `SPEC.md` (D-32), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md` | A second independent re-review found a Phase 0 token measurement that needed Tier 1a components, a deploy-spike dependency on the version pin ADR, the cache counted as Tier 1a, an hours claim that excluded Phase 0 work, Gate A items that belonged to Gate B and exemplar retrieval described as pgvector | Phase 0 hours are added to the commitment. The buffered top (260 h) exceeds the 240 h envelope, so the hour-100 and hour-130 triggers are mandatory. The synthetic harness figure is an estimate until the first live run |
| ADR-011 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-012 (hours, checkpoint, cuts).** Third independent re-review fixes: (E1) golden test split: P2-14 is the 1a variant (in-process, replay, step 5a empty retrieval, no cache-hit trace item), the 1b variant (exemplar citation and cache-hit) is a Gate B item attached to P2-21 and the Tier 1b tasks. (E2) New task P1-15 Eval harness and CI (Tier 1a, inside the 116–148 h budget, depends on P0-09 and P0-17, dependency of P1-14, P2-13, P2-14). Gate A live sample = 42 critical cases + golden 1a + one pleading persona + a live subset of ≥ 100 LLM-stage turns as synthetic scripted answer variants over approved items. DS-06, five personas and the 150-case set are Tier 2/3. The verifier p95 < 400 ms gate is not-run at Tier 1a and applies at Gate B on MCP. P0-17 now depends on P0-05. (E3) Digit rule exemption (digits allowed if in the stem, the selected authored probe template or the student's verified-correct value, no new computed values) in P2-07, P2-08, SPEC and AGENTS. (E4) "Hour 240" best-effort wording dropped: Tier 1a needs about 7.5–9 weeks (about 10 buffered) at 25 h/week, so the 6–8 week figure is not sufficient, and Tier 1b starts only after Gate A with a re-estimate. (E5) Cuts named: T1b-0 teacher view, T1b-1 `search_exemplars` in-process, T1b-2 defer cache, T1b-4 A2A guard kept as an in-process module behind the same interface. Second-provider deferral leaves the Tier 1b list (Tier 2, P3-10). Later-stage list: late-cut-1 benchmark 150 to 42 critical, late-cut-2 secondary provider evaluation, late-cut-3 retention purge and audit viewer, late-cut-4 coordinator cohort tooling. (E6) Exemplar retrieval is an exact SQL filter, pgvector only for the transfer tie-break and the near-duplicate scan. (E7) Housekeeping: all nine files are modified and uncommitted, §1.5 hashes are the pre-ADR baseline, ADR-001 to ADR-004 status wording, hour-100 note, T1c-01 teacher assigned-cohort read policy. Other edits in the same pass: `PRD.md` v1.3.24, `SPEC.md` D-33, `EVALS.md` and `THRESHOLDS.md` Gate A tier-scoping, digit-rule exemption in `SPEC.md` and `AGENTS.md`, exemplar wording, `CONTEXT.md` fixes | `PRD.md` (v1.3.24), `SPEC.md` (D-33), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md` | A third independent re-review found a golden trajectory that mixed Tier 1a and 1b evidence, Gate A evaluation items with no Tier 1a home, an unnamed cut order, a digit rule that blocked authored probe values and a calendar claim that the hours did not support | Gate A is evaluated on a Tier 1a subset. The calendar is longer than 6–8 weeks (7.5–9, about 10 buffered). No new hours are added: P1-15 is absorbed in the Tier 1a budget |
| ADR-012 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-013 (hours, triggers, checkpoint).** Fourth independent re-review fixes: (F1) P0-17 depends on P0-09 and P0-12 (with P0-05, P0-08, P0-11) and owns a minimal fixture recorder and the replay CI job, so the Slice 0 exit test has an owner before P1-15. Slice 0 uses a thin in-process provider-adapter call that P2-02 later generalises into the full adapter. P0-14 formalises the pins. P1-15 keeps the full harness and extends the recorder. (F2) The 1a golden fixture's recorded classifier output is null or `insufficient_evidence`: no misconception claim, `prompt_type=diagnostic_probe` (P2-14, P2-15). (F3) At a Tier 1a miss only cuts 1a-1 to 1a-3 apply and all Tier 1b and Tier 1c scope is dropped. T1b-0, T1b-1, T1b-2 and T1b-4 apply only while Tier 1b is in progress. Savings: 1a-1 about 8–12 h, 1a-2 about 8–10 h, 1a-3 about 15–20 h. Triggers: hour 100, if P1-01a, P2-06, P2-08 or P1-14's core tasks are not Done, apply 1a-1. Hour 130, if P2-13 and P2-14 are not both Done, apply 1a-2 and 1a-3 together. Final checkpoint hour 160 (was 148). (F4) New task P1-16 CI, security and content checks (`scripts/sync_stories.py --check`, `content-validate.yml`, `pip-audit`, `npm audit`, `gitleaks`, `axe` on the practice screen, Sentry SDK and `before_send` scrubber on web and API), Tier 1a, about 8–12 h, depends on P0-09 and P0-17, dependency of P1-14. `user-story.md`, `scripts/`, `content/` and `blueprint.md` are planned artefacts created by P0-08, P0-11 and P1-16. (F5) Hours: Tier 1a 124–160 h (was 116–148). Tier 1 total 220–290 h. Tier 1a commitment 124–160 + content about 48 + Phase 0 20–30 = 192–238 h, 221–274 h buffered, about 7.7–9.5 weeks at 25 h/week (about 11 buffered). Tier 1a plus 1b 204–270 h. Plus content and Phase 0 272–348 h (313–400 h buffered). Roadmap about 305–400 h. The buffered top exceeds the 240 h envelope, so the triggers are mandatory. (F6) The stale per-phase week claims for Phases 0–2 are removed: about 8–11 weeks at 25 h/week for the Tier 1a commitment. (F7) ADR-009 to ADR-011 status wording. The §1.5 sign-off count matches the table (eight documents). The ≥ 100 LLM-stage Gate A requirement applies unless both Cut 1a-2 and Cut 1a-3 are taken (then Gate A is judged in template mode). Gate A is labelled pedagogy-unvalidated until the Gate B educator check (P0-18). P1-01a RLS hardening: API database role is non-owner without `BYPASSRLS`, `FORCE ROW LEVEL SECURITY`, `SECURITY DEFINER` auth lookup keyed by the Clerk `sub`, then `SET LOCAL`, with `tests/authz` cases | `PRD.md` (v1.3.25), `SPEC.md` (D-34), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md` | A fourth independent re-review (owner decisions F1 to F7, 2026-10-11): the Slice 0 exit test needed an owner before P1-15, CI, security and content checks needed a task, the cut and checkpoint text mixed Tier 1a and Tier 1b cuts, and the hours and week claims no longer matched the scope | Tier 1a grows by 8–12 h to 124–160 h. The Tier 1a commitment is 192–238 h (221–274 h buffered), and the buffered top exceeds the 240 h envelope, so the hour-100 and hour-130 triggers are mandatory. The checkpoint moves from hour 148 to hour 160. A Tier 1a miss drops all Tier 1b and Tier 1c scope |
| ADR-013 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default, live ceilings), ADR-014 (T1b-0, 10 h accounting).** Fifth independent re-review fixes (owner decisions G1 to G8, 2026-10-11): (G1) New Tier 1a task P1-17 Orchestrator and persistence (`run_turn`, TX-A and TX-B persistence, session lease, idempotency, rate counters), about 14–20 h, depends on P1-02, P1-04, P1-08 and P1-01a, dependency of P1-14. The missing P1-02 edges are added to P1-01, P1-09, P2-11 and P2-12. New Tier 1b task P2-22 Gate B CI and release checks (`deploy-prod.yml`, `deployed-services` live job and nightly, `tests/smoke`, `pytest -m release`, Langfuse dataset mirror, golden 1b), a dependency of P2-21. The import-boundary check is owned by P1-16. (G2) Hours: Tier 1a engineering 138–180 h (was 124–160). Tier 1 content package about 58 h (+10 h: FB/EC cases and the scripted-variant generator inside P1-15). Phase 0 20–30 h. Commitment 138–180 + 58 + 20–30 = 216–268 h, 248–308 h buffered, about 8.6–10.7 weeks at 25 h/week (9.9–12.3 buffered). Tier 1 234–310 h. Tier 1a plus 1b 218–290 h. Plus content and Phase 0 296–378 h (340–435 h buffered). Roadmap about 319–420 h. Final checkpoint: Gate A (P2-15) passes by hour 180 (was hour 160, P1-14). "About 8–11 weeks" becomes "about 9–12 weeks at 25 h/week". (G3) Triggers: hour 70, if P1-01a and P2-06 are not both Done, apply Cut 1a-1. Hour 100, if P2-08 and P1-17 are not both Done, apply Cuts 1a-2 and 1a-3 together. These replace the hour-100 and hour-130 triggers. Savings are unchanged (1a-1 about 8–12 h, 1a-2 about 8–10 h, 1a-3 about 15–20 h). A cut frees only the hours not yet spent on its scope. (G4) The golden 1a classifier expectation (null or `insufficient_evidence` gives `diagnostic_probe`) is pinned to the replay fixture. Live mode asserts that `prompt_type` obeys the confidence rule. The ≥ 100 LLM-stage live sample is waived only if Cut 1a-3 is taken. `diagram_leakage` at Gate A is judged on the diagram specs of approved Tier 1a items (DS-09 is Tier 2). Authz at Gate A is 16 cases (9 app-layer, 3 RLS, 4 hardening). P1-01a: the `SECURITY DEFINER` lookup is owned by a dedicated non-login role, `search_path = pg_catalog, public`, `EXECUTE` revoked from `PUBLIC` and granted only to the API role, and every table with student-scoped rows uses `FORCE ROW LEVEL SECURITY`. (G5) Token rule: ceiling 1.2 x measured mean x 200 turns. The provisional 450,000 tokens corresponds to a mean of 1,875 (this supersedes the 2,250 mean allowance in ADR-006 and ADR-009). A measured mean above 1,875 raises the ceiling by a PRD change. P0-12 cap about 6 h including the synthetic three-call harness. The alternate-provider check needs an OpenRouter key, Slice 0 needs only the Gemini key. (G6) Housekeeping: the P2-21 cache-hit item applies only if T1b-2 was not taken. P2-17 note on T1b-4 clarified (guard stays an in-process module, no A2A call). ADR-002, ADR-005, ADR-006, ADR-009 and ADR-012 status wording. (G7) New §5.1 known-issues register KI-1 to KI-6. (G8) Other edits in the same pass: `PRD.md` v1.3.26, `SPEC.md` D-35, and fixes in `EVALS.md`, `THRESHOLDS.md` and `AGENTS.md` | `PRD.md` (v1.3.26), `SPEC.md` (D-35), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md` | A fifth independent re-review found no owner for the turn orchestrator and persistence, Postgres-dependent tasks without a schema dependency, Gate B CI work with no task, an effort estimate and trigger schedule that no longer matched the scope, a token-ceiling formula that did not reconcile with its mean, and unrecorded accepted limitations | +14–20 h orchestrator task and +10 h content. Commitment 216–268 h (248–308 h buffered). The unbuffered top (268 h) exceeds the 240 h envelope, so the hour-70 and hour-100 triggers are mandatory. Checkpoint moves from hour 160 to hour 180. A Tier 1a miss still drops all Tier 1b and Tier 1c scope |
| ADR-014 | 2026-10-11 | **Accepted, partly superseded by ADR-015 (hours, checkpoints, dialogue default).** Full-coverage review fixes (owner decisions D1 to D5 and D8, 2026-10-11). (D1) Tier 1a exemplars: the retrieval gate runs but the exemplar source is an empty stub. The real exact-SQL exemplar query, authoring and `search_exemplars` arrive in Tier 1b (P2-18 owns the SQL filter, P2-16 wraps it). (D2) GitHub Actions `deploy-prod.yml` is the authoritative deploy trigger. Vercel Git auto-deploy is disabled. (D3) The about 10 h FB/EC cases and scripted-variant generator is counted in the about 58 h content package only. P1-15 logs it against content, and it is excluded from the 138–180 h engineering budget and its checkpoints. (D4) Cut T1b-0 (teacher view) is dropped. T1b-0 and T1b-3 are retired names. The remaining Tier 1b cuts are T1b-1, T1b-2 and T1b-4. Rule: Tier 1c does not start unless Gate B has hours to spare. (D5) Threat model v0 (P0-16) is due before Tier 1b starts and gates P2-16 and P2-17. Gate B verifies it exists. The educator check (P0-18) and child check findings are applied before Gate B. (D8) Interim triggers and the hour-180 checkpoint are engineering hours. Item groups in `BUILD_LOG.md`: P1-02 owns all schema migrations and P1-01a applies `FORCE ROW LEVEL SECURITY` through a table registry that the 16-case authz suite enumerates (P1-12 and P2-12 register their tables). P1-09 (validates and routes) and P1-17 (persists) boundary. P2-01 depends on P0-14. P1-16 depends on P1-05, P1-06 and P1-07. P2-16 depends on P2-18. Owners added for the `before_model` prompt-capture test (P1-15), poisoned fixtures (P2-13), authored prompt files (P2-07), the MCP and A2A 401 case (P2-17), the verifier p95 gate on MCP (P2-16) and the deployed nightly live run (P2-22). P0-12 Tier 1a note: the OpenRouter check is off the Slice 0 path, and a mean above 1,875 raises the ceiling by a PRD change. §2.1 gate labels corrected and Gate C added. Other files: `PRD.md` v1.3.27, `SPEC.md` D-36, and the fixes by their owners in `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md` | `PRD.md` (v1.3.27), `SPEC.md` (D-36), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `CONTEXT.md`, `THRESHOLDS.md`, `EVALS.md`, `BUILD_LOG.md` | A full-coverage review of all nine files found a double-counted 10 h, a Gate A task chain that lost P0-14, unowned student tables and Gate A and Gate B requirements with no task, inconsistent timing phrases for the educator check, child check and threat model, a retired-in-practice teacher-view cut, mislabelled gates and an ambiguous deploy trigger | None to hours: the Tier 1a engineering budget (138–180 h), the content package (about 58 h) and the commitment (216–268 h, 248–308 h buffered) are unchanged. Tier 1c starts only if Gate B has hours to spare. Tier 1a exemplar retrieval is an empty stub, so the exemplar path is first exercised in Tier 1b |
| ADR-015 | 2026-10-11 | **Accepted.** Gate review remediation (owner decisions 2026-10-11, NO-GO to GO). (B-1) The audit record supplied by the owner is entered in §4.1 so no item is unmapped (C-1 to C-7, D-1 to D-9); ADR-007 is superseded. The record is the owner's mapping, not the original audit document. (B-2) The single-engineer envelope is locked at 240 h. Tier 1a is the sole commitment: 120 h engineering + 45 h content = 165 h (190 h with the 15% buffer). Phase 0 non-Slice-0 work (20–30 h) is a separate line: with it 185–195 h (213–224 h buffered), at most 240 h. `DIALOGUE_MODE=template` is the shipped default. Cuts 1a-2 and 1a-3 are taken at baseline, so P2-07 and P2-10 are outside Tier 1a (an opt-in `llm` stretch of about 23–30 h plus about 10 h for the scripted-variant generator). `llm` becomes the default only by a PRD change after the early educator check and a Gate B live calibration run (n ≥ 100). Gate A is judged in template mode with fixture-backed adapter replay, and Gate B (Tier 1b) is a stretch built only if hours remain below 240 h. Derived by this ADR: Gate A checkpoint at engineering hour 138 (120 h + 15%), triggers kept at hour 70 (P1-01a and P2-06: Cut 1a-1) and hour 100 (P2-08 and P1-17: Cut 1a-1 if not taken, no work outside the Gate A dependency set), planning sums Tier 1 216–250 h, Tier 1a+1b 200–230 h, roadmap about 301–360 h. (Risks) Langfuse flush is asynchronous after the response, and in the inline fallback the turn deadline and revision gate use 7.2 s (revision only if elapsed ≤ 4.4 s); the digit rule reads "strictly forbidden unless it matches the stem, the selected probe template or the student's verified value" in AGENTS §2.10 and SPEC WF-09 (the two already agreed, only the wording is tightened); live-run ceilings are 250 turns, 500,000 tokens (about 2,000 tokens per turn, rule: measured mean × 250), USD 0.80 (nightly USD 0.30); Next.js 14.x with React 18 is pinned (TECHNICAL §1.1, P0-08) | `PRD.md` (v1.3.28, Decision #52), `SPEC.md` (D-37), `DESIGN.md`, `TECHNICAL.md`, `AGENTS.md`, `THRESHOLDS.md`, `EVALS.md`, `CONTEXT.md`, `BUILD_LOG.md` | Gate review NO-GO: the audit source text was missing, and the commitment (216–268 h) exceeded the 240 h envelope while the shipped default (`llm`) contradicted Cut 1a-3 | Gate A becomes pedagogy-unvalidated template-mode evidence, the model-level ratchets and `fallback_rate` are `not-run` at Gate A, and Tier 1b may not be built. The 165 h figure excludes Phase 0 and the 45 h content figure is below the itemised ~48 h (KI-7). The Next.js 14 end-of-life risk is recorded and given a fail-fast check at P0-08 (KI-8) |

### 4.1 Audit traceability (owner-supplied record, ADR-015)

Source: the audit record entered by the owner on 2026-10-11 (ADR-015). It is the owner's mapping of the pre-build audit, **not a recovered copy of the original audit report**, which is still not in the repository. It replaces the earlier reconstructed table and the accepted-risk status of ADR-007: no item is unmapped. The D-1 to D-7 numbering follows the order of the owner's list, because the owner's text names the drift topics without per-ID numbers. Line numbers are those at the time of ADR-015 and drift as the files are edited, so search the quoted section or decision ID if a line has moved. W-items (W-1 to W-12) are cited in the SPEC decision rows and ADR-001 and are not renumbered here.


| Audit ID | Owner-supplied audit record | Closed in (file:line at ADR-015) | Status |
| --- | --- | --- | --- |
| C-1 | MCP bundle size ≤ 90 MB (resolved: unzipped wheel measurements verified about 83 MB; no ADK, pandas or torch) | SPEC.md:1373; TECHNICAL.md:221; TECHNICAL.md:269; THRESHOLDS.md:115 | Closed |
| C-2 | Multi-project deployment separation (resolved: independent deployment roots for API, MCP and Safety) | TECHNICAL.md:268; TECHNICAL.md:305; SPEC.md:1566 | Closed |
| C-3 | Two-phase FSM contract (resolved: TX-A legality and lease check, TX-B post-pipeline outcome resolution) | SPEC.md:117; SPEC.md:543; DESIGN.md:552 | Closed |
| C-4 | Latency sum omissions (resolved: 15 s client timeout, asynchronous post-response telemetry flush) | SPEC.md:1353; SPEC.md:1357; SPEC.md:1396; DESIGN.md:193 | Closed |
| C-5 | Fallback-rate gate flakiness (resolved: live ratchet with a 95% Wilson interval rule and n ≥ 100) | SPEC.md:1498; SPEC.md:1542; THRESHOLDS.md:202 | Closed |
| C-6 | Token ceiling ambiguity (resolved: ≤ 1,500 prompt and ≤ 250 completion per individual model call, thinking tokens disabled) | SPEC.md:1363; SPEC.md:1364; AGENTS.md:353 | Closed |
| C-7 | Single-engineer delivery capacity (resolved by the ADR-015 envelope: 240 h, Tier 1a 120 h + 45 h = 165 h) | PRD.md:3333; PRD.md:3332; SPEC.md:132 | Closed |
| D-1 | Row lock versus session lease (resolved: a row lock is held only inside TX-A and TX-B, the 12 s lease serialises events) | SPEC.md:109; DESIGN.md:552; AGENTS.md:488 | Closed |
| D-2 | SymPy module import versus MCP hop (resolved: Phase A imports `app.verifier` in process, Phase B reaches SymPy only through MCP) | SPEC.md:1357; TECHNICAL.md:54; TECHNICAL.md:288 | Closed |
| D-3 | Next.js App Router versus Vite (resolved: Next.js App Router, client-rendered, Decision #26; pinned to 14.x by ADR-015) | PRD.md:3688; TECHNICAL.md:56; TECHNICAL.md:26 | Closed |
| D-4 | Clerk `azp` versus `aud` (resolved: `azp` is checked against an exact-origin allow-list, `aud` only with a JWT template) | DESIGN.md:208; TECHNICAL.md:233; TECHNICAL.md:139 | Closed |
| D-5 | Terminal-state rule (resolved: only the `transfer_outcome` back-fill mutates a terminal session, own-table records are permitted) | TECHNICAL.md:386; AGENTS.md:495 | Closed |
| D-6 | `fallback_rate` post-calibration ratchet (resolved: reported until the first n ≥ 100 run, then blocking) | SPEC.md:1498; THRESHOLDS.md:202 | Closed |
| D-7 | Harness-level versus model-level gate semantics (resolved: replay never passes a ratchet, a live run never passes a harness gate) | SPEC.md:1542; EVALS.md:15 | Closed |
| D-8 | `eval-nightly` is a GitHub Actions workflow, not a Vercel Cron route (resolved) | SPEC.md:120; EVALS.md:38 | Closed |
| D-9 | Safety Guard `forbidden_strings` exception (resolved: leakage detection only, never returned, hashed in spans) | SPEC.md:119; AGENTS.md:76 | Closed |

Status of each ADR is one of `Proposed`, `Accepted`, `Accepted, partly superseded by ADR-NNN`, `Superseded by ADR-NNN`. Add the status in the Decision Summary cell.

---

## 5. Issue, Bug & Debugging Incident Register

| Incident ID | Date Detected | Trigger / Symptom | Root Cause | Fix / Resolution | Eval Impact |
| --- | --- | --- | --- | --- | --- |
| INC-001 | | | | | |

Eval Impact names the affected gate or metric from `THRESHOLDS.md` / `EVALS.md` (for example `answer_leakage`, `schema_valid`, `fallback_rate`), or `None`. A leakage event, verifier mismatch or golden-test failure is always recorded here.

### 5.1 Known-issues register (accepted, owner: engineer unless stated)

These are accepted limitations, not incidents. The incident table above stays empty until a real incident occurs.

| ID | Known issue | Owner | Closes when |
| --- | --- | --- | --- |
| KI-1 | **Closed by ADR-015.** The original audit report is still not in the repository, but the owner-supplied record maps every item (§4.1). If the original is found, check it against §4.1 and log any gap as an incident | Engineer | Closed. Reopens only if the original audit contradicts §4.1 |
| KI-2 | Tokens per turn are unmeasured until P0-12. The 500,000-token ceiling (250 turns × about 2,000 tokens) is provisional. Bundle sizes are conservative or unpinned measurements until re-measured | Engineer | P0-12 records the mean tokens per turn. P0-14 and P0-13 record the bundle sizes on the pinned set |
| KI-3 | The 120 h Tier 1a engineering budget is an owner-set planning figure. The task-level estimates in §2.2 (for example P0-17 15–20 h, P1-01a 6–8 h, P1-16 8–12 h, P1-17 14–20 h) were not re-summed against it, and the hour-138 checkpoint, the unchanged hour-70 and hour-100 triggers are derived by ADR-015 | Engineer | Gate A passes with actual hours logged in §2.3. Triggers at hour 70 and hour 100 apply until then, and the first trigger re-checks the figure |
| KI-4 | The independent reviewers did not read in full: PRD §§1–17 and §20, SPEC §3 API schemas, DESIGN diagrams and ER detail, the 150-case taxonomy, the V1–V9 rule definitions, Next.js and React version compatibility, and whether the stage caps are achievable in practice | Engineer | Each area is spot-checked as it is built, and the result is recorded in the §3.2 entry of that task |
| KI-5 | Phase 0 20–30 h includes the Gate B and deferred items (threat model v0, P0-13) | Engineer | The Phase 0 hours are re-split at the Phase 0 exit |
| KI-6 | Vendor behaviour (Vercel, Neon, Clerk, Gemini) is unverified | Engineer | P0-12 and P0-13 record the observed behaviour |
| KI-7 | The 45 h Tier 1a content figure is owner-locked. The itemised estimate in PRD §18.3 is about 48 h before the FB/EC cases, so the figure is about 3 h or more short | Engineer | Absorbed in the 15% buffer (about 25 h). Log actual content hours at each session and review at the hour-70 trigger |
| KI-8 | Next.js 14.x is pinned with React 18 (ADR-015) although Next.js 14 passed end of life on 2025-10-26 and an App Router advisory (CVE-2026-23864) is reported unpatched for 14.x. The P1-16 `npm audit` gate may therefore fail | Engineer | P0-08 runs `npm audit` and the `@clerk/nextjs` and `@sentry/nextjs` peer check on the skeleton in the first session. A high-severity finding with no 14.x fix triggers an ADR to move to the supported Next.js line before P1-07 starts. The gate is not weakened |
